import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shirt, Heart, Plus, ArrowRight, Cloud, CloudDrizzle, CloudLightning, CloudOff, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from 'lucide-react'
import { useUserStore } from '@/store/userStore'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useItemImage } from '@/hooks/useItemImage'
import type { ClothingItem } from '@/types'
import { generateOutfit, type WeatherCondition } from '@/lib/stylist'
import { getLocalWeather } from '@/lib/weather'

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
          onAskStylist={() => navigate('/stylist', { state: { mode: 'wardrobe' } })}
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

type CurrentWeather = { temperature: number; label: string; condition: WeatherCondition; code: number; dateKey: string }

function stableHash(value: string): number {
  return [...value].reduce((hash, character) => (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0, 7)
}

function weatherDescription(code: number): string {
  if (code === 0) return 'Clear sky'
  if (code === 1) return 'Mostly clear'
  if (code === 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code === 45 || code === 48) return 'Foggy'
  if (code >= 51 && code <= 57) return 'Drizzle'
  if (code >= 61 && code <= 67) return 'Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Rain showers'
  if (code === 85 || code === 86) return 'Snow showers'
  if (code >= 95) return 'Thunderstorm'
  return 'Current conditions'
}

function weatherIcon(code: number): LucideIcon {
  if (code <= 1) return Sun
  if (code === 2) return CloudSun
  if (code === 3 || code === 45 || code === 48) return Cloud
  if (code >= 51 && code <= 57) return CloudDrizzle
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow
  if (code >= 95) return CloudLightning
  return CloudSun
}

/** Practical, outfit-specific finishing ideas based on the pieces on today's rack. */
function buildStylingTips(outfit: ClothingItem[], weather: CurrentWeather | null): string[] {
  if (outfit.length === 0) return []

  const tops = outfit.filter((item) => item.category === 'tops')
  const bottoms = outfit.filter((item) => item.category === 'bottoms')
  const dresses = outfit.filter((item) => item.category === 'dresses')
  const outerwear = outfit.filter((item) => item.category === 'outerwear')
  const shoes = outfit.filter((item) => item.category === 'shoes')
  const accessories = outfit.filter((item) => item.category === 'accessories')
  const printed = outfit.filter((item) => item.pattern !== 'solid')
  const solid = outfit.filter((item) => item.pattern === 'solid')
  const sharedColour = outfit
    .flatMap((item) => item.colour.map((colour) => ({ itemId: item.id, colour: colour.trim(), key: colour.trim().toLowerCase() })))
    .find(({ itemId, key }) => key && outfit.some((item) => item.id !== itemId && item.colour.some((colour) => colour.trim().toLowerCase() === key)))
  const tips: string[] = []

  if (tops.length && bottoms.length) {
    const top = tops[0]
    const bottom = bottoms[0]
    const relaxedTop = /relaxed|oversized|loose/i.test(top.fit ?? top.name)
    const relaxedBottom = /relaxed|oversized|wide|loose/i.test(bottom.fit ?? bottom.name)
    if (relaxedTop && relaxedBottom) {
      tips.push('Add shape with a half-tuck or rolled sleeves.')
    } else if (relaxedTop) {
      tips.push('Balance the relaxed top with a half-tuck or slim belt.')
    } else if (relaxedBottom) {
      tips.push('Define the waist to balance the relaxed silhouette.')
    } else {
      tips.push('Try a small front tuck to define the waist.')
    }
  } else if (dresses.length) {
    tips.push('Let the dress lead; add one simple finishing detail.')
  } else if (tops.length) {
    tips.push('Try a cuff or relaxed half-tuck to add shape.')
  } else if (bottoms.length) {
    tips.push('Keep the top simple and define the waist.')
  }

  if (printed.length && solid.length) {
    tips.push('Let the print lead; keep accessories simple.')
  } else if (sharedColour) {
    tips.push(`Repeat ${sharedColour.colour} in one small accessory.`)
  } else if (printed.length) {
    tips.push('Keep accessories pared back around the print.')
  } else if (accessories.length) {
    tips.push('Let one accessory be the finishing touch.')
  } else if (shoes.length) {
    tips.push('Echo a shoe colour in one small detail.')
  } else {
    tips.push('Add a belt, scarf, or light layer to finish the look.')
  }

  if (outerwear.length) {
    tips.push('Wear the outer layer open; push the sleeves back.')
  } else if (weather?.condition === 'rainy') {
    tips.push('Choose a light rain layer and shoes with grip.')
  } else if (weather?.condition === 'cold' || weather?.condition === 'cool') {
    tips.push('Add a warm layer; wear it open indoors.')
  } else if (weather?.condition === 'hot') {
    tips.push('Keep layers light and choose breathable accessories.')
  } else if (accessories.length) {
    tips.push('Roll a cuff for an easy, considered finish.')
  } else {
    tips.push('Finish with a rolled cuff or slim belt.')
  }

  return tips.slice(0, 3)
}

function DailyOutfitCard({ items, profile, onAskStylist }: {
  items: ClothingItem[]
  profile: Parameters<typeof generateOutfit>[2]
  onAskStylist: () => void
}) {
  const [weather, setWeather] = useState<CurrentWeather | null>(null)
  const [weatherError, setWeatherError] = useState(false)
  const [recommendation, setRecommendation] = useState<string[] | null>(null)
  const [recommendationLoading, setRecommendationLoading] = useState(false)
  const [today, setToday] = useState(() => new Date())
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(today)
  const recommendedItems = recommendation?.length
    ? items.filter((item) => recommendation.includes(item.id))
    : []
  const stylingTips = buildStylingTips(recommendedItems, weather)

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
    getLocalWeather().then(({ temperature, code, condition }) => {
      setWeather({ temperature, label: weatherDescription(code), condition, code, dateKey: weatherDateKey })
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
    const cacheKey = `kloset:daily-outfit:v4:${profile?.id ?? profile?.name ?? 'guest'}:${dayKey}:${wardrobeKey}`
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
    void generateOutfit({ occasion: 'casual', weather: weather?.condition ?? 'warm', mood: 'relaxed' }, items, profile, dailyAttempt)
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
  }, [weather, weatherError, items, profile, today.getDate(), today.getMonth(), today.getFullYear()])

  return (
    <section className="mb-16 lg:mb-20" aria-labelledby="daily-outfit-title">
      <h2 id="daily-outfit-title" className="m-0 text-left font-display text-3xl sm:text-4xl lg:text-5xl font-medium leading-tight text-text-primary">
        Today’s outfit <em className="italic text-butter-yellow">recommendation</em>
      </h2>
      <p className="mt-4 ml-0 text-left text-2xs uppercase tracking-ultra-wide text-text-muted">{dateLabel}</p>
      <div className="mt-3 ml-0 flex items-center gap-2 text-left text-sm text-text-muted" aria-live="polite">
        {weather ? (() => {
          const Icon = weatherIcon(weather.code)
          return <><Icon size={18} className="text-deep-purple" /><span>{weather.label} · {Math.round(weather.temperature)}°C</span></>
        })() : <><CloudOff size={18} className="text-deep-purple" /><span>{weatherError ? 'Weather unavailable — allow location access to see local conditions.' : 'Checking today’s weather…'}</span></>}
      </div>
      <div className="daily-outfit-shell mt-6">
        <div className="daily-outfit-layout">
          <div className="daily-outfit-items" aria-live="polite">
          {recommendedItems.length ? (
            recommendedItems.map((item) => <RecommendationPiece key={item.id} item={item} />)
          ) : items.length < 2 ? (
            <p className="text-sm text-text-muted">Add at least two pieces to your Kloset for a personal outfit recommendation.</p>
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
          {stylingTips.length ? <ul className="space-y-4">
            {stylingTips.map((tip) => (
              <li key={tip} className="flex gap-3 text-sm leading-relaxed text-text-muted">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-butter-yellow" aria-hidden="true" />
                <span>{tip}</span>
              </li>
            ))}
          </ul> : <p className="text-sm leading-relaxed text-text-muted">Outfit-specific tips will appear here with today’s look.</p>}
          </aside>
          <button
          onClick={onAskStylist}
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
