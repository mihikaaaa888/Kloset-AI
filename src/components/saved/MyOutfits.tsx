import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Plus, Sparkles, X } from 'lucide-react'

import { SavedOutfitCard } from '@/components/saved/SavedOutfitCard'
import { SavedOutfitDetailModal } from '@/components/saved/SavedOutfitDetailModal'
import { CreateOutfitModal } from '@/components/saved/CreateOutfitModal'
import { ShareSheet } from '@/components/friends/ShareSheet'
import type { ShareTarget } from '@/lib/friendService'
import { useOutfitStore } from '@/store/outfitStore'
import { useKlosetStore } from '@/store/klosetStore'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { resolveOutfitItems } from '@/lib/outfitPieces'
import type { Outfit } from '@/types'

/** Saved looks, named outfit collections, and recoverable deleted looks. */
export function MyOutfits() {
  const navigate = useNavigate()
  const { savedOutfits, trashedOutfits, saveOutfit, trashOutfit, restoreOutfit, permanentlyDeleteOutfit } = useOutfitStore()
  const { collections, activeCollectionId, createCollection, selectCollection, addOutfits, removeOutfit, deleteCollection } = useKlosetStore()
  const wardrobeItems = useWardrobeStore((s) => s.items)

  const [selectedOutfit, setSelectedOutfit] = useState<Outfit | null>(null)
  const [creating, setCreating] = useState(false)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)
  const [showRecycleBin, setShowRecycleBin] = useState(false)
  const [showNewKloset, setShowNewKloset] = useState(false)
  const [newKlosetName, setNewKlosetName] = useState('')
  const [showAddFromMain, setShowAddFromMain] = useState(false)
  const [pickedOutfitIds, setPickedOutfitIds] = useState<string[]>([])
  const activeCollection = collections.find((collection) => collection.id === activeCollectionId) ?? collections[0]
  const isMain = activeCollection.id === 'main'

  const currentOutfits = useMemo(() => {
    const collectionOutfits = isMain
      ? savedOutfits
      : savedOutfits.filter((outfit) => activeCollection.outfitIds.includes(outfit.id))
    return [...collectionOutfits].sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''))
  }, [activeCollection, isMain, savedOutfits])

  const visibleOutfits = showRecycleBin ? trashedOutfits : currentOutfits
  const resolvedOutfits = useMemo(
    () => visibleOutfits.map((outfit) => ({ outfit, resolvedItems: resolveOutfitItems(outfit, wardrobeItems) })),
    [visibleOutfits, wardrobeItems],
  )

  const selectedResolved = useMemo(
    () => selectedOutfit ? resolveOutfitItems(selectedOutfit, wardrobeItems) : [],
    [selectedOutfit, wardrobeItems],
  )

  const availableMainOutfits = savedOutfits.filter((outfit) => !activeCollection.outfitIds.includes(outfit.id))

  // Shop and inspiration pieces aren't in the wardrobe, so pass the resolved ones along.
  const sendOutfit = (outfit: Outfit) => {
    const items = resolveOutfitItems(outfit, wardrobeItems).flatMap((r) => (r.item ? [r.item] : []))
    setShareTarget({ kind: 'outfit', outfit, items })
  }

  const removeFromCurrentView = (outfit: Outfit) => {
    if (showRecycleBin) {
      if (window.confirm(`Permanently delete “${outfit.name}”? This cannot be undone.`)) permanentlyDeleteOutfit(outfit.id)
    } else if (isMain) {
      trashOutfit(outfit.id)
    } else {
      removeOutfit(activeCollection.id, outfit.id)
    }
    if (selectedOutfit?.id === outfit.id) setSelectedOutfit(null)
  }

  const handleCreate = (outfit: Outfit) => {
    saveOutfit(outfit)
    if (!isMain) addOutfits(activeCollection.id, [outfit.id])
    setShowRecycleBin(false)
    setCreating(false)
  }

  const handleCreateKloset = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const created = createCollection(newKlosetName)
    if (created) {
      setNewKlosetName('')
      setShowNewKloset(false)
      setShowRecycleBin(false)
    }
  }

  const togglePickedOutfit = (id: string) => {
    setPickedOutfitIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id])
  }

  const addPickedOutfits = () => {
    addOutfits(activeCollection.id, pickedOutfitIds)
    setPickedOutfitIds([])
    setShowAddFromMain(false)
  }

  return (
    <>
      <div className="mb-8 border-b border-text-primary/10 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <label htmlFor="kloset-collection" className="mb-2 block text-2xs font-medium uppercase tracking-widest text-text-muted">Your klosets</label>
            <select
              id="kloset-collection"
              value={activeCollection.id}
              onChange={(event) => { selectCollection(event.target.value); setShowRecycleBin(false) }}
              className="min-w-56 border-b border-text-primary/25 bg-transparent py-2 pr-8 font-display text-2xl text-text-primary focus:border-text-primary focus:outline-none"
            >
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>{collection.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!showRecycleBin && !isMain && <button
              onClick={() => { setPickedOutfitIds([]); setShowAddFromMain(true) }}
              className="h-10 px-4 ring-1 ring-inset ring-text-primary/20 text-2xs font-medium uppercase tracking-widest text-text-primary hover:ring-text-primary/50"
            >
              Add from Main
            </button>}
            <button
              onClick={() => { setShowNewKloset((current) => !current); setShowRecycleBin(false) }}
              className="h-10 px-4 flex items-center gap-2 bg-text-primary text-warm-cream text-2xs font-medium uppercase tracking-widest hover:bg-text-primary/90"
            >
              <Plus size={14} /> New Kloset
            </button>
            {!isMain && <button
              onClick={() => {
                if (window.confirm(`Delete “${activeCollection.name}”? Its outfits will remain in Main Kloset.`)) deleteCollection(activeCollection.id)
              }}
              className="h-10 px-4 ring-1 ring-inset ring-red-800/20 text-2xs font-medium uppercase tracking-widest text-red-800 hover:ring-red-800/50"
            >
              Delete Kloset
            </button>}
            <button
              onClick={() => { setShowRecycleBin((current) => !current); setShowNewKloset(false) }}
              aria-pressed={showRecycleBin}
              className={`h-10 px-4 flex items-center gap-2 ring-1 ring-inset text-2xs font-medium uppercase tracking-widest transition-colors ${showRecycleBin ? 'bg-text-primary text-warm-cream ring-text-primary' : 'ring-text-primary/20 text-text-primary hover:ring-text-primary/50'}`}
            >
              <Archive size={14} /> Recycle Bin ({trashedOutfits.length})
            </button>
          </div>
        </div>

        {showNewKloset && <form onSubmit={handleCreateKloset} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            autoFocus
            required
            maxLength={40}
            value={newKlosetName}
            onChange={(event) => setNewKlosetName(event.target.value)}
            placeholder="Name this Kloset, e.g. Paris trip"
            aria-label="New Kloset name"
            className="min-w-0 flex-1 border-b border-text-primary/25 bg-transparent px-1 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-text-primary focus:outline-none"
          />
          <button type="submit" className="h-10 px-5 bg-text-primary text-warm-cream text-2xs font-medium uppercase tracking-widest">Create</button>
          <button type="button" onClick={() => setShowNewKloset(false)} className="h-10 px-3 text-text-muted hover:text-text-primary" aria-label="Cancel creating Kloset"><X size={17} /></button>
        </form>}

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-muted">
            {showRecycleBin
              ? `${trashedOutfits.length} deleted ${trashedOutfits.length === 1 ? 'outfit' : 'outfits'} · restore any look to Main Kloset.`
              : isMain
                ? `${savedOutfits.length} ${savedOutfits.length === 1 ? 'outfit' : 'outfits'} in your main collection.`
                : `${currentOutfits.length} ${currentOutfits.length === 1 ? 'outfit' : 'outfits'} in ${activeCollection.name}. Added looks stay in Main Kloset too.`}
          </p>
          {!showRecycleBin && <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/stylist')}
              className="h-10 px-4 flex items-center gap-2 ring-1 ring-inset ring-text-primary/20 text-2xs font-medium uppercase tracking-widest text-text-primary hover:ring-text-primary/50"
            >
              <Sparkles size={14} strokeWidth={1.25} /> Ask the stylist
            </button>
            <button
              onClick={() => setCreating(true)}
              className="h-10 px-4 flex items-center gap-2 bg-text-primary text-warm-cream text-2xs font-medium uppercase tracking-widest hover:bg-text-primary/90"
            >
              <Plus size={14} strokeWidth={1.5} /> New outfit
            </button>
          </div>}
        </div>
      </div>

      {resolvedOutfits.length === 0 ? (
        <div className="py-20 flex flex-col items-center text-center px-4">
          {showRecycleBin ? <>
            <h2 className="font-display text-3xl text-text-primary mb-3">Recycle bin is empty</h2>
            <p className="text-text-muted text-sm max-w-sm leading-relaxed">Outfits you remove from Main Kloset will stay here until you restore or permanently delete them.</p>
          </> : !isMain ? <>
            <h2 className="font-display text-3xl text-text-primary mb-3">Nothing in {activeCollection.name} yet</h2>
            <p className="text-text-muted text-sm max-w-sm leading-relaxed mb-8">Add saved looks from Main Kloset. They’ll appear here while staying in your main collection.</p>
            {availableMainOutfits.length > 0 && <button onClick={() => setShowAddFromMain(true)} className="h-12 px-8 bg-text-primary text-warm-cream text-xs font-medium uppercase tracking-widest">Add outfits from Main</button>}
          </> : <>
            <h2 className="font-display text-3xl text-text-primary mb-3">No outfits yet</h2>
            <p className="text-text-muted text-sm max-w-sm leading-relaxed mb-8">Outfits you save from the stylist, or build here from your own pieces, will be kept in this collection.</p>
            <button onClick={() => setCreating(true)} className="h-12 px-8 flex items-center gap-2 bg-text-primary text-warm-cream text-xs font-medium uppercase tracking-widest hover:bg-text-primary/90">
              <Plus size={14} strokeWidth={1.5} /> Build your first outfit
            </button>
          </>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-10">
          {resolvedOutfits.map(({ outfit, resolvedItems }) => (
            <SavedOutfitCard
              key={outfit.id}
              outfit={outfit}
              resolvedItems={resolvedItems}
              onClick={() => setSelectedOutfit(outfit)}
              onUnsave={(event) => { event.stopPropagation(); removeFromCurrentView(outfit) }}
              onRestore={showRecycleBin ? (event) => { event.stopPropagation(); restoreOutfit(outfit.id) } : undefined}
              removeLabel={showRecycleBin ? 'Delete outfit permanently' : isMain ? 'Move outfit to recycle bin' : 'Remove from this Kloset'}
              onSend={(event) => { event.stopPropagation(); sendOutfit(outfit) }}
              trashed={showRecycleBin}
            />
          ))}
        </div>
      )}

      <SavedOutfitDetailModal
        outfit={selectedOutfit}
        resolvedItems={selectedResolved}
        open={!!selectedOutfit}
        onClose={() => setSelectedOutfit(null)}
        onUnsave={() => selectedOutfit && removeFromCurrentView(selectedOutfit)}
        removeLabel={showRecycleBin ? 'Delete Permanently' : isMain ? 'Move to Recycle Bin' : 'Remove from Kloset'}
        onRestore={showRecycleBin && selectedOutfit ? () => { restoreOutfit(selectedOutfit.id); setSelectedOutfit(null) } : undefined}
        onStyleSimilar={() => { setSelectedOutfit(null); navigate('/stylist') }}
        onSend={() => {
          if (!selectedOutfit) return
          const outfit = selectedOutfit
          setSelectedOutfit(null)
          sendOutfit(outfit)
        }}
      />

      {showAddFromMain && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAddFromMain(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="add-outfits-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-xl max-h-[85svh] overflow-hidden rounded-2xl bg-warm-cream shadow-2xl">
          <header className="flex items-start justify-between border-b border-text-primary/10 p-6">
            <div>
              <p className="text-2xs uppercase tracking-widest text-text-muted">Keep your original looks</p>
              <h2 id="add-outfits-title" className="mt-1 font-display text-2xl text-text-primary">Add outfits to {activeCollection.name}</h2>
            </div>
            <button onClick={() => setShowAddFromMain(false)} aria-label="Close add outfits dialog" className="p-1 text-text-muted hover:text-text-primary"><X size={20} /></button>
          </header>
          <div className="max-h-[55svh] overflow-y-auto p-6">
            {availableMainOutfits.length === 0 ? <p className="py-8 text-center text-sm text-text-muted">All your Main Kloset outfits are already in this collection.</p> : <div className="space-y-2">
              {availableMainOutfits.map((outfit) => <label key={outfit.id} className="flex cursor-pointer items-center gap-3 border border-text-primary/10 p-4 hover:border-text-primary/30">
                <input type="checkbox" checked={pickedOutfitIds.includes(outfit.id)} onChange={() => togglePickedOutfit(outfit.id)} className="h-4 w-4 accent-text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg text-text-primary">{outfit.name}</span>
                  <span className="block text-xs capitalize text-text-muted">{outfit.occasion.replace('-', ' ')}</span>
                </span>
                <span className="text-2xs uppercase tracking-widest text-text-muted">In Main</span>
              </label>)}
            </div>}
          </div>
          <footer className="flex items-center justify-between border-t border-text-primary/10 p-6">
            <span className="text-xs text-text-muted">{pickedOutfitIds.length} selected</span>
            <button disabled={!pickedOutfitIds.length} onClick={addPickedOutfits} className="h-11 px-5 bg-text-primary text-warm-cream text-2xs font-medium uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40">Add without moving</button>
          </footer>
        </section>
      </div>}

      <ShareSheet target={shareTarget} onClose={() => setShareTarget(null)} />
      <CreateOutfitModal open={creating} items={wardrobeItems} onClose={() => setCreating(false)} onSave={handleCreate} />
    </>
  )
}
