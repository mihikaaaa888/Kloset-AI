import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Heart, X } from 'lucide-react'
import { clsx } from 'clsx'
import { apiFetch, apiUrl } from '@/lib/apiUrl'
import { buildDiscoverQueries, filterForUser, type DiscoverQuery, type WebProduct } from '@/lib/discoverFeed'
import { learnTasteProfile, type RecommendationFeedback } from '@/lib/recommendationFeedback'
import { useRecommendationStore } from '@/store/recommendationStore'
import type { ClothingCategory, UserProfile } from '@/types'

type FeedItem = WebProduct & { search: DiscoverQuery }

/**
 * "From around the web": live products from any store, searched with the
 * user's taste. Shop's own catalog is only a few dozen pieces; this never
 * runs out (Show more searches again with a different mix).
 */
export function WebDiscoverFeed({ profile, category, feedback }: {
  profile: UserProfile | null
  category: ClothingCategory | 'all'
  feedback: RecommendationFeedback[]
}) {
  const userId = profile?.id ?? 'guest'
  const recordFeedback = useRecommendationStore((s) => s.recordFeedback)
  // Taste as of when this feed opened, so hearting a card doesn't reshuffle what's already shown.
  const tasteAtOpen = useRef(learnTasteProfile(feedback))
  const [items, setItems] = useState<FeedItem[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'ok' | 'error' | 'no-key'>('ok')
  const [votes, setVotes] = useState<Record<string, 'like' | 'dislike'>>({})
  const requestId = useRef(0)

  const ratedIds = useMemo(() => new Set(feedback.filter((e) => e.action === 'dislike').map((e) => e.itemId)), [feedback])

  const load = useCallback(async (nextPage: number, replace: boolean) => {
    const id = ++requestId.current
    const queries = buildDiscoverQueries(profile, tasteAtOpen.current, category, nextPage)
    setLoading(true)
    try {
      const res = await apiFetch(apiUrl('/api/discover-feed'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: queries.map((q) => q.text) }),
      })
      const data = await res.json() as { items?: WebProduct[]; noKey?: boolean; error?: string }
      if (id !== requestId.current) return
      if (data.noKey) { setStatus('no-key'); return }
      if (!res.ok) throw new Error(data.error)
      const byText = new Map(queries.map((q) => [q.text, q]))
      const fresh = (data.items ?? []).map((item) => {
        const search = byText.get(item.query) ?? queries[0]
        return { ...item, category: search.category, search }
      })
      setItems((current) => {
        const seen = new Set(replace ? [] : current.map((i) => i.id))
        return [...(replace ? [] : current), ...fresh.filter((i) => !seen.has(i.id))]
      })
      setPage(nextPage)
      setStatus('ok')
    } catch {
      if (id === requestId.current) setStatus('error')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [profile, category])

  useEffect(() => {
    setItems([])
    void load(0, true)
  }, [load])

  const visible = useMemo(() => filterForUser(items, profile, tasteAtOpen.current, new Set([...ratedIds].map((id) => id.replace(/^web:/, '')))), [items, profile, ratedIds])

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

  if (status === 'no-key') return null

  return (
    <section aria-label="From around the web" className="mt-12 border-t border-text-primary/10 pt-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl text-text-primary">From around the web</h2>
          <p className="mt-1 text-xs text-text-muted">
            Live picks from stores everywhere{basedOn.length ? <>, chosen using <span className="text-text-primary">{basedOn.map((b) => b.charAt(0).toUpperCase() + b.slice(1)).join(' · ')}</span></> : ', tuned to your taste as you heart and skip'}.
          </p>
        </div>
      </div>

      {status === 'error' && !visible.length ? (
        <p className="py-10 text-center text-sm text-text-muted">Couldn’t load live picks right now. <button onClick={() => void load(page, items.length === 0)} className="underline underline-offset-4 hover:text-text-primary">Try again</button></p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((item) => <WebProductCard key={item.id} item={item} vote={votes[item.id]} onVote={(action) => vote(item, action)} />)}
          {loading && Array.from({ length: visible.length ? 5 : 10 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="animate-pulse"><div className="aspect-[3/4] bg-text-primary/8" /><div className="mt-2 h-3 w-3/4 bg-text-primary/8" /><div className="mt-1.5 h-3 w-1/3 bg-text-primary/8" /></div>
          ))}
        </div>
      )}

      {!loading && status !== 'error' && (
        <div className="mt-8 flex justify-center">
          <button onClick={() => void load(page + 1, false)} className="h-10 rounded-full border border-text-primary/25 px-6 text-xs text-text-primary transition-colors hover:border-text-primary/50 hover:bg-text-primary/5">
            {visible.length ? 'Show more' : 'Find picks'}
          </button>
        </div>
      )}
      <p className="mt-4 text-center text-[10px] text-text-muted">Prices and stock are set by each store and may change.</p>
    </section>
  )
}

function WebProductCard({ item, vote, onVote }: { item: FeedItem; vote?: 'like' | 'dislike'; onVote: (action: 'like' | 'dislike') => void }) {
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
      </a>
    </article>
  )
}
