import { useState } from 'react'
import { Plus, Check, ArrowUpRight, Shirt } from 'lucide-react'
import { colourNameToHex } from '@/lib/colourUtils'
import { formatINR } from '@/lib/shopping'
import type { CatalogItem } from '@/types'

interface ShopItemCardProps {
  item: CatalogItem
  mode: 'buy' | 'rent'
  inWardrobe: boolean
  onAdd: () => void
}

/** H&M-style product tile — photo, name, price, plain-text actions. No card box; a small retailer tag sits on the photo. */
export function ShopItemCard({ item, mode, inWardrobe, onAdd }: ShopItemCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const fallbackHex = item.colours[0] ? colourNameToHex(item.colours[0]) : '#EDE9E2'
  const href = mode === 'rent' ? item.rentUrl : item.shopUrl

  return (
    <div className="group flex flex-col">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={() => { console.log('[shop] open item', { id: item.id, mode }) }}
        className="relative block aspect-[3/4] overflow-hidden bg-cream-200"
      >
        {!imageFailed ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget
              // Retailer logos / 1px placeholders load fine but aren't product photos.
              if (w < 200 || h < 200 || w / h > 1.6) setImageFailed(true)
            }}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-3 px-4 text-center"
            style={{ background: `linear-gradient(160deg, ${fallbackHex}33, ${fallbackHex}99)` }}
          >
            <Shirt size={32} strokeWidth={1.25} className="text-text-primary/40" />
            <span className="text-2xs uppercase tracking-widest text-text-primary/50">Photo unavailable</span>
          </div>
        )}
        {item.brand && (
          <span className="absolute bottom-3 left-3 text-2xs uppercase tracking-widest text-text-primary bg-warm-cream/90 px-2 py-1">
            {item.brand}
          </span>
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
