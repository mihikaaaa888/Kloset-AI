import type { WebShopResult } from '@/types'
import { apiUrl } from '@/lib/apiUrl'

export type Retailer = 'zara' | 'hm' | 'cos' | 'uniqlo' | 'mango' | 'stories' | 'everlane'

interface WebShopSearchResponse {
  results: WebShopResult[]
  noKey?: boolean
  error?: string
}

// The chat asks for the same query from more than one place (the outfit board's
// "to buy" tile and the product row under it) — share one request per query.
const inflight = new Map<string, Promise<WebShopSearchResponse>>()

/** Same as searchWebShop, but concurrent/repeat calls for one query share a request. */
export function searchWebShopCached(query: string, retailers?: Retailer[]): Promise<WebShopSearchResponse> {
  const key = `${query.toLowerCase()}|${(retailers ?? []).join(',')}`
  const existing = inflight.get(key)
  if (existing) return existing
  const request = searchWebShop(query, retailers).then((res) => {
    // Don't keep failures around — the next render can retry.
    if (res.error) inflight.delete(key)
    return res
  }, (e) => {
    inflight.delete(key)
    throw e
  })
  inflight.set(key, request)
  return request
}

/** Live web search for real product pages on Zara/H&M/etc, via the Exa-backed API route. */
export async function searchWebShop(
  query: string,
  retailers?: Retailer[]
): Promise<WebShopSearchResponse> {
  console.log('[webShopService] searching', { query, retailers })

  const response = await fetch(apiUrl('/api/web-shop-search'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, retailers }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    console.error('[webShopService] request failed', response.status, data.error)
    return { results: [], error: data.error ?? 'Live shopping search failed.' }
  }

  const data = await response.json()
  console.log('[webShopService] got', data.results?.length ?? 0, 'results', data.noKey ? '(no key)' : '')
  return data
}

// Retailer names we never show in the UI — Kloset suggests pieces, not brands.
// Product-page titles usually carry the store name ("Linen Shirt | ZARA
// India", "H&M - Wide jeans"), so it's stripped along with the separator.
const BRAND_PATTERNS = [
  /&\s*other\s*stories/gi,
  /\bH\s*&\s*M\b/gi,
  /\bZara\b/gi,
  /\bCOS\b/g,
  /\bUniqlo\b/gi,
  /\bMango\b/gi,
  /\bEverlane\b/gi,
]

/** Removes retailer/brand names and leftover separators from a product title. */
export function cleanProductTitle(title: string): string {
  let cleaned = title
  for (const pattern of BRAND_PATTERNS) cleaned = cleaned.replace(pattern, '')
  cleaned = cleaned
    .replace(/\s*[|–—-]\s*(india|usa|official site|online|[a-z]{2})?\s*$/i, '')
    .replace(/^\s*[|–—-]\s*/, '')
    .replace(/\s*[|–—-]\s*[|–—-]\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return cleaned || 'Shop this piece'
}
