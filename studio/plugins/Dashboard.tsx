import React, {useEffect, useState, useCallback} from 'react'
import {useClient, useCurrentUser} from 'sanity'
import {
  Box, Button, Card, Flex, Heading, Spinner, Stack, Text, Badge, Select, Checkbox, Label, useToast,
} from '@sanity/ui'
import {
  CheckmarkCircleIcon, ErrorOutlineIcon, RestoreIcon, LaunchIcon,
  PublishIcon, RemoveCircleIcon, ClockIcon, DownloadIcon,
} from '@sanity/icons'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Stats {
  total: number
  published: number
  inactive: number
  draft: number
  archived: number
}

interface Product {
  _id: string
  name: string
  status: string
  affiliate_link?: string
  inactive_reason?: string
  inactive_since?: string
  changed_by?: string
  link_checked_at?: string
  marketplace_slug?: string
  marketplace_name?: string
  link_is_search_fallback?: boolean
}

interface MarketplaceOption {
  slug: string
  name: string
}

const INACTIVE_REASONS = [
  {label: 'Broken link', value: 'broken_link'},
  {label: 'Seasonal / no longer available', value: 'seasonal'},
  {label: 'Manually removed', value: 'manual'},
  {label: 'Duplicate', value: 'duplicate'},
  {label: 'Quality issue', value: 'quality'},
  {label: 'Other', value: 'other'},
]

const ARCHIVE_DAYS = 90
const archiveCutoff = () => {
  const d = new Date()
  d.setDate(d.getDate() - ARCHIVE_DAYS)
  return d.toISOString()
}

// ── CSV export ───────────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  '_id', 'name', 'description', 'affiliate_link', 'categories',
  'marketplace_slug', 'country_code', 'image_url', 'featured', 'status',
  'inactive_reason',
]

function toCSVField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadCSV(filename: string, rows: Record<string, string>[]) {
  const lines = [
    CSV_COLUMNS.join(','),
    ...rows.map((row) => CSV_COLUMNS.map((col) => toCSVField(row[col] || '')).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], {type: 'text/csv'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({label, value, tone}: {label: string; value: number; tone?: string}) {
  return (
    <Card padding={4} radius={2} border tone={(tone as any) || 'default'} style={{flex: 1, minWidth: 120}}>
      <Stack space={2}>
        <Text size={3} weight="bold" style={{fontVariantNumeric: 'tabular-nums'}}>{value}</Text>
        <Text muted size={1}>{label}</Text>
      </Stack>
    </Card>
  )
}

function DeactivateModal({
  count, onConfirm, onCancel,
}: {count: number; onConfirm: (reason: string) => void; onCancel: () => void}) {
  const [reason, setReason] = useState('manual')
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <Card padding={5} radius={3} style={{width: 400, maxWidth: '90vw'}}>
        <Stack space={4}>
          <Heading size={1}>Deactivate {count} product{count !== 1 ? 's' : ''}</Heading>
          <Stack space={2}>
            <Label size={1}>Reason (required)</Label>
            <Select value={reason} onChange={(e) => setReason((e.target as HTMLSelectElement).value)}>
              {INACTIVE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </Stack>
          <Text size={1} muted>
            Status will be set to <strong>Inactive</strong> and the reason recorded.
            Products can be re-enabled at any time.
          </Text>
          <Flex gap={2} justify="flex-end">
            <Button text="Cancel" mode="ghost" onClick={onCancel} />
            <Button
              text={`Deactivate ${count}`}
              tone="critical"
              icon={RemoveCircleIcon}
              onClick={() => onConfirm(reason)}
            />
          </Flex>
        </Stack>
      </Card>
    </div>
  )
}

interface PendingChange {
  _id: string
  _type: string
  name: string
  kind: 'created' | 'updated'
}

function PushConfirmModal({
  changes, pushing, siteLabel, onConfirm, onCancel,
}: {changes: PendingChange[]; pushing: boolean; siteLabel: string; onConfirm: () => void; onCancel: () => void}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <Card padding={5} radius={3} style={{width: 440, maxWidth: '90vw'}}>
        <Stack space={4}>
          <Heading size={1}>Push {changes.length} change{changes.length !== 1 ? 's' : ''} to the {siteLabel}</Heading>
          <Text size={1} muted>
            This rebuilds the <strong>{siteLabel}</strong> with the current content. It can take a
            few minutes to go live once triggered.
          </Text>
          <Flex gap={2} justify="flex-end">
            <Button text="Cancel" mode="ghost" onClick={onCancel} disabled={pushing} />
            <Button
              text={pushing ? 'Pushing…' : 'Push to site'}
              tone="positive"
              icon={PublishIcon}
              disabled={pushing}
              onClick={onConfirm}
            />
          </Flex>
        </Stack>
      </Card>
    </div>
  )
}

// ── Review Queue — one focused item at a time, no returning to the table between checks ──

function ReviewQueue({
  items, marketplaceName, onOpenChecked, onMarkBroken, onUseSearch, canUseSearch, onExit,
}: {
  items: Product[]
  marketplaceName: string
  onOpenChecked: (p: Product) => void
  onMarkBroken: (p: Product) => Promise<void>
  onUseSearch: (p: Product) => Promise<void>
  canUseSearch: (p: Product) => boolean
  onExit: () => void
}) {
  const [index, setIndex] = useState(0)
  const [tally, setTally] = useState({kept: 0, broken: 0, searched: 0, skipped: 0})
  const [busy, setBusy] = useState(false)

  const current = items[index]
  const finished = index >= items.length

  function advance(kind: 'kept' | 'broken' | 'searched' | 'skipped') {
    setTally((t) => ({...t, [kind]: t[kind] + 1}))
    setIndex((i) => i + 1)
  }

  async function handleBroken() {
    setBusy(true)
    try {
      await onMarkBroken(current)
      advance('broken')
    } finally {
      setBusy(false)
    }
  }

  async function handleUseSearch() {
    setBusy(true)
    try {
      await onUseSearch(current)
      advance('searched')
    } finally {
      setBusy(false)
    }
  }

  function handleOpen() {
    onOpenChecked(current)
    window.open(current.affiliate_link, '_blank', 'noopener,noreferrer')
  }

  if (items.length === 0) {
    return (
      <Card padding={4} radius={2} border tone="positive">
        <Stack space={3}>
          <Text size={1} weight="semibold">Nothing to review — no published items match this filter.</Text>
          <Button text="Back to list" mode="ghost" onClick={onExit} />
        </Stack>
      </Card>
    )
  }

  if (finished) {
    return (
      <Card padding={5} radius={3} border tone="positive">
        <Stack space={4}>
          <Heading size={1}>Batch complete</Heading>
          <Text size={1}>
            Reviewed {items.length} — {tally.kept} still there, {tally.broken} marked broken
            {tally.searched > 0 ? `, ${tally.searched} switched to search` : ''}
            {tally.skipped > 0 ? `, ${tally.skipped} skipped` : ''}.
          </Text>
          <Button text="Done" tone="positive" onClick={onExit} style={{alignSelf: 'flex-start'}} />
        </Stack>
      </Card>
    )
  }

  return (
    <Card padding={5} radius={3} border tone="primary">
      <Stack space={4}>
        <Flex align="center" justify="space-between" wrap="wrap" gap={2}>
          <Text size={1} muted>Reviewing {marketplaceName} — item {index + 1} of {items.length}</Text>
          <Button text="Exit queue" mode="ghost" fontSize={1} onClick={onExit} />
        </Flex>

        <Stack space={2}>
          <Heading size={2}>{current.name}</Heading>
          <Text size={1} muted>
            Last checked: {current.link_checked_at ? new Date(current.link_checked_at).toLocaleDateString() : 'Never'}
          </Text>
        </Stack>

        <Button
          text="Open & Check →"
          icon={LaunchIcon}
          tone="primary"
          onClick={handleOpen}
          style={{alignSelf: 'flex-start'}}
        />

        <Flex gap={2} wrap="wrap">
          <Button
            text="Still There"
            tone="positive"
            icon={CheckmarkCircleIcon}
            disabled={busy}
            onClick={() => advance('kept')}
          />
          <Button
            text={busy ? 'Marking…' : 'Mark Broken'}
            tone="critical"
            icon={RemoveCircleIcon}
            disabled={busy}
            onClick={handleBroken}
          />
          {canUseSearch(current) && (
            <Button
              text={busy ? 'Switching…' : 'Use Search Instead'}
              mode="ghost"
              tone="caution"
              disabled={busy}
              onClick={handleUseSearch}
            />
          )}
          <Button
            text="Skip"
            mode="ghost"
            disabled={busy}
            onClick={() => advance('skipped')}
          />
        </Flex>

        <Text size={0} muted>{tally.kept} kept · {tally.broken} broken · {tally.skipped} skipped</Text>
      </Stack>
    </Card>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export function DashboardTool() {
  const client = useClient({apiVersion: '2024-01-01'})
  const currentUser = useCurrentUser()
  const toast = useToast()

  const [stats, setStats] = useState<Stats | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('inactive')
  const [filterMarketplace, setFilterMarketplace] = useState<string>('all')
  const [marketplaces, setMarketplaces] = useState<MarketplaceOption[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState(false)
  const [showDeactivate, setShowDeactivate] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [queueActive, setQueueActive] = useState(false)
  const [queueItems, setQueueItems] = useState<Product[]>([])
  const [queueBatchSize, setQueueBatchSize] = useState(15)

  const currentDataset = client.config().dataset
  const siteLabel = currentDataset === 'production' ? 'live production site' : `${currentDataset} preview site`
  const [lastDeployedAt, setLastDeployedAt] = useState<string | null>(null)
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [showPushConfirm, setShowPushConfirm] = useState(false)
  const [pushing, setPushing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setSelected(new Set())
    try {
      const cutoff = archiveCutoff()
      const [total, published, inactive, draft, archived, productList] = await Promise.all([
        client.fetch<number>(`count(*[_type == "product" && !defined(deleted_at)])`),
        client.fetch<number>(`count(*[_type == "product" && status == "published" && !defined(deleted_at)])`),
        client.fetch<number>(`count(*[_type == "product" && status == "inactive" && !defined(deleted_at)])`),
        client.fetch<number>(`count(*[_type == "product" && (status == "draft" || !defined(status)) && !defined(deleted_at)])`),
        client.fetch<number>(`count(*[_type == "product" && status == "inactive" && defined(inactive_since) && inactive_since < "${cutoff}" && !defined(deleted_at)])`),
        client.fetch<Product[]>(`
          *[_type == "product" && !defined(deleted_at)] | order(_createdAt desc) [0...200] {
            _id, name, status, affiliate_link, inactive_reason, inactive_since, changed_by, link_checked_at,
            link_is_search_fallback,
            "marketplace_slug": marketplace->slug.current, "marketplace_name": marketplace->name
          }
        `),
      ])
      setStats({total, published, inactive, draft, archived})
      setProducts(productList)
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {load()}, [load])

  useEffect(() => {
    client
      .fetch<MarketplaceOption[]>(`*[_type == "marketplace"]{"slug": slug.current, name} | order(name asc)`)
      .then(setMarketplaces)
  }, [client])

  // ── Push changes to site ─────────────────────────────────────────────────────
  const loadPendingChanges = useCallback(async () => {
    setPendingLoading(true)
    try {
      const status = await client.fetch<{lastDeployedAt?: string; lastDeployedBy?: string} | null>(
        `*[_type == "deployStatus"][0]{lastDeployedAt, lastDeployedBy}`,
      )
      const since = status?.lastDeployedAt || '1970-01-01T00:00:00Z'
      setLastDeployedAt(status?.lastDeployedAt || null)

      const docs = await client.fetch<{_id: string; _type: string; name: string; _createdAt: string}[]>(
        `*[_type in ["product", "category", "marketplace"] && !defined(deleted_at) &&
           (_createdAt > $since || _updatedAt > $since)] | order(_updatedAt desc) {
          _id, _type, name, _createdAt
        }`,
        {since},
      )
      setPendingChanges(
        docs.map((d) => ({
          _id: d._id,
          _type: d._type,
          name: d.name || d._id,
          kind: d._createdAt > since ? 'created' : 'updated',
        })),
      )
    } finally {
      setPendingLoading(false)
    }
  }, [client])

  useEffect(() => {loadPendingChanges()}, [loadPendingChanges])

  async function pushToSite() {
    setPushing(true)
    try {
      const res = await fetch('/api/deploy', {method: 'POST'})
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Request failed (${res.status})`)
      }
      await client.createOrReplace({
        _id: 'deployStatus',
        _type: 'deployStatus',
        lastDeployedAt: new Date().toISOString(),
        lastDeployedBy: currentUser?.email || 'operator',
      })
      toast.push({status: 'success', title: `Rebuild triggered for the ${siteLabel} — live in a few minutes`})
      setShowPushConfirm(false)
      await loadPendingChanges()
    } catch (err: any) {
      toast.push({status: 'error', title: 'Push failed', description: err?.message || 'Unknown error'})
    } finally {
      setPushing(false)
    }
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  const visibleProducts = products.filter((p) => {
    if (filterMarketplace !== 'all' && p.marketplace_slug !== filterMarketplace) return false
    if (filterStatus === 'all') return true
    if (filterStatus === 'inactive') return p.status === 'inactive'
    if (filterStatus === 'draft') return p.status === 'draft' || !p.status
    if (filterStatus === 'published') return p.status === 'published'
    if (filterStatus === 'archived') {
      const cutoff = archiveCutoff()
      return p.status === 'inactive' && p.inactive_since && p.inactive_since < cutoff
    }
    return true
  })

  // ── Selection ─────────────────────────────────────────────────────────────
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === visibleProducts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(visibleProducts.map((p) => p._id)))
    }
  }

  // ── Audit log write ───────────────────────────────────────────────────────
  async function writeAuditLog(product: Product, newStatus: string, reason?: string) {
    await client.create({
      _type: 'auditLog',
      timestamp: new Date().toISOString(),
      product_ref: {_type: 'reference', _ref: product._id},
      product_name: product.name,
      old_status: product.status || 'draft',
      new_status: newStatus,
      changed_by: currentUser?.email || 'operator',
      reason: reason || '',
    })
  }

  // ── Bulk Publish ──────────────────────────────────────────────────────────
  async function bulkPublish() {
    if (selected.size === 0) return
    setActionBusy(true)
    try {
      const targets = products.filter((p) => selected.has(p._id))
      const changedBy = currentUser?.email || 'operator'
      const now = new Date().toISOString()
      await Promise.all(
        targets.map((p) =>
          client
            .patch(p._id)
            .set({status: 'published', changed_by: changedBy, inactive_since: null, inactive_reason: null})
            .commit(),
        ),
      )
      await Promise.all(targets.map((p) => writeAuditLog(p, 'published')))
      await load()
      loadPendingChanges()
    } finally {
      setActionBusy(false)
    }
  }

  // ── Bulk Deactivate ───────────────────────────────────────────────────────
  async function bulkDeactivate(reason: string) {
    setShowDeactivate(false)
    if (selected.size === 0) return
    setActionBusy(true)
    try {
      const targets = products.filter((p) => selected.has(p._id))
      const changedBy = currentUser?.email || 'operator'
      const now = new Date().toISOString()
      await Promise.all(
        targets.map((p) =>
          client
            .patch(p._id)
            .set({status: 'inactive', inactive_reason: reason, inactive_since: now, changed_by: changedBy})
            .commit(),
        ),
      )
      await Promise.all(targets.map((p) => writeAuditLog(p, 'inactive', reason)))
      await load()
      loadPendingChanges()
    } finally {
      setActionBusy(false)
    }
  }

  // ── Export CSV (always the full catalog, regardless of the filter above) ────
  async function exportCSV() {
    setExporting(true)
    try {
      const docs = await client.fetch<any[]>(`
        *[_type == "product" && !defined(deleted_at)] | order(_createdAt desc) {
          _id, name, description, affiliate_link, featured, status, inactive_reason,
          "categories": categories[]->name,
          "marketplace_slug": marketplace->slug.current,
          "country_code": country->code,
          "media": media[]{"assetUrl": asset->url, url}
        }
      `)
      const rows = docs.map((d) => ({
        _id: d._id,
        name: d.name || '',
        description: d.description || '',
        affiliate_link: d.affiliate_link || '',
        categories: (d.categories || []).join('|'),
        marketplace_slug: d.marketplace_slug || '',
        country_code: d.country_code || '',
        image_url: (d.media || []).map((m: any) => m.assetUrl || m.url).filter(Boolean).join('|'),
        featured: d.featured ? 'true' : 'false',
        status: d.status || 'draft',
        inactive_reason: d.inactive_reason || '',
      }))
      downloadCSV(`findsradar-products-${new Date().toISOString().slice(0, 10)}.csv`, rows)
      toast.push({
        status: 'success',
        title: `Exported ${rows.length} product${rows.length !== 1 ? 's' : ''}`,
      })
    } catch (err: any) {
      toast.push({
        status: 'error',
        title: 'Export failed',
        description: err?.message || 'Unknown error',
      })
    } finally {
      setExporting(false)
    }
  }

  // ── Re-enable single product ───────────────────────────────────────────────
  async function reEnable(product: Product) {
    setActionBusy(true)
    try {
      const changedBy = currentUser?.email || 'operator'
      await client
        .patch(product._id)
        .set({status: 'published', changed_by: changedBy, inactive_since: null, inactive_reason: null, skip_check: true})
        .commit()
      await writeAuditLog(product, 'published')
      await load()
      loadPendingChanges()
    } finally {
      setActionBusy(false)
    }
  }

  // ── Manual link check — records that a human looked at this URL ───────────
  async function markChecked(product: Product) {
    const now = new Date().toISOString()
    try {
      await client.patch(product._id).set({link_checked_at: now}).commit()
      setProducts((prev) => prev.map((p) => (p._id === product._id ? {...p, link_checked_at: now} : p)))
      loadPendingChanges()
    } catch (err: any) {
      toast.push({status: 'error', title: 'Could not record check', description: err?.message || 'Unknown error'})
    }
  }

  // ── One-click broken-link triage — skips the reason picker for speed ──────
  // Updates local state instead of a full reload, so this stays smooth inside the Review Queue.
  async function markBroken(product: Product) {
    setActionBusy(true)
    try {
      const changedBy = currentUser?.email || 'operator'
      const now = new Date().toISOString()
      await client
        .patch(product._id)
        .set({status: 'inactive', inactive_reason: 'broken_link', inactive_since: now, changed_by: changedBy, link_checked_at: now})
        .commit()
      await writeAuditLog(product, 'inactive', 'broken_link')
      setProducts((prev) =>
        prev.map((p) =>
          p._id === product._id
            ? {...p, status: 'inactive', inactive_reason: 'broken_link', inactive_since: now, changed_by: changedBy, link_checked_at: now}
            : p,
        ),
      )
      toast.push({status: 'success', title: `Marked "${product.name}" broken`})
      loadPendingChanges()
    } finally {
      setActionBusy(false)
    }
  }

  // ── Search-link fallback — for marketplaces with thin/fast-turnover inventory,
  // swap a dead exact-product link for a live search instead of retiring the card.
  // Query is derived from the product name (not the original search that found it —
  // that's discarded at capture time now that the bookmarklet trims tracking params).
  function buildSearchUrl(product: Product): string | null {
    const query = encodeURIComponent(product.name)
    if (product.marketplace_slug === 'temu-us') {
      return `https://www.temu.com/search_result.html?search_key=${query}`
    }
    return null
  }

  async function useSearchInstead(product: Product) {
    const searchUrl = buildSearchUrl(product)
    if (!searchUrl) return
    setActionBusy(true)
    try {
      const changedBy = currentUser?.email || 'operator'
      const now = new Date().toISOString()
      // Also re-publishes with cleared inactive fields, so this works the same whether
      // called mid-review (already published, a no-op on those fields) or on a row
      // that's already marked inactive from the table.
      const patch = {
        affiliate_link: searchUrl,
        link_is_search_fallback: true,
        link_checked_at: now,
        status: 'published',
        inactive_reason: null,
        inactive_since: null,
        changed_by: changedBy,
      }
      await client.patch(product._id).set(patch).commit()
      if (product.status === 'inactive') await writeAuditLog(product, 'published')
      setProducts((prev) =>
        prev.map((p) =>
          p._id === product._id
            ? {...p, ...patch, inactive_reason: undefined, inactive_since: undefined}
            : p,
        ),
      )
      toast.push({status: 'success', title: `Switched "${product.name}" to a search link`})
      loadPendingChanges()
    } finally {
      setActionBusy(false)
    }
  }

  // ── Review Queue — batch of published items for the current marketplace filter,
  // oldest-checked (or never-checked) first ─────────────────────────────────
  function startQueue() {
    const candidates = products
      .filter((p) => p.status === 'published' && (filterMarketplace === 'all' || p.marketplace_slug === filterMarketplace))
      .slice()
      .sort((a, b) => (a.link_checked_at || '').localeCompare(b.link_checked_at || ''))
      .slice(0, queueBatchSize)
    setQueueItems(candidates)
    setQueueActive(true)
  }

  if (loading) {
    return <Flex align="center" justify="center" padding={8}><Spinner /></Flex>
  }

  const s = stats!
  const allChecked = visibleProducts.length > 0 && selected.size === visibleProducts.length
  const someChecked = selected.size > 0 && !allChecked

  return (
    <Box padding={5} style={{maxWidth: 1000, margin: '0 auto'}}>
      <Stack space={7}>

        {/* Header */}
        <Flex align="center" gap={3}>
          <Heading size={2}>Site Health Dashboard</Heading>
          <Flex gap={2} style={{marginLeft: 'auto'}}>
            <Button
              text={exporting ? 'Exporting…' : 'Download CSV'}
              icon={DownloadIcon}
              mode="ghost"
              fontSize={1}
              disabled={exporting}
              onClick={exportCSV}
            />
            <Button text="Refresh" mode="ghost" fontSize={1} onClick={load} />
          </Flex>
        </Flex>

        {/* Stats */}
        <Flex gap={3} wrap="wrap">
          <StatCard label="Total"      value={s.total}     tone="default"  />
          <StatCard label="Published"  value={s.published} tone="positive" />
          <StatCard label="Draft"      value={s.draft}     tone="default"  />
          <StatCard label="Inactive"   value={s.inactive}  tone={s.inactive > 0 ? 'caution' : 'default'} />
          <StatCard label={`Archived (${ARCHIVE_DAYS}d+)`} value={s.archived} tone={s.archived > 0 ? 'critical' : 'default'} />
        </Flex>

        {/* Push changes to site */}
        <Card padding={4} radius={2} border tone={pendingChanges.length > 0 ? 'primary' : 'default'}>
          <Stack space={3}>
            <Flex align="center" gap={3} wrap="wrap">
              <Heading size={1}>Push changes to {siteLabel}</Heading>
              <Button
                text={pendingChanges.length > 0 ? `Push ${pendingChanges.length} change${pendingChanges.length !== 1 ? 's' : ''} to site` : 'Push to site'}
                icon={PublishIcon}
                tone="positive"
                fontSize={1}
                disabled={pendingLoading || pendingChanges.length === 0}
                onClick={() => setShowPushConfirm(true)}
                style={{marginLeft: 'auto'}}
              />
            </Flex>
            <Text size={1} muted>
              {lastDeployedAt
                ? `Last pushed ${new Date(lastDeployedAt).toLocaleString()}`
                : 'Never pushed from this panel yet.'}
            </Text>
            {pendingLoading ? (
              <Flex align="center" gap={2}><Spinner /><Text size={1} muted>Checking for changes…</Text></Flex>
            ) : pendingChanges.length === 0 ? (
              <Text size={1} muted>No changes since the last push.</Text>
            ) : (
              <Stack space={1}>
                {pendingChanges.map((c) => (
                  <Flex key={c._id} align="center" gap={2}>
                    <Badge tone={c.kind === 'created' ? 'positive' : 'primary'} fontSize={0} mode="outline">
                      {c.kind}
                    </Badge>
                    <Text size={1} muted style={{fontFamily: 'monospace', fontSize: 11}}>{c._type}</Text>
                    <Text size={1}>{c.name}</Text>
                  </Flex>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>

        {/* Bulk Actions Panel */}
        <Stack space={3}>
          <Flex align="center" gap={3} wrap="wrap">
            <Heading size={1}>Products</Heading>
            <Box style={{width: 180}}>
              <Select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus((e.target as HTMLSelectElement).value)
                  setSelected(new Set())
                }}
              >
                <option value="inactive">⛔ Inactive ({s.inactive})</option>
                <option value="draft">📝 Draft ({s.draft})</option>
                <option value="published">✅ Published ({s.published})</option>
                <option value="archived">🗃 Archived ({s.archived})</option>
                <option value="all">All ({s.total})</option>
              </Select>
            </Box>

            <Box style={{width: 180}}>
              <Select
                value={filterMarketplace}
                onChange={(e) => {
                  setFilterMarketplace((e.target as HTMLSelectElement).value)
                  setSelected(new Set())
                }}
              >
                <option value="all">All marketplaces</option>
                {marketplaces.map((m) => (
                  <option key={m.slug} value={m.slug}>{m.name}</option>
                ))}
              </Select>
            </Box>

            <Box style={{width: 110}}>
              <Select
                value={queueBatchSize}
                onChange={(e) => setQueueBatchSize(Number((e.target as HTMLSelectElement).value))}
              >
                <option value={10}>10 items</option>
                <option value={15}>15 items</option>
                <option value={20}>20 items</option>
              </Select>
            </Box>
            <Button
              text="Start URL Check Queue"
              icon={LaunchIcon}
              tone="primary"
              mode="ghost"
              fontSize={1}
              onClick={startQueue}
            />

            {/* Action buttons — show when items selected */}
            {selected.size > 0 && (
              <Flex gap={2} style={{marginLeft: 'auto'}}>
                <Text size={1} muted style={{alignSelf: 'center'}}>{selected.size} selected</Text>
                <Button
                  text={actionBusy ? 'Working…' : `Publish ${selected.size}`}
                  icon={PublishIcon}
                  tone="positive"
                  mode="default"
                  disabled={actionBusy}
                  onClick={bulkPublish}
                  fontSize={1}
                />
                <Button
                  text={`Deactivate ${selected.size}`}
                  icon={RemoveCircleIcon}
                  tone="critical"
                  mode="ghost"
                  disabled={actionBusy}
                  onClick={() => setShowDeactivate(true)}
                  fontSize={1}
                />
              </Flex>
            )}
          </Flex>

          {/* Review Queue replaces the table while active */}
          {queueActive ? (
            <ReviewQueue
              items={queueItems}
              marketplaceName={filterMarketplace === 'all' ? 'all marketplaces' : (marketplaces.find((m) => m.slug === filterMarketplace)?.name || filterMarketplace)}
              onOpenChecked={markChecked}
              onMarkBroken={markBroken}
              onUseSearch={useSearchInstead}
              canUseSearch={(p) => buildSearchUrl(p) !== null}
              onExit={() => setQueueActive(false)}
            />
          ) : (
          <>
          {/* Product table */}
          {visibleProducts.length === 0 ? (
            <Card padding={4} border radius={2} tone="positive">
              <Flex align="center" gap={2}>
                <CheckmarkCircleIcon />
                <Text size={1}>No products in this view.</Text>
              </Flex>
            </Card>
          ) : (
            <Card border radius={2} style={{overflow: 'hidden'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13}}>
                <thead>
                  <tr style={{background: 'var(--card-muted-bg-color)'}}>
                    <th style={{padding: '10px 14px', width: 32}}>
                      <Checkbox
                        checked={allChecked}
                        indeterminate={someChecked}
                        onChange={toggleAll}
                      />
                    </th>
                    {['Product', 'Reason / Changed by', filterStatus !== 'published' ? 'Since' : 'Checked', 'Actions'].map((h) => (
                      <th key={h} style={{
                        padding: '10px 14px', textAlign: 'left', fontWeight: 600,
                        color: 'var(--card-fg-color)',
                        borderBottom: '1px solid var(--card-border-color)',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((p, i) => (
                    <tr key={p._id} style={{
                      borderBottom: i < visibleProducts.length - 1 ? '1px solid var(--card-border-color)' : undefined,
                      background: selected.has(p._id) ? 'var(--card-muted-bg-color)' : undefined,
                    }}>
                      <td style={{padding: '10px 14px'}}>
                        <Checkbox
                          checked={selected.has(p._id)}
                          onChange={() => toggleOne(p._id)}
                        />
                      </td>
                      <td style={{padding: '10px 14px', maxWidth: 240}}>
                        <Flex align="center" gap={2} wrap="wrap">
                          <Text size={1} weight="semibold">{p.name}</Text>
                          {p.link_is_search_fallback && (
                            <Badge tone="caution" fontSize={0} mode="outline">
                              🔍 Search link — find a replacement
                            </Badge>
                          )}
                        </Flex>
                      </td>
                      <td style={{padding: '10px 14px', color: 'var(--card-muted-fg-color)', maxWidth: 200}}>
                        <Text size={1} muted style={{fontFamily: 'monospace', fontSize: 11}}>
                          {p.inactive_reason || p.changed_by || '—'}
                        </Text>
                      </td>
                      <td style={{padding: '10px 14px', whiteSpace: 'nowrap'}}>
                        <Text size={1} muted>
                          {(p.inactive_since || p.link_checked_at)
                            ? new Date(p.inactive_since || p.link_checked_at || '').toLocaleDateString('en-GB', {
                                day: 'numeric', month: 'short', year: 'numeric',
                              })
                            : '—'}
                        </Text>
                      </td>
                      <td style={{padding: '10px 14px', whiteSpace: 'nowrap'}}>
                        <Flex gap={2}>
                          {p.status === 'inactive' && (
                            <Button
                              text={actionBusy ? '…' : 'Re-enable'}
                              icon={RestoreIcon}
                              tone="positive"
                              mode="ghost"
                              fontSize={1}
                              disabled={actionBusy}
                              onClick={() => reEnable(p)}
                            />
                          )}
                          {p.status === 'inactive' && buildSearchUrl(p) && (
                            <Button
                              text={actionBusy ? '…' : 'Use Search Instead'}
                              mode="ghost"
                              tone="caution"
                              fontSize={1}
                              disabled={actionBusy}
                              onClick={() => useSearchInstead(p)}
                            />
                          )}
                          {p.affiliate_link && (
                            <Button
                              as="a"
                              href={p.affiliate_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              text="Check URL"
                              icon={LaunchIcon}
                              mode="ghost"
                              tone="default"
                              fontSize={1}
                              onClick={() => markChecked(p)}
                            />
                          )}
                          {p.status !== 'inactive' && (
                            <Button
                              text={actionBusy ? '…' : 'Mark Broken'}
                              icon={RemoveCircleIcon}
                              tone="critical"
                              mode="ghost"
                              fontSize={1}
                              disabled={actionBusy}
                              onClick={() => markBroken(p)}
                            />
                          )}
                        </Flex>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {visibleProducts.length > 0 && (
            <Text size={1} muted>
              Showing {visibleProducts.length} products.
              {filterStatus === 'archived' && ` Archived = inactive for ${ARCHIVE_DAYS}+ days.`}
            </Text>
          )}
          </>
          )}
        </Stack>

      </Stack>

      {/* Deactivate reason modal */}
      {showDeactivate && (
        <DeactivateModal
          count={selected.size}
          onConfirm={bulkDeactivate}
          onCancel={() => setShowDeactivate(false)}
        />
      )}

      {/* Push-to-site confirmation modal */}
      {showPushConfirm && (
        <PushConfirmModal
          changes={pendingChanges}
          pushing={pushing}
          siteLabel={siteLabel}
          onConfirm={pushToSite}
          onCancel={() => setShowPushConfirm(false)}
        />
      )}
    </Box>
  )
}
