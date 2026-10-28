import { useState, useMemo } from 'react'
import { Plus, Search, Shirt, Compass, ArrowRight, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'

import { CategoryFilter } from '@/components/wardrobe/CategoryFilter'
import { ClothingCard } from '@/components/wardrobe/ClothingCard'
import { AddItemModal } from '@/components/wardrobe/AddItemModal'
import { ItemDetailModal } from '@/components/wardrobe/ItemDetailModal'
import { MyOutfits } from '@/components/saved/MyOutfits'
import { BuildBoard } from '@/components/build/BuildBoard'
import { ShareSheet } from '@/components/friends/ShareSheet'
import type { ShareTarget } from '@/lib/friendService'
import { Button } from '@/components/ui/Button'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useUserStore } from '@/store/userStore'
import { useOutfitStore } from '@/store/outfitStore'
import { deleteImage } from '@/lib/imageStorage'
import { SAMPLE_WARDROBE_ITEMS } from '@/lib/sampleData'
import { useAuth } from '@/contexts/AuthContext'
import { insertItem, updateItem as dbUpdateItem, deleteItem as dbDeleteItem } from '@/lib/wardrobeService'
import type { ClothingItem, ClothingCategory } from '@/types'

type KlosetView = 'pieces' | 'build' | 'outfits'

export function WardrobePage() {
  const navigate = useNavigate()
  const profile = useUserStore((s) => s.profile)
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const viewParam = searchParams.get('view')
  const view: KlosetView = viewParam === 'outfits' || viewParam === 'build' ? viewParam : 'pieces'
  const setView = (next: KlosetView) => {
    setSearchParams(next === 'pieces' ? {} : { view: next }, { replace: true })
    console.log('[wardrobe] view changed', next)
  }
  const { items, addItem, updateItem, removeItem, toggleFavourite, activeCategory, setActiveCategory } =
    useWardrobeStore()

  const [showAddModal, setShowAddModal] = useState(false)
  const [editItem, setEditItem] = useState<ClothingItem | undefined>()
  const [detailItem, setDetailItem] = useState<ClothingItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of items) {
      counts[item.category] = (counts[item.category] ?? 0) + 1
    }
    return counts
  }, [items])

  const filteredItems = useMemo(() => {
    let result = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.colour.some((c) => c.toLowerCase().includes(q)) ||
          i.material?.toLowerCase().includes(q) ||
          i.brand?.toLowerCase().includes(q)
      )
    }
    return result
  }, [items, activeCategory, searchQuery])

  const handleAddSamples = () => {
    for (const sample of SAMPLE_WARDROBE_ITEMS) {
      const item = { ...sample, id: crypto.randomUUID() }
      addItem(item)
      if (user) insertItem(user.id, item).catch(() => {})
    }
  }

  const handleSaveItem = (item: ClothingItem) => {
    if (editItem) {
      updateItem(item.id, item)
      if (user) dbUpdateItem(user.id, item).catch(() => {})
    } else {
      addItem(item)
      if (user) insertItem(user.id, item).catch(() => {})
    }
    setEditItem(undefined)
  }

  const handleEdit = (item: ClothingItem) => {
    setDetailItem(null)
    setEditItem(item)
    setShowAddModal(true)
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Remove this item from your Kloset?')) {
      const item = items.find((i) => i.id === id)
      if (item?.imageId) deleteImage(item.imageId).catch(() => {})
      removeItem(id)
      if (user) dbDeleteItem(user.id, id).catch(() => {})
      setDetailItem(null)
    }
  }

  const handleIncrementWorn = (item: ClothingItem) => {
    const updated = { ...item, timesWorn: item.timesWorn + 1 }
    updateItem(item.id, { timesWorn: updated.timesWorn })
    if (user) dbUpdateItem(user.id, updated).catch(() => {})
    setDetailItem((prev) => prev ? { ...prev, timesWorn: updated.timesWorn } : null)
  }

  // Saved to Supabase too, or the heart is lost on every other device.
  const handleToggleFavourite = (item: ClothingItem) => {
    toggleFavourite(item.id)
    if (user) dbUpdateItem(user.id, { ...item, isFavourite: !item.isFavourite }).catch(() => {})
  }

  const openAdd = () => {
    setEditItem(undefined)
    setShowAddModal(true)
  }

  const name = profile?.name?.split(' ')[0] ?? 'Your'
  const savedCount = useOutfitStore((s) => s.savedOutfits.length)

  return (
    <div className="min-h-screen bg-warm-cream pt-16 lg:pt-20 pb-28 md:pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-10 lg:pt-14 pb-6">
          <div>
            <h1 className="font-display text-4xl lg:text-6xl font-medium text-text-primary leading-none">
              {name}&apos;s Kloset
            </h1>
            <p className="text-text-muted text-sm mt-3">
              {items.length} {items.length === 1 ? 'piece' : 'pieces'}
              {savedCount > 0 && <> · {savedCount} {savedCount === 1 ? 'outfit' : 'outfits'}</>}
            </p>
          </div>

          {view === 'pieces' && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowSearch((v) => !v)}
                aria-pressed={showSearch}
                className={clsx(
                  'w-11 h-11 rounded-full flex items-center justify-center ring-1 ring-inset transition-colors',
                  showSearch
                    ? 'bg-text-primary text-warm-cream ring-text-primary'
                    : 'text-text-primary ring-text-primary/20 hover:ring-text-primary/50'
                )}
                aria-label="Search wardrobe"
              >
                <Search size={17} strokeWidth={1.25} />
              </button>
              <button
                onClick={openAdd}
                className="h-11 px-5 flex items-center gap-2 bg-text-primary text-warm-cream text-xs font-medium uppercase tracking-widest hover:bg-text-primary/90 transition-colors"
              >
                <Plus size={14} strokeWidth={1.5} />
                Add piece
              </button>
            </div>
          )}
        </div>

        {/* View switch */}
        <div role="tablist" aria-label="My Kloset sections" className="flex gap-8 border-b border-text-primary/10 mb-8">
          {([['pieces', 'Pieces'], ['build', 'Build'], ['outfits', 'My Outfits']] as const).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={clsx(
                'relative -mb-px pt-3 pb-3 text-xs uppercase tracking-widest transition-colors',
                view === value
                  ? 'text-text-primary font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-text-primary'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {view === 'outfits' ? <MyOutfits /> : view === 'build' ? <BuildBoard onSaved={() => setView('outfits')} /> : <>

        {/* Search bar */}
        {showSearch && (
          <div className="mb-8 animate-fade-up">
            <div className="relative">
              <Search size={16} strokeWidth={1.25} className="absolute left-0 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                autoFocus
                type="search"
                placeholder="Search by name, colour, material…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-8 py-3 border-b border-text-primary/25 focus:border-text-primary bg-transparent text-base text-text-primary placeholder:text-text-muted focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"
                >
                  <X size={16} strokeWidth={1.25} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Category filter */}
        {items.length > 0 && (
          <div className="mb-6">
            <CategoryFilter
              active={activeCategory}
              counts={categoryCounts}
              onChange={(cat) => setActiveCategory(cat as ClothingCategory | 'all')}
            />
          </div>
        )}

        {/* Content */}
        {items.length === 0 ? (
          <EmptyState onAdd={openAdd} onLoadSamples={handleAddSamples} />
        ) : filteredItems.length === 0 ? (
          <NoResultsState query={searchQuery} category={activeCategory} onClear={() => {
            setSearchQuery('')
            setActiveCategory('all')
          }} />
        ) : (
          <>
            {items.length >= 3 && (
              <button
                onClick={() => navigate('/stylist')}
                className="group w-full mb-10 py-5 border-y border-text-primary/10 flex items-center justify-between gap-4 text-left"
              >
                <span>
                  <span className="block font-display text-2xl text-text-primary">Not sure what to wear?</span>
                  <span className="block text-sm text-text-muted mt-0.5">Your AI stylist can build a look from these pieces.</span>
                </span>
                <span className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-widest text-butter-yellow flex-shrink-0">
                  Style me
                  <ArrowRight size={14} strokeWidth={1.25} className="transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </button>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 sm:gap-x-5 gap-y-10">
              {filteredItems.map((item) => (
                <ClothingCard
                  key={item.id}
                  item={item}
                  onClick={() => setDetailItem(item)}
                  onToggleFavourite={(e) => { e.stopPropagation(); handleToggleFavourite(item) }}
                  onStyleThis={(e) => { e.stopPropagation(); navigate('/stylist', { state: { mode: 'item', itemId: item.id } }) }}
                />
              ))}
              <AddItemCard onClick={openAdd} />
            </div>
          </>
        )}
        </>}
      </div>

      <AddItemModal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setEditItem(undefined) }}
        onSave={handleSaveItem}
        editItem={editItem}
      />

      <ItemDetailModal
        item={detailItem}
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        onEdit={() => detailItem && handleEdit(detailItem)}
        onDelete={() => detailItem && handleDelete(detailItem.id)}
        onToggleFavourite={() => {
          if (!detailItem) return
          handleToggleFavourite(detailItem)
          setDetailItem((prev) => prev ? { ...prev, isFavourite: !prev.isFavourite } : null)
        }}
        onIncrementWorn={() => detailItem && handleIncrementWorn(detailItem)}
        onSend={() => detailItem && setShareTarget({ kind: 'item', item: detailItem })}
      />

      <ShareSheet target={shareTarget} onClose={() => setShareTarget(null)} />
    </div>
  )
}

function EmptyState({ onAdd, onLoadSamples }: { onAdd: () => void; onLoadSamples: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4">
      <div className="w-20 h-20 rounded-3xl bg-text-primary/8 flex items-center justify-center mb-6">
        <Shirt size={32} strokeWidth={1} className="text-text-primary/50" />
      </div>
      <h2 className="font-display text-2xl font-medium text-text-primary mb-8">Your Kloset is empty</h2>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button size="lg" onClick={onAdd} className="gap-2">
          <Plus size={16} />
          Add your first item
        </Button>
        <Button variant="secondary" size="lg" onClick={() => navigate('/discover')} className="gap-2">
          <Compass size={16} />
          Browse inspiration
        </Button>
        <Button variant="secondary" size="lg" onClick={onLoadSamples}>
          Load sample wardrobe
        </Button>
      </div>
    </div>
  )
}

function NoResultsState({ query, category, onClear }: { query: string; category: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="w-16 h-16 rounded-3xl bg-text-primary/8 flex items-center justify-center mb-4">
        <Search size={24} strokeWidth={1} className="text-text-primary/50" />
      </div>
      <h3 className="font-display text-xl font-medium text-text-primary mb-2">No items found</h3>
      <p className="text-text-muted text-sm mb-6">
        {query
          ? `Nothing matched "${query}" in ${category === 'all' ? 'your wardrobe' : category}`
          : `You don't have anything in ${category} yet`}
      </p>
      <button
        onClick={onClear}
        className="text-sm text-text-primary underline underline-offset-4 hover:text-text-muted transition-colors"
      >
        Clear filters
      </button>
    </div>
  )
}

function AddItemCard({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="group text-left">
      <div className="aspect-[3/4] ring-1 ring-inset ring-text-primary/15 group-hover:ring-text-primary/40 flex flex-col items-center justify-center gap-3 transition-colors">
        <span className="w-12 h-12 rounded-full ring-1 ring-text-primary/20 group-hover:bg-text-primary group-hover:text-warm-cream group-hover:ring-text-primary flex items-center justify-center text-text-primary transition-colors duration-300">
          <Plus size={18} strokeWidth={1.25} />
        </span>
        <span className="text-2xs uppercase tracking-widest text-text-muted group-hover:text-text-primary transition-colors">
          Add a piece
        </span>
      </div>
    </button>
  )
}
