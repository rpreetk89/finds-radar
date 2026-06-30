import React, {useEffect, useState, useCallback} from 'react'
import {useClient} from 'sanity'
import {Box, Button, Card, Flex, Heading, Spinner, Stack, Text, Badge} from '@sanity/ui'
import {CheckmarkCircleIcon, ErrorOutlineIcon, RestoreIcon, LaunchIcon} from '@sanity/icons'

interface Stats {
  total: number
  published: number
  autoUnpublished: number
  skipCheck: number
  unchecked: number
  broken: number
}

interface AutoUnpublishedProduct {
  _id: string
  name: string
  affiliate_link?: string
  unpublish_reason?: string
  link_checked_at?: string
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({label, value, tone}: {label: string; value: number; tone?: 'default' | 'positive' | 'critical' | 'caution'}) {
  return (
    <Card padding={4} radius={2} border tone={tone || 'default'} style={{flex: 1, minWidth: 120}}>
      <Stack space={2}>
        <Text size={3} weight="bold" style={{fontVariantNumeric: 'tabular-nums'}}>{value}</Text>
        <Text muted size={1}>{label}</Text>
      </Stack>
    </Card>
  )
}

// ── Main dashboard ─────────────────────────────────────────────────────────────

export function DashboardTool() {
  const client = useClient({apiVersion: '2024-01-01'})
  const [stats, setStats] = useState<Stats | null>(null)
  const [autoUnpublished, setAutoUnpublished] = useState<AutoUnpublishedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [reenabling, setReenabling] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [total, published, autoUnpub, skipCheck, unchecked, broken, autoUnpubList] =
        await Promise.all([
          client.fetch<number>(`count(*[_type == "product"])`),
          client.fetch<number>(`count(*[_type == "product" && published != false && auto_unpublished != true])`),
          client.fetch<number>(`count(*[_type == "product" && auto_unpublished == true])`),
          client.fetch<number>(`count(*[_type == "product" && skip_check == true])`),
          client.fetch<number>(`count(*[_type == "product" && !defined(link_checked_at) && published != false])`),
          client.fetch<number>(`count(*[_type == "product" && link_status == "broken"])`),
          client.fetch<AutoUnpublishedProduct[]>(
            `*[_type == "product" && auto_unpublished == true] | order(link_checked_at desc) {
              _id, name, affiliate_link, unpublish_reason, link_checked_at
            }`,
          ),
        ])
      setStats({total, published, autoUnpublished: autoUnpub, skipCheck, unchecked, broken})
      setAutoUnpublished(autoUnpubList)
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => { load() }, [load])

  async function reEnable(id: string) {
    setReenabling((prev) => ({...prev, [id]: true}))
    try {
      await client
        .patch(id)
        .set({published: true, auto_unpublished: false, skip_check: true, link_status: 'ok'})
        .commit()
      await load()
    } finally {
      setReenabling((prev) => ({...prev, [id]: false}))
    }
  }

  if (loading) {
    return (
      <Flex align="center" justify="center" padding={8}>
        <Spinner />
      </Flex>
    )
  }

  const s = stats!

  return (
    <Box padding={5} style={{maxWidth: 960, margin: '0 auto'}}>
      <Stack space={6}>

        {/* Header */}
        <Stack space={2}>
          <Heading size={2}>Site Health Dashboard</Heading>
          <Text muted size={1}>Live counts from the current dataset. Re-enabled products are marked "skip check" so they won't be auto-unpublished again.</Text>
        </Stack>

        {/* Stats row */}
        <Flex gap={3} wrap="wrap">
          <StatCard label="Total products"     value={s.total}           tone="default"  />
          <StatCard label="Live on site"        value={s.published}       tone="positive" />
          <StatCard label="Auto-unpublished"    value={s.autoUnpublished} tone={s.autoUnpublished > 0 ? 'critical' : 'default'} />
          <StatCard label="Never checked"       value={s.unchecked}       tone={s.unchecked > 0 ? 'caution' : 'default'} />
          <StatCard label="Skip check (manual)" value={s.skipCheck}       tone="default"  />
        </Flex>

        {/* Auto-unpublished table */}
        {autoUnpublished.length === 0 ? (
          <Card padding={5} radius={2} border tone="positive">
            <Flex align="center" gap={3}>
              <CheckmarkCircleIcon style={{color: 'currentColor'}} />
              <Text size={1}>No auto-unpublished products — everything looks healthy.</Text>
            </Flex>
          </Card>
        ) : (
          <Stack space={3}>
            <Flex align="center" gap={2}>
              <ErrorOutlineIcon />
              <Text size={1} weight="semibold">
                {autoUnpublished.length} product{autoUnpublished.length !== 1 ? 's' : ''} auto-unpublished
              </Text>
              <Button text="Refresh" mode="ghost" onClick={load} fontSize={1} style={{marginLeft: 'auto'}} />
            </Flex>

            <Card border radius={2} style={{overflow: 'hidden'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13}}>
                <thead>
                  <tr style={{background: 'var(--card-muted-bg-color)'}}>
                    {['Product', 'Reason detected', 'Checked at', 'Actions'].map((h) => (
                      <th key={h} style={{
                        padding: '10px 14px', textAlign: 'left',
                        fontWeight: 600, color: 'var(--card-fg-color)',
                        borderBottom: '1px solid var(--card-border-color)',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {autoUnpublished.map((p, i) => (
                    <tr key={p._id} style={{
                      borderBottom: i < autoUnpublished.length - 1 ? '1px solid var(--card-border-color)' : undefined,
                    }}>
                      <td style={{padding: '10px 14px', fontWeight: 500, color: 'var(--card-fg-color)', maxWidth: 220}}>
                        <Text size={1} style={{fontWeight: 600}}>{p.name}</Text>
                      </td>
                      <td style={{padding: '10px 14px', color: 'var(--card-muted-fg-color)', maxWidth: 280}}>
                        <Text size={1} muted style={{fontFamily: 'monospace', fontSize: 11}}>
                          {p.unpublish_reason || '—'}
                        </Text>
                      </td>
                      <td style={{padding: '10px 14px', whiteSpace: 'nowrap'}}>
                        <Text size={1} muted>
                          {p.link_checked_at
                            ? new Date(p.link_checked_at).toLocaleDateString('en-GB', {
                                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                              })
                            : '—'}
                        </Text>
                      </td>
                      <td style={{padding: '10px 14px', whiteSpace: 'nowrap'}}>
                        <Flex gap={2}>
                          <Button
                            text={reenabling[p._id] ? 'Re-enabling…' : 'Re-enable'}
                            icon={RestoreIcon}
                            tone="positive"
                            mode="ghost"
                            fontSize={1}
                            onClick={() => reEnable(p._id)}
                            disabled={!!reenabling[p._id]}
                          />
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

            <Card padding={3} radius={2} tone="caution" border>
              <Text size={1} muted>
                <strong>Re-enable</strong> sets the product live again and marks it "skip check" so it won't be auto-unpublished on future runs.
                To re-enroll it in checks later, open the product in the editor and disable "Skip automated checks".
              </Text>
            </Card>
          </Stack>
        )}

      </Stack>
    </Box>
  )
}
