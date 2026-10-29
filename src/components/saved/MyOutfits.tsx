import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Sparkles } from 'lucide-react'

import { SavedOutfitCard } from '@/components/saved/SavedOutfitCard'
import { SavedOutfitDetailModal } from '@/components/saved/SavedOutfitDetailModal'
import { CreateOutfitModal } from '@/components/saved/CreateOutfitModal'
import { ShareSheet } from '@/components/friends/ShareSheet'
import type { ShareTarget } from '@/lib/friendService'
import { useOutfitStore } from '@/store/outfitStore'
import { deleteWithUndo } from '@/store/undoStore'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { resolveOutfitItems } from '@/lib/outfitPieces'
import type { Outfit } from '@/types'

/** The "My Outfits" view inside My Kloset: saved looks plus a manual outfit builder. */
export function MyOutfits() {
  const navigate = useNavigate()
  const { savedOutfits, saveOutfit, unsaveOutfit } = useOutfitStore()
  const wardrobeItems = useWardrobeStore((s) => s.items)

  const [selectedOutfit, setSelectedOutfit] = useState<Outfit | null>(null)
  const [creating, setCreating] = useState(false)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)
  // Shop and inspiration pieces aren't in the wardrobe, so pass the resolved ones along.
  const sendOutfit = (outfit: Outfit) => {
    const items = resolveOutfitItems(outfit, wardrobeItems).flatMap((r) => (r.item ? [r.item] : []))
    setShareTarget({ kind: 'outfit', outfit, items })
  }

  // Newest first, with each outfit's pieces resolved against the wardrobe (or their snapshot)
  const resolvedOutfits = useMemo(
    () =>
      [...savedOutfits]
        .sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''))
        .map((outfit) => ({ outfit, resolvedItems: resolveOutfitItems(outfit, wardrobeItems) })),
    [savedOutfits, wardrobeItems]
  )

  const selectedResolved = useMemo(
    () => resolvedOutfits.find((r) => r.outfit.id === selectedOutfit?.id)?.resolvedItems ?? [],
    [resolvedOutfits, selectedOutfit]
  )

  const handleUnsave = (outfit: Outfit, e?: React.MouseEvent) => {
    e?.stopPropagation()
    deleteWithUndo({
      message: `Removed ${outfit.name || 'outfit'}`,
      remove: () => {
        unsaveOutfit(outfit.id)
        console.log('[my-outfits] removed outfit', outfit.id)
        if (selectedOutfit?.id === outfit.id) setSelectedOutfit(null)
      },
      // Put back as it was, keeping its original savedAt so it returns to the same spot.
      restore: () =>
        useOutfitStore.setState((s) => ({
          savedOutfits: [...s.savedOutfits.filter((o) => o.id !== outfit.id), outfit],
        })),
    })
  }

  const handleCreate = (outfit: Outfit) => {
    saveOutfit(outfit)
    console.log('[my-outfits] outfit saved', outfit.id)
    setCreating(false)
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-text-primary/10 mb-8">
        <p className="text-sm text-text-muted">
          {savedOutfits.length === 0
            ? 'Put pieces together yourself, or let the stylist suggest a look.'
            : `${savedOutfits.length} ${savedOutfits.length === 1 ? 'outfit' : 'outfits'} saved`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/stylist')}
            className="h-11 px-5 flex items-center gap-2 ring-1 ring-inset ring-text-primary/20 text-text-primary text-xs font-medium uppercase tracking-widest hover:ring-text-primary/50 transition-colors"
          >
            <Sparkles size={14} strokeWidth={1.25} />
            Ask the stylist
          </button>
          <button
            onClick={() => setCreating(true)}
            className="h-11 px-5 flex items-center gap-2 bg-text-primary text-warm-cream text-xs font-medium uppercase tracking-widest hover:bg-text-primary/90 transition-colors"
          >
            <Plus size={14} strokeWidth={1.5} />
            New outfit
          </button>
        </div>
      </div>

      {savedOutfits.length === 0 ? (
        <div className="py-20 flex flex-col items-center text-center px-4">
          <h2 className="font-display text-3xl text-text-primary mb-3">No outfits yet</h2>
          <p className="text-text-muted text-sm max-w-sm leading-relaxed mb-8">
            Outfits you save from the stylist, or build here from your own pieces, will be kept in this collection.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="h-12 px-8 flex items-center gap-2 bg-text-primary text-warm-cream text-xs font-medium uppercase tracking-widest hover:bg-text-primary/90 transition-colors"
          >
            <Plus size={14} strokeWidth={1.5} />
            Build your first outfit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-10">
          {resolvedOutfits.map(({ outfit, resolvedItems }) => (
            <SavedOutfitCard
              key={outfit.id}
              outfit={outfit}
              resolvedItems={resolvedItems}
              onClick={() => setSelectedOutfit(outfit)}
              onUnsave={(e) => handleUnsave(outfit, e)}
              onSend={(e) => { e.stopPropagation(); sendOutfit(outfit) }}
            />
          ))}
        </div>
      )}

      <SavedOutfitDetailModal
        outfit={selectedOutfit}
        resolvedItems={selectedResolved}
        open={!!selectedOutfit}
        onClose={() => setSelectedOutfit(null)}
        onUnsave={() => selectedOutfit && handleUnsave(selectedOutfit)}
        onStyleSimilar={() => {
          setSelectedOutfit(null)
          navigate('/stylist')
        }}
        onSend={() => {
          if (!selectedOutfit) return
          const outfit = selectedOutfit
          setSelectedOutfit(null)
          sendOutfit(outfit)
        }}
      />

      <ShareSheet target={shareTarget} onClose={() => setShareTarget(null)} />

      <CreateOutfitModal
        open={creating}
        items={wardrobeItems}
        onClose={() => setCreating(false)}
        onSave={handleCreate}
      />
    </>
  )
}
