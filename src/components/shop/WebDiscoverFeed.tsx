import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Heart, X } from 'lucide-react'
import { clsx } from 'clsx'
import { buildDiscoverQueries, buildKlosetQueries, buildSearchQueries, filterForUser } from '@/lib/discoverFeed'
import { parsePrice, useLiveProducts, type LiveProduct } from '@/lib/liveShop'
import { learnTasteProfile, type RecommendationFeedback } from '@/lib/recommendationFeedback'
import { useRecommendationStore } from '@/store/recommendationStore'
import type { ClothingCategory, ClothingItem, UserProfile } from '@/types'

type FeedItem = LiveProduct

// Suggested for you shows a short row first; Show more reveals more, then searches again.
const SUGGESTED_STEP = 12

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

  const queriesFor = useCallback((page: number) => {
    if (suggested) return buildKlosetQueries(profile, wardrobe, tasteAtOpen.current, page)
    if (searching) return buildSearchQueries(profile, search, { category, colours, styles, avoid: tasteAtOpen.current.avoids.colours }, page)
    return buildDiscoverQueries(profile, tasteAtOpen.current, category, page)
  }, [suggested, searching, profile, wardrobe, search, category, colours, styles])
  const { items, loading, status, loadMore, retry } = useLiveProducts(queriesFor, { enabled: inView, brand })
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

  const basedOn = useMemo(() => {
    const t = tasteAtOpen.current
    return [...new Set([
      ...t.loves.colours.slice(0, 2), ...(profile?.favouriteColours ?? []).slice(0, 2).map((c) => c.toLowerCase()),
      ...t.loves.materials.slice(0, 1), ...t.loves.patterns.slice(0, 1), ...(t.patternLean === 'prints' ? ['prints'] : []),
      ...t.loves.styles.slice(0, 1), ...(profile?.stylePreferences ?? []).slice(0, 2),
    ])].slice(0, 5)
  }, [profile])

  // Without the search key there's no live feed; for a brand that's all there
  // is to show, so say so instead of leaving the page blank.
  if (status === 'no-key' && suggested) return null
  if (status === 'no-key') {
    return brand
      ? <p className="mt-6 border-t border-text-primary/10 py-10 text-center text-sm text-text-muted">Live search isn’t available right now, so {brand}’s site can’t be searched. Try again later.</p>
      : null
  }

  return (
    <section ref={sectionRef} aria-label={suggested ? 'Suggested for you' : 'From around the web'} className={suggested ? 'pt-4' : 'mt-12 border-t border-text-primary/10 pt-6'}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        {suggested ? (
          <div>
            <h2 className="font-display text-2xl text-text-primary">Suggested for you</h2>
            <p className="mt-1 text-xs text-text-muted">Live picks that go with your Kloset and what you dress for.</p>
          </div>
        ) : (
          <div>
            <h2 className="font-display text-2xl text-text-primary">{brand ? `From ${brand}` : search.trim() ? `Results for “${search.trim()}”` : searching ? 'Your filtered picks' : 'From around the web'}</h2>
            <p className="mt-1 text-xs text-text-muted">
              {brand ? `Live from ${brand}’s site` : searching ? 'Searched live across stores' : 'Live picks from stores everywhere'}{basedOn.length ? <>, chosen using <span className="text-text-primary">{basedOn.map((b) => b.charAt(0).toUpperCase() + b.slice(1)).join(' · ')}</span></> : ', tuned to your taste as you heart and skip'}.
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((item) => <WebProductCard key={item.id} item={item} vote={votes[item.id]} onVote={(action) => vote(item, action)} reason={suggested ? item.search.reason : undefined} />)}
          {loading && Array.from({ length: visible.length ? 5 : (suggested ? 6 : 10) }).map((_, i) => (
            <div key={`skeleton-${i}`} className="animate-pulse"><div className="aspect-[3/4] bg-text-primary/8" /><div className="mt-2 h-3 w-3/4 bg-text-primary/8" /><div className="mt-1.5 h-3 w-1/3 bg-text-primary/8" /></div>
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
      {!suggested && <p className="mt-4 text-center text-[10px] text-text-muted">Prices and stock are set by each store and may change.</p>}
    </section>
  )
}

function WebProductCard({ item, vote, onVote, reason }: { item: FeedItem; vote?: 'like' | 'dislike'; onVote: (action: 'like' | 'dislike') => void; reason?: string }) {
  const [hidden, setHidden] = useState(false)
  if (hidden || vote === 'dislike') return null
  return (
    <article className="group min-w-0">
      <div className="relative aspect-[3/4] overflow-hidden bg-white">
        <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`View ${item.title} on ${item.retailer}`} className="absolute inset-0">
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setHidden(true)}
            // Logos and banners load tiny or very wide; product photos don't.
            onLoad={(e) => { const { naturalWidth: w, naturalHeight: h } = e.currentTarget; if (w < 160 || h < 160 || w / h > 1.6) setHidden(true) }}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </a>
        <div className="absolute right-2 top-2 flex flex-col gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <button onClick={() => onVote('like')} aria-pressed={vote === 'like'} aria-label="More like this" className={clsx('flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-colors', vote === 'like' ? 'bg-text-primary text-warm-cream' : 'bg-warm-cream/90 text-text-primary hover:bg-warm-cream')}>
            <Heart size={14} fill={vote === 'like' ? 'currentColor' : 'none'} />
          </button>
          <button onClick={() => onVote('dislike')} aria-label="Not for me" className="flex h-8 w-8 items-center justify-center rounded-full bg-warm-cream/90 text-text-primary shadow-sm hover:bg-warm-cream">
            <X size={14} />
          </button>
        </div>
      </div>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
        <p className="line-clamp-2 text-xs leading-snug text-text-primary" title={item.title}>{item.title}</p>
        <p className="mt-1 truncate text-2xs text-text-muted">{item.retailer}{item.price ? ` · ${item.price}` : ''}</p>
        {reason && <p className="mt-0.5 truncate text-2xs text-[#355E3B]" title={reason}>{reason}</p>}
      </a>
    </article>
  )
}
