import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

import { SavedOutfitCard } from '@/components/saved/SavedOutfitCard'
import { SavedOutfitDetailModal } from '@/components/saved/SavedOutfitDetailModal'
import { CreateOutfitModal } from '@/components/saved/CreateOutfitModal'
import { ShareSheet } from '@/components/friends/ShareSheet'
import type { ShareTarget } from '@/lib/friendService'
import { useOutfitStore } from '@/store/outfitStore'
import { useKlosetStore } from '@/store/klosetStore'
import { deleteWithUndo } from '@/store/undoStore'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { resolveOutfitItems } from '@/lib/outfitPieces'
import type { Outfit } from '@/types'

/** Saved looks, named outfit collections, and recoverable deleted looks. */
export function MyOutfits() {
  const navigate = useNavigate()
  const { savedOutfits, trashedOutfits, saveOutfit, trashOutfit, restoreOutfit, permanentlyDeleteOutfit } = useOutfitStore()
  const { collections, activeCollectionId, addOutfits, removeOutfit } = useKlosetStore()
  const wardrobeItems = useWardrobeStore((s) => s.items)
  const [searchParams, setSearchParams] = useSearchParams()

  const [selectedOutfit, setSelectedOutfit] = useState<Outfit | null>(null)
  const [creating, setCreating] = useState(false)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)
  const showRecycleBin = searchParams.get('recycle') === '1'
  const clearRecycleBinView = () => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('recycle')
    setSearchParams(nextParams, { replace: true })
  }

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

  // Shop and inspiration pieces aren't in the wardrobe, so pass the resolved ones along.
  const sendOutfit = (outfit: Outfit) => {
    const items = resolveOutfitItems(outfit, wardrobeItems).flatMap((r) => (r.item ? [r.item] : []))
    setShareTarget({ kind: 'outfit', outfit, items })
  }

  // Every removal here can be undone from the toast, including emptying it from the recycle bin.
  const removeFromCurrentView = (outfit: Outfit) => {
    const closeIfOpen = () => { if (selectedOutfit?.id === outfit.id) setSelectedOutfit(null) }
    const name = outfit.name || 'outfit'
    if (showRecycleBin) {
      const index = useOutfitStore.getState().trashedOutfits.findIndex((o) => o.id === outfit.id)
      deleteWithUndo({
        message: `Deleted ${name}`,
        remove: () => { permanentlyDeleteOutfit(outfit.id); closeIfOpen() },
        restore: () => useOutfitStore.setState((s) => {
          const rest = s.trashedOutfits.filter((o) => o.id !== outfit.id)
          return { trashedOutfits: [...rest.slice(0, index), outfit, ...rest.slice(index)] }
        }),
      })
    } else if (isMain) {
      deleteWithUndo({
        message: `Moved ${name} to the recycle bin`,
        remove: () => { trashOutfit(outfit.id); closeIfOpen() },
        restore: () => restoreOutfit(outfit.id),
      })
    } else {
      const collectionId = activeCollection.id
      deleteWithUndo({
        message: `Removed ${name} from ${activeCollection.name}`,
        remove: () => { removeOutfit(collectionId, outfit.id); closeIfOpen() },
        restore: () => addOutfits(collectionId, [outfit.id]),
      })
    }
  }

  const handleCreate = (outfit: Outfit) => {
    saveOutfit(outfit)
    if (!isMain) addOutfits(activeCollection.id, [outfit.id])
    clearRecycleBinView()
    setCreating(false)
  }

  return (
    <>
      <div className="mb-5 flex justify-end border-b border-text-primary/10 pb-4">
        {!showRecycleBin && <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={showCreateMenu}
            onClick={() => setShowCreateMenu((visible) => !visible)}
            className="inline-flex items-center gap-2 py-2 text-xs font-medium uppercase tracking-widest text-text-primary hover:text-text-muted"
          >
            Create outfit <ChevronDown size={14} />
          </button>
          {showCreateMenu && <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-56 border border-text-primary/10 bg-surface p-1 shadow-lifted">
            <button role="menuitem" onClick={() => { setShowCreateMenu(false); navigate('/wardrobe?view=build') }} className="block w-full px-3 py-2.5 text-left text-sm text-text-primary hover:bg-text-primary/5">Build it myself</button>
            <button role="menuitem" onClick={() => { setShowCreateMenu(false); navigate('/stylist') }} className="block w-full px-3 py-2.5 text-left text-sm text-text-primary hover:bg-text-primary/5">Let the stylist do it</button>
          </div>}
        </div>}
      </div>

      {resolvedOutfits.length === 0 ? (
        <div className="py-20 flex flex-col items-center text-center px-4">
          {showRecycleBin ? <>
            <h2 className="font-display text-3xl text-text-primary mb-3">Recycle bin is empty</h2>
            <p className="text-text-muted text-sm max-w-sm leading-relaxed">Deleted outfits stay here for 30 days, then they’re permanently removed.</p>
          </> : !isMain ? <>
            <h2 className="font-display text-3xl text-text-primary mb-3">Nothing in {activeCollection.name} yet</h2>
            <p className="text-text-muted text-sm max-w-sm leading-relaxed mb-8">Add saved looks from Main Kloset. They’ll appear here while staying in your main collection.</p>
          </> : <>
            <h2 className="font-display text-3xl text-text-primary mb-3">No outfits yet</h2>
            <p className="text-text-muted text-sm max-w-sm leading-relaxed mb-8">Outfits you save from the stylist, or build here from your own pieces, will be kept in this collection.</p>
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

      <ShareSheet target={shareTarget} onClose={() => setShareTarget(null)} />
      <CreateOutfitModal open={creating} items={wardrobeItems} onClose={() => setCreating(false)} onSave={handleCreate} />
    </>
  )
}
