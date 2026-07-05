import React, {useState, useRef} from 'react'
import {useClient} from 'sanity'
import {Box, Button, Card, Stack, Text, Spinner, Badge, Flex, Heading} from '@sanity/ui'
import {UploadIcon, DocumentsIcon, CheckmarkCircleIcon, ErrorOutlineIcon} from '@sanity/icons'

// ── CSV helpers ────────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += c
    }
  }
  result.push(current)
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase())
  return lines
    .slice(1)
    .map((line) => {
      const values = parseCSVLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, i) => {
        row[h] = (values[i] || '').trim()
      })
      return row
    })
    .filter((row) => row.name || row._id)
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ── Template CSV ──────────────────────────────────────────────────────────────

const TEMPLATE_CSV = `name,description,affiliate_link,categories,marketplace_slug,country_code,image_url,featured,status
"Handheld Steamer","Compact travel iron for clothes","https://example.com/buy","Home|Travel","amazon-us","us","https://example.com/img1.jpg|https://example.com/img2.jpg",false,published
"Wireless Earbuds","Noise-cancelling buds","https://example.com/buy2","Technology","temu-us","us","https://example.com/image2.jpg",false,draft`

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], {type: 'text/csv'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'findsradar-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Column reference ──────────────────────────────────────────────────────────

const COLUMNS = [
  {key: '_id', label: 'Document ID — only for updating an existing product (leave blank to create new)', required: false},
  {key: 'name', label: 'Name', required: true},
  {key: 'description', label: 'Description', required: false},
  {key: 'affiliate_link', label: 'Affiliate Link', required: false},
  {key: 'categories', label: 'Categories (pipe-separated)', required: false},
  {key: 'marketplace_slug', label: 'Marketplace Slug', required: false},
  {key: 'country_code', label: 'Country Code', required: false},
  {key: 'image_url', label: 'Image URLs — separate multiple with | (e.g. url1|url2)', required: false},
  {key: 'featured', label: 'Featured (true/false)', required: false},
  {key: 'status', label: 'Status — draft / published / inactive', required: false},
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportRow {
  _id?: string
  name: string
  description?: string
  affiliate_link?: string
  categories?: string
  marketplace_slug?: string
  country_code?: string
  image_url?: string
  featured?: string
  status?: string
  published?: string // legacy column, still honored if `status` is blank
}

interface CurrentDoc {
  _id: string
  name?: string
  description?: string
  affiliate_link?: string
  featured?: boolean
  status?: string
  categories?: string[]
  marketplace_slug?: string
  country_code?: string
  image_url?: string[]
}

interface Change {
  label: string
  from: string
  to: string
}

interface PreviewRow {
  row: ImportRow
  mode: 'create' | 'update' | 'not-found'
  changes: Change[]
}

interface RowResult {
  name: string
  status: 'ok' | 'error'
  message?: string
}

function resolvedStatus(row: ImportRow): string {
  if (row.status) return row.status.toLowerCase().trim()
  if (row.published) return row.published === 'false' ? 'draft' : 'published'
  return 'published'
}

function normCategories(names: string[] | undefined): string {
  return (names || []).map((n) => n.toLowerCase().trim()).filter(Boolean).sort().join('|')
}

function csvCategories(value: string | undefined): string {
  return normCategories((value || '').split('|').map((s) => s.trim()))
}

// ── Diffing ───────────────────────────────────────────────────────────────────

function computeChanges(row: ImportRow, current: CurrentDoc): Change[] {
  const changes: Change[] = []

  function check(label: string, csvValue: string | undefined, currentValue: string) {
    if (csvValue === undefined || csvValue === '') return // blank = no change
    if (csvValue.trim() === (currentValue || '').trim()) return
    changes.push({label, from: currentValue || '—', to: csvValue})
  }

  check('Name', row.name, current.name || '')
  check('Description', row.description, current.description || '')
  check('Affiliate Link', row.affiliate_link, current.affiliate_link || '')
  check('Marketplace', row.marketplace_slug, current.marketplace_slug || '')
  check('Country', row.country_code, current.country_code || '')

  if (row.categories !== undefined && row.categories !== '') {
    const csvNorm = csvCategories(row.categories)
    const curNorm = normCategories(current.categories)
    if (csvNorm !== curNorm) {
      changes.push({label: 'Categories', from: (current.categories || []).join(', ') || '—', to: row.categories})
    }
  }

  if (row.image_url !== undefined && row.image_url !== '') {
    const csvUrls = row.image_url.split('|').map((s) => s.trim()).filter(Boolean).join('|')
    const curUrls = (current.image_url || []).join('|')
    if (csvUrls !== curUrls) {
      changes.push({label: 'Images', from: `${(current.image_url || []).length} image(s)`, to: `${csvUrls.split('|').filter(Boolean).length} image(s)`})
    }
  }

  if (row.featured !== undefined && row.featured !== '') {
    const csvFeatured = row.featured === 'true'
    if (csvFeatured !== Boolean(current.featured)) {
      changes.push({label: 'Featured', from: current.featured ? 'true' : 'false', to: csvFeatured ? 'true' : 'false'})
    }
  }

  const csvStatus = row.status || row.published ? resolvedStatus(row) : undefined
  if (csvStatus !== undefined && csvStatus !== (current.status || '')) {
    changes.push({label: 'Status', from: current.status || '—', to: csvStatus})
  }

  return changes
}

// ── Main component ────────────────────────────────────────────────────────────

export function BulkImportTool() {
  const client = useClient({apiVersion: '2024-01-01'})

  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [parsed, setParsed] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<RowResult[]>([])
  const [progress, setProgress] = useState<{done: number; total: number} | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Parse + analyze (build create/update preview with diffs) ───────────────

  async function analyze(text: string) {
    setAnalyzing(true)
    try {
      const rows = parseCSV(text) as unknown as ImportRow[]
      const ids = rows.map((r) => r._id).filter((v): v is string => Boolean(v))

      let currentById: Record<string, CurrentDoc> = {}
      if (ids.length > 0) {
        const docs = await client.fetch<any[]>(
          `*[_id in $ids]{
            _id, name, description, affiliate_link, featured, status,
            "categories": categories[]->name,
            "marketplace_slug": marketplace->slug.current,
            "country_code": country->code,
            "media": media[]{"assetUrl": asset->url, url}
          }`,
          {ids},
        )
        currentById = Object.fromEntries(
          docs.map((d) => [
            d._id,
            {
              ...d,
              image_url: (d.media || []).map((m: any) => m.assetUrl || m.url).filter(Boolean),
            } as CurrentDoc,
          ]),
        )
      }

      const built: PreviewRow[] = rows.map((row) => {
        if (!row._id) {
          return {row, mode: 'create', changes: []}
        }
        const current = currentById[row._id]
        if (!current) {
          return {row, mode: 'not-found', changes: []}
        }
        return {row, mode: 'update', changes: computeChanges(row, current)}
      })

      setPreview(built)
      setParsed(true)
      setResults([])
      setProgress(null)
    } finally {
      setAnalyzing(false)
    }
  }

  function handleParse() {
    analyze(csvText)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
      analyze(text)
    }
    reader.readAsText(file)
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  async function handleImport() {
    setImporting(true)
    const importable = preview.filter((p) => p.mode !== 'not-found')
    setProgress({done: 0, total: importable.length})
    setResults([])

    // Fetch all reference docs once
    const [marketplaces, categories, countries] = await Promise.all([
      client.fetch<{_id: string; slug: string; name: string}[]>(
        `*[_type == "marketplace"]{_id, "slug": slug.current, name}`,
      ),
      client.fetch<{_id: string; name: string}[]>(`*[_type == "category"]{_id, name}`),
      client.fetch<{_id: string; code: string}[]>(`*[_type == "country"]{_id, code}`),
    ])

    const mpBySlug: Record<string, string> = {}
    marketplaces.forEach((m) => {
      mpBySlug[m.slug] = m._id
    })

    const catByName: Record<string, string> = {}
    categories.forEach((c) => {
      catByName[c.name.toLowerCase().trim()] = c._id
    })

    const countryByCode: Record<string, string> = {}
    countries.forEach((c) => {
      countryByCode[c.code.toLowerCase()] = c._id
    })

    async function resolveCategoryRefs(value: string | undefined) {
      const catNames = (value || '').split('|').map((s) => s.trim()).filter(Boolean)
      const catRefs = []
      for (const catName of catNames) {
        const key = catName.toLowerCase().trim()
        if (!catByName[key]) {
          const newCat = await client.create({_type: 'category', name: catName})
          catByName[key] = newCat._id
        }
        catRefs.push({_type: 'reference', _ref: catByName[key], _key: uid()})
      }
      return catRefs
    }

    function resolveMedia(value: string | undefined) {
      return (value || '')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((url) => ({_type: 'mediaItem', _key: uid(), url}))
    }

    const rowResults: RowResult[] = []
    let done = 0

    for (const item of importable) {
      const row = item.row
      try {
        if (item.mode === 'create') {
          const catRefs = await resolveCategoryRefs(row.categories)
          const mpId = mpBySlug[(row.marketplace_slug || '').toLowerCase().trim()]
          const countryId = countryByCode[(row.country_code || '').toLowerCase().trim()]

          await client.create({
            _type: 'product',
            name: row.name,
            description: row.description || '',
            affiliate_link: row.affiliate_link || '',
            featured: row.featured === 'true',
            status: resolvedStatus(row),
            ...(mpId ? {marketplace: {_type: 'reference', _ref: mpId}} : {}),
            ...(countryId ? {country: {_type: 'reference', _ref: countryId}} : {}),
            categories: catRefs,
            media: resolveMedia(row.image_url),
          })
        } else {
          // update — only patch fields that were flagged as changed
          const patch: Record<string, any> = {}
          const changedLabels = new Set(item.changes.map((c) => c.label))

          if (changedLabels.has('Name')) patch.name = row.name
          if (changedLabels.has('Description')) patch.description = row.description
          if (changedLabels.has('Affiliate Link')) patch.affiliate_link = row.affiliate_link
          if (changedLabels.has('Featured')) patch.featured = row.featured === 'true'
          if (changedLabels.has('Status')) patch.status = resolvedStatus(row)
          if (changedLabels.has('Categories')) patch.categories = await resolveCategoryRefs(row.categories)
          if (changedLabels.has('Images')) patch.media = resolveMedia(row.image_url)
          if (changedLabels.has('Marketplace')) {
            const mpId = mpBySlug[(row.marketplace_slug || '').toLowerCase().trim()]
            if (mpId) patch.marketplace = {_type: 'reference', _ref: mpId}
          }
          if (changedLabels.has('Country')) {
            const countryId = countryByCode[(row.country_code || '').toLowerCase().trim()]
            if (countryId) patch.country = {_type: 'reference', _ref: countryId}
          }

          if (Object.keys(patch).length > 0) {
            await client.patch(row._id as string).set(patch).commit()
          }
        }

        rowResults.push({name: row.name || row._id || '(unknown)', status: 'ok'})
      } catch (err: any) {
        rowResults.push({name: row.name || row._id || '(unknown)', status: 'error', message: err?.message || 'Unknown error'})
      }

      done += 1
      setProgress({done, total: importable.length})
    }

    setResults(rowResults)
    setImporting(false)
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  function handleReset() {
    setCsvText('')
    setPreview([])
    setParsed(false)
    setResults([])
    setProgress(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const okCount = results.filter((r) => r.status === 'ok').length
  const errCount = results.filter((r) => r.status === 'error').length
  const notFoundCount = preview.filter((p) => p.mode === 'not-found').length
  const createCount = preview.filter((p) => p.mode === 'create').length
  const updateCount = preview.filter((p) => p.mode === 'update').length

  return (
    <Box padding={5} style={{maxWidth: 960, margin: '0 auto'}}>
      <Stack space={5}>

        {/* Header */}
        <Stack space={2}>
          <Heading size={2}>Bulk Import / Update Products</Heading>
          <Text muted size={1}>
            Import new products or bulk-update existing ones via CSV. Include a product's <code>_id</code> column
            (e.g. from Dashboard → Download CSV) to update it in place — leave <code>_id</code> blank to create a
            new product. References (marketplace, country, categories) are resolved by slug/code/name; new
            categories are created automatically. Blank cells are always treated as "no change" on updates.
          </Text>
        </Stack>

        {/* Column reference card */}
        <Card padding={4} radius={2} tone="primary" border>
          <Stack space={3}>
            <Text size={1} weight="semibold">CSV columns</Text>
            <Box style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px'}}>
              {COLUMNS.map((col) => (
                <Flex key={col.key} align="center" gap={2}>
                  <Badge tone={col.required ? 'critical' : 'default'} mode="outline" fontSize={0}>
                    {col.required ? 'required' : 'optional'}
                  </Badge>
                  <Text size={1} style={{fontFamily: 'monospace'}}>{col.key}</Text>
                  <Text muted size={0}>— {col.label}</Text>
                </Flex>
              ))}
            </Box>
            <Button
              text="Download template CSV"
              mode="ghost"
              icon={UploadIcon}
              onClick={downloadTemplate}
              tone="primary"
              fontSize={1}
              style={{alignSelf: 'flex-start'}}
            />
          </Stack>
        </Card>

        {/* Input area */}
        {!parsed && (
          <Card padding={4} radius={2} border>
            <Stack space={3}>
              <Text size={1} weight="semibold">Paste CSV or upload a file</Text>

              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={TEMPLATE_CSV}
                rows={10}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  padding: '10px',
                  border: '1px solid var(--card-border-color)',
                  borderRadius: 4,
                  background: 'var(--card-bg-color)',
                  color: 'var(--card-fg-color)',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />

              <Flex gap={2} align="center">
                <Button
                  text={analyzing ? 'Analyzing…' : `Parse ${csvText.trim() ? '& preview' : ''}`}
                  icon={DocumentsIcon}
                  onClick={handleParse}
                  disabled={!csvText.trim() || analyzing}
                  tone="primary"
                />
                <Text muted size={1}>or</Text>
                <Button
                  text="Upload .csv file"
                  mode="ghost"
                  onClick={() => fileRef.current?.click()}
                  disabled={analyzing}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{display: 'none'}}
                  onChange={handleFileUpload}
                />
                {analyzing && <Spinner />}
              </Flex>
            </Stack>
          </Card>
        )}

        {/* Preview table */}
        {parsed && preview.length > 0 && results.length === 0 && (
          <Card padding={4} radius={2} border>
            <Stack space={3}>
              <Flex align="center" justify="space-between" wrap="wrap" gap={2}>
                <Text size={1} weight="semibold">
                  {createCount > 0 && `${createCount} to create`}
                  {createCount > 0 && updateCount > 0 && ' · '}
                  {updateCount > 0 && `${updateCount} to update`}
                  {notFoundCount > 0 && ` · ${notFoundCount} with unknown _id (will be skipped)`}
                </Text>
                <Button text="Back / edit" mode="ghost" onClick={handleReset} fontSize={1} />
              </Flex>

              <Box style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12}}>
                  <thead>
                    <tr>
                      {['#', 'Image', 'Name', 'Action', 'Changes'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '6px 10px',
                            textAlign: 'left',
                            borderBottom: '1px solid var(--card-border-color)',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            color: 'var(--card-fg-color)',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((item, i) => {
                      const row = item.row
                      const firstImage = (row.image_url || '').split('|').map((s) => s.trim()).filter(Boolean)[0]
                      const imageCount = (row.image_url || '').split('|').map((s) => s.trim()).filter(Boolean).length
                      return (
                        <tr key={i} style={{borderBottom: '1px solid var(--card-border-color)'}}>
                          <td style={{padding: '6px 10px', color: 'var(--card-muted-fg-color)'}}>{i + 1}</td>
                          <td style={{padding: '6px 10px'}}>
                            {firstImage ? (
                              <Box style={{position: 'relative', width: 48, height: 48}}>
                                <img
                                  src={firstImage}
                                  alt=""
                                  style={{width: 48, height: 48, objectFit: 'cover', borderRadius: 4, display: 'block'}}
                                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2' }}
                                />
                                {imageCount > 1 && (
                                  <Badge tone="primary" fontSize={0} style={{position: 'absolute', bottom: -4, right: -4}}>
                                    {imageCount}
                                  </Badge>
                                )}
                              </Box>
                            ) : (
                              <Text muted size={0}>none</Text>
                            )}
                          </td>
                          <td style={{padding: '6px 10px', fontWeight: 500, color: 'var(--card-fg-color)'}}>
                            {row.name || <Text muted size={0} style={{fontFamily: 'monospace'}}>{row._id}</Text>}
                          </td>
                          <td style={{padding: '6px 10px'}}>
                            {item.mode === 'create' && <Badge tone="positive" fontSize={0}>Create</Badge>}
                            {item.mode === 'update' && <Badge tone="primary" fontSize={0}>Update</Badge>}
                            {item.mode === 'not-found' && <Badge tone="critical" fontSize={0}>Unknown _id</Badge>}
                          </td>
                          <td style={{padding: '6px 10px', color: 'var(--card-fg-color)'}}>
                            {item.mode === 'create' && <Text muted size={0}>New record</Text>}
                            {item.mode === 'not-found' && (
                              <Text size={0} style={{color: 'var(--card-fg-color)'}}>
                                No product found with this _id — will be skipped
                              </Text>
                            )}
                            {item.mode === 'update' && item.changes.length === 0 && (
                              <Text muted size={0}>No changes</Text>
                            )}
                            {item.mode === 'update' && item.changes.length > 0 && (
                              <Stack space={1}>
                                {item.changes.map((c, ci) => (
                                  <Text key={ci} size={0} style={{fontFamily: 'monospace'}}>
                                    {c.label}: <span style={{opacity: 0.6}}>{c.from}</span> → {c.to}
                                  </Text>
                                ))}
                              </Stack>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Box>

              {progress && (
                <Flex align="center" gap={3}>
                  <Spinner />
                  <Text size={1}>Importing {progress.done} / {progress.total}…</Text>
                </Flex>
              )}

              {!importing && (
                <Flex gap={2}>
                  <Button
                    text={importing ? 'Importing…' : `Apply ${createCount + updateCount} change${createCount + updateCount !== 1 ? 's' : ''} →`}
                    icon={UploadIcon}
                    onClick={handleImport}
                    disabled={importing || createCount + updateCount === 0}
                    tone="positive"
                  />
                  <Button text="Cancel" mode="ghost" onClick={handleReset} disabled={importing} />
                </Flex>
              )}
            </Stack>
          </Card>
        )}

        {/* Progress during import */}
        {importing && progress && (
          <Card padding={4} radius={2} border tone="primary">
            <Flex align="center" gap={3}>
              <Spinner />
              <Text size={1}>
                Applying… {progress.done} / {progress.total} products
              </Text>
            </Flex>
          </Card>
        )}

        {/* Results */}
        {results.length > 0 && (
          <Card padding={4} radius={2} border tone={errCount > 0 ? 'caution' : 'positive'}>
            <Stack space={3}>
              <Flex align="center" gap={3}>
                {errCount === 0
                  ? <CheckmarkCircleIcon style={{color: 'var(--card-fg-color)'}} />
                  : <ErrorOutlineIcon style={{color: 'var(--card-fg-color)'}} />
                }
                <Text size={1} weight="semibold">
                  Done — {okCount} succeeded, {errCount} failed
                </Text>
              </Flex>

              {errCount > 0 && (
                <Box style={{overflowX: 'auto'}}>
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12}}>
                    <thead>
                      <tr>
                        {['Product', 'Status', 'Error'].map((h) => (
                          <th key={h} style={{padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--card-border-color)', fontWeight: 600, color: 'var(--card-fg-color)'}}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={i} style={{borderBottom: '1px solid var(--card-border-color)'}}>
                          <td style={{padding: '6px 10px', color: 'var(--card-fg-color)'}}>{r.name}</td>
                          <td style={{padding: '6px 10px'}}>
                            <Badge tone={r.status === 'ok' ? 'positive' : 'critical'} fontSize={0}>
                              {r.status === 'ok' ? 'Applied' : 'Failed'}
                            </Badge>
                          </td>
                          <td style={{padding: '6px 10px', color: 'var(--card-muted-fg-color)', fontFamily: 'monospace', fontSize: 11}}>
                            {r.message || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              )}

              <Button text="Import another batch" mode="ghost" onClick={handleReset} />
            </Stack>
          </Card>
        )}

        {/* Parsed but no rows */}
        {parsed && preview.length === 0 && (
          <Card padding={4} radius={2} border tone="caution">
            <Stack space={2}>
              <Text size={1} weight="semibold">No valid rows found</Text>
              <Text muted size={1}>Check your CSV has a header row and at least one data row with a "name" or "_id" column.</Text>
              <Button text="Try again" mode="ghost" onClick={handleReset} />
            </Stack>
          </Card>
        )}

      </Stack>
    </Box>
  )
}
