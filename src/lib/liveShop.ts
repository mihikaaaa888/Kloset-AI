import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, apiUrl } from '@/lib/apiUrl'
import type { DiscoverQuery, WebProduct } from '@/lib/discoverFeed'
import type { ClothingItem, PieceSnapshot } from '@/types'

// Kloset's shopping is live: every product comes from a live search
// (/api/discover-feed, Exa-backed), never from a fixed list. This is the one
// way screens fetch them.

/** A live product with the search that found it (its category, traits and reason). */
export type LiveProduct = WebProduct & { search: DiscoverQuery }
export type LiveStatus = 'ok' | 'error' | 'no-key' | 'no-brand-site'

interface FeedResponse { items?: WebProduct[]; noKey?: boolean; brandNotFound?: boolean; error?: string }

// Two screens asking for the same searches at once share one request.
const inflight = new Map<string, Promise<{ items: LiveProduct[]; status: LiveStatus }>>()

export function fetchLiveProducts(queries: DiscoverQuery[], options: { brand?: string | null } = {}): Promise<{ items: LiveProduct[]; status: LiveStatus }> {
  const brand = options.brand ?? null
  const key = `${brand ?? ''}|${queries.map((q) => q.text).join('|')}`
  const existing = inflight.get(key)
  if (existing) return existing
  const request = (async () => {
    try {
      const res = await apiFetch(apiUrl('/api/discover-feed'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: queries.map((q) => q.text), ...(brand ? { brand } : {}) }),
      })
      const data = await res.json().catch(() => ({})) as FeedResponse
      if (data.noKey) return { items: [], status: 'no-key' as const }
      if (data.brandNotFound) return { items: [], status: 'no-brand-site' as const }
      if (!res.ok) return { items: [], status: 'error' as const }
      const byText = new Map(queries.map((q) => [q.text, q]))
      const items = (data.items ?? []).map((item) => {
        const search = byText.get(item.query) ?? queries[0]
        return { ...item, category: search.category, search }
      })
      return { items, status: 'ok' as const }
    } catch (error) {
      console.warn('[liveShop] live search failed', error)
      return { items: [], status: 'error' as const }
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, request)
  return request
}

/**
 * Live products for a screen. `queriesFor(page)` builds the searches; page 0
 * loads when `enabled`, loadMore() fetches the next page. Searches again only
 * when the search words change, not on every re-render of profile or wardrobe.
 */
export function useLiveProducts(queriesFor: (page: number) => DiscoverQuery[], options: { enabled?: boolean; brand?: string | null } = {}) {
  const { enabled = true, brand = null } = options
  const [items, setItems] = useState<LiveProduct[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<LiveStatus>('ok')
  const requestId = useRef(0)
  const queriesRef = useRef(queriesFor)
  queriesRef.current = queriesFor
  const signature = `${brand ?? ''}|${queriesFor(0).map((q) => q.text).join('|')}`

  const load = useCallback(async (nextPage: number, replace: boolean) => {
    const id = ++requestId.current
    const queries = queriesRef.current(nextPage)
    if (!queries.length) { setItems([]); return }
    setLoading(true)
    const result = await fetchLiveProducts(queries, { brand })
    if (id !== requestId.current) return
    setStatus(result.status)
    if (result.status === 'ok') {
      setItems((current) => {
        const seen = new Set(replace ? [] : current.map((item) => item.id))
        return [...(replace ? [] : current), ...result.items.filter((item) => !seen.has(item.id))]
      })
      setPage(nextPage)
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on signature
  }, [signature])

  useEffect(() => {
    if (!enabled) return
    setItems([])
    void load(0, true)
  }, [load, enabled])

  return {
    items,
    loading,
    status,
    loadMore: () => load(page + 1, false),
    retry: () => load(page, items.length === 0),
  }
}

/** "₹1,999", "Rs. 1,499", "$45.00", "€99" → amount and currency; null when there's no price. */
export function parsePrice(price: string | null | undefined): { amount: number; currency: string } | null {
  const match = String(price ?? '').match(/(₹|Rs\.?|INR|\$|£|€)\s?([\d,]+(?:\.\d{1,2})?)/)
  if (!match) return null
  const amount = Number(match[2].replace(/,/g, ''))
  if (!Number.isFinite(amount)) return null
  const currency = match[1].startsWith('R') || match[1] === 'INR' ? '₹' : match[1]
  return { amount, currency }
}

/** What an outfit keeps of a live product: its photo, name, category and the colour it was searched in. */
export function liveToSnapshot(product: LiveProduct): PieceSnapshot {
  return {
    source: 'shop',
    name: product.title,
    category: product.search.category,
    imageUrl: product.imageUrl,
    colour: product.search.traits.colours ?? [],
  }
}

/** A live product shaped like a wardrobe item, for pickers that show items. Id is the product URL. */
export function liveToItem(product: LiveProduct): ClothingItem {
  return {
    id: product.id,
    name: product.title,
    category: product.search.category,
    subcategory: product.search.traits.subcategory,
    imageUrl: product.imageUrl,
    imageSource: 'remote',
    colour: product.search.traits.colours ?? [],
    pattern: 'solid',
    seasons: [],
    occasions: [],
    isFavourite: false,
    timesWorn: 0,
    createdAt: '',
    updatedAt: '',
  }
}
