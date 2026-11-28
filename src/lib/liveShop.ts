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

// ─── Remembered results ───────────────────────────────────────────────────────
// The last good results for each search are kept on the device, so a failed
// search (Exa down, out of credits, rate limited, offline) shows what was there
// before instead of an error. Only the most recent searches are kept.
const REMEMBER_PREFIX = 'kloset:live:v1:'
const REMEMBER_INDEX = 'kloset:live:v1:index'
const REMEMBER_MAX = 40

// Results fetched ahead for the next visit are shown instantly while this fresh.
const INSTANT_MAX_AGE_MS = 24 * 60 * 60 * 1000

function rememberResults(key: string, items: LiveProduct[]) {
  try {
    localStorage.setItem(REMEMBER_PREFIX + key, JSON.stringify({ at: Date.now(), items: items.slice(0, 48) }))
    const index = (JSON.parse(localStorage.getItem(REMEMBER_INDEX) ?? '[]') as string[]).filter((entry) => entry !== key)
    index.push(key)
    for (const old of index.splice(0, Math.max(0, index.length - REMEMBER_MAX))) localStorage.removeItem(REMEMBER_PREFIX + old)
    localStorage.setItem(REMEMBER_INDEX, JSON.stringify(index))
  } catch { /* storage full or blocked: nothing to remember */ }
}

/** Remembered results for a search; with maxAgeMs, only if saved that recently. */
function recallResults(key: string, maxAgeMs = Infinity): LiveProduct[] | null {
  try {
    const saved = JSON.parse(localStorage.getItem(REMEMBER_PREFIX + key) ?? 'null') as { at: number; items: LiveProduct[] } | LiveProduct[] | null
    // Entries saved before timestamps were added are a bare array: fine as a fallback, never instant.
    const items = Array.isArray(saved) ? (maxAgeMs === Infinity ? saved : null) : (saved && Date.now() - saved.at <= maxAgeMs ? saved.items : null)
    return Array.isArray(items) && items.length ? items : null
  } catch { return null }
}

/** Fetch searches ahead of time and keep the results on the device, for `instant` to show later. */
export async function prefetchLiveProducts(queries: DiscoverQuery[], options: { brand?: string | null } = {}): Promise<void> {
  const brand = options.brand ?? null
  const key = `${brand ?? ''}|${queries.map((q) => q.text).join('|')}`
  if (!queries.length || recallResults(key, INSTANT_MAX_AGE_MS)) return
  const result = await fetchLiveProducts(queries, { brand })
  if (result.status === 'ok' && result.items.length) rememberResults(key, result.items)
}

/**
 * Live products for a screen. `queriesFor(page)` builds the searches; page 0
 * loads when `enabled`, loadMore() fetches the next page. Searches again only
 * when the search words change, not on every re-render of profile or wardrobe.
 */
export function useLiveProducts(queriesFor: (page: number) => DiscoverQuery[], options: { enabled?: boolean; brand?: string | null; shuffle?: boolean; instant?: boolean } = {}) {
  const { enabled = true, brand = null, shuffle = false, instant = false } = options
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
    const key = `${brand ?? ''}|${queries.map((q) => q.text).join('|')}`
    // Fetched ahead (prefetchLiveProducts) and still fresh: show it without waiting on a search.
    const ready = instant ? recallResults(key, INSTANT_MAX_AGE_MS) : null
    let result = ready ? { items: ready, status: 'ok' as const } : await fetchLiveProducts(queries, { brand })
    if (id !== requestId.current) return
    if (result.status === 'error' || result.status === 'no-key') {
      // Show what this search found last time; failing that, try once more
      // after a short wait before telling anyone it failed.
      const remembered = recallResults(key)
      if (remembered) {
        console.warn('[liveShop] live search failed, showing earlier results')
        result = { items: remembered, status: 'ok' }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 4000))
        if (id !== requestId.current) return
        result = await fetchLiveProducts(queries, { brand })
        if (id !== requestId.current) return
      }
    } else if (result.status === 'ok' && result.items.length && !ready) {
      rememberResults(key, result.items)
    }
    setStatus(result.status)
    if (result.status === 'ok') {
      setItems((current) => {
        const seen = new Set(replace ? [] : current.map((item) => item.id))
        const fresh = result.items.filter((item) => !seen.has(item.id))
        // Shuffle each batch on its own, so loading more never reorders cards already shown.
        if (shuffle) for (let i = fresh.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [fresh[i], fresh[j]] = [fresh[j], fresh[i]] }
        return [...(replace ? [] : current), ...fresh]
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

/**
 * A smaller copy of a product photo, where the store's image server can make
 * one (Shopify, Myntra, H&M, Zara and a few others); otherwise the photo as is.
 * Full-size retailer photos are often 2000px and slow to arrive.
 */
export function smallImage(url: string | null | undefined, width = 480): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    if (host.includes('cdn.shopify.com') || parsed.pathname.includes('/cdn/shop/')) {
      parsed.searchParams.set('width', String(width))
      return parsed.toString()
    }
    if (host.includes('myntassets.com')) {
      return url.replace(/h_\d+,q_\d+,w_\d+/, `h_${Math.round(width * 4 / 3)},q_80,w_${width}`)
    }
    if (host.includes('image.hm.com') || host.includes('lp2.hm.com')) {
      parsed.searchParams.set('imwidth', String(width))
      return parsed.toString()
    }
    if (host.includes('static.zara.net') || host.includes('static.bershka.net') || host.includes('static.pullandbear.net') || host.includes('static.massimodutti.net')) {
      parsed.searchParams.set('w', String(width))
      return parsed.toString()
    }
  } catch { /* not a URL: use as is */ }
  return url
}
