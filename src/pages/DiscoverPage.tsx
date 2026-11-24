import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, Heart, Search, SlidersHorizontal, X } from 'lucide-react'
import { clsx } from 'clsx'

import { CompleteAPiece } from '@/components/shop/CompleteAPiece'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useUserStore } from '@/store/userStore'
import { useAuth } from '@/contexts/AuthContext'
import { useRecommendationStore } from '@/store/recommendationStore'
import { saveFavouriteBrands } from '@/lib/profileService'
import { ALL_BRANDS, brandKey, canonicalBrand, likedBrands, searchBrands } from '@/lib/brands'
import { notify } from '@/store/undoStore'
import { CATALOG_STYLE_LABELS } from '@/lib/catalogData'
import { WebDiscoverFeed } from '@/components/shop/WebDiscoverFeed'
import { BUDGET_BANDS, type BudgetId, type PieceAnchor } from '@/lib/shopping'
import type { ClothingCategory, ClothingItem, StylePreference } from '@/types'

type ShopMode = 'buy' | 'rent'
type SortMode = 'recommended' | 'price-low' | 'price-high'

const CATEGORY_FILTERS: { value: ClothingCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'outerwear', label: 'Woolens' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
]

const budgetLabel = (id: BudgetId, mode: ShopMode) => {
  const band = BUDGET_BANDS.find((candidate) => candidate.id === id) ?? BUDGET_BANDS[0]
  return mode === 'rent' ? band.rentLabel : band.buyLabel
}

const anchorFromWardrobeItem = (item: ClothingItem): PieceAnchor => ({
  name: item.name, category: item.category, colours: item.colour, occasions: item.occasions,
  formality: item.formality, imageUrl: item.imageUrl,
})

// Colour filter choices; they're added to the live search words.
const SHOP_COLOURS = ['black', 'white', 'cream', 'beige', 'brown', 'grey', 'navy', 'blue', 'green', 'olive', 'sage', 'red', 'pink', 'yellow', 'lilac', 'orange']
const ALL_STYLES = Object.keys(CATALOG_STYLE_LABELS) as StylePreference[]

export function DiscoverPage() {
  const { user } = useAuth()
  const wardrobeItems = useWardrobeStore((state) => state.items)
  const profile = useUserStore((s) => s.profile)
  const updateProfile = useUserStore((s) => s.updateProfile)
  const feedback = useRecommendationStore((state) => profile?.id ? state.feedbackByUser[profile.id] ?? [] : [])
  const location = useLocation()
  const navigate = useNavigate()
  const filterRef = useRef<HTMLDivElement>(null)
  const routeItem = (location.state as { completeWith?: ClothingItem } | null)?.completeWith

  const [mode, setMode] = useState<ShopMode>('buy')
  const [budget, setBudget] = useState<BudgetId>('any')
  const [customBudgetAmount, setCustomBudgetAmount] = useState(6500)
  const [category, setCategory] = useState<ClothingCategory | 'all'>('all')
  // Shop one brand: live picks from its own site.
  const [brand, setBrand] = useState<string | null>(null)
  const [brandPickerOpen, setBrandPickerOpen] = useState(false)
  const [brandQuery, setBrandQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  // Live search runs once typing pauses, not on every keystroke (each search costs a call).
  const [liveSearch, setLiveSearch] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setLiveSearch(searchQuery.trim()), 700)
    return () => window.clearTimeout(timer)
  }, [searchQuery])
  // Brands live under the search bar: shown while searching, not as a row of their own.
  const [searchFocused, setSearchFocused] = useState(false)
  const [colours, setColours] = useState<string[]>([])
  const [styles, setStyles] = useState<StylePreference[]>([])
  const [sort, setSort] = useState<SortMode>('recommended')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completeAnchor, setCompleteAnchor] = useState<PieceAnchor | undefined>()

  useEffect(() => {
    if (!routeItem) return
    setCompleteAnchor(anchorFromWardrobeItem(routeItem))
    setCompleteOpen(true)
    navigate(location.pathname, { replace: true, state: null })
  }, [routeItem, navigate, location.pathname])

  useEffect(() => {
    if (!filtersOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !filterRef.current?.contains(event.target)) setFiltersOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setFiltersOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [filtersOpen])



  // The person's own styles first in the Style filter.
  const myStyles = profile?.stylePreferences ?? []
  const stylesAvailable = [...ALL_STYLES].sort((a, b) => Number(myStyles.includes(b)) - Number(myStyles.includes(a)) || a.localeCompare(b))
  const band = BUDGET_BANDS.find((candidate) => candidate.id === budget) ?? BUDGET_BANDS[0]
  const budgetRange: [number, number] | null = budget === 'any' ? null : budget === 'custom' ? [0, customBudgetAmount > 0 ? customBudgetAmount : Infinity] : band.buy

  const openComplete = (anchor?: PieceAnchor) => {
    setCompleteAnchor(anchor)
    setCompleteOpen(true)
  }
  const toggleValue = (values: string[], value: string, setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value])
  }

  // Brand bubbles: hearted brands, brands they own, then popular ones.
  const favouriteBrands = profile?.favouriteBrands ?? []
  const isFavouriteBrand = (name: string) => favouriteBrands.some((fav) => brandKey(fav) === brandKey(name))
  const brandBubbles = useMemo(() => {
    const liked = likedBrands(profile, wardrobeItems)
    return brand && !liked.some((entry) => brandKey(entry.name) === brandKey(brand)) ? [{ name: brand, favourite: false }, ...liked] : liked
  }, [profile, wardrobeItems, brand])
  const brandResults = useMemo(() => searchBrands(brandQuery), [brandQuery])
  const typedBrand = brandQuery.trim()
  const typedIsNew = typedBrand.length >= 2 && !ALL_BRANDS.some((name) => brandKey(name) === brandKey(canonicalBrand(typedBrand)))

  const toggleFavouriteBrand = (name: string) => {
    const canonical = canonicalBrand(name)
    const next = isFavouriteBrand(canonical)
      ? favouriteBrands.filter((fav) => brandKey(fav) !== brandKey(canonical))
      : [...favouriteBrands, canonical].slice(-50)
    updateProfile({ favouriteBrands: next })
    console.log('[shop] favourite brands', { count: next.length })
    if (user) void saveFavouriteBrands(user.id, next).then((saved) => { if (!saved) notify('Couldn’t save your favourite brands right now. They’re kept on this device.') })
  }
  const pickBrand = (name: string) => {
    setBrand(canonicalBrand(name))
    setBrandPickerOpen(false)
    setBrandQuery('')
  }

  // Under All, Suggested for you (live picks for their Kloset: what they own
  // and need) comes first, when nothing narrows the page.
  const liveSuggested = mode === 'buy' && category === 'all' && !brand && !liveSearch && sort === 'recommended' && budget === 'any' && colours.length === 0 && styles.length === 0


  const activeFilters = [
    ...(budget !== 'any' ? [{ key: 'budget', label: budgetLabel(budget, mode), remove: () => setBudget('any') }] : []),
    ...colours.map((colour) => ({ key: `colour-${colour}`, label: colour, remove: () => setColours(colours.filter((entry) => entry !== colour)) })),
    ...styles.map((style) => ({ key: `style-${style}`, label: CATALOG_STYLE_LABELS[style] ?? style, remove: () => setStyles(styles.filter((entry) => entry !== style)) })),
  ]

  return (
    <div className="min-h-screen bg-warm-cream pt-16 pb-28 lg:pt-20 md:pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="flex min-h-14 items-center justify-between gap-3 pt-2">
          <h1 className="font-display text-3xl font-medium leading-tight text-text-primary">Shop</h1>
          <div className="flex items-center gap-2 sm:gap-3">
            {mode === 'buy' && !completeOpen && (
              <button onClick={() => openComplete()} className="inline-flex h-9 shrink-0 items-center rounded-full border border-text-primary/20 px-4 text-xs text-text-primary transition-colors hover:border-text-primary/45 hover:bg-text-primary/5">
                Complete a piece
              </button>
            )}
            <div className="inline-flex rounded-full border border-text-primary/15 bg-surface p-0.5" role="tablist" aria-label="Shop mode">
              {(['buy', 'rent'] as const).map((value) => (
                <button key={value} role="tab" aria-selected={mode === value} onClick={() => { setMode(value); setCategory('all'); setBudget('any') }} className={clsx('h-8 rounded-full px-4 text-xs transition-colors', mode === value ? 'bg-text-primary text-warm-cream' : 'text-text-muted hover:text-text-primary')}>
                  {value === 'buy' ? 'Buy' : 'Rent'}
                </button>
              ))}
            </div>
          </div>
        </header>

        {mode === 'buy' && !completeOpen && <>
          <label className="mt-4 flex h-11 items-center gap-2.5 rounded-full border border-text-primary/15 bg-surface px-4 text-text-muted transition-colors focus-within:border-text-primary/45">
            <Search size={16} strokeWidth={1.5} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} type="search" placeholder="Search pieces or brands" aria-label="Search Shop by piece or brand" className="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none" />
            {searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear shop search" className="p-1 hover:text-text-primary"><X size={14} /></button>}
          </label>
          {/* Brands under search: your brands while the box is focused, matching brands as you type. */}
          {(searchFocused || searchQuery.trim() || brandPickerOpen) && (
            <div className="flex items-center gap-2 overflow-x-auto pt-3 pb-1 no-scrollbar" aria-label="Shop by brand">
              <span className="shrink-0 pr-1 text-xs text-text-muted">Brands</span>
              {(searchQuery.trim() ? searchBrands(searchQuery).slice(0, 6).map((name) => ({ name, favourite: isFavouriteBrand(name) })) : brandBubbles).map(({ name, favourite }) => (
                <button key={name} type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => { pickBrand(name); setSearchQuery('') }} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-text-primary/15 px-3 py-1 text-xs text-text-muted transition-colors hover:border-text-primary/40 hover:text-text-primary">
                  {favourite && <Heart size={10} fill="currentColor" aria-label="Favourite" />}
                  {name}
                </button>
              ))}
              <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => setBrandPickerOpen((open) => !open)} aria-expanded={brandPickerOpen} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-text-primary/30 px-3 py-1 text-xs text-text-primary hover:border-text-primary/60">
                <Search size={11} /> All brands
              </button>
            </div>
          )}
        {brandPickerOpen && (
          <section aria-label="All brands" className="py-3">
            <label className="flex items-center gap-2 border-b border-text-primary/15 px-1 py-2 text-text-muted focus-within:border-text-primary/50">
              <Search size={14} strokeWidth={1.5} />
              <input autoFocus value={brandQuery} onChange={(event) => setBrandQuery(event.target.value)} type="search" placeholder="Search any brand" aria-label="Search brands" className="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none" />
              <button type="button" onClick={() => { setBrandPickerOpen(false); setBrandQuery('') }} aria-label="Close brands" className="p-1 hover:text-text-primary"><X size={14} /></button>
            </label>
            <p className="mt-2 text-xs text-text-muted">Tap a brand to shop it. Tap the heart to keep it in your bubbles.</p>
            <div className="mt-2 flex max-h-64 flex-wrap gap-2 overflow-y-auto pb-1">
              {brandResults.map((name) => <BrandBubble key={name} name={name} favourite={isFavouriteBrand(name)} onPick={() => pickBrand(name)} onToggleFavourite={() => toggleFavouriteBrand(name)} />)}
              {/* Any other brand, after the directory's matches. */}
              {typedIsNew && <BrandBubble name={typedBrand} label={`Shop “${typedBrand}”`} favourite={isFavouriteBrand(typedBrand)} onPick={() => pickBrand(typedBrand)} onToggleFavourite={() => toggleFavouriteBrand(typedBrand)} />}
              {!typedIsNew && brandResults.length === 0 && <p className="text-xs text-text-muted">No brands match. Keep typing to search any brand.</p>}
            </div>
          </section>
        )}
          {brand && (
            <div className="flex items-center gap-2 pt-2.5">
              <button type="button" onClick={() => setBrand(null)} className="inline-flex items-center gap-1.5 rounded-full border border-text-primary bg-text-primary px-3 py-1 text-xs text-warm-cream" aria-label={`Stop shopping ${brand}`}>
                {isFavouriteBrand(brand) && <Heart size={10} fill="currentColor" aria-hidden="true" />}Shopping {brand} <X size={12} />
              </button>
            </div>
          )}
        </>}

        {mode === 'rent' && !completeOpen ? (
          <div className="py-24 text-center">
            <p className="font-display text-3xl text-text-primary">Renting is coming soon</p>
            <p className="mt-2 text-sm text-text-muted">You’ll be able to rent pieces by the week, right here.</p>
          </div>
        ) : completeOpen ? (
          <section className="py-5" aria-label="Complete a piece">
            <div className="mb-4 flex items-center justify-end">
              <button onClick={() => { setCompleteOpen(false); setCompleteAnchor(undefined) }} aria-label="Close complete-a-piece" className="p-1 text-text-muted hover:text-text-primary"><X size={18} /></button>
            </div>
            <CompleteAPiece key={completeAnchor?.name ?? 'choose-piece'} profile={profile} wardrobe={wardrobeItems} feedback={feedback} initialAnchor={completeAnchor} />
          </section>
        ) : <>
        <div className="mt-4 flex items-center gap-4 border-b border-text-primary/10 pb-3">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto no-scrollbar" aria-label="Shop categories">
            {CATEGORY_FILTERS.map((filter) => (
              <button key={filter.value} onClick={() => setCategory(filter.value)} aria-pressed={category === filter.value} className={clsx('shrink-0 rounded-full px-3 py-1.5 text-sm tracking-normal transition-colors', category === filter.value ? 'bg-text-primary/8 font-medium text-text-primary' : 'text-text-muted hover:text-text-primary')}>
                {filter.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="relative" ref={filterRef}>
              <button onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-text-primary transition-colors hover:bg-text-primary/5">
                <SlidersHorizontal size={15} strokeWidth={1.4} /> <span>Filters</span>
                {activeFilters.length > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-text-primary px-1 text-2xs tabular-nums text-warm-cream">{activeFilters.length}</span>}
              </button>
              {filtersOpen && <div className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] border border-text-primary/10 bg-surface p-4 shadow-lifted">
                <div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-medium text-text-primary">Filters</h3><button onClick={() => { setBudget('any'); setColours([]); setStyles([]) }} className="text-xs text-text-muted hover:text-text-primary">Clear all</button></div>
                <FilterGroup label="Budget">
                  {BUDGET_BANDS.map((band) => <label key={band.id} className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-text-muted"><input type="radio" className="accent-text-primary" name="shop-budget" checked={budget === band.id} onChange={() => setBudget(band.id)} />{band.buyLabel}</label>)}
                  {budget === 'custom' && <label className="mt-2 flex items-center gap-2 text-xs text-text-muted">Maximum ₹<input type="number" min="1" value={customBudgetAmount} onChange={(event) => setCustomBudgetAmount(Number(event.target.value))} className="w-24 border-b border-text-primary/20 bg-transparent px-1 py-1 text-text-primary focus:outline-none" /></label>}
                </FilterGroup>
                <FilterGroup label="Colour">
                  <div className="grid max-h-28 grid-cols-2 gap-x-2 overflow-y-auto">{SHOP_COLOURS.map((colour) => <label key={colour} className="flex cursor-pointer items-center gap-2 py-1 text-xs capitalize text-text-muted"><input type="checkbox" className="accent-text-primary" checked={colours.includes(colour)} onChange={() => toggleValue(colours, colour, setColours)} />{colour}</label>)}</div>
                </FilterGroup>
                <FilterGroup label="Style">
                  {myStyles.length > 0 && <button type="button" onClick={() => setStyles(myStyles.filter((style) => stylesAvailable.includes(style)))} className="mb-1.5 text-xs text-text-primary underline underline-offset-4">Just my style</button>}
                  <div className="grid grid-cols-2 gap-x-2">{stylesAvailable.map((style) => <label key={style} className="flex cursor-pointer items-center gap-2 py-1 text-xs text-text-muted"><input type="checkbox" className="accent-text-primary" checked={styles.includes(style)} onChange={() => setStyles(styles.includes(style) ? styles.filter((entry) => entry !== style) : [...styles, style])} />{CATALOG_STYLE_LABELS[style] ?? style}{myStyles.includes(style) && <span className="text-2xs text-butter-yellow">· yours</span>}</label>)}</div>
                </FilterGroup>

                <FilterGroup label="Size"><p className="text-xs leading-relaxed text-text-muted">Sizes are picked on each store’s site.</p></FilterGroup>
              </div>}
            </div>
            <label className="flex items-center gap-1 text-xs text-text-primary">
              <span className="sr-only">Sort products</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="max-w-28 cursor-pointer appearance-none bg-transparent py-1.5 pr-3 text-xs text-text-primary focus:outline-none sm:max-w-none">
                <option value="recommended">Recommended</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option>
              </select><ChevronDown size={13} className="pointer-events-none -ml-1" />
            </label>
          </div>
        </div>



        {activeFilters.length > 0 && <div className="flex flex-wrap gap-2 pt-3">{activeFilters.map((filter) => <button key={filter.key} onClick={filter.remove} className="inline-flex items-center gap-1.5 rounded-full border border-text-primary/15 px-2.5 py-1 text-xs text-text-muted hover:border-text-primary/35 hover:text-text-primary">{filter.label}<X size={12} /></button>)}</div>}


        {/* Everything on Shop is live: Suggested for your Kloset first under All, then the feed for the tab, search, filters or brand. */}
        {liveSuggested && <WebDiscoverFeed key="kloset-suggested" variant="suggested" profile={profile} category="all" feedback={feedback} wardrobe={wardrobeItems} />}
        <WebDiscoverFeed
          key={`${category}:${brand ?? ''}:${liveSearch}:${colours.join(',')}:${styles.join(',')}`}
          variant={liveSearch ? 'search' : 'browse'}
          profile={profile}
          category={category}
          feedback={feedback}
          brand={brand}
          search={liveSearch}
          colours={colours}
          styles={styles}
          budgetRange={budgetRange}
          sort={sort}
          wardrobe={wardrobeItems}
        />
        </>}
      </div>
    </div>
  )
}

function BrandBubble({ name, label, favourite, onPick, onToggleFavourite }: { name: string; label?: string; favourite: boolean; onPick: () => void; onToggleFavourite: () => void }) {
  return (
    <span className="inline-flex items-center rounded-full border border-text-primary/15 text-xs text-text-primary">
      <button type="button" onClick={onPick} className="py-1 pl-3 pr-1.5 hover:underline">{label ?? name}</button>
      <button type="button" onClick={onToggleFavourite} aria-pressed={favourite} aria-label={favourite ? `Remove ${name} from favourite brands` : `Add ${name} to favourite brands`} className={clsx('py-1 pl-1 pr-2.5', favourite ? 'text-butter-yellow' : 'text-text-muted hover:text-text-primary')}>
        <Heart size={12} fill={favourite ? 'currentColor' : 'none'} />
      </button>
    </span>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <fieldset className="mb-4 border-t border-text-primary/10 pt-3"><legend className="mb-1 text-xs font-medium text-text-primary">{label}</legend>{children}</fieldset>
}
