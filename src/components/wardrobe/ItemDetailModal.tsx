import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Heart, Pencil, Trash2, Plus, X, Send } from 'lucide-react'
import { clsx } from 'clsx'
import { colourNameToHex, isLightColour } from '@/lib/colourUtils'
import { useItemImage } from '@/hooks/useItemImage'
import { CATEGORY_LABEL, CategoryGlyph } from '@/components/wardrobe/categoryVisuals'
import type { ClothingItem } from '@/types'

interface ItemDetailModalProps {
  item: ClothingItem | null
  open: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleFavourite: () => void
  onIncrementWorn: () => void
  onSend: () => void
}

/**
 * Full-screen product page for a single wardrobe piece.
 *
 * The photo sits on a neutral stage and is drawn with object-contain at no
 * more than its natural size, so small or odd-ratio uploads are never
 * stretched or cropped to fill the screen. Details scroll in their own column.
 */
export function ItemDetailModal({
  item,
  open,
  onClose,
  onEdit,
  onDelete,
  onToggleFavourite,
  onIncrementWorn,
  onSend,
}: ItemDetailModalProps) {
  const imageUrl = useItemImage(item)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => { setNaturalSize(null) }, [imageUrl])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open || !item) return null

  const primaryColour = item.colour[0]
  const bgHex = primaryColour ? colourNameToHex(primaryColour) : '#EDE9E2'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      className="fixed inset-0 z-[60] bg-warm-cream animate-fade-in flex flex-col lg:flex-row"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 lg:top-6 lg:right-6 z-10 w-11 h-11 rounded-full bg-surface/90 backdrop-blur-sm ring-1 ring-text-primary/10 flex items-center justify-center text-text-primary hover:bg-surface hover:ring-text-primary/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow"
      >
        <X size={20} strokeWidth={1.25} />
      </button>

      {/* ── Image stage ── */}
      <div className="relative flex-shrink-0 h-[55vh] lg:h-auto lg:flex-1 bg-tile flex items-center justify-center p-6 sm:p-10 lg:p-16 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            onLoad={(e) => {
              const img = e.currentTarget
              setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
              console.log('[item-detail] image loaded', { id: item.id, w: img.naturalWidth, h: img.naturalHeight })
            }}
            onError={() => console.error('[item-detail] image failed to load', item.id)}
            style={naturalSize ? { maxWidth: `min(100%, ${naturalSize.w}px)`, maxHeight: `min(100%, ${naturalSize.h}px)` } : undefined}
            className="max-w-full max-h-full w-auto h-auto object-contain shadow-[0_12px_40px_-12px_rgba(36,27,41,0.25)]"
          />
        ) : (
          <div
            className="aspect-[3/4] h-full max-h-[520px] flex items-center justify-center"
            style={{ backgroundColor: bgHex }}
          >
            <CategoryGlyph
              category={item.category}
              size={72}
              className={isLightColour(bgHex) ? 'text-text-primary/35' : 'text-white/45'}
            />
          </div>
        )}
      </div>

      {/* ── Details ── */}
      <div className="flex-1 lg:flex-none lg:w-[440px] xl:w-[500px] overflow-y-auto border-t lg:border-t-0 lg:border-l border-text-primary/10">
        <div className="px-6 sm:px-10 pt-8 lg:pt-24 pb-12">
          <p className="text-2xs uppercase tracking-widest text-text-muted">
            {CATEGORY_LABEL[item.category]}
            {item.brand && <> · {item.brand}</>}
          </p>
          <h2 className="font-display text-4xl lg:text-5xl font-medium text-text-primary leading-[1.05] mt-3 text-balance">
            {item.name}
          </h2>

          <div className="flex items-center gap-3 mt-8">
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-2 h-12 bg-text-primary text-warm-cream text-xs font-medium uppercase tracking-widest hover:bg-text-primary/90 transition-colors"
            >
              <Pencil size={14} strokeWidth={1.5} />
              Edit piece
            </button>
            <button
              onClick={onToggleFavourite}
              aria-label={item.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
              aria-pressed={item.isFavourite}
              className={clsx(
                'w-12 h-12 flex items-center justify-center ring-1 ring-inset transition-colors',
                item.isFavourite
                  ? 'ring-rose-300 text-rose-500 bg-rose-50'
                  : 'ring-text-primary/20 text-text-primary hover:ring-text-primary/50'
              )}
            >
              <Heart size={18} strokeWidth={1.25} className={item.isFavourite ? 'fill-rose-500' : ''} />
            </button>
          </div>
          <button
            onClick={onSend}
            className="mt-3 w-full flex items-center justify-center gap-2 h-12 ring-1 ring-inset ring-text-primary/20 text-text-primary text-xs font-medium uppercase tracking-widest hover:ring-text-primary/50 transition-colors"
          >
            <Send size={14} strokeWidth={1.25} />
            Send to a friend
          </button>

          <dl className="mt-10 border-t border-text-primary/10">
            {item.colour.length > 0 && (
              <DetailRow label="Colour">
                <div className="flex items-center justify-end gap-3 flex-wrap">
                  {item.colour.map((c) => (
                    <span key={c} className="flex items-center gap-1.5 capitalize">
                      <span
                        className="w-3 h-3 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: colourNameToHex(c) }}
                      />
                      {c}
                    </span>
                  ))}
                </div>
              </DetailRow>
            )}
            {item.material && <DetailRow label="Material"><span className="capitalize">{item.material}</span></DetailRow>}
            {item.pattern && item.pattern !== 'solid' && (
              <DetailRow label="Pattern"><span className="capitalize">{item.pattern}</span></DetailRow>
            )}
            {item.seasons.length > 0 && (
              <DetailRow label="Season">
                <span className="capitalize">{item.seasons.map((s) => s.replace('-', ' ')).join(', ')}</span>
              </DetailRow>
            )}
            {item.occasions.length > 0 && (
              <DetailRow label="Wear to">
                <span className="capitalize">{item.occasions.map((o) => o.replace('-', ' ')).join(', ')}</span>
              </DetailRow>
            )}
            <DetailRow label="Times worn">
              <span className="flex items-center justify-end gap-3">
                <span className="tabular-nums">{item.timesWorn}</span>
                <button
                  onClick={onIncrementWorn}
                  className="flex items-center gap-1 text-2xs uppercase tracking-widest font-semibold text-butter-yellow hover:underline underline-offset-4"
                >
                  <Plus size={12} strokeWidth={1.5} />
                  Log wear
                </button>
              </span>
            </DetailRow>
          </dl>

          {item.notes && (
            <div className="mt-8">
              <p className="text-2xs uppercase tracking-widest text-text-muted mb-2">Notes</p>
              <p className="text-sm text-text-primary leading-relaxed">{item.notes}</p>
            </div>
          )}

          <button
            onClick={onDelete}
            className="mt-10 flex items-center gap-2 text-2xs uppercase tracking-widest text-text-muted hover:text-red-700 transition-colors"
          >
            <Trash2 size={13} strokeWidth={1.5} />
            Remove from Kloset
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-4 border-b border-text-primary/10">
      <dt className="text-2xs uppercase tracking-widest text-text-muted flex-shrink-0">{label}</dt>
      <dd className="text-sm text-text-primary text-right">{children}</dd>
    </div>
  )
}
