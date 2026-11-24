import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Heart, Plus, X } from 'lucide-react'
import { clsx } from 'clsx'
import { buildDiscoverQueries, buildKlosetQueries, buildSearchQueries, filterForUser } from '@/lib/discoverFeed'
import { liveToItem, parsePrice, prefetchLiveProducts, useLiveProducts, type LiveProduct } from '@/lib/liveShop'
import { insertItem } from '@/lib/wardrobeService'
import { useAuth } from '@/contexts/AuthContext'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { learnTasteProfile, type RecommendationFeedback } from '@/lib/recommendationFeedback'
import { useRecommendationStore } from '@/store/recommendationStore'
import type { ClothingCategory, ClothingItem, UserProfile } from '@/types'

type FeedItem = LiveProduct

// Suggested for you shows a short row first; Show more reveals more, then searches again.
const SUGGESTED_STEP = 12

// Each Shop visit starts its searches one page further on, so a reload brings
// other products. Once a visit loads, the next visit's products are fetched in
// the background and kept on the device, so the next open is instant.
// Read on open, moved on only after a load (opening twice in dev's StrictMode doesn't skip one).
const VISIT_KEY = 'kloset:shop:visit'
function currentVisit(): number {
  try { return Number(localStorage.getItem(VISIT_KEY)) || 1 } catch { return Math.floor(Math.random() * 1000) }
}
function advanceVisit(to: number) {
  try { localStorage.setItem(VISIT_KEY, String(to)) } catch { /* storage blocked: next visit picks at random */ }
}

/**
 * Shop's live products. Every product on Shop comes from here:
 * - 'suggested': picks for the person's Kloset (what they own and need), first under All;
 * - 'browse': the endless feed for All or a category, tuned to their taste;
 * - 'search': what they typed. Colour and style filters become search words.
 */
export function WebDiscoverFeed({
  profile, category, feedback, brand = null, variant = 'browse', wardrobe = [],
  search = '', colours = [], styles = [], budgetRange = null, sort = 'recommended',
}: {
  profile: UserProfile | null
  category: ClothingCategory | 'all'
  feedback: RecommendationFeedback[]
  /** Search only this brand's own website (any brand; the server finds its site). */
  brand?: string | null
  variant?: 'browse' | 'suggested' | 'search'
  wardrobe?: ClothingItem[]
  search?: string
  colours?: string[]
  styles?: string[]
  /** Only products whose shown ₹ price is in [min, max]; products without a price are hidden while set. */
  budgetRange?: [number, number] | null
  sort?: 'recommended' | 'price-low' | 'price-high'
}) {
  const suggested = variant === 'suggested'
  const searching = variant === 'search' || colours.length > 0 || styles.length > 0
  const userId = profile?.id ?? 'guest'
  const recordFeedback = useRecommendationStore((s) => s.recordFeedback)
  // Taste as of when this feed opened, so hearting a card doesn't reshuffle what's already shown.
  const tasteAtOpen = useRef(learnTasteProfile(feedback))
  const [votes, setVotes] = useState<Record<string, 'like' | 'dislike'>>({})
  const [shown, setShown] = useState(SUGGESTED_STEP)
  // The general feed searches once it scrolls near view, not on page open:
  // fewer searches at once (Exa allows 10 a second) and none for people who never scroll.
  const sectionRef = useRef<HTMLElement>(null)
  const [inView, setInView] = useState(variant !== 'browse')
  useEffect(() => {
    if (inView || !sectionRef.current) return
    const observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setInView(true) }, { rootMargin: '600px' })
    observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [inView])

  const [visit] = useState(currentVisit)
  const queriesAt = useCallback((page: number, atVisit: number) => {
    if (suggested) return buildKlosetQueries(profile, wardrobe, tasteAtOpen.current, page + atVisit)
    // A typed search keeps its most relevant results first.
    if (searching) return buildSearchQueries(profile, search, { category, colours, styles, avoid: tasteAtOpen.current.avoids.colours }, page)
    return buildDiscoverQueries(profile, tasteAtOpen.current, category, page + atVisit, wardrobe)
  }, [suggested, searching, profile, wardrobe, search, category, colours, styles])
  const queriesFor = useCallback((page: number) => queriesAt(page, visit), [queriesAt, visit])
  const { items, loading, status, loadMore, retry } = useLiveProducts(queriesFor, { enabled: inView, brand, shuffle: !searching, instant: !searching })
  // This visit has products: get the next visit's ready in the background.
  const prefetched = useRef(false)
  useEffect(() => {
    if (searching || prefetched.current || !items.length) return
    prefetched.current = true
    advanceVisit(visit + 1)
    void prefetchLiveProducts(queriesAt(0, visit + 1), { brand })
  }, [searching, items.length, visit, queriesAt, brand])
  useEffect(() => { setShown(SUGGESTED_STEP) }, [items.length === 0])

  const ratedIds = useMemo(() => new Set(feedback.filter((e) => e.action === 'dislike').map((e) => e.itemId)), [feedback])
  const allVisible = useMemo(() => {
    let list = filterForUser(items, profile, tasteAtOpen.current, new Set([...ratedIds].map((id) => id.replace(/^web:/, ''))))
    if (budgetRange) list = list.filter((item) => { const price = parsePrice(item.price); return !!price && price.currency === '₹' && price.amount >= budgetRange[0] && price.amount <= budgetRange[1] })
    if (sort !== 'recommended') {
      const amount = (item: FeedItem) => parsePrice(item.price)?.amount ?? (sort === 'price-low' ? Infinity : -Infinity)
      list = [...list].sort((a, b) => (sort === 'price-low' ? amount(a) - amount(b) : amount(b) - amount(a)))
    }
    return list
  }, [items, profile, ratedIds, budgetRange, sort])
  const visible = suggested ? allVisible.slice(0, shown) : allVisible
  const showMore = () => {
    if (suggested && shown < allVisible.length) { setShown((count) => count + SUGGESTED_STEP); return }
    if (suggested) setShown((count) => count + SUGGESTED_STEP)
    void loadMore()
  }

  const vote = (item: FeedItem, action: 'like' | 'dislike') => {
    setVotes((current) => ({ ...current, [item.id]: action }))
    recordFeedback(userId, {
      id: `${action}:web:${item.id}:${Date.now()}`,
      itemId: `web:${item.id}`,
      action,
      traits: item.search.traits,
      createdAt: new Date().toISOString(),
    })
  }


  // Without the search key there's no live feed; for a brand that's all there
  // is to show, so say so instead of leaving the page blank.
  if (status === 'no-key' && suggested) return null
  if (status === 'no-key') {
    return brand
      ? <p className="mt-6 border-t border-text-primary/10 py-10 text-center text-sm text-text-muted">Live search isn’t available right now, so {brand}’s site can’t be searched. Try again later.</p>
      : null
  }

  return (
    <section ref={sectionRef} aria-label={suggested ? 'Suggested for you' : 'From around the web'} className={suggested ? 'pt-6' : 'mt-10 pt-6'}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        {suggested ? (
          <div>
            <h2 className="font-display text-2xl font-medium text-text-primary">Suggested for you</h2>
            <p className="mt-1 text-xs text-text-muted">Picked to go with what’s already in your Kloset.</p>
          </div>
        ) : (
          <div>
            <h2 className="font-display text-2xl font-medium text-text-primary">{brand ? `From ${brand}` : search.trim() ? `Results for “${search.trim()}”` : searching ? 'Your filtered picks' : 'From around the web'}</h2>
            <p className="mt-1 max-w-[65ch] text-xs text-text-muted">
              {brand ? `Live from ${brand}’s site` : searching ? 'Searched live across stores' : wardrobe.length ? 'Live picks for what your Kloset is missing, what goes with your pieces, and what you’ve hearted' : 'Live picks from stores everywhere, tuned to your taste as you heart and skip'}.
            </p>
          </div>
        )}
      </div>

      {status === 'ok' && !loading && items.length > 0 && !visible.length && budgetRange ? (
        <p className="py-10 text-center text-sm text-text-muted">Nothing here shows a price in your budget. Try Show more or another budget.</p>
      ) : status === 'ok' && brand && !loading && !visible.length ? (
        <p className="py-10 text-center text-sm text-text-muted">Nothing from {brand}’s site matched this time. Try Show more, another category, or another brand.</p>
      ) : status === 'no-brand-site' ? (
        <p className="py-10 text-center text-sm text-text-muted">Couldn’t find {brand}’s own website to search. Check the spelling, or try another brand.</p>
      ) : status === 'error' && !visible.length ? (
        <p className="py-10 text-center text-sm text-text-muted">Couldn’t load live picks right now. <button onClick={() => void retry()} className="underline underline-offset-4 hover:text-text-primary">Try again</button></p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((item) => <WebProductCard key={item.id} item={item} vote={votes[item.id]} onVote={(action) => vote(item, action)} reason={searching ? undefined : item.search.reason} />)}
          {loading && Array.from({ length: visible.length ? 5 : (suggested ? 6 : 10) }).map((_, i) => (
            <div key={`skeleton-${i}`} className="animate-pulse"><div className="aspect-[3/4] bg-tile" /><div className="mt-3 h-3 w-3/4 bg-text-primary/8" /><div className="mt-2 h-3 w-1/3 bg-text-primary/8" /><div className="mt-3 h-7 w-28 rounded-full bg-text-primary/8" /></div>
          ))}
        </div>
      )}

      {!loading && status !== 'error' && status !== 'no-brand-site' && (
        <div className="mt-8 flex justify-center">
          <button onClick={showMore} className="h-10 rounded-full border border-text-primary/25 px-6 text-xs text-text-primary transition-colors hover:border-text-primary/50 hover:bg-text-primary/5">
            {visible.length ? 'Show more' : 'Find picks'}
          </button>
        </div>
      )}
      {!suggested && <p className="mt-6 text-center text-xs text-text-muted">Prices and stock are set by each store and may change.</p>}
    </section>
  )
}

function WebProductCard({ item, vote, onVote, reason }: { item: FeedItem; vote?: 'like' | 'dislike'; onVote: (action: 'like' | 'dislike') => void; reason?: string }) {
  const [hidden, setHidden] = useState(false)
  const { user } = useAuth()
  const addItem = useWardrobeStore((s) => s.addItem)
  // Matched by photo, so it still shows as added after a reload.
  const inKloset = useWardrobeStore((s) => !!item.imageUrl && s.items.some((owned) => owned.imageUrl === item.imageUrl))
  if (hidden || vote === 'dislike') return null

  const addToKloset = () => {
    const now = new Date().toISOString()
    const newItem: ClothingItem = { ...liveToItem(item), id: crypto.randomUUID(), createdAt: now, updatedAt: now }
    addItem(newItem)
    if (user) insertItem(user.id, newItem).catch((error) => console.warn('[shop] could not save to Kloset', error))
  }

  return (
    <article className="group min-w-0">
      <div className="relative aspect-[3/4] overflow-hidden bg-tile">
        <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`View ${item.title} on ${item.retailer}`} className="absolute inset-0">
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setHidden(true)}
            // Logos and banners load tiny or very wide; product photos don't.
            onLoad={(e) => { const { naturalWidth: w, naturalHeight: h } = e.currentTarget; if (w < 160 || h < 160 || w / h > 1.6) setHidden(true) }}
            // Multiply blends store photos' white backdrops into the warm tile.
            className="h-full w-full object-cover mix-blend-multiply transition-transform duration-700 ease-editorial group-hover:scale-[1.015] dark:mix-blend-normal"
          />
        </a>
        <div className="absolute right-2 top-2 flex flex-col gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <button onClick={() => onVote('like')} aria-pressed={vote === 'like'} aria-label="More like this" className={clsx('flex h-8 w-8 items-center justify-center rounded-full shadow-soft transition-colors', vote === 'like' ? 'bg-text-primary text-warm-cream' : 'bg-warm-cream/90 text-text-primary hover:bg-warm-cream')}>
            <Heart size={14} fill={vote === 'like' ? 'currentColor' : 'none'} />
          </button>
          <button onClick={() => onVote('dislike')} aria-label="Not for me" className="flex h-8 w-8 items-center justify-center rounded-full bg-warm-cream/90 text-text-primary shadow-soft hover:bg-warm-cream">
            <X size={14} />
          </button>
        </div>
      </div>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-3 block">
        <p className="truncate text-xs text-text-muted">{item.retailer}</p>
        <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-text-primary group-hover:underline decoration-text-primary/30 underline-offset-2" title={item.title}>{item.title}</p>
        {item.price && <p className="mt-1 text-sm font-medium tabular-nums text-text-primary">{item.price}</p>}
        {reason && <p className="mt-1 truncate text-xs text-butter-yellow" title={reason}>{reason}</p>}
      </a>
      <button
        type="button"
        onClick={addToKloset}
        disabled={inKloset}
        aria-label={inKloset ? `${item.title} is in your Kloset` : `Add ${item.title} to Kloset`}
        className="mt-3 inline-flex h-7 items-center gap-1 rounded-full border border-text-primary/20 px-3 text-xs text-text-primary transition-colors hover:border-text-primary/45 hover:bg-text-primary/5 disabled:cursor-default disabled:border-transparent disabled:bg-text-primary/5 disabled:text-text-muted"
      >
        {inKloset ? <Check size={12} /> : <Plus size={12} />}
        {inKloset ? 'In your Kloset' : 'Add to Kloset'}
      </button>
    </article>
  )
}
