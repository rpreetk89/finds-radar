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
    .filter((row) => row.name)
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ── Template CSV ──────────────────────────────────────────────────────────────

const TEMPLATE_CSV = `name,description,price,affiliate_link,categories,marketplace_slug,country_code,image_url,featured,published
"Handheld Steamer","Compact travel iron for clothes","$19.99","https://example.com/buy","Home|Travel","amazon-us","us","https://example.com/img1.jpg|https://example.com/img2.jpg",false,true
"Wireless Earbuds","Noise-cancelling buds","$49.99","https://example.com/buy2","Technology","temu-us","us","https://example.com/image2.jpg",false,true`

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
  {key: 'name', label: 'Name', required: true},
  {key: 'description', label: 'Description', required: false},
  {key: 'price', label: 'Price', required: false},
  {key: 'affiliate_link', label: 'Affiliate Link', required: false},
  {key: 'categories', label: 'Categories (pipe-separated)', required: false},
  {key: 'marketplace_slug', label: 'Marketplace Slug', required: false},
  {key: 'country_code', label: 'Country Code', required: false},
  {key: 'image_url', label: 'Image URLs — separate multiple with | (e.g. url1|url2)', required: false},
  {key: 'featured', label: 'Featured (true/false)', required: false},
  {key: 'published', label: 'Published (true/false)', required: false},
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportRow {
  name: string
  description?: string
  price?: string
  affiliate_link?: string
  categories?: string
  marketplace_slug?: string
  country_code?: string
  image_url?: string
  featured?: string
  published?: string
}

interface RowResult {
  name: string
  status: 'ok' | 'error'
  message?: string
}

// ── Main component ────────────────────────────────────────────────────────────

export function BulkImportTool() {
  const client = useClient({apiVersion: '2024-01-01'})

  const [csvText, setCsvText] = useState('')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [parsed, setParsed] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<RowResult[]>([])
  const [progress, setProgress] = useState<{done: number; total: number} | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Parse ──────────────────────────────────────────────────────────────────

  function handleParse() {
    const parsed = parseCSV(csvText) as unknown as ImportRow[]
    setRows(parsed)
    setParsed(true)
    setResults([])
    setProgress(null)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
      const parsed = parseCSV(text) as unknown as ImportRow[]
      setRows(parsed)
      setParsed(true)
      setResults([])
      setProgress(null)
    }
    reader.readAsText(file)
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  async function handleImport() {
    setImporting(true)
    setProgress({done: 0, total: rows.length})
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

    const rowResults: RowResult[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        // Resolve categories (create if missing)
        const catNames = (row.categories || '')
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
        const catRefs = []
        for (const catName of catNames) {
          const key = catName.toLowerCase().trim()
          if (!catByName[key]) {
            const newCat = await client.create({_type: 'category', name: catName})
            catByName[key] = newCat._id
          }
          catRefs.push({_type: 'reference', _ref: catByName[key], _key: uid()})
        }

        // Resolve marketplace
        const mpSlug = (row.marketplace_slug || '').toLowerCase().trim()
        const mpId = mpBySlug[mpSlug]

        // Resolve country
        const countryCode = (row.country_code || '').toLowerCase().trim()
        const countryId = countryByCode[countryCode]

        // Build media array
        const imageUrls = (row.image_url || '')
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
        const media = imageUrls.map((url) => ({
          _type: 'mediaItem',
          _key: uid(),
          url,
          type: 'image',
        }))

        // Create product
        await client.create({
          _type: 'product',
          name: row.name,
          description: row.description || '',
          price: row.price || '',
          affiliate_link: row.affiliate_link || '',
          featured: row.featured === 'true',
          published: row.published !== 'false',
          ...(mpId ? {marketplace: {_type: 'reference', _ref: mpId}} : {}),
          ...(countryId ? {country: {_type: 'reference', _ref: countryId}} : {}),
          categories: catRefs,
          media,
        })

        rowResults.push({name: row.name, status: 'ok'})
      } catch (err: any) {
        rowResults.push({name: row.name, status: 'error', message: err?.message || 'Unknown error'})
      }

      setProgress({done: i + 1, total: rows.length})
    }

    setResults(rowResults)
    setImporting(false)
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  function handleReset() {
    setCsvText('')
    setRows([])
    setParsed(false)
    setResults([])
    setProgress(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const okCount = results.filter((r) => r.status === 'ok').length
  const errCount = results.filter((r) => r.status === 'error').length

  return (
    <Box padding={5} style={{maxWidth: 960, margin: '0 auto'}}>
      <Stack space={5}>

        {/* Header */}
        <Stack space={2}>
          <Heading size={2}>Bulk Import Products</Heading>
          <Text muted size={1}>
            Import multiple products at once via CSV. References (marketplace, country, categories)
            are resolved by slug/code/name. New categories are created automatically.
          </Text>
        </Stack>

        {/* Column reference card */}
        <Card padding={4} radius={2} tone="primary" border>
          <Stack space={3}>
            <Text size={1} weight="semibold">Required CSV columns</Text>
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
                  text={`Parse ${csvText.trim() ? '& preview' : ''}`}
                  icon={DocumentsIcon}
                  onClick={handleParse}
                  disabled={!csvText.trim()}
                  tone="primary"
                />
                <Text muted size={1}>or</Text>
                <Button
                  text="Upload .csv file"
                  mode="ghost"
                  onClick={() => fileRef.current?.click()}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{display: 'none'}}
                  onChange={handleFileUpload}
                />
              </Flex>
            </Stack>
          </Card>
        )}

        {/* Preview table */}
        {parsed && rows.length > 0 && results.length === 0 && (
          <Card padding={4} radius={2} border>
            <Stack space={3}>
              <Flex align="center" justify="space-between">
                <Text size={1} weight="semibold">{rows.length} products ready to import</Text>
                <Button text="Back / edit" mode="ghost" onClick={handleReset} fontSize={1} />
              </Flex>

              <Box style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12}}>
                  <thead>
                    <tr>
                      {['#', 'Name', 'Categories', 'Marketplace', 'Country', 'Featured', 'Published'].map((h) => (
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
                    {rows.map((row, i) => (
                      <tr key={i} style={{borderBottom: '1px solid var(--card-border-color)'}}>
                        <td style={{padding: '6px 10px', color: 'var(--card-muted-fg-color)'}}>{i + 1}</td>
                        <td style={{padding: '6px 10px', fontWeight: 500, color: 'var(--card-fg-color)'}}>{row.name}</td>
                        <td style={{padding: '6px 10px', color: 'var(--card-fg-color)'}}>{row.categories || '—'}</td>
                        <td style={{padding: '6px 10px', color: 'var(--card-fg-color)', fontFamily: 'monospace'}}>{row.marketplace_slug || '—'}</td>
                        <td style={{padding: '6px 10px', color: 'var(--card-fg-color)', fontFamily: 'monospace'}}>{row.country_code || '—'}</td>
                        <td style={{padding: '6px 10px', color: 'var(--card-fg-color)'}}>{row.featured === 'true' ? '✓' : '—'}</td>
                        <td style={{padding: '6px 10px', color: 'var(--card-fg-color)'}}>{row.published === 'false' ? 'Draft' : 'Published'}</td>
                      </tr>
                    ))}
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
                    text={importing ? 'Importing…' : `Import ${rows.length} products →`}
                    icon={UploadIcon}
                    onClick={handleImport}
                    disabled={importing}
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
                Importing… {progress.done} / {progress.total} products
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
                  Import complete — {okCount} succeeded, {errCount} failed
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
                              {r.status === 'ok' ? 'Imported' : 'Failed'}
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
        {parsed && rows.length === 0 && (
          <Card padding={4} radius={2} border tone="caution">
            <Stack space={2}>
              <Text size={1} weight="semibold">No valid rows found</Text>
              <Text muted size={1}>Check your CSV has a header row and at least one data row with a "name" column.</Text>
              <Button text="Try again" mode="ghost" onClick={handleReset} />
            </Stack>
          </Card>
        )}

      </Stack>
    </Box>
  )
}
