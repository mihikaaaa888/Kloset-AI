import { useState, useMemo } from 'react'
import { clsx } from 'clsx'

import { ShopItemCard } from '@/components/shop/ShopItemCard'
import { BudgetDropdown } from '@/components/shop/BudgetDropdown'
import { CompleteAPiece } from '@/components/shop/CompleteAPiece'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useUserStore } from '@/store/userStore'
import { useAuth } from '@/contexts/AuthContext'
import { insertItem } from '@/lib/wardrobeService'
import { ALL_CATALOG_ITEMS } from '@/lib/catalogData'
import { catalogToItem } from '@/lib/outfitPieces'
import {
  fitsBuyBudget,
  fitsRentBudget,
  isRentable,
  rankForUser,
  type BudgetId,
} from '@/lib/shopping'
import type { CatalogItem, ClothingCategory } from '@/types'

type ShopMode = 'piece' | 'complete' | 'rent'
type Section = 'women' | 'men'

const MODES: { id: ShopMode; label: string; blurb?: string }[] = [
  { id: 'piece', label: 'New pieces' },
  { id: 'complete', label: 'Complete a piece', blurb: 'Pick something you own, or upload a photo — we’ll find what goes with it.' },
  { id: 'rent', label: 'Rent', blurb: 'Occasion and investment pieces you can rent by the week.' },
]

const CATEGORY_FILTERS: { value: ClothingCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
]

/** Number of top-ranked pieces shown as "Suggested for you" before the rest. */
const SUGGESTED_COUNT = 10

/** Personal shopping — new pieces, complete-a-piece, or rentals, with one budget dropdown. */
export function DiscoverPage() {
  const { user } = useAuth()
  const { items: wardrobeItems, addItem } = useWardrobeStore()
  const profile = useUserStore((s) => s.profile)

  const [mode, setMode] = useState<ShopMode>('piece')
  const [section, setSection] = useState<Section>(profile?.genderStylePreference === 'masculine' ? 'men' : 'women')
  const [budget, setBudget] = useState<BudgetId>('any')
  const [category, setCategory] = useState<ClothingCategory | 'all'>('all')
  // Items added this session, for instant UI feedback before the store syncs.
  const [addedThisSession, setAddedThisSession] = useState<Set<string>>(new Set())

  const addedCatalogIds = useMemo(
    () => new Set(wardrobeItems.map((i) => i.catalogId).filter(Boolean) as string[]),
    [wardrobeItems]
  )
  const isInWardrobe = (id: string) => addedCatalogIds.has(id) || addedThisSession.has(id)

  const pieces = useMemo(() => {
    const pool = ALL_CATALOG_ITEMS.filter((item) => (item.gender ?? 'women') === section).filter((item) => {
      if (mode === 'rent') return isRentable(item) && fitsRentBudget(item, budget)
      return fitsBuyBudget(item, budget)
    }).filter((item) => category === 'all' || item.category === category)
    return rankForUser(pool, profile, wardrobeItems)
  }, [mode, section, budget, category, profile, wardrobeItems])

  const handleAdd = (catalogItem: CatalogItem) => {
    if (isInWardrobe(catalogItem.id)) return
    const newItem = catalogToItem(catalogItem, crypto.randomUUID())

    console.log('[shop] add to Kloset', { id: catalogItem.id, mode })
    addItem(newItem)
    setAddedThisSession((prev) => new Set(prev).add(catalogItem.id))
    if (user) {
      insertItem(user.id, newItem).catch((err) => console.error('[shop] failed to save item', catalogItem.id, err))
    }
  }

  const activeMode = MODES.find((m) => m.id === mode)!
  const resultCount = pieces.length
  const isEmpty = resultCount === 0
  // New pieces open with the best matches for this user; everything else follows.
  const suggested = mode === 'piece' ? pieces.slice(0, SUGGESTED_COUNT) : []
  const rest = mode === 'piece' ? pieces.slice(SUGGESTED_COUNT) : pieces

  const renderGrid = (list: CatalogItem[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-10">
      {list.map((item) => (
        <ShopItemCard
          key={item.id}
          item={item}
          mode={mode === 'rent' ? 'rent' : 'buy'}
          inWardrobe={isInWardrobe(item.id)}
          onAdd={() => handleAdd(item)}
        />
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-warm-cream pt-16 lg:pt-20 pb-28 md:pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <header className="pt-10 pb-8 lg:pt-14 text-center">
          <p className="text-butter-yellow text-xs font-medium uppercase tracking-ultra-wide mb-3">
            Personal shopping
          </p>
          <h1 className="font-display text-4xl lg:text-5xl font-medium text-text-primary">
            Shop for you
          </h1>
          {activeMode.blurb && <p className="text-text-muted text-sm mt-3">{activeMode.blurb}</p>}
        </header>

        {/* ── Toolbar: mode tabs + budget ── */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-end justify-between gap-4 border-b border-text-primary/10 pb-3">
          <nav className="flex gap-6 sm:gap-10 overflow-x-auto no-scrollbar" aria-label="Shopping mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  console.log('[shop] mode changed', m.id)
                  setMode(m.id)
                  setCategory('all')
                }}
                aria-current={mode === m.id ? 'page' : undefined}
                className={clsx('text-tab sm:text-sm flex-shrink-0', mode === m.id && 'text-tab-active')}
              >
                {m.label}
              </button>
            ))}
          </nav>
          <div className="self-end sm:self-auto">
            <BudgetDropdown value={budget} onChange={setBudget} mode={mode === 'rent' ? 'rent' : 'buy'} />
          </div>
        </div>

        {/* ── Women / Men ── */}
        {mode !== 'complete' && (
          <div className="flex gap-6 pt-5" role="group" aria-label="Shop section">
            {(['women', 'men'] as Section[]).map((sec) => (
              <button
                key={sec}
                onClick={() => { setSection(sec); setCategory('all') }}
                aria-pressed={section === sec}
                className={clsx('text-tab flex-shrink-0 capitalize', section === sec && 'text-tab-active')}
              >
                {sec}
              </button>
            ))}
          </div>
        )}

        {/* ── Category (new pieces + rentals) ── */}
        {mode !== 'complete' && (
          <div className="flex gap-6 overflow-x-auto no-scrollbar pt-5">
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setCategory(f.value)}
                className={clsx('text-tab flex-shrink-0 !text-2xs', category === f.value && 'text-tab-active')}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {mode !== 'complete' && (
          <p className="text-2xs uppercase tracking-widest text-text-muted pt-5 pb-6">
            {resultCount} {resultCount === 1 ? 'piece' : 'pieces'}
          </p>
        )}

        {/* ── Results ── */}
        {mode === 'complete' ? (
          <div className="pt-10">
            <CompleteAPiece
              budget={budget}
              profile={profile}
              wardrobe={wardrobeItems}
              isInWardrobe={isInWardrobe}
              onAdd={handleAdd}
            />
          </div>
        ) : isEmpty ? (
          <div className="py-20 text-center">
            <p className="font-display text-2xl text-text-primary mb-2">Nothing in this budget yet</p>
            <button
              onClick={() => { setBudget('any'); setCategory('all') }}
              className="text-tab text-tab-active"
            >
              Show everything
            </button>
          </div>
        ) : suggested.length > 0 ? (
          <>
            <section aria-labelledby="shop-suggested">
              <div className="flex items-baseline justify-between gap-4 mb-6">
                <h2 id="shop-suggested" className="font-display text-2xl lg:text-3xl text-text-primary">Suggested for you</h2>
                <p className="text-2xs uppercase tracking-widest text-text-muted">Based on your style</p>
              </div>
              {renderGrid(suggested)}
            </section>
            {rest.length > 0 && (
              <section aria-labelledby="shop-more" className="mt-16 pt-10 border-t border-text-primary/10">
                <h2 id="shop-more" className="font-display text-2xl lg:text-3xl text-text-primary mb-6">More pieces</h2>
                {renderGrid(rest)}
              </section>
            )}
          </>
        ) : (
          renderGrid(rest)
        )}
      </div>
    </div>
  )
}
