import { Heart, MoreHorizontal, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ClothingItem } from '@/types'
import { colourNameToHex, isLightColour } from '@/lib/colourUtils'
import { useItemImage } from '@/hooks/useItemImage'
import { CategoryGlyph } from '@/components/wardrobe/categoryVisuals'

interface ClothingCardProps {
  item: ClothingItem
  onClick: () => void
  onCompletePiece?: (e: React.MouseEvent) => void
  onFavourite?: () => void
  isFavourite?: boolean
  selectionMode?: boolean
  onDelete?: (e: React.MouseEvent) => void
  deleteLabel?: string
}

/**
 * Editorial product tile: a tall photo on a warm neutral stage with the
 * piece's name and details set underneath, like a boutique listing.
 */
export function ClothingCard({ item, onClick, onCompletePiece, onFavourite, isFavourite = item.isFavourite, selectionMode = false, onDelete, deleteLabel = `Delete ${item.name}` }: ClothingCardProps) {
  const imageUrl = useItemImage(item)
  const primaryColour = item.colour[0]
  const bgHex = primaryColour ? colourNameToHex(primaryColour) : '#EDE9E2'
  const [showActions, setShowActions] = useState(false)
  const meta = [item.colour[0], item.timesWorn > 0 ? `worn ${item.timesWorn}×` : null].filter(Boolean).join(' · ')
  const actionMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showActions) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!actionMenuRef.current?.contains(event.target as Node)) setShowActions(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowActions(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [showActions])

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
              className="w-full h-full object-cover transition-transform duration-700 ease-editorial group-hover:scale-[1.015]"
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
          {isFavourite && (
            <span className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-warm-cream/95 text-text-primary shadow-soft" aria-label="Favourite" role="img">
              <Heart size={13} strokeWidth={1.7} fill="currentColor" />
            </span>
          )}
        </div>

        <div className="pt-2.5">
          <h3 className="truncate font-display text-base leading-snug text-text-primary">{item.name}</h3>
          {meta && <p className="mt-0.5 truncate text-xs capitalize text-text-muted">{meta}</p>}
        </div>
      </button>

      {(onCompletePiece || onDelete) && (
        <div className="absolute right-2.5 top-2.5 z-10" ref={actionMenuRef}>
          <button
            type="button"
            title="Piece actions"
            aria-label={`Actions for ${item.name}`}
            aria-haspopup="menu"
            aria-expanded={showActions}
            onClick={(event) => { event.stopPropagation(); setShowActions((open) => !open) }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-warm-cream/95 text-text-primary shadow-soft backdrop-blur-sm transition-colors hover:bg-text-primary hover:text-warm-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            <MoreHorizontal size={16} strokeWidth={1.7} />
          </button>
          {showActions && (
            <div role="menu" aria-label={`${item.name} actions`} className="absolute right-0 top-10 min-w-48 border border-text-primary/10 bg-surface p-1 shadow-lifted">
              {onCompletePiece && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={(event) => { event.stopPropagation(); setShowActions(false); onCompletePiece(event) }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-text-primary transition-colors hover:bg-text-primary/5"
                >
                  <Sparkles size={15} strokeWidth={1.5} />
                  Style this piece
                </button>
              )}
              {onFavourite && (
                <button
                  type="button"
                  role="menuitem"
                  aria-pressed={isFavourite}
                  onClick={(event) => { event.stopPropagation(); setShowActions(false); onFavourite() }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-text-primary transition-colors hover:bg-text-primary/5"
                >
                  <Heart size={15} strokeWidth={1.5} fill={isFavourite ? 'currentColor' : 'none'} />
                  {isFavourite ? 'Remove favourite' : 'Add to favourites'}
                </button>
              )}
              {onDelete && (
                <>
                  <div className="my-1 border-t border-text-primary/10" />
                  <button
                    type="button"
                    role="menuitem"
                    aria-label={deleteLabel}
                    onClick={(event) => { event.stopPropagation(); setShowActions(false); onDelete(event) }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-red-700 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <Trash2 size={15} strokeWidth={1.5} />
                    Remove
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

    </article>
  )
}
