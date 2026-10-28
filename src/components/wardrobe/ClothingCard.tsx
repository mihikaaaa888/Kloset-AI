import { Heart, Sparkles, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { ClothingItem } from '@/types'
import { colourNameToHex, isLightColour } from '@/lib/colourUtils'
import { useItemImage } from '@/hooks/useItemImage'
import { CATEGORY_LABEL, CategoryGlyph } from '@/components/wardrobe/categoryVisuals'

interface ClothingCardProps {
  item: ClothingItem
  onClick: () => void
  onToggleFavourite: (e: React.MouseEvent) => void
  onStyleThis?: (e: React.MouseEvent) => void
  onDelete?: (e: React.MouseEvent) => void
}

/**
 * Editorial product tile: a tall photo on a warm neutral stage with the
 * piece's name and details set underneath, like a boutique listing.
 */
export function ClothingCard({ item, onClick, onToggleFavourite, onStyleThis, onDelete }: ClothingCardProps) {
  const imageUrl = useItemImage(item)
  const primaryColour = item.colour[0]
  const bgHex = primaryColour ? colourNameToHex(primaryColour) : '#EDE9E2'

  return (
    <article className="group relative">
      <button
        onClick={onClick}
        aria-label={`View ${item.name}`}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow focus-visible:ring-offset-4 focus-visible:ring-offset-warm-cream"
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

        <div className="pt-3.5 pr-8">
          <p className="text-2xs uppercase tracking-widest text-text-muted">
            {CATEGORY_LABEL[item.category]}
            {item.brand && <> · {item.brand}</>}
          </p>
          <h3 className="font-display text-lg leading-snug text-text-primary mt-1 truncate">{item.name}</h3>
          <div className="flex items-center gap-1 mt-2">
            {item.colour.slice(0, 4).map((c) => (
              <span
                key={c}
                title={c}
                className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: colourNameToHex(c) }}
              />
            ))}
            {item.timesWorn > 0 && (
              <span className="ml-auto text-2xs text-text-muted tabular-nums">Worn {item.timesWorn}×</span>
            )}
          </div>
        </div>
      </button>

      {onDelete && (
        <button
          onClick={onDelete}
          aria-label={`Delete ${item.name}`}
          className="absolute top-2.5 left-2.5 w-9 h-9 rounded-full flex items-center justify-center bg-warm-cream/90 backdrop-blur-sm text-text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 transition-all hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 size={15} strokeWidth={1.5} />
        </button>
      )}

      {/* Favourite: always visible when set, on hover otherwise */}
      <button
        onClick={onToggleFavourite}
        aria-label={item.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
        aria-pressed={item.isFavourite}
        className={clsx(
          'absolute top-2.5 right-2.5 w-9 h-9 rounded-full flex items-center justify-center bg-warm-cream/90 backdrop-blur-sm',
          'transition-all duration-300 hover:bg-warm-cream',
          item.isFavourite ? 'text-rose-500' : 'text-text-primary opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
        )}
      >
        <Heart size={16} strokeWidth={1.25} className={item.isFavourite ? 'fill-rose-500' : ''} />
      </button>

      {/* Style this: slides up over the photo on hover */}
      {onStyleThis && (
        <div className="absolute inset-x-0 top-0 aspect-[3/4] pointer-events-none flex items-end p-2.5">
          <button
            onClick={onStyleThis}
            className="pointer-events-auto w-full h-10 flex items-center justify-center gap-2 bg-warm-cream/95 backdrop-blur-sm text-text-primary text-2xs font-semibold uppercase tracking-widest translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 transition-all duration-300 ease-editorial hover:bg-text-primary hover:text-warm-cream"
          >
            <Sparkles size={13} strokeWidth={1.25} />
            Style this
          </button>
        </div>
      )}
    </article>
  )
}
