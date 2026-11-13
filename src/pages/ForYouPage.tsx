import { useMemo, useState, type PointerEvent } from 'react'
import { Heart, RotateCcw, Shirt, ThumbsDown } from 'lucide-react'
import { ALL_CATALOG_ITEMS } from '@/lib/catalogData'
import { rankForUser } from '@/lib/shopping'
import { scoreRecommendationFeedback, traitsFromCatalog, traitsFromWardrobe, type RecommendationFeedback, type RecommendationTraits } from '@/lib/recommendationFeedback'
import { useRecommendationStore } from '@/store/recommendationStore'
import { useUserStore } from '@/store/userStore'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useItemImage } from '@/hooks/useItemImage'
import type { CatalogItem, ClothingCategory, ClothingItem } from '@/types'

type ForYouCard =
  | { kind: 'shop'; id: string; category: ClothingCategory; item: CatalogItem }
  | { kind: 'pairing'; id: string; category: 'pairing'; items: ClothingItem[]; traits: RecommendationTraits }

const CARD_CATEGORIES: ClothingCategory[] = ['tops', 'bottoms', 'dresses', 'shoes', 'outerwear', 'accessories']

function diverseShopCards(items: CatalogItem[]): ForYouCard[] {
  const byCategory = new Map(CARD_CATEGORIES.map((category) => [category, items.filter((item) => item.category === category)]))
  const result: ForYouCard[] = []
  let round = 0
  while (result.length < items.length) {
    let added = false
    for (const category of CARD_CATEGORIES) {
      const item = byCategory.get(category)?.[round]
      if (!item) continue
      result.push({ kind: 'shop', id: item.id, category, item })
      added = true
    }
    if (!added) break
    round += 1
  }
  return result
}

function makePairingCard(items: ClothingItem[]): ForYouCard {
  const categories = [...new Set(items.map((item) => item.category))]
  const id = `pair:${items.map((item) => item.id).sort().join(':')}`
  const first = traitsFromWardrobe(items[0])
  const traits: RecommendationTraits = {
    ...first,
    pairingCategories: categories,
    subcategory: items.map((item) => item.subcategory).filter(Boolean).join(' + '),
    colours: [...new Set(items.flatMap((item) => item.colour))],
    material: [...new Set(items.map((item) => item.material).filter(Boolean))].join(' / '),
    pattern: items.some((item) => item.pattern !== 'solid') ? 'mixed' : 'solid',
    occasions: [...new Set(items.flatMap((item) => item.occasions))],
  }
  return { kind: 'pairing', id, category: 'pairing', items, traits }
}

function wardrobePairings(wardrobe: ClothingItem[], feedback: RecommendationFeedback[]): ForYouCard[] {
  const groups: [ClothingCategory, ClothingCategory][] = [
    ['tops', 'bottoms'], ['dresses', 'shoes'], ['tops', 'outerwear'], ['bottoms', 'shoes'],
  ]
  const cards: ForYouCard[] = []
  for (const [firstCategory, secondCategory] of groups) {
    const firstItems = wardrobe.filter((item) => item.category === firstCategory)
    const secondItems = wardrobe.filter((item) => item.category === secondCategory)
    for (const first of firstItems) {
      for (const second of secondItems) {
        if (first.id === second.id) continue
        const card = makePairingCard([first, second])
        if (feedback.some((event) => event.itemId === card.id && event.action !== 'dwell')) continue
        cards.push(card)
      }
    }
  }
  const ranked = cards.map((card) => {
    if (card.kind !== 'pairing') return { card, score: 0 }
    const ownedItems = card.items
    const colourVariety = new Set(card.traits.colours.map((colour) => colour.toLowerCase())).size
    const commonOccasions = ownedItems[0].occasions.filter((occasion) => ownedItems[1].occasions.includes(occasion)).length
    const patternClash = ownedItems.every((item) => item.pattern !== 'solid') ? -3 : 0
    const feedbackScore = scoreRecommendationFeedback(card.traits, feedback)
    const favouriteBonus = ownedItems.filter((item) => item.isFavourite).length * 0.5
    return { card, score: commonOccasions * 1.5 + (colourVariety > 1 ? 0.4 : 0) + patternClash + feedbackScore + favouriteBonus }
  })
  return ranked.sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id)).map(({ card }) => card)
}

function mixedDeck(shopCards: ForYouCard[], pairingCards: ForYouCard[]): ForYouCard[] {
  const deck: ForYouCard[] = []
  const byCategory = new Map(CARD_CATEGORIES.map((category) => [category, shopCards.filter((card) => card.kind === 'shop' && card.category === category)]))
  let round = 0
  let pairIndex = 0
  let shopRemaining = shopCards.length
  while (shopRemaining || pairIndex < pairingCards.length) {
    let added = false
    for (const category of CARD_CATEGORIES) {
      const card = byCategory.get(category)?.[round]
      if (!card) continue
      deck.push(card); shopRemaining -= 1; added = true
      if (deck.length % 2 === 0 && pairingCards[pairIndex]) deck.push(pairingCards[pairIndex++])
    }
    if (!added && pairingCards[pairIndex]) deck.push(pairingCards[pairIndex++])
    else if (!added) break
    round += 1
  }
  while (pairIndex < pairingCards.length) deck.push(pairingCards[pairIndex++])
  return deck
}

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
    const rankedShop = rankForUser(pool, profile, wardrobe, feedback)
    const diverseShop = diverseShopCards(rankedShop)
    const pairings = wardrobePairings(wardrobe, feedback)
    return mixedDeck(diverseShop, pairings)
  }, [feedback, profile, wardrobe])

  const card = deck[0]
  const decide = (action: 'like' | 'dislike') => {
    if (!card) return
    const traits = card.kind === 'shop' ? traitsFromCatalog(card.item) : card.traits
    recordFeedback(userId, {
      id: `${action}:${card.id}:${Date.now()}`,
      itemId: card.id,
      action,
      traits,
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

        {card ? (
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
              aria-label={`${card.kind === 'shop' ? card.item.name : card.items.map((item) => item.name).join(' with ')}. Swipe right to like or left to dislike.`}
              className="relative touch-pan-y select-none overflow-hidden rounded-[28px] border border-text-primary/10 bg-surface shadow-lifted outline-none focus-visible:ring-2 focus-visible:ring-deep-purple"
              style={{ transform: `translateX(${dragX}px) rotate(${dragX * 0.035}deg)`, transition: swiping ? 'none' : 'transform 180ms ease-out' }}
            >
              <div className={`relative aspect-[4/5] bg-cream-200 ${card.kind === 'pairing' ? 'grid grid-cols-2 gap-0.5' : ''}`}>
                {card.kind === 'shop' ? (card.item.imageUrl ? <img src={card.item.imageUrl} alt={card.item.name} draggable={false} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Shirt size={44} className="text-text-muted/50" /></div>) : card.items.map((wardrobeItem) => <PairingImage key={wardrobeItem.id} item={wardrobeItem} />)}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 pb-6 pt-24 text-white">
                  {card.kind === 'shop' ? <><p className="text-xs uppercase tracking-[0.2em] text-white/75">Shop · {card.item.category}{card.item.subcategory ? ` · ${card.item.subcategory}` : ''}</p><h2 className="mt-2 font-display text-3xl leading-tight">{card.item.name}</h2><p className="mt-2 text-sm text-white/80">{card.item.colours.slice(0, 3).join(' · ')}{card.item.material ? ` · ${card.item.material}` : ''}</p></> : <><p className="text-xs uppercase tracking-[0.2em] text-white/75">From your Kloset · pairing idea</p><div className="mt-2 space-y-1">{card.items.map((wardrobeItem) => <h2 key={wardrobeItem.id} className="font-display text-xl leading-tight">{wardrobeItem.name}</h2>)}</div></>}
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

function PairingImage({ item }: { item: ClothingItem }) {
  const imageUrl = useItemImage(item)
  return imageUrl ? <img src={imageUrl} alt={item.name} draggable={false} className="h-full min-h-0 w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-cream-200"><Shirt size={36} className="text-text-muted/50" /></div>
}
