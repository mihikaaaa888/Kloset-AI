import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Search, Shirt, Compass, X, ChevronDown, ArrowLeft } from 'lucide-react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'

import { ClothingCard } from '@/components/wardrobe/ClothingCard'
import { AddItemModal } from '@/components/wardrobe/AddItemModal'
import { ItemDetailModal } from '@/components/wardrobe/ItemDetailModal'
import { MyOutfits } from '@/components/saved/MyOutfits'
import { BuildBoard } from '@/components/build/BuildBoard'
import { ShareSheet } from '@/components/friends/ShareSheet'
import type { ShareTarget } from '@/lib/friendService'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { CATEGORY_LABEL } from '@/components/wardrobe/categoryVisuals'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useKlosetStore } from '@/store/klosetStore'
import { useUserStore } from '@/store/userStore'
import { deleteImage } from '@/lib/imageStorage'
import { deleteWithUndo, notify } from '@/store/undoStore'
import { SAMPLE_WARDROBE_ITEMS } from '@/lib/sampleData'
import { useAuth } from '@/contexts/AuthContext'
import { insertItem, updateItem as dbUpdateItem, deleteItem as dbDeleteItem } from '@/lib/wardrobeService'
import type { ClothingItem, ClothingCategory } from '@/types'

type KlosetView = 'pieces' | 'build' | 'outfits'

export function WardrobePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const showLandingBack = (location.state as { fromBuildMyKloset?: boolean } | null)?.fromBuildMyKloset === true
  const profile = useUserStore((s) => s.profile)
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const viewParam = searchParams.get('view')
  const view: KlosetView = viewParam === 'outfits' || viewParam === 'build' ? viewParam : 'pieces'
  const setView = (next: KlosetView) => {
    setSearchParams(next === 'pieces' ? {} : { view: next }, { replace: true })
    console.log('[wardrobe] view changed', next)
  }
  const { items, setItems, addItem, updateItem, removeItem, activeCategory, setActiveCategory } =
    useWardrobeStore()
  const { collections, activeCollectionId, createCollection, selectCollection, addItems, removeItem: removeCollectionItem, setCollectionItems } = useKlosetStore()
  const [creatingKloset, setCreatingKloset] = useState(false)
  const [newKlosetName, setNewKlosetName] = useState('')
  const [showKlosetMenu, setShowKlosetMenu] = useState(false)
  const [completeSelectionMode, setCompleteSelectionMode] = useState(false)
  const [showMainPicker, setShowMainPicker] = useState(false)
  const [mainPickerIds, setMainPickerIds] = useState<string[]>([])
  const klosetMenuRef = useRef<HTMLDivElement>(null)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editItem, setEditItem] = useState<ClothingItem | undefined>()
  const [detailItem, setDetailItem] = useState<ClothingItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)
  const activeCollection = collections.find((collection) => collection.id === activeCollectionId) ?? collections[0]
  const isMainCollection = activeCollectionId === 'main'
  const closetItems = useMemo(
    () => isMainCollection ? items : items.filter((item) => activeCollection?.itemIds.includes(item.id)),
    [items, isMainCollection, activeCollection],
  )

  useEffect(() => {
    if (!showKlosetMenu) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !klosetMenuRef.current?.contains(event.target)) setShowKlosetMenu(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [showKlosetMenu])

  useEffect(() => {
    if (!completeSelectionMode) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setCompleteSelectionMode(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [completeSelectionMode])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of closetItems) {
      counts[item.category] = (counts[item.category] ?? 0) + 1
    }
    return counts
  }, [closetItems])

  const filteredItems = useMemo(() => {
    let result = activeCategory === 'all' ? closetItems : closetItems.filter((i) => i.category === activeCategory)
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
  }, [closetItems, activeCategory, searchQuery])

  const handleAddSamples = () => {
    const addedIds: string[] = []
    for (const sample of SAMPLE_WARDROBE_ITEMS) {
      const item = { ...sample, id: crypto.randomUUID() }
      addItem(item)
      addedIds.push(item.id)
      if (user) insertItem(user.id, item).catch(() => {})
    }
    if (!isMainCollection) addItems(activeCollectionId, addedIds)
  }

  const handleSaveItem = (item: ClothingItem) => {
    if (editItem) {
      updateItem(item.id, item)
      if (user) dbUpdateItem(user.id, item).catch(() => {})
    } else {
      addItem(item)
      if (!isMainCollection) addItems(activeCollectionId, [item.id])
      if (user) insertItem(user.id, item).catch(() => {})
    }
    setEditItem(undefined)
  }

  const handleEdit = (item: ClothingItem) => {
    setDetailItem(null)
    setEditItem(item)
    setShowAddModal(true)
  }

  // Hidden straight away; the database row and photo only go once the Undo toast closes.
  const handleDelete = (id: string) => {
    if (!isMainCollection) {
      const collectionName = activeCollection?.name ?? 'this Kloset'
      deleteWithUndo({
        message: `Removed ${items.find((item) => item.id === id)?.name ?? 'piece'} from ${collectionName}`,
        keys: [`kloset:${activeCollectionId}:${id}`],
        remove: () => {
          removeCollectionItem(activeCollectionId, id)
          setDetailItem(null)
        },
        restore: () => addItems(activeCollectionId, [id]),
      })
      return
    }
    const index = items.findIndex((i) => i.id === id)
    const item = items[index]
    if (!item) return
    const putBack = () => {
      const current = useWardrobeStore.getState().items.filter((i) => i.id !== id)
      setItems([...current.slice(0, index), item, ...current.slice(index)])
    }
    deleteWithUndo({
      message: `Removed ${item.name}`,
      keys: [`wardrobe:${id}`],
      remove: () => {
        removeItem(id)
        setDetailItem(null)
      },
      restore: putBack,
      commit: async () => {
        if (user) {
          try {
            await dbDeleteItem(user.id, id, item.imageStoragePath)
          } catch (err) {
            putBack()
            notify(`Couldn't remove ${item.name}. It's back in your Kloset.`)
            throw err
          }
        }
        if (item.imageId) deleteImage(item.imageId).catch(() => {})
      },
    })
  }

  const handleIncrementWorn = (item: ClothingItem) => {
    const updated = { ...item, timesWorn: item.timesWorn + 1 }
    updateItem(item.id, { timesWorn: updated.timesWorn })
    if (user) dbUpdateItem(user.id, updated).catch(() => {})
    setDetailItem((prev) => prev ? { ...prev, timesWorn: updated.timesWorn } : null)
  }

  const openAdd = () => {
    setEditItem(undefined)
    setShowAddModal(true)
  }

  const openCompletePiece = (item: ClothingItem) => {
    setCompleteSelectionMode(false)
    navigate('/stylist', { state: { mode: 'item', itemId: item.id } })
  }

  const openMainPicker = () => {
    setMainPickerIds(activeCollection?.itemIds ?? [])
    setShowMainPicker(true)
  }
  const saveMainPicker = () => {
    setCollectionItems(activeCollectionId, mainPickerIds)
    setShowMainPicker(false)
  }

  const name = profile?.name?.split(' ')[0] ?? 'Your'
  const mainKlosetName = profile?.name ? `${name}'s Kloset` : 'My Kloset'
  useEffect(() => {
    if (activeCategory !== 'all' && !categoryCounts[activeCategory]) setActiveCategory('all')
  }, [activeCategory, categoryCounts, setActiveCategory])
  const handleSelectKloset = (id: string) => {
    selectCollection(id)
    setCreatingKloset(false)
    setShowKlosetMenu(false)
  }
  const handleCreateKloset = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (createCollection(newKlosetName)) {
      setNewKlosetName('')
      setCreatingKloset(false)
      setShowKlosetMenu(false)
    }
  }
  return (
    <div className="min-h-screen bg-warm-cream pt-16 lg:pt-20 pb-28 md:pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        {view === 'build' ? (
          <div className="pt-5 pb-5 sm:pt-8">
            <BuildBoard
              onSaved={() => setView('outfits')}
              onBack={() => setView('outfits')}
              onAddPiece={openAdd}
              onStyleMe={() => navigate('/stylist')}
              availableItems={closetItems}
            />
          </div>
        ) : <>
        <div className="flex min-h-14 items-center justify-between gap-3 pb-4 pt-2">
          <div className="flex min-w-0 items-center gap-2">
          {showLandingBack && <button type="button" onClick={() => navigate('/')} aria-label="Back to home" className="inline-flex h-10 shrink-0 items-center gap-1.5 px-1 text-sm text-text-muted transition-colors hover:text-text-primary md:hidden"><ArrowLeft size={18} strokeWidth={1.5} /><span>Back</span></button>}
          <div ref={klosetMenuRef} className="relative min-w-0">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={showKlosetMenu}
              onClick={() => setShowKlosetMenu((visible) => !visible)}
              className="flex max-w-full items-center gap-2 text-left font-display text-2xl sm:text-3xl font-medium leading-tight text-text-primary"
            >
              <span className="truncate">{activeCollectionId === 'main' ? mainKlosetName : (collections.find((collection) => collection.id === activeCollectionId)?.name ?? mainKlosetName)}</span>
              <ChevronDown size={17} className="shrink-0" aria-hidden="true" />
            </button>
            {showKlosetMenu && <div role="menu" className="absolute left-0 top-full z-40 mt-3 w-64 max-w-[calc(100vw-2rem)] border border-text-primary/10 bg-surface p-2 shadow-lifted">
              {collections.map((collection) => {
                const label = collection.id === 'main' ? mainKlosetName : collection.name
                return <button key={collection.id} role="menuitem" onClick={() => handleSelectKloset(collection.id)} className={clsx('flex w-full items-center px-3 py-2.5 text-left text-sm transition-colors hover:bg-text-primary/5', activeCollectionId === collection.id ? 'font-medium text-text-primary' : 'text-text-muted')}>{label}</button>
              })}
              <div className="my-1 border-t border-text-primary/10" />
              {creatingKloset ? <form onSubmit={handleCreateKloset} className="flex flex-col gap-2 p-2">
                <input autoFocus required maxLength={40} value={newKlosetName} onChange={(event) => setNewKlosetName(event.target.value)} placeholder="e.g. Bali Kloset" aria-label="New Kloset name" className="min-w-0 border-b border-text-primary/25 bg-transparent px-1 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-text-primary focus:outline-none" />
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => { setCreatingKloset(false); setNewKlosetName('') }} className="px-2 py-1 text-xs text-text-muted hover:text-text-primary">Cancel</button>
                  <button type="submit" className="px-2 py-1 text-xs font-medium text-text-primary hover:underline">Create Kloset</button>
                </div>
              </form> : <button role="menuitem" onClick={() => setCreatingKloset(true)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-text-primary hover:bg-text-primary/5"><Plus size={15} /> New Kloset</button>}
            </div>}
          </div>
          </div>

          {view === 'pieces' && <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button onClick={() => setShowSearch((visible) => !visible)} aria-pressed={showSearch} aria-label="Search wardrobe" className="flex h-10 w-10 items-center justify-center text-text-primary transition-colors hover:bg-text-primary/5">
              {showSearch ? <X size={18} strokeWidth={1.4} /> : <Search size={18} strokeWidth={1.4} />}
            </button>
            <button onClick={openAdd} className="inline-flex h-9 sm:h-10 items-center gap-1.5 bg-text-primary px-2.5 sm:px-5 text-2xs font-medium uppercase tracking-widest text-warm-cream transition-colors hover:bg-text-primary/90"><Plus size={14} strokeWidth={1.5} /> <span className="hidden sm:inline">Add piece</span><span className="sm:hidden">Add</span></button>
          </div>}
        </div>

        {view === 'pieces' && showSearch && <div className="mb-4 animate-fade-up">
          <div className="relative">
            <Search size={16} strokeWidth={1.25} className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-text-muted" />
            <input autoFocus type="search" placeholder="Search by name, colour, material…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full border-b border-text-primary/25 bg-transparent py-2.5 pl-7 pr-8 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-text-primary focus:outline-none" />
            {searchQuery && <button onClick={() => setSearchQuery('')} aria-label="Clear search" className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"><X size={16} strokeWidth={1.25} /></button>}
          </div>
        </div>}

        {/* Two primary views; Build stays available from outfit creation. */}
        <div role="tablist" aria-label="My Kloset sections" className="mb-4 hidden gap-8 border-b border-text-primary/10 md:flex">
          {([['pieces', 'Pieces'], ['outfits', 'Outfits']] as const).map(([value, label]) => (
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

        {view === 'outfits' ? <MyOutfits /> : <>

        {!isMainCollection && <div className="mb-3 flex justify-end">
          <button onClick={openMainPicker} className="inline-flex items-center gap-2 border border-text-primary/25 px-3 py-2 text-2xs font-medium uppercase tracking-widest text-text-primary transition-colors hover:border-text-primary/50">
            <Plus size={14} /> Add from {mainKlosetName}
          </button>
        </div>}

        {/* Category filter */}
        {closetItems.length > 0 && (
          <div className="mb-4 -mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
            <div role="group" aria-label="Filter pieces by category" className="flex w-max min-w-full gap-2 py-1">
              {[['all', 'All'], ['tops', 'Tops'], ['bottoms', 'Bottoms'], ['dresses', 'Dresses'], ['outerwear', 'Outerwear'], ['shoes', 'Shoes'], ['accessories', 'Accessories']].filter(([category]) => category === 'all' || (categoryCounts[category] ?? 0) > 0).map(([category, label]) => {
                const selected = activeCategory === category
                return <button key={category} onClick={() => setActiveCategory(category as ClothingCategory | 'all')} aria-pressed={selected} className={clsx('shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-colors', selected ? 'border-text-primary bg-text-primary text-warm-cream' : 'border-text-primary/15 bg-surface/60 text-text-muted hover:border-text-primary/35 hover:text-text-primary')}>{label}</button>
              })}
            </div>
          </div>
        )}

        {/* Content */}
        {closetItems.length === 0 ? isMainCollection ? (
          <EmptyState onAdd={openAdd} onLoadSamples={handleAddSamples} onStyleMe={() => navigate('/stylist')} />
        ) : (
          <EmptySubsetState closetName={activeCollection?.name ?? 'this Kloset'} mainKlosetName={mainKlosetName} onAddFromMain={openMainPicker} onAddPiece={openAdd} />
        ) :
        filteredItems.length === 0 ? (
          <NoResultsState query={searchQuery} category={activeCategory} onClear={() => {
            setSearchQuery('')
            setActiveCategory('all')
          }} />
        ) : (
          <>
            {completeSelectionMode && <div className="mb-4 flex min-h-10 items-center justify-between border-y border-text-primary/15 py-2 text-sm text-text-primary" role="status">
              <span>Pick a piece to complete</span>
              <button type="button" onClick={() => setCompleteSelectionMode(false)} className="text-xs text-text-muted underline underline-offset-4 transition-colors hover:text-text-primary">Cancel</button>
            </div>}
            {closetItems.length < 3 && <div className="mb-4 flex items-center justify-between gap-3 border-y border-text-primary/10 py-3 text-sm text-text-muted">
              <span>Add a few more pieces for more complete outfit ideas.</span>
              <button onClick={() => navigate('/stylist')} className="shrink-0 border border-text-primary/25 px-3 py-2 text-2xs font-medium uppercase tracking-widest text-text-primary hover:border-text-primary/50">Style me</button>
            </div>}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 sm:gap-x-5 gap-y-10">
              {filteredItems.map((item) => (
                <ClothingCard
                  key={item.id}
                  item={item}
                  selectionMode={completeSelectionMode}
                  onClick={() => completeSelectionMode ? openCompletePiece(item) : setDetailItem(item)}
                  onDelete={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                  deleteLabel={isMainCollection ? `Delete ${item.name}` : `Remove ${item.name} from ${activeCollection?.name ?? 'this Kloset'}`}
                  onCompletePiece={(e) => { e.stopPropagation(); openCompletePiece(item) }}
                />
              ))}
              {!completeSelectionMode && <AddItemCard onClick={openAdd} />}
            </div>
          </>
        )}
        </>}
        </>}
      </div>

      {view !== 'build' && <nav aria-label="Kloset navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-text-primary/10 bg-surface/95 px-8 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-sm items-center justify-around">
          <button onClick={() => setView('pieces')} aria-current={view === 'pieces' ? 'page' : undefined} className={clsx('min-w-20 py-1 text-xs transition-colors', view === 'pieces' ? 'font-medium text-text-primary' : 'text-text-muted')}>Pieces</button>
          <button onClick={openAdd} aria-label="Add a piece" className="flex h-11 w-11 items-center justify-center rounded-full bg-text-primary text-warm-cream shadow-soft"><Plus size={20} /></button>
          <button onClick={() => setView('outfits')} aria-current={view === 'outfits' ? 'page' : undefined} className={clsx('min-w-20 py-1 text-xs transition-colors', view === 'outfits' ? 'font-medium text-text-primary' : 'text-text-muted')}>Outfits</button>
        </div>
      </nav>}

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
        onIncrementWorn={() => detailItem && handleIncrementWorn(detailItem)}
        onSend={() => detailItem && setShareTarget({ kind: 'item', item: detailItem })}
        deleteLabel={isMainCollection ? 'Remove from Kloset' : `Remove from ${activeCollection?.name ?? 'this Kloset'}`}
      />

      <MainClosetPicker
        open={showMainPicker}
        items={items}
        selectedIds={mainPickerIds}
        onToggle={(id) => setMainPickerIds((selected) => selected.includes(id) ? selected.filter((itemId) => itemId !== id) : [...selected, id])}
        onClose={() => setShowMainPicker(false)}
        onSave={saveMainPicker}
        mainKlosetName={mainKlosetName}
      />

      <ShareSheet target={shareTarget} onClose={() => setShareTarget(null)} />
    </div>
  )
}

function EmptyState({ onAdd, onLoadSamples, onStyleMe }: { onAdd: () => void; onLoadSamples: () => void; onStyleMe: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4">
      <div className="w-20 h-20 rounded-3xl bg-text-primary/8 flex items-center justify-center mb-6">
        <Shirt size={32} strokeWidth={1} className="text-text-primary/50" />
      </div>
      <h2 className="font-display text-2xl font-medium text-text-primary mb-8">Your Kloset is empty</h2>
      <div className="flex flex-col items-center gap-4">
        <Button size="lg" onClick={onAdd} className="gap-2">
          <Plus size={16} />
          Add your first item
        </Button>
        <Button variant="outline" size="md" onClick={onStyleMe}>Style me</Button>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-text-muted">
          <button onClick={() => navigate('/discover')} className="inline-flex items-center gap-1.5 hover:text-text-primary"><Compass size={14} /> Browse inspiration</button>
          <button onClick={onLoadSamples} className="hover:text-text-primary">Load sample wardrobe</button>
        </div>
      </div>
    </div>
  )
}

function EmptySubsetState({ closetName, mainKlosetName, onAddFromMain, onAddPiece }: { closetName: string; mainKlosetName: string; onAddFromMain: () => void; onAddPiece: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-text-primary/8">
        <Shirt size={28} strokeWidth={1} className="text-text-primary/50" />
      </div>
      <h2 className="mb-2 font-display text-2xl font-medium text-text-primary">{closetName} is empty</h2>
      <p className="mb-6 max-w-md text-sm leading-relaxed text-text-muted">
        Choose pieces from {mainKlosetName} to include here. New pieces you add here will also be saved in {mainKlosetName}.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button onClick={onAddFromMain} className="border border-text-primary/25 px-4 py-3 text-2xs font-medium uppercase tracking-widest text-text-primary transition-colors hover:border-text-primary/50">
          Add from {mainKlosetName}
        </button>
        <button onClick={onAddPiece} className="px-4 py-3 text-2xs font-medium uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary">
          Add a new piece
        </button>
      </div>
    </div>
  )
}

function MainClosetPicker({ open, items, selectedIds, onToggle, onClose, onSave, mainKlosetName }: {
  open: boolean
  items: ClothingItem[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onClose: () => void
  onSave: () => void
  mainKlosetName: string
}) {
  const [query, setQuery] = useState('')
  const visibleItems = items.filter((item) => {
    const search = query.trim().toLowerCase()
    return !search || item.name.toLowerCase().includes(search) || item.category.toLowerCase().includes(search) || item.colour.some((colour) => colour.toLowerCase().includes(search))
  })

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add pieces from ${mainKlosetName}`}
      maxWidth="max-w-xl"
      footer={(
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-text-muted">{selectedIds.length} selected</span>
          <Button variant="outline" size="sm" onClick={onSave}>Save selection</Button>
        </div>
      )}
    >
      <div className="px-6 py-5">
        <p className="mb-4 text-sm leading-relaxed text-text-muted">Select which main-closet pieces should appear in this Kloset. Changes here won’t remove pieces from your main Kloset.</p>
        <div className="relative mb-3">
          <Search size={15} strokeWidth={1.25} className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your main Kloset" aria-label="Search main Kloset pieces" className="w-full border-b border-text-primary/20 bg-transparent py-2 pl-6 text-sm text-text-primary placeholder:text-text-muted focus:border-text-primary focus:outline-none" />
        </div>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">Your main Kloset has no pieces yet. Add pieces there first.</p>
        ) : visibleItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">No pieces match that search.</p>
        ) : (
          <div className="max-h-[52dvh] divide-y divide-text-primary/10 overflow-y-auto">
            {visibleItems.map((item) => (
              <label key={item.id} className="flex cursor-pointer items-center gap-3 py-3">
                <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} className="h-4 w-4 accent-butter-yellow" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text-primary">{item.name}</span>
                  <span className="mt-0.5 block text-2xs uppercase tracking-widest text-text-muted">{CATEGORY_LABEL[item.category]}{item.colour.length ? ` · ${item.colour.join(', ')}` : ''}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
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
    <button onClick={onClick} className="group w-full self-start text-left">
      <div className="w-full aspect-[3/4] ring-1 ring-inset ring-text-primary/15 group-hover:ring-text-primary/40 flex flex-col items-center justify-center gap-3 transition-colors">
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
