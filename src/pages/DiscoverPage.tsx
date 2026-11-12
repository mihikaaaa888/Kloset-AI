import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import { clsx } from 'clsx'

import { ShopItemCard } from '@/components/shop/ShopItemCard'
import { CompleteAPiece } from '@/components/shop/CompleteAPiece'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useUserStore } from '@/store/userStore'
import { useAuth } from '@/contexts/AuthContext'
import { useRecommendationStore } from '@/store/recommendationStore'
import { deleteItem as dbDeleteItem, insertItem } from '@/lib/wardrobeService'
import { deleteWithUndo, notify, offerUndo } from '@/store/undoStore'
import { ALL_CATALOG_ITEMS } from '@/lib/catalogData'
import { catalogToItem } from '@/lib/outfitPieces'
import {
  BUDGET_BANDS,
  fitsBuyBudget,
  fitsRentBudget,
  isRentable,
  rankForUser,
  type BudgetId,
  type PieceAnchor,
} from '@/lib/shopping'
import type { CatalogItem, ClothingCategory, ClothingItem } from '@/types'

type ShopMode = 'buy' | 'rent'
type SortMode = 'recommended' | 'price-low' | 'price-high' | 'name'

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

const anchorFromCatalogItem = (item: CatalogItem): PieceAnchor => ({
  name: item.name, category: item.category, colours: item.colours, occasions: item.occasions,
  formality: item.formality, imageUrl: item.imageUrl,
})

export function DiscoverPage() {
  const { user } = useAuth()
  const { items: wardrobeItems, addItem, removeItem } = useWardrobeStore()
  const profile = useUserStore((s) => s.profile)
  const feedback = useRecommendationStore((state) => profile?.id ? state.feedbackByUser[profile.id] ?? [] : [])
  const location = useLocation()
  const navigate = useNavigate()
  const filterRef = useRef<HTMLDivElement>(null)
  const routeItem = (location.state as { completeWith?: ClothingItem } | null)?.completeWith

  const [mode, setMode] = useState<ShopMode>('buy')
  const [budget, setBudget] = useState<BudgetId>('any')
  const [customBudgetAmount, setCustomBudgetAmount] = useState(6500)
  const [category, setCategory] = useState<ClothingCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [retailers, setRetailers] = useState<string[]>([])
  const [colours, setColours] = useState<string[]>([])
  const [sort, setSort] = useState<SortMode>('recommended')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completeAnchor, setCompleteAnchor] = useState<PieceAnchor | undefined>()
  const [addedThisSession, setAddedThisSession] = useState<Set<string>>(new Set())

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

  const addedCatalogIds = useMemo(
    () => new Set(wardrobeItems.map((item) => item.catalogId).filter(Boolean) as string[]),
    [wardrobeItems],
  )
  const isInWardrobe = (id: string) => addedCatalogIds.has(id) || addedThisSession.has(id)

  const retailersAvailable = useMemo(() => [...new Set(ALL_CATALOG_ITEMS.map((item) => item.brand).filter(Boolean) as string[])].sort(), [])
  const brandSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return query ? retailersAvailable.filter((brand) => brand.toLowerCase().includes(query)).slice(0, 5) : []
  }, [retailersAvailable, searchQuery])
  const coloursAvailable = useMemo(() => [...new Set(ALL_CATALOG_ITEMS.flatMap((item) => item.colours))].sort(), [])

  const pieces = useMemo(() => {
    const preference = String(profile?.genderStylePreference ?? '').toLowerCase()
    const genders = ['feminine', 'female', 'women'].includes(preference)
      ? ['women']
      : ['masculine', 'male', 'men'].includes(preference)
        ? ['men']
        : ['women', 'men']
    const pool = ALL_CATALOG_ITEMS
      .filter((item) => genders.includes(item.gender ?? 'women'))
      .filter((item) => mode === 'rent' ? isRentable(item) && fitsRentBudget(item, budget, customBudgetAmount) : fitsBuyBudget(item, budget, customBudgetAmount))
      .filter((item) => category === 'all' || item.category === category)
      .filter((item) => {
        const query = searchQuery.trim().toLowerCase()
        return !query || [item.name, item.brand, item.category, item.subcategory, item.material, item.description, ...(item.colours ?? []), ...(item.occasions ?? [])]
          .some((value) => value?.toLowerCase().includes(query))
      })
      .filter((item) => retailers.length === 0 || retailers.includes(item.brand ?? ''))
      .filter((item) => colours.length === 0 || item.colours.some((colour) => colours.includes(colour)))
    const ranked = rankForUser(pool, profile, wardrobeItems, feedback)
    if (sort === 'price-low') return [...ranked].sort((a, b) => (mode === 'rent' ? a.rentPricePerWeek - b.rentPricePerWeek : a.estimatedPrice - b.estimatedPrice))
    if (sort === 'price-high') return [...ranked].sort((a, b) => (mode === 'rent' ? b.rentPricePerWeek - a.rentPricePerWeek : b.estimatedPrice - a.estimatedPrice))
    if (sort === 'name') return [...ranked].sort((a, b) => a.name.localeCompare(b.name))
    return ranked
  }, [mode, budget, customBudgetAmount, category, profile, wardrobeItems, feedback, retailers, colours, sort, searchQuery])

  const handleAdd = useCallback((catalogItem: CatalogItem) => {
    if (isInWardrobe(catalogItem.id)) return
    const newItem = catalogToItem(catalogItem, crypto.randomUUID())
    console.log('[shop] add to Kloset', { id: catalogItem.id, mode })
    addItem(newItem)
    setAddedThisSession((previous) => new Set(previous).add(catalogItem.id))
    const saved = user
      ? insertItem(user.id, newItem).catch((error) => {
          console.error('[shop] failed to save item', catalogItem.id, error)
          throw error
        })
      : Promise.resolve()
    offerUndo(`Added ${catalogItem.name} to your Kloset`, async () => {
      removeItem(newItem.id)
      setAddedThisSession((previous) => {
        const next = new Set(previous)
        next.delete(catalogItem.id)
        return next
      })
      try {
        await saved
        if (user) await dbDeleteItem(user.id, newItem.id, newItem.imageStoragePath)
      } catch {
        addItem(newItem)
        setAddedThisSession((previous) => new Set(previous).add(catalogItem.id))
        notify(`Couldn't undo adding ${catalogItem.name}. It's back in your Kloset.`)
      }
    })
  }, [addItem, removeItem, user, mode, wardrobeItems, addedThisSession])

  const handleRemove = useCallback((catalogItem: CatalogItem) => {
    const item = useWardrobeStore.getState().items.find((wardrobeItem) => wardrobeItem.catalogId === catalogItem.id)
    if (!item) {
      setAddedThisSession((previous) => {
        const next = new Set(previous)
        next.delete(catalogItem.id)
        return next
      })
      return
    }
    console.log('[shop] remove from Kloset', { id: catalogItem.id })
    deleteWithUndo({
      message: `Removed ${catalogItem.name} from your Kloset`,
      keys: [`wardrobe:${item.id}`],
      remove: () => {
        removeItem(item.id)
        setAddedThisSession((previous) => {
          const next = new Set(previous)
          next.delete(catalogItem.id)
          return next
        })
      },
      restore: () => {
        addItem(item)
        setAddedThisSession((previous) => new Set(previous).add(catalogItem.id))
      },
      commit: async () => {
        if (!user) return
        try {
          await dbDeleteItem(user.id, item.id, item.imageStoragePath)
        } catch (error) {
          addItem(item)
          setAddedThisSession((previous) => new Set(previous).add(catalogItem.id))
          notify(`Couldn't remove ${catalogItem.name}. It's back in your Kloset.`)
          throw error
        }
      },
    })
  }, [addItem, removeItem, user])

  const openComplete = (anchor?: PieceAnchor) => {
    setCompleteAnchor(anchor)
    setCompleteOpen(true)
  }
  const toggleValue = (values: string[], value: string, setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value])
  }

  const isEmpty = pieces.length === 0
  const suggested = mode === 'buy' ? pieces.slice(0, 10) : []
  const rest = mode === 'buy' ? pieces.slice(10) : pieces
  const renderGrid = (list: CatalogItem[]) => (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {list.map((item) => (
        <ShopItemCard
          key={item.id}
          item={item}
          mode={mode}
          inWardrobe={isInWardrobe(item.id)}
          onAdd={() => handleAdd(item)}
          onRemove={() => handleRemove(item)}
          onCompletePiece={() => openComplete(anchorFromCatalogItem(item))}
        />
      ))}
    </div>
  )

  const activeFilters = [
    ...(budget !== 'any' ? [{ key: 'budget', label: budgetLabel(budget, mode), remove: () => setBudget('any') }] : []),
    ...retailers.map((retailer) => ({ key: `retailer-${retailer}`, label: retailer, remove: () => setRetailers(retailers.filter((entry) => entry !== retailer)) })),
    ...colours.map((colour) => ({ key: `colour-${colour}`, label: colour, remove: () => setColours(colours.filter((entry) => entry !== colour)) })),
  ]

  return (
    <div className="min-h-screen bg-warm-cream pt-24 pb-28 lg:pt-28 md:pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between border-b border-text-primary/10 pb-3 pt-2">
          <div className="inline-flex rounded-full border border-text-primary/15 bg-surface p-1" role="tablist" aria-label="Shop mode">
            {(['buy', 'rent'] as const).map((value) => (
              <button key={value} role="tab" aria-selected={mode === value} onClick={() => { setMode(value); setCategory('all'); setBudget('any') }} className={clsx('rounded-full px-5 py-2 text-xs tracking-wide transition-colors', mode === value ? 'bg-text-primary text-warm-cream' : 'text-text-muted hover:text-text-primary')}>
                {value === 'buy' ? 'Buy' : 'Rent'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'buy' && !completeOpen && <>
          <label className="mt-4 flex items-center gap-2 border-b border-text-primary/15 px-1 py-2 text-text-muted focus-within:border-text-primary/50">
            <Search size={16} strokeWidth={1.5} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} type="search" placeholder="Search items or brands" aria-label="Search Shop by item or brand" className="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none" />
            {searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear shop search" className="p-1 hover:text-text-primary"><X size={14} /></button>}
          </label>
          {brandSuggestions.length > 0 && <div className="flex flex-wrap gap-2 pt-2" aria-label="Matching brands">{brandSuggestions.map((brand) => <button key={brand} type="button" onClick={() => { setRetailers((selected) => selected.includes(brand) ? selected : [...selected, brand]); setSearchQuery('') }} className="rounded-full border border-text-primary/15 bg-surface px-3 py-1.5 text-xs text-text-primary hover:border-text-primary/40">Shop {brand}</button>)}</div>}
        </>}

        {mode === 'rent' && !completeOpen ? (
          <div className="py-20 text-center"><p className="mb-5 font-display text-2xl text-text-primary">Coming soon</p><button onClick={() => openComplete()} className="border border-text-primary/25 px-4 py-2 text-sm text-text-primary hover:border-text-primary/50">Complete a piece</button></div>
        ) : completeOpen ? (
          <section className="py-5" aria-label="Complete a piece">
            <div className="mb-4 flex items-center justify-end">
              <button onClick={() => { setCompleteOpen(false); setCompleteAnchor(undefined) }} aria-label="Close complete-a-piece" className="p-1 text-text-muted hover:text-text-primary"><X size={18} /></button>
            </div>
            <CompleteAPiece key={completeAnchor?.name ?? 'choose-piece'} mode={mode} budget={budget} onBudgetChange={setBudget} customBudgetAmount={customBudgetAmount} onCustomBudgetAmountChange={setCustomBudgetAmount} profile={profile} wardrobe={wardrobeItems} isInWardrobe={isInWardrobe} initialAnchor={completeAnchor} />
          </section>
        ) : <>
        <div className="flex items-center gap-4 border-b border-text-primary/10 py-3">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto no-scrollbar" aria-label="Shop categories">
            {CATEGORY_FILTERS.map((filter) => (
              <button key={filter.value} onClick={() => setCategory(filter.value)} aria-pressed={category === filter.value} className={clsx('shrink-0 rounded-full px-3 py-1.5 text-sm tracking-normal transition-colors', category === filter.value ? 'bg-text-primary/8 font-medium text-text-primary' : 'text-text-muted hover:text-text-primary')}>
                {filter.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="relative" ref={filterRef}>
              <button onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs text-text-primary hover:bg-text-primary/5">
                <SlidersHorizontal size={15} strokeWidth={1.4} /> <span>Filters</span>
                {activeFilters.length > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-text-primary px-1 text-[9px] text-warm-cream">{activeFilters.length}</span>}
              </button>
              {filtersOpen && <div className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] border border-text-primary/10 bg-surface p-4 shadow-lifted">
                <div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-medium text-text-primary">Filters</h3><button onClick={() => { setBudget('any'); setRetailers([]); setColours([]) }} className="text-xs text-text-muted hover:text-text-primary">Clear all</button></div>
                <FilterGroup label="Budget">
                  {BUDGET_BANDS.map((band) => <label key={band.id} className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-text-muted"><input type="radio" name="shop-budget" checked={budget === band.id} onChange={() => setBudget(band.id)} />{band.buyLabel}</label>)}
                  {budget === 'custom' && <label className="mt-2 flex items-center gap-2 text-xs text-text-muted">Maximum ₹<input type="number" min="1" value={customBudgetAmount} onChange={(event) => setCustomBudgetAmount(Number(event.target.value))} className="w-24 border-b border-text-primary/20 bg-transparent px-1 py-1 text-text-primary focus:outline-none" /></label>}
                </FilterGroup>
                <FilterGroup label="Retailer">
                  <div className="grid max-h-28 grid-cols-2 gap-x-2 overflow-y-auto">{retailersAvailable.map((retailer) => <label key={retailer} className="flex cursor-pointer items-center gap-2 py-1 text-xs text-text-muted"><input type="checkbox" checked={retailers.includes(retailer)} onChange={() => toggleValue(retailers, retailer, setRetailers)} />{retailer}</label>)}</div>
                </FilterGroup>
                <FilterGroup label="Colour">
                  <div className="grid max-h-28 grid-cols-2 gap-x-2 overflow-y-auto">{coloursAvailable.map((colour) => <label key={colour} className="flex cursor-pointer items-center gap-2 py-1 text-xs text-text-muted"><input type="checkbox" checked={colours.includes(colour)} onChange={() => toggleValue(colours, colour, setColours)} />{colour}</label>)}</div>
                </FilterGroup>
                <FilterGroup label="Size"><p className="text-xs leading-relaxed text-text-muted">Sizes are selected on the retailer’s site. Size data isn’t available in this catalog yet.</p></FilterGroup>
              </div>}
            </div>
            <label className="flex items-center gap-1 text-xs text-text-primary">
              <span className="sr-only">Sort products</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="max-w-24 appearance-none bg-transparent py-1.5 pr-3 text-xs text-text-primary focus:outline-none sm:max-w-none">
                <option value="recommended">Sort</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name</option>
              </select><ChevronDown size={13} className="pointer-events-none -ml-1" />
            </label>
          </div>
        </div>

        {activeFilters.length > 0 && <div className="flex flex-wrap gap-2 pt-3">{activeFilters.map((filter) => <button key={filter.key} onClick={filter.remove} className="inline-flex items-center gap-1.5 rounded-full border border-text-primary/15 px-2.5 py-1 text-xs text-text-muted hover:border-text-primary/35 hover:text-text-primary">{filter.label}<X size={12} /></button>)}</div>}

        <div className="flex items-center justify-between gap-3 pt-4 pb-3">
          <div>
            <h2 className="text-sm font-medium text-text-muted">Suggested for you</h2>
          </div>
          <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
            <button onClick={() => openComplete()} className="inline-flex h-8 shrink-0 items-center gap-1.5 border border-text-primary/25 px-3 text-xs text-text-primary transition-colors hover:border-text-primary/50 hover:bg-text-primary/5">
              Complete a piece
            </button>
          </div>
        </div>

        {isEmpty ? (
          <div className="py-20 text-center"><p className="mb-2 font-display text-2xl text-text-primary">No pieces found</p><button onClick={() => { setBudget('any'); setCategory('all'); setRetailers([]); setColours([]) }} className="text-sm text-text-primary underline underline-offset-4">Show everything</button></div>
        ) : (
          <>
            {suggested.length > 0 && <section aria-label="Suggested for you">{renderGrid(suggested)}</section>}
            {rest.length > 0 && <section aria-label="More pieces" className="mt-12 border-t border-text-primary/10 pt-6"><h2 className="mb-4 text-sm font-medium text-text-muted">More pieces</h2>{renderGrid(rest)}</section>}
          </>
        )}
        </>}
      </div>
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <fieldset className="mb-4 border-t border-text-primary/10 pt-3"><legend className="mb-1 text-2xs uppercase tracking-widest text-text-muted">{label}</legend>{children}</fieldset>
}
