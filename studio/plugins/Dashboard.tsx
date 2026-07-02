import React, {useEffect, useState, useCallback} from 'react'
import {useClient, useCurrentUser} from 'sanity'
import {
  Box, Button, Card, Flex, Heading, Spinner, Stack, Text, Badge, Select, Checkbox, Label,
} from '@sanity/ui'
import {
  CheckmarkCircleIcon, ErrorOutlineIcon, RestoreIcon, LaunchIcon,
  PublishIcon, RemoveCircleIcon, ClockIcon,
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

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export function DashboardTool() {
  const client = useClient({apiVersion: '2024-01-01'})
  const currentUser = useCurrentUser()

  const [stats, setStats] = useState<Stats | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('inactive')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState(false)
  const [showDeactivate, setShowDeactivate] = useState(false)

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
            _id, name, status, affiliate_link, inactive_reason, inactive_since, changed_by, link_checked_at
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

  // ── Filtering ─────────────────────────────────────────────────────────────
  const visibleProducts = products.filter((p) => {
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
    } finally {
      setActionBusy(false)
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
    } finally {
      setActionBusy(false)
    }
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
          <Button text="Refresh" mode="ghost" fontSize={1} onClick={load} style={{marginLeft: 'auto'}} />
        </Flex>

        {/* Stats */}
        <Flex gap={3} wrap="wrap">
          <StatCard label="Total"      value={s.total}     tone="default"  />
          <StatCard label="Published"  value={s.published} tone="positive" />
          <StatCard label="Draft"      value={s.draft}     tone="default"  />
          <StatCard label="Inactive"   value={s.inactive}  tone={s.inactive > 0 ? 'caution' : 'default'} />
          <StatCard label={`Archived (${ARCHIVE_DAYS}d+)`} value={s.archived} tone={s.archived > 0 ? 'critical' : 'default'} />
        </Flex>

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
                        <Text size={1} weight="semibold">{p.name}</Text>
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
    </Box>
  )
}
