import { Plus, Trash2 } from 'lucide-react'
import type { ClothingItem } from '@/types'
import { colourNameToHex, isLightColour } from '@/lib/colourUtils'
import { useItemImage } from '@/hooks/useItemImage'
import { CategoryGlyph } from '@/components/wardrobe/categoryVisuals'

interface ClothingCardProps {
  item: ClothingItem
  onClick: () => void
  onCompletePiece?: (e: React.MouseEvent) => void
  selectionMode?: boolean
  onDelete?: (e: React.MouseEvent) => void
  deleteLabel?: string
}

/**
 * Editorial product tile: a tall photo on a warm neutral stage with the
 * piece's name and details set underneath, like a boutique listing.
 */
export function ClothingCard({ item, onClick, onCompletePiece, selectionMode = false, onDelete, deleteLabel = `Delete ${item.name}` }: ClothingCardProps) {
  const imageUrl = useItemImage(item)
  const primaryColour = item.colour[0]
  const bgHex = primaryColour ? colourNameToHex(primaryColour) : '#EDE9E2'

  return (
    <article className="group relative">
      <button
        onClick={onClick}
        aria-label={selectionMode ? `Select ${item.name} to complete` : `View ${item.name}`}
        className={`block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow focus-visible:ring-offset-4 focus-visible:ring-offset-warm-cream ${selectionMode ? 'rounded-sm transition-shadow hover:ring-2 hover:ring-text-primary/50 hover:ring-offset-2 hover:ring-offset-warm-cream' : ''}`}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-tile">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-700 ease-editorial group-hover:scale-[1.03]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: bgHex }}>
              <CategoryGlyph
                category={item.category}
                size={56}
                className={isLightColour(bgHex) ? 'text-text-primary/35' : 'text-white/45'}
              />
            </div>
          )}
          <div className="absolute inset-0 ring-1 ring-inset ring-text-primary/5 pointer-events-none" />
        </div>

        <div className="pt-2 pr-8">
          <h3 className="font-display text-sm leading-snug text-text-primary truncate">{item.name}</h3>
        </div>
      </button>

      {onCompletePiece && (
        <button
          type="button"
          title="Complete this piece"
          aria-label={`Complete this piece: ${item.name}`}
          onClick={(event) => { event.stopPropagation(); onCompletePiece(event) }}
          className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-warm-cream/95 text-text-primary shadow-soft backdrop-blur-sm transition-opacity hover:bg-text-primary hover:text-warm-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <Plus size={16} strokeWidth={1.7} />
        </button>
      )}

      {onDelete && (
        <button
          onClick={onDelete}
          aria-label={deleteLabel}
          className="absolute top-2.5 left-2.5 w-9 h-9 rounded-full flex items-center justify-center bg-warm-cream/90 backdrop-blur-sm text-text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 transition-all hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 size={15} strokeWidth={1.5} />
        </button>
      )}

    </article>
  )
}
