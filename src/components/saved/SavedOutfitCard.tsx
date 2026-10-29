import { Trash2, Send, RotateCcw } from 'lucide-react'
import { CategoryGlyph } from '@/components/wardrobe/categoryVisuals'
import { clsx } from 'clsx'
import { colourNameToHex, isLightColour } from '@/lib/colourUtils'
import { useItemImage } from '@/hooks/useItemImage'
import type { Outfit, ClothingItem } from '@/types'

interface ResolvedOutfitItem {
  itemId: string
  role: string
  item: ClothingItem | null
}

interface SavedOutfitCardProps {
  outfit: Outfit
  resolvedItems: ResolvedOutfitItem[]
  onClick: () => void
  onUnsave: (e: React.MouseEvent) => void
  onSend: (e: React.MouseEvent) => void
  trashed?: boolean
  onRestore?: (e: React.MouseEvent) => void
  removeLabel?: string
}

const OCCASION_LABEL: Record<string, string> = {
  work: 'Work', casual: 'Casual', 'date-night': 'Date Night', formal: 'Formal',
  weekend: 'Weekend', travel: 'Travel', 'special-event': 'Special Event', gym: 'Gym',
}

export function SavedOutfitCard({ outfit, resolvedItems, onClick, onUnsave, onSend, trashed = false, onRestore, removeLabel }: SavedOutfitCardProps) {
  const mosaicSlots = [...resolvedItems].slice(0, 4)
  while (mosaicSlots.length < 4) mosaicSlots.push({ itemId: '', role: '', item: null })

  const savedDate = outfit.savedAt
    ? new Date(outfit.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null

  return (
    <article className="group relative">
      <button
        onClick={onClick}
        aria-label={`View ${outfit.name}`}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow focus-visible:ring-offset-4 focus-visible:ring-offset-warm-cream"
      >
        {/* Mosaic */}
        <div className="grid grid-cols-2 gap-px aspect-[4/3] bg-text-primary/5 overflow-hidden">
          {mosaicSlots.map((slot, i) => (
            <MosaicCell key={slot.itemId || `empty-${i}`} item={slot.item} role={slot.role} />
          ))}
        </div>

        {/* Info */}
        <div className="pt-4 pr-10">
          <p className="text-2xs uppercase tracking-widest text-text-muted">
            {OCCASION_LABEL[outfit.occasion] ?? outfit.occasion}
            {' · '}
            {resolvedItems.length} {resolvedItems.length === 1 ? 'piece' : 'pieces'}
            {savedDate && <> · {savedDate}</>}
          </p>
          <h3 className="font-display text-xl leading-snug text-text-primary mt-1 line-clamp-2">{outfit.name}</h3>
          {outfit.source === 'manual' ? (
            <p className="text-xs text-text-muted mt-1">Styled by you</p>
          ) : outfit.mood ? (
            <p className="text-xs text-text-muted mt-1 capitalize">{outfit.mood}</p>
          ) : null}
        </div>
      </button>

      <div className="absolute top-2.5 right-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
        {!trashed && <button
          onClick={onSend}
          aria-label="Send to a friend"
          className="w-9 h-9 rounded-full bg-warm-cream/90 backdrop-blur-sm flex items-center justify-center text-text-primary hover:bg-warm-cream transition-colors"
        >
          <Send size={15} strokeWidth={1.25} />
        </button>}
        {trashed && onRestore && <button
          onClick={onRestore}
          aria-label="Restore outfit"
          className="w-9 h-9 rounded-full bg-warm-cream/90 backdrop-blur-sm flex items-center justify-center text-text-primary hover:text-emerald-800 transition-colors"
        >
          <RotateCcw size={15} strokeWidth={1.25} />
        </button>}
        <button
          onClick={onUnsave}
          aria-label={removeLabel ?? (trashed ? 'Delete outfit permanently' : 'Move outfit to recycle bin')}
          className="w-9 h-9 rounded-full bg-warm-cream/90 backdrop-blur-sm flex items-center justify-center text-text-primary hover:text-red-700 transition-colors"
        >
          <Trash2 size={15} strokeWidth={1.25} />
        </button>
      </div>
    </article>
  )
}

function MosaicCell({ item, role }: { item: ClothingItem | null; role: string }) {
  const imageUrl = useItemImage(item)

  if (!item) {
    return <div className="bg-tile" />
  }

  const primaryColour = item.colour[0]
  const bgHex = primaryColour ? colourNameToHex(primaryColour) : '#EDE9E2'
  const isLight = isLightColour(bgHex)

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: bgHex }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
      ) : (
        <CategoryGlyph
          category={item.category}
          size={40}
          className={isLight ? 'text-text-primary/35' : 'text-white/45'}
        />
      )}
      {/* Role tag */}
      <span
        className={clsx(
          'absolute bottom-2 left-2 text-2xs font-medium uppercase tracking-widest px-1.5 py-0.5',
          'bg-warm-cream/90 text-text-primary'
        )}
      >
        {role}
      </span>
    </div>
  )
}
