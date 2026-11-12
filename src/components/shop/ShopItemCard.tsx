import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { colourNameToHex, isLightColour } from '@/lib/colourUtils'
import { CategoryGlyph } from '@/components/wardrobe/categoryVisuals'
import { formatINR } from '@/lib/shopping'
import type { CatalogItem } from '@/types'

interface ShopItemCardProps {
  item: CatalogItem
  mode: 'buy' | 'rent'
  inWardrobe: boolean
  onAdd: () => void
  onRemove: () => void
  onCompletePiece?: () => void
}

/** Product tile with its closet and styling actions grouped in one menu. */
export function ShopItemCard({ item, mode, inWardrobe, onAdd, onRemove, onCompletePiece }: ShopItemCardProps) {
  const [imageStage, setImageStage] = useState<0 | 1 | 2>(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const fallbackHex = item.colours[0] ? colourNameToHex(item.colours[0]) : '#EDE9E2'
  const fallbackText = isLightColour(fallbackHex) ? 'text-text-primary/35' : 'text-white/45'
  const href = mode === 'rent' ? item.rentUrl : item.shopUrl

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  return (
    <div className="group flex flex-col">
      <div className="relative aspect-[3/4] overflow-hidden bg-cream-200">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={() => { console.log('[shop] open item', { id: item.id, mode }) }}
          className="absolute inset-0 block"
        >
          {imageStage < 2 && (imageStage === 1 ? item.imageFallbackUrl : item.imageUrl) ? (
            <img
              src={imageStage === 1 ? item.imageFallbackUrl : item.imageUrl}
              alt={item.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageStage((stage) => stage === 0 && item.imageFallbackUrl ? 1 : 2)}
              onLoad={(e) => {
                const { naturalWidth: w, naturalHeight: h } = e.currentTarget
                // Retailer logos / 1px placeholders load fine but aren't product photos.
                if (w < 200 || h < 200 || w / h > 1.6) setImageStage((stage) => stage === 0 && item.imageFallbackUrl ? 1 : 2)
              }}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              aria-hidden="true"
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: fallbackHex }}
            >
              <CategoryGlyph category={item.category} size={56} className={fallbackText} />
            </div>
          )}
        </a>
        {inWardrobe && <span className="absolute left-3 top-3 bg-warm-cream/90 px-2 py-1 text-2xs uppercase tracking-widest text-text-primary">In your Kloset</span>}
        <div ref={menuRef} className="absolute right-2 top-2 z-10">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={`Actions for ${item.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Piece actions"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-warm-cream/95 text-text-primary shadow-sm transition-colors hover:bg-text-primary hover:text-warm-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary"
          >
            <MoreHorizontal size={18} strokeWidth={1.7} />
          </button>
          {menuOpen && <div role="menu" className="absolute right-0 top-full mt-1 w-44 border border-text-primary/10 bg-surface py-1 shadow-lifted">
            {mode === 'buy' && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); inWardrobe ? onRemove() : onAdd() }} className="block w-full px-3 py-2.5 text-left text-sm text-text-primary hover:bg-text-primary/5">{inWardrobe ? 'Remove from Kloset' : 'Add to Kloset'}</button>}
            {onCompletePiece && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onCompletePiece() }} className="block w-full px-3 py-2.5 text-left text-sm text-text-primary hover:bg-text-primary/5">Complete a piece</button>}
          </div>}
        </div>
      </div>

      <div className="pt-3 flex flex-col gap-1">
        <p className="text-sm text-text-primary leading-snug">{item.name}</p>
        <p className="text-xs text-text-muted">
          {item.brand ? <>{item.brand} · </> : null}
          {mode === 'rent' ? (
            <>{formatINR(item.rentPricePerWeek)} / week</>
          ) : (
            <>{formatINR(item.estimatedPrice)}</>
          )}
        </p>
      </div>
    </div>
  )
}
