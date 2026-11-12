import { useMemo, useState, type PointerEvent } from 'react'
import { Heart, RotateCcw, Shirt, ThumbsDown } from 'lucide-react'
import { ALL_CATALOG_ITEMS } from '@/lib/catalogData'
import { rankForUser } from '@/lib/shopping'
import { traitsFromCatalog } from '@/lib/recommendationFeedback'
import { useRecommendationStore } from '@/store/recommendationStore'
import { useUserStore } from '@/store/userStore'
import { useWardrobeStore } from '@/store/wardrobeStore'

export function ForYouPage() {
  const profile = useUserStore((state) => state.profile)
  const wardrobe = useWardrobeStore((state) => state.items)
  const userId = profile?.id ?? 'guest'
  const feedback = useRecommendationStore((state) => state.feedbackByUser[userId] ?? [])
  const recordFeedback = useRecommendationStore((state) => state.recordFeedback)
  const clearSwipeFeedback = useRecommendationStore((state) => state.clearSwipeFeedback)
  const [ratedThisSession, setRatedThisSession] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [swiping, setSwiping] = useState(false)

  const deck = useMemo(() => {
    const preference = profile?.genderStylePreference
    const ownedIds = new Set(wardrobe.map((item) => item.catalogId).filter(Boolean))
    const unseenIds = new Set(feedback.filter((event) => event.action !== 'dwell').map((event) => event.itemId))
    const pool = ALL_CATALOG_ITEMS.filter((item) => {
      if (ownedIds.has(item.id) || unseenIds.has(item.id)) return false
      if (preference === 'feminine') return item.gender !== 'men'
      if (preference === 'masculine') return item.gender === 'men'
      return true
    })
    return rankForUser(pool, profile, wardrobe, feedback)
  }, [feedback, profile, wardrobe])

  const item = deck[0]
  const decide = (action: 'like' | 'dislike') => {
    if (!item) return
    recordFeedback(userId, {
      id: `${action}:${item.id}:${Date.now()}`,
      itemId: item.id,
      action,
      traits: traitsFromCatalog(item),
      createdAt: new Date().toISOString(),
    })
    setRatedThisSession((current) => current + 1)
    setDragX(0)
    setSwiping(false)
  }

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setSwiping(true)
    setDragX(0)
    ;(event.currentTarget as HTMLElement).dataset.startX = String(event.clientX)
  }
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!swiping) return
    const startX = Number(event.currentTarget.dataset.startX ?? event.clientX)
    setDragX(event.clientX - startX)
  }
  const onPointerUp = () => {
    if (Math.abs(dragX) > 90) decide(dragX > 0 ? 'like' : 'dislike')
    else { setDragX(0); setSwiping(false) }
  }

  return (
    <main className="min-h-screen bg-warm-cream px-5 pb-28 pt-28 md:pt-32">
      <div className="mx-auto max-w-5xl">
        <p className="mb-2 text-xs uppercase tracking-[0.24em] text-text-muted">Made for your taste</p>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-text-primary sm:text-5xl">For you</h1>
            <p className="mt-2 max-w-xl text-sm text-text-muted">Swipe right for pieces you like, left for ones you’d skip. Kloset will use your choices to tune future outfit and shop recommendations.</p>
          </div>
          <span className="shrink-0 text-xs text-text-muted">{feedback.filter((event) => event.action !== 'dwell').length} rated</span>
        </div>

        {item ? (
          <div className="mx-auto max-w-md">
            <article
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') decide('like')
                if (event.key === 'ArrowLeft') decide('dislike')
              }}
              tabIndex={0}
              aria-label={`${item.name}. Swipe right to like or left to dislike.`}
              className="relative touch-pan-y select-none overflow-hidden rounded-[28px] border border-text-primary/10 bg-surface shadow-lifted outline-none focus-visible:ring-2 focus-visible:ring-deep-purple"
              style={{ transform: `translateX(${dragX}px) rotate(${dragX * 0.035}deg)`, transition: swiping ? 'none' : 'transform 180ms ease-out' }}
            >
              <div className="relative aspect-[4/5] bg-cream-200">
                {item.imageUrl ? <img src={item.imageUrl} alt={item.name} draggable={false} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Shirt size={44} className="text-text-muted/50" /></div>}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 pb-6 pt-24 text-white">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/75">{item.category}{item.subcategory ? ` · ${item.subcategory}` : ''}</p>
                  <h2 className="mt-2 font-display text-3xl leading-tight">{item.name}</h2>
                  <p className="mt-2 text-sm text-white/80">{item.colours.slice(0, 3).join(' · ')}{item.material ? ` · ${item.material}` : ''}</p>
                </div>
                {dragX > 28 && <span className="absolute left-5 top-5 rounded-lg border-2 border-green-700 bg-white/90 px-3 py-1 text-sm font-bold uppercase tracking-widest text-green-800">Like</span>}
                {dragX < -28 && <span className="absolute right-5 top-5 rounded-lg border-2 border-rose-700 bg-white/90 px-3 py-1 text-sm font-bold uppercase tracking-widest text-rose-800">Skip</span>}
              </div>
            </article>
            <div className="mt-5 flex items-center justify-center gap-6">
              <button onClick={() => decide('dislike')} aria-label="Show me fewer like this" className="flex h-14 w-14 items-center justify-center rounded-full border border-text-primary/15 bg-surface text-text-muted transition hover:border-rose-300 hover:text-rose-700"><ThumbsDown size={21} /></button>
              <span className="min-w-16 text-center text-xs tabular-nums text-text-muted">{ratedThisSession + 1} / {ratedThisSession + deck.length}</span>
              <button onClick={() => decide('like')} aria-label="I like this" className="flex h-14 w-14 items-center justify-center rounded-full bg-deep-purple text-butter-yellow transition hover:scale-105"><Heart size={22} /></button>
            </div>
            <p className="mt-3 text-center text-xs text-text-muted">← Skip this style · Like this style →</p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-text-primary/10 bg-surface px-8 py-14 text-center shadow-lifted">
            <Heart size={28} className="text-deep-purple" />
            <h2 className="mt-4 font-display text-3xl text-text-primary">You’re all caught up</h2>
            <p className="mt-2 text-sm text-text-muted">Your choices are saved and will shape future recommendations.</p>
            <button onClick={() => { clearSwipeFeedback(userId); setRatedThisSession(0) }} className="mt-6 inline-flex items-center gap-2 rounded-full bg-deep-purple px-5 py-3 text-sm text-butter-yellow"><RotateCcw size={16} /> Start over</button>
          </div>
        )}
      </div>
    </main>
  )
}
