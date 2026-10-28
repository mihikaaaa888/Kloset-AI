import { Trash2, ChevronRight, Shirt, Send } from 'lucide-react'
import { HangerIcon } from '@/components/ui/HangerIcon'
import { clsx } from 'clsx'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { colourNameToHex, isLightColour } from '@/lib/colourUtils'
import { useItemImage } from '@/hooks/useItemImage'
import type { Outfit, ClothingItem } from '@/types'

interface ResolvedOutfitItem {
  itemId: string
  role: string
  item: ClothingItem | null
}

interface SavedOutfitDetailModalProps {
  outfit: Outfit | null
  resolvedItems: ResolvedOutfitItem[]
  open: boolean
  onClose: () => void
  onUnsave: () => void
  onStyleSimilar: () => void
  onSend: () => void
}

const OCCASION_LABEL: Record<string, string> = {
  work: 'Work', casual: 'Casual', 'date-night': 'Date Night', formal: 'Formal',
  weekend: 'Weekend', travel: 'Travel', 'special-event': 'Special Event', gym: 'Gym',
}
const WEATHER_LABEL: Record<string, string> = {
  hot: 'Hot', warm: 'Warm', cool: 'Cool', cold: 'Cold', rainy: 'Rainy',
}

export function SavedOutfitDetailModal({
  outfit,
  resolvedItems,
  open,
  onClose,
  onUnsave,
  onStyleSimilar,
  onSend,
}: SavedOutfitDetailModalProps) {
  if (!outfit) return null

  const mainItems = resolvedItems.filter((r) => ['top', 'bottom', 'dress'].includes(r.role))
  const otherItems = resolvedItems.filter((r) => !['top', 'bottom', 'dress'].includes(r.role))
  const allColours = [
    ...new Set(resolvedItems.flatMap((r) => r.item?.colour ?? [])),
  ]

  const tips = outfit.stylingNotes
    ? outfit.stylingNotes.split('. ').filter(Boolean)
    : []

  return (
    <Modal open={open} onClose={onClose} variant="sheet" maxWidth="max-w-lg">
      <div className="pb-8">
        {/* Header */}
        <div className="px-6 pt-5 pb-5 border-b border-cream-100">
          <h2 className="font-serif text-2xl font-medium text-charcoal-900 leading-tight">
            {outfit.name}
          </h2>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="dark">{OCCASION_LABEL[outfit.occasion] ?? outfit.occasion}</Badge>
            {outfit.weather && (
              <Badge variant="neutral">{WEATHER_LABEL[outfit.weather] ?? outfit.weather}</Badge>
            )}
            {outfit.mood && (
              <Badge variant="gold" className="capitalize">{outfit.mood}</Badge>
            )}
          </div>
        </div>

        <div className="px-6 pt-5 space-y-6">
          {/* Items grid */}
          <div className="space-y-3">
            <p className="text-2xs font-medium text-charcoal-400 uppercase tracking-widest">
              Outfit pieces
            </p>
            <div
              className={clsx(
                'grid gap-3',
                mainItems.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
              )}
            >
              {mainItems.map((r) => (
                <OutfitDetailTile key={r.itemId} resolved={r} featured />
              ))}
            </div>
            {otherItems.length > 0 && (
              <div
                className={clsx(
                  'grid gap-3',
                  otherItems.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                )}
              >
                {otherItems.map((r) => (
                  <OutfitDetailTile key={r.itemId} resolved={r} />
                ))}
              </div>
            )}
          </div>

          {/* Why it works */}
          {outfit.whyItWorks && (
            <div className="rounded-3xl bg-charcoal-900 p-5">
              <div className="flex items-center gap-2 mb-3">
                <HangerIcon size={13} className="text-gold" />
                <span className="text-gold text-2xs font-medium uppercase tracking-widest">
                  Why this works
                </span>
              </div>
              <p className="text-cream-50/80 text-sm leading-relaxed">{outfit.whyItWorks}</p>
              {allColours.length > 0 && (
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-charcoal-700">
                  <span className="text-charcoal-400 text-2xs uppercase tracking-widest">Palette</span>
                  <div className="flex gap-1.5">
                    {allColours.slice(0, 6).map((c) => (
                      <div
                        key={c}
                        title={c}
                        className="w-3.5 h-3.5 rounded-full ring-1 ring-white/10"
                        style={{ backgroundColor: colourNameToHex(c) }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Styling tips */}
          {tips.length > 0 && (
            <div className="rounded-3xl bg-cream-100 p-5">
              <p className="text-2xs font-medium text-charcoal-400 uppercase tracking-widest mb-3">
                Styling tips
              </p>
              <ul className="space-y-2">
                {tips.slice(0, 3).map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <ChevronRight size={13} className="text-gold mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-charcoal-700 leading-relaxed">{tip}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onStyleSimilar}
              fullWidth
              className="gap-2"
            >
              <HangerIcon size={14} />
              Style Similar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSend}
              fullWidth
              className="gap-2"
            >
              <Send size={14} strokeWidth={1.5} />
              Send
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onUnsave}
              fullWidth
              className="gap-2 !text-red-500 hover:!bg-red-50 dark:bg-red-950/40"
            >
              <Trash2 size={14} />
              Remove
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function OutfitDetailTile({
  resolved,
  featured = false,
}: {
  resolved: ResolvedOutfitItem
  featured?: boolean
}) {
  const { item, role } = resolved
  const imageUrl = useItemImage(item)

  if (!item) {
    return (
      <div
        className={clsx(
          'rounded-2xl bg-cream-100 flex items-center justify-center',
          featured ? 'aspect-[4/3]' : 'aspect-[3/2]'
        )}
      >
        <p className="text-2xs text-charcoal-300 uppercase tracking-widest">Removed</p>
      </div>
    )
  }

  const bgHex = item.colour[0] ? colourNameToHex(item.colour[0]) : '#EDE9E2'
  const isLight = isLightColour(bgHex)

  return (
    <div className="rounded-2xl overflow-hidden bg-surface shadow-card">
      <div
        className={clsx('relative flex items-center justify-center', featured ? 'aspect-[4/3]' : 'aspect-[3/2]')}
        style={imageUrl ? undefined : { backgroundColor: bgHex }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <Shirt
            size={28}
            className={clsx('select-none', isLight ? 'text-text-primary opacity-30' : 'text-white opacity-40')}
          />
        )}
        <span className="absolute top-2 left-2 text-2xs font-medium uppercase tracking-widest px-2 py-0.5 rounded-full bg-surface/90 backdrop-blur-sm text-charcoal-700 capitalize">
          {role}
        </span>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-xs font-medium text-charcoal-900 truncate">{item.name}</p>
      </div>
    </div>
  )
}
