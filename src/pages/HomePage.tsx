import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shirt, Heart, Plus, ArrowRight, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useUserStore } from '@/store/userStore'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useItemImage } from '@/hooks/useItemImage'
import type { ClothingItem } from '@/types'
import { generateOutfit } from '@/lib/stylist'
import { getLocalWeather, type LocalWeather } from '@/lib/weather'
import { WeatherCard } from '@/components/home/WeatherCard'
import { useRecommendationStore } from '@/store/recommendationStore'
import { outfitRatingEvents, traitsFromWardrobe } from '@/lib/recommendationFeedback'
import { MisfitPicker } from '@/components/stylist/MisfitPicker'
import { useSampleKloset } from '@/hooks/useSampleKloset'
import { getDailyStylingTip, rateStylingTip, type StylingTip } from '@/lib/stylingTipEngine'

export function HomePage() {
  const navigate = useNavigate()
  const profile = useUserStore((s) => s.profile)
  const items = useWardrobeStore((s) => s.items)

  const favourites = items.filter((i) => i.isFavourite).slice(0, 4)

  return (
    <div className="min-h-screen bg-warm-cream pt-28 lg:pt-32 pb-24 md:pb-0">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-12 lg:pb-16">

        <DailyOutfitCard
          items={items}
          profile={profile}
          onAskStylist={(outfitItemIds) => navigate('/stylist', {
            state: {
              mode: 'chat',
              outfitItemIds,
              initialPrompt: 'Can you check this outfit?',
            },
          })}
        />

        {/* ── Wardrobe empty state ── */}
        {items.length === 0 && (
          <section className="border-y border-text-primary/15 py-16 text-center mb-20">
            <h3 className="font-display text-3xl font-medium text-text-primary mb-3">Start building your Kloset</h3>
            <p className="text-text-muted text-sm max-w-sm mx-auto mb-8">
              Add your clothes to get outfits made for you.
            </p>
            <button onClick={() => navigate('/wardrobe')} className="text-tab text-tab-active sm:text-sm">
              <Plus size={13} /> Add your first piece
            </button>
          </section>
        )}

        {/* ── Favourites ── */}
        {favourites.length > 0 && (
          <section className="mb-20">
            <SectionHeader title="Your favourites" action={{ label: 'View all', onClick: () => navigate('/wardrobe') }} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-8">
              {favourites.map((item) => <WardrobeThumb key={item.id} item={item} onClick={() => navigate('/wardrobe')} />)}
            </div>
          </section>
        )}

      </div>

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type CurrentWeather = LocalWeather & { dateKey: string }

function stableHash(value: string): number {
  return [...value].reduce((hash, character) => (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0, 7)
}


function DailyOutfitCard({ items, profile, onAskStylist }: {
  items: ClothingItem[]
  profile: Parameters<typeof generateOutfit>[2]
  onAskStylist: (itemIds: string[]) => void
}) {
  const feedback = useRecommendationStore((state) => profile?.id ? state.feedbackByUser[profile.id] ?? [] : [])
  const sectionRef = useRef<HTMLElement>(null)
  const [weather, setWeather] = useState<CurrentWeather | null>(null)
  const [weatherError, setWeatherError] = useState(false)
  const [recommendation, setRecommendation] = useState<string[] | null>(null)
  const [recommendationLoading, setRecommendationLoading] = useState(false)
  const [stylingTip, setStylingTip] = useState<StylingTip | null>(null)
  const [tipRating, setTipRating] = useState<'helpful' | 'not-helpful' | 'applied' | null>(null)
  const [today, setToday] = useState(() => new Date())
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(today)
  const recommendedItems = recommendation?.length
    ? items.filter((item) => recommendation.includes(item.id))
    : []
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  // Views and today's thumbs-up should shape the next recommendation, not
  // replace the outfit the user is looking at (liking it used to swap it out).
  // A thumbs-down does take effect now: today's look is replaced with another.
  const rankingFeedback = feedback.filter((event) => event.createdAt.slice(0, 10) !== todayKey
    || (event.action !== 'dwell' && !(event.action === 'like' && (event.source === 'daily-outfit' || event.source === 'stylist-outfit'))))
  const rankingFeedbackKey = stableHash(rankingFeedback.map((event) => `${event.id}:${event.action}`).join('|')).toString(36)
  const useRecommendationGrid = recommendedItems.length > 3
  const userId = profile?.id ?? 'guest'
  const combinationId = recommendedItems.map((item) => item.id).sort().join('|')
  const dailyRating = feedback.find((event) => event.source === 'daily-outfit' && event.combinationId === combinationId)?.action ?? null

  // A thumbs-down swaps today's look, so "what didn't go?" asks about the one just rated.
  const [dislikedLook, setDislikedLook] = useState<ClothingItem[] | null>(null)
  const dislikedLookId = dislikedLook?.map((item) => item.id).sort().join('|') ?? ''
  const dislikedMisfits = feedback
    .filter((event) => event.source === 'daily-outfit' && event.combinationId === dislikedLookId && event.misfit)
    .map((event) => event.itemId.slice(event.itemId.lastIndexOf(':') + 1))

  function rateDailyOutfit(action: 'like' | 'dislike') {
    if (!stylingTip || !recommendedItems.length) return
    rateStylingTip(userId, stylingTip, action === 'like' ? 'helpful' : 'not-helpful')
    setTipRating(action === 'like' ? 'helpful' : 'not-helpful')
    setDislikedLook(action === 'dislike' && recommendedItems.length > 1 ? recommendedItems : null)
    useRecommendationStore.getState().recordFeedbackBatch(userId, outfitRatingEvents(recommendedItems, action, 'daily-outfit'))
  }

  function markDailyMisfits(misfitIds: string[]) {
    if (!dislikedLook) return
    useRecommendationStore.getState().recordFeedbackBatch(userId, outfitRatingEvents(dislikedLook, 'dislike', 'daily-outfit', { misfitIds }))
  }

  useEffect(() => {
    const now = new Date()
    const nextLocalDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const timer = window.setTimeout(() => setToday(new Date()), nextLocalDay.getTime() - now.getTime() + 50)
    return () => window.clearTimeout(timer)
  }, [today.getDate(), today.getMonth(), today.getFullYear()])

  useEffect(() => {
    const weatherDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    setWeather(null)
    setWeatherError(false)
    getLocalWeather().then((value) => {
      setWeather({ ...value, dateKey: weatherDateKey })
    }).catch(() => setWeatherError(true))
  }, [today.getDate(), today.getMonth(), today.getFullYear()])

  useEffect(() => {
    const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    if ((!weather && !weatherError) || (weather && weather.dateKey !== dayKey) || items.length < 2) return
    let cancelled = false
    const wardrobeSignature = items.map((item) => [
      item.id,
      item.category,
      item.colour.join(','),
      item.pattern,
      item.formality ?? '',
      item.fit ?? '',
      item.occasions.join(','),
      item.seasons.join(','),
      item.timesWorn,
      item.lastWorn ?? '',
      item.isFavourite ? 'favourite' : '',
    ].join(':')).sort().join('|')
    const wardrobeKey = stableHash(wardrobeSignature).toString(36)
    // Bump the cache version when recommendation rules change so today's rack
    // is recalculated instead of preserving the older repetitive selection.
    const cacheKey = `kloset:daily-outfit:v6:${profile?.id ?? profile?.name ?? 'guest'}:${dayKey}:${wardrobeKey}:${rankingFeedbackKey}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const cachedIds = JSON.parse(cached) as string[]
        if (Array.isArray(cachedIds) && cachedIds.every((id) => typeof id === 'string')) {
          setRecommendation(cachedIds)
          setRecommendationLoading(false)
          return
        }
      }
    } catch {
      // Continue with a fresh recommendation if local storage is unavailable.
    }

    setRecommendationLoading(true)
    const dailyAttempt = stableHash(`${profile?.id ?? profile?.name ?? 'guest'}|${dayKey}|${wardrobeKey}`)
    void generateOutfit({ occasion: 'casual', weather: weather?.condition ?? 'warm', mood: 'relaxed' }, items, profile, dailyAttempt, undefined, rankingFeedback)
      .then(({ suggestion }) => {
        if (cancelled) return
        const itemIds = suggestion?.items.map(({ item }) => item.id) ?? []
        setRecommendation(itemIds)
        try {
          localStorage.setItem(cacheKey, JSON.stringify(itemIds))
        } catch {
          // The daily seed still keeps the recommendation stable within this date.
        }
      })
      .catch(() => {
        if (!cancelled) setRecommendation([])
      })
      .finally(() => {
        if (!cancelled) setRecommendationLoading(false)
      })
    return () => { cancelled = true }
  }, [weather, weatherError, items, profile, rankingFeedbackKey, today.getDate(), today.getMonth(), today.getFullYear()])

  useEffect(() => {
    if (!recommendedItems.length) { setStylingTip(null); return }
    setTipRating(null)
    const outfitKey = recommendedItems.map((item) => item.id).join('|')
    setStylingTip(getDailyStylingTip(userId, recommendedItems, items, weather?.condition ?? null, profile, today, `daily:${outfitKey}`))
  }, [userId, recommendedItems.map((item) => item.id).join('|'), items, weather?.condition, profile, todayKey])

  useEffect(() => {
    const node = sectionRef.current
    if (!node || !profile?.id || recommendedItems.length === 0) return
    let timer: number | undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.55 && timer === undefined) {
        timer = window.setTimeout(() => {
          const state = useRecommendationStore.getState()
          const todayKey = new Date().toISOString().slice(0, 10)
          const alreadyViewed = new Set((state.feedbackByUser[profile.id] ?? [])
            .filter((event) => event.action === 'dwell' && event.createdAt.slice(0, 10) === todayKey)
            .map((event) => event.itemId))
          const now = new Date().toISOString()
          const newViews = recommendedItems.filter((item) => !alreadyViewed.has(item.id)).map((item) => ({
            id: `dwell:${item.id}:${now.slice(0, 10)}`,
            itemId: item.id,
            action: 'dwell' as const,
            traits: traitsFromWardrobe(item),
            dwellSeconds: 5,
            createdAt: now,
          }))
          if (newViews.length) state.recordFeedbackBatch(profile.id, newViews)
        }, 5000)
      } else if (timer !== undefined) {
        window.clearTimeout(timer)
        timer = undefined
      }
    }, { threshold: [0, 0.55] })
    observer.observe(node)
    return () => {
      observer.disconnect()
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [recommendedItems, profile?.id])

  return (
    <section ref={sectionRef} className="mb-16 lg:mb-20" aria-labelledby="daily-outfit-title">
      {/* Heading, date, and today's weather as a wide strip right under the date. */}
      <h2 id="daily-outfit-title" className="m-0 text-left font-display text-3xl sm:text-4xl lg:text-5xl font-medium leading-tight text-text-primary">
        Today’s outfit <em className="italic text-butter-yellow">recommendation</em>
      </h2>
      <p className="mt-4 text-left text-2xs uppercase tracking-ultra-wide text-text-muted">{dateLabel}</p>
      <div className="mt-3 w-full max-w-5xl">
        <WeatherCard weather={weather} error={weatherError} />
      </div>
      <div className="daily-outfit-shell mt-6">
        <div className={`daily-outfit-layout${useRecommendationGrid ? ' daily-outfit-layout--many' : ''}`}>
          <div className={`daily-outfit-items${useRecommendationGrid ? ' daily-outfit-items--many' : ''}`} aria-live="polite">
          {recommendedItems.length ? (
            recommendedItems.map((item) => <RecommendationPiece key={item.id} item={item} />)
          ) : items.length < 2 ? (
            <StartKloset />
          ) : recommendationLoading || (!weather && !weatherError) ? (
            <p className="text-sm text-text-muted">Putting together today’s look from your Kloset…</p>
          ) : (
            <p className="text-sm text-text-muted">Add a top and bottom, or a dress, for a complete outfit recommendation.</p>
          )}
          </div>
          <aside className="daily-outfit-tips border border-text-primary/10 bg-surface p-5 sm:p-6" aria-labelledby="styling-tips-title">
          <div className="mb-4 text-[#355E3B] dark:text-[#9BC89D]">
            <h3 id="styling-tips-title" className="text-2xs font-semibold uppercase tracking-ultra-wide">Styling tips</h3>
          </div>
          {stylingTip ? <>
            <p className="text-sm leading-relaxed text-text-muted">{stylingTip.text}</p>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-text-primary/10 pt-3">
              <span className="text-[11px] text-text-muted">Rate this outfit</span>
              <div className="flex gap-2">
                <button type="button" aria-label="This outfit and styling tip are helpful" aria-pressed={dailyRating === 'like'} onClick={() => rateDailyOutfit('like')} className={`rounded-full p-2 transition ${dailyRating === 'like' || tipRating === 'helpful' ? 'bg-[#355E3B] text-white' : 'text-text-muted hover:bg-text-primary/5'}`}><ThumbsUp size={15} /></button>
                <button type="button" aria-label="This outfit and styling tip are not helpful" aria-pressed={dailyRating === 'dislike'} onClick={() => rateDailyOutfit('dislike')} className={`rounded-full p-2 transition ${dailyRating === 'dislike' || tipRating === 'not-helpful' ? 'bg-text-primary/10 text-text-primary' : 'text-text-muted hover:bg-text-primary/5'}`}><ThumbsDown size={15} /></button>
              </div>
            </div>
            {dislikedLook && (
              <MisfitPicker items={dislikedLook} misfitIds={dislikedMisfits} onChange={markDailyMisfits} title="What didn’t go in that look?" />
            )}
          </> : <p className="text-sm leading-relaxed text-text-muted">Add a few pieces to your Kloset to get a styling tip.</p>}
          </aside>
          <button
          onClick={() => onAskStylist(recommendedItems.map((item) => item.id))}
          className="daily-outfit-ask mt-12 flex h-12 w-full items-center justify-between bg-[#355E3B] px-5 text-sm font-medium tracking-wide text-[#FFFDD0] transition-colors hover:bg-[#2B4E31] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355E3B]"
        >
          <span>Ask stylist</span>
          <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}

/** A new Kloset: sample basics for a first outfit, or Shop for ideas. */
function StartKloset() {
  const navigate = useNavigate()
  const sampleKloset = useSampleKloset()
  return (
    <div className="text-sm text-text-muted">
      <p>Today’s outfit needs a couple of pieces. Try it with a few sample basics picked for your style; you can remove them any time in Profile.</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <button type="button" onClick={() => void sampleKloset.load()} className="rounded-full bg-[#355E3B] px-4 py-2 text-xs font-medium text-[#FFFDD0] hover:bg-[#2B4E31]">Use a sample Kloset</button>
        <button type="button" onClick={() => navigate('/wardrobe')} className="text-xs underline-offset-4 hover:text-text-primary hover:underline">Add my own</button>
        <button type="button" onClick={() => navigate('/discover')} className="text-xs underline-offset-4 hover:text-text-primary hover:underline">Browse inspiration</button>
      </div>
    </div>
  )
}

function RecommendationPiece({ item }: { item: ClothingItem }) {
  const imageUrl = useItemImage(item)

  return (
    <div className="daily-outfit-piece min-w-0">
      <div className="aspect-[4/5] overflow-hidden bg-surface">
        {imageUrl ? <img src={imageUrl} alt={item.name} className="h-full w-full object-contain p-3" /> : <div className="flex h-full w-full items-center justify-center"><Shirt size={28} className="text-text-primary/25" /></div>}
      </div>
      <span className="mt-2 block truncate text-sm font-medium text-text-primary">{item.name}</span>
    </div>
  )
}

function SectionHeader({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  const words = title.split(' ')
  const last = words.pop()
  return (
    <div className="flex items-end justify-between mb-6 border-b border-text-primary/15 pb-4">
      <h2 className="font-display text-3xl lg:text-4xl font-medium text-text-primary">
        {words.join(' ')} <em className="italic text-butter-yellow">{last}</em>
      </h2>
      {action && (
        <button onClick={action.onClick} className="text-tab">
          {action.label}
        </button>
      )}
    </div>
  )
}

function WardrobeThumb({ item, onClick }: { item: ClothingItem; onClick: () => void }) {
  const imageUrl = useItemImage(item)

  return (
    <button onClick={onClick} className="group text-left">
      <div className="relative aspect-[3/4] overflow-hidden bg-cream-200">
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Shirt size={24} className="text-text-primary/20" />
          </div>
        )}
        {item.isFavourite && (
          <Heart size={14} className="absolute top-3 right-3 fill-butter-yellow text-butter-yellow" />
        )}
      </div>
      <p className="text-sm text-text-primary mt-3 truncate group-hover:underline underline-offset-4">{item.name}</p>
      <p className="text-2xs uppercase tracking-widest text-text-muted mt-0.5">{item.category}</p>
    </button>
  )
}
