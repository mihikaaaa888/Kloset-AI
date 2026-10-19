import { useState } from 'react'
import { Plus, Check, ArrowUpRight } from 'lucide-react'
import { colourNameToHex, isLightColour } from '@/lib/colourUtils'
import { CategoryGlyph } from '@/components/wardrobe/categoryVisuals'
import { formatINR } from '@/lib/shopping'
import type { CatalogItem } from '@/types'

interface ShopItemCardProps {
  item: CatalogItem
  mode: 'buy' | 'rent'
  inWardrobe: boolean
  onAdd: () => void
}

/** H&M-style product tile — photo, name, price, plain-text actions. No card box, no brand. */
export function ShopItemCard({ item, mode, inWardrobe, onAdd }: ShopItemCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const fallbackHex = item.colours[0] ? colourNameToHex(item.colours[0]) : '#EDE9E2'
  const fallbackText = isLightColour(fallbackHex) ? 'text-text-primary/35' : 'text-white/45'
  const href = mode === 'rent' ? item.rentUrl : item.shopUrl

  return (
    <div className="group flex flex-col">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={() => console.log('[shop] open item', { id: item.id, mode })}
        className="relative block aspect-[3/4] overflow-hidden bg-cream-200"
      >
        {item.imageUrl && !imageFailed ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
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
        {inWardrobe && (
          <span className="absolute top-3 left-3 text-2xs uppercase tracking-widest text-text-primary bg-warm-cream/90 px-2 py-1">
            In your Kloset
          </span>
        )}
      </a>

      <div className="pt-3 flex flex-col gap-1">
        <p className="text-sm text-text-primary leading-snug">{item.name}</p>
        <p className="text-sm font-semibold text-text-primary">
          {mode === 'rent' ? (
            <>{formatINR(item.rentPricePerWeek)}<span className="font-normal text-text-muted"> / week</span></>
          ) : (
            <>{formatINR(item.estimatedPrice)}</>
          )}
        </p>

        <div className="flex items-center gap-5">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 py-3 text-2xs uppercase tracking-widest text-butter-yellow font-semibold hover:underline underline-offset-4"
          >
            {mode === 'rent' ? 'Rent' : 'Buy'}
            <ArrowUpRight size={12} />
          </a>
          <button
            type="button"
            onClick={() => !inWardrobe && onAdd()}
            disabled={inWardrobe}
            className="flex items-center gap-1 py-3 text-2xs uppercase tracking-widest text-text-muted hover:text-text-primary disabled:text-text-muted/50 disabled:cursor-default transition-colors"
          >
            {inWardrobe ? <Check size={12} /> : <Plus size={12} />}
            {inWardrobe ? 'Added' : 'Add to Kloset'}
          </button>
        </div>
      </div>
    </div>
  )
}
