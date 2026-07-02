import React, {useState} from 'react'
import {useDocumentOperation} from 'sanity'
import {Box, Button, Card, Flex, Spinner, Stack, Text, TextInput} from '@sanity/ui'
import {SearchIcon} from '@sanity/icons'

interface Fetched {
  name: string | null
  description: string | null
  price: string | null
  imageUrl: string | null
}

async function fetchMeta(url: string): Promise<Fetched> {
  // Direct browser fetch — works for most sites; Amazon and a few others block CORS.
  const res = await fetch(url, {mode: 'cors'})
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  const extract = (patterns: RegExp[]): string | null => {
    for (const re of patterns) {
      const m = html.match(re)
      if (m?.[1]) return m[1].trim().replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    }
    return null
  }

  return {
    name: extract([
      /property=["']og:title["']\s+content=["']([^"']+)["']/,
      /content=["']([^"']+)["']\s+property=["']og:title["']/,
      /<title[^>]*>([^<]+)<\/title>/,
    ]),
    description: extract([
      /property=["']og:description["']\s+content=["']([^"']+)["']/,
      /content=["']([^"']+)["']\s+property=["']og:description["']/,
      /name=["']description["']\s+content=["']([^"']+)["']/,
    ]),
    price: extract([
      /"price"\s*:\s*"([0-9.,]+)"/,
      /itemprop=["']price["']\s+content=["']([^"']+)["']/,
      /content=["']([^"']+)["']\s+itemprop=["']price["']/,
    ]),
    imageUrl: extract([
      /property=["']og:image["']\s+content=["']([^"']+)["']/,
      /content=["']([^"']+)["']\s+property=["']og:image["']/,
    ]),
  }
}

type DialogState = 'closed' | 'askUrl' | 'loading' | 'preview' | 'error'

export function FetchProductDetailsAction(props: any) {
  const {patch} = useDocumentOperation(props.id, props.type)
  // Document actions read from draft first, fall back to published
  const doc = props.draft || props.published || {}
  const affiliateLink = doc.affiliate_link as string | undefined
  const currentMedia = doc.media as any[] | undefined

  const [dialogState, setDialogState] = useState<DialogState>('closed')
  const [url, setUrl] = useState('')
  const [fetched, setFetched] = useState<Fetched | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  function open() {
    const target = affiliateLink?.trim()
    if (target) {
      setUrl(target)
      doFetch(target)
    } else {
      setUrl('')
      setDialogState('askUrl')
    }
  }

  function close() {
    setDialogState('closed')
    setFetched(null)
    setErrorMsg('')
  }

  async function doFetch(target: string) {
    setDialogState('loading')
    try {
      const data = await fetchMeta(target)
      setFetched(data)
      setDialogState('preview')
    } catch (e: any) {
      const isCors = e.message?.toLowerCase().includes('cors') || e.message?.toLowerCase().includes('fetch')
      setErrorMsg(
        isCors
          ? 'This site blocks browser requests (common for Amazon). Paste the product details manually, or try a direct product page URL from another marketplace.'
          : `Could not fetch: ${e.message}`,
      )
      setDialogState('error')
    }
  }

  function applyFetch() {
    if (!fetched) return
    const patches: Record<string, any> = {}
    if (fetched.name) patches.name = fetched.name
    if (fetched.description) patches.description = fetched.description
    if (fetched.price) patches.price = fetched.price.startsWith('$') ? fetched.price : `$${fetched.price}`
    if (!affiliateLink && url) patches.affiliate_link = url

    // Only set media if the product has no images yet
    if (fetched.imageUrl && (!currentMedia || currentMedia.length === 0)) {
      patches.media = [{
        _type: 'mediaItem',
        _key: `img-${Date.now()}`,
        url: fetched.imageUrl,
        type: 'image',
      }]
    }

    patch.execute([{set: patches}])
    close()
  }

  // ── Dialog content ──────────────────────────────────────────────────────────

  let dialog: any

  if (dialogState === 'askUrl') {
    dialog = {
      type: 'dialog',
      id: 'fetch-url',
      header: 'Fetch product details from URL',
      onClose: close,
      content: (
        <Box padding={4}>
          <Stack space={4}>
            <Text size={1} muted>
              Paste the product page URL. Works for most sites — Amazon may block browser requests.
            </Text>
            <TextInput
              value={url}
              onChange={(e) => setUrl((e.target as HTMLInputElement).value)}
              placeholder="https://www.example.com/product/..."
              onKeyDown={(e: React.KeyboardEvent) => {if (e.key === 'Enter' && url) doFetch(url)}}
              autoFocus
            />
            <Flex gap={2} justify="flex-end">
              <Button text="Cancel" mode="ghost" onClick={close} />
              <Button text="Fetch" tone="primary" disabled={!url.trim()} onClick={() => doFetch(url.trim())} />
            </Flex>
          </Stack>
        </Box>
      ),
    }
  }

  if (dialogState === 'loading') {
    dialog = {
      type: 'dialog',
      id: 'fetch-url',
      header: 'Fetching…',
      onClose: close,
      content: (
        <Box padding={6}>
          <Flex justify="center" align="center">
            <Spinner />
          </Flex>
        </Box>
      ),
    }
  }

  if (dialogState === 'error') {
    dialog = {
      type: 'dialog',
      id: 'fetch-url',
      header: 'Could not fetch',
      onClose: close,
      content: (
        <Box padding={4}>
          <Stack space={4}>
            <Card tone="critical" padding={3} radius={2} border>
              <Text size={1}>{errorMsg}</Text>
            </Card>
            <Flex justify="flex-end">
              <Button text="Close" mode="ghost" onClick={close} />
            </Flex>
          </Stack>
        </Box>
      ),
    }
  }

  if (dialogState === 'preview' && fetched) {
    const hasData = fetched.name || fetched.description || fetched.price || fetched.imageUrl
    dialog = {
      type: 'dialog',
      id: 'fetch-url',
      header: 'Review before applying',
      onClose: close,
      content: (
        <Box padding={4}>
          <Stack space={4}>
            {!hasData ? (
              <Card tone="caution" padding={3} radius={2} border>
                <Text size={1}>Nothing useful found on that page. Fill in the fields manually.</Text>
              </Card>
            ) : (
              <>
                {fetched.name && (
                  <Stack space={1}>
                    <Text size={0} weight="semibold" muted>NAME</Text>
                    <Text size={1}>{fetched.name}</Text>
                  </Stack>
                )}
                {fetched.description && (
                  <Stack space={1}>
                    <Text size={0} weight="semibold" muted>DESCRIPTION</Text>
                    <Text size={1}>{fetched.description.slice(0, 300)}{fetched.description.length > 300 ? '…' : ''}</Text>
                  </Stack>
                )}
                {fetched.price && (
                  <Stack space={1}>
                    <Text size={0} weight="semibold" muted>PRICE</Text>
                    <Text size={1}>${fetched.price}</Text>
                  </Stack>
                )}
                {fetched.imageUrl && (
                  <Stack space={1}>
                    <Text size={0} weight="semibold" muted>IMAGE URL {currentMedia && currentMedia.length > 0 ? '(skipped — product already has images)' : ''}</Text>
                    <Text size={1} style={{wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 11}}>
                      {fetched.imageUrl}
                    </Text>
                  </Stack>
                )}
                <Card tone="caution" padding={3} radius={2} border>
                  <Text size={1} muted>
                    These values will overwrite any you've already typed. Review and edit them in the form after applying.
                  </Text>
                </Card>
              </>
            )}
            <Flex gap={2} justify="flex-end">
              <Button text="Cancel" mode="ghost" onClick={close} />
              {hasData && <Button text="Apply to form" tone="primary" onClick={applyFetch} />}
            </Flex>
          </Stack>
        </Box>
      ),
    }
  }

  return {
    label: affiliateLink ? 'Fetch from URL' : 'Fetch from URL…',
    icon: SearchIcon,
    onHandle: open,
    dialog,
  }
}
