import { RefreshCw, BookMarked, Check, Shirt } from 'lucide-react'
import { HangerIcon } from '@/components/ui/HangerIcon'
import { CompleteTheLook } from '@/components/stylist/CompleteTheLook'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { colourNameToHex, isLightColour } from '@/lib/colourUtils'
import { useItemImage } from '@/hooks/useItemImage'
import type { OutfitSuggestion, OutfitItemResult } from '@/lib/stylist'

// ─── Occasion + weather display labels ───────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────

interface OutfitResultProps {
  suggestion: OutfitSuggestion
  onTryAnother: () => void
  onSave: () => void
  isSaved: boolean
  isRegenerating: boolean
}

export function OutfitResult({
  suggestion,
  onTryAnother,
  onSave,
  isSaved,
  isRegenerating,
}: OutfitResultProps) {
  const { name, items, stylingTips } = suggestion

  return (
    <div className="animate-fade-up grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
      {/* ══ Left: the outfit itself ══════════════════════════════════════════ */}
      <div className="lg:col-span-7 space-y-6">
        {/* ── Outfit header ── */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl font-medium text-charcoal-900 leading-[1.05]">
                {name}
              </h2>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {items.map((result) => <OutfitItemTile key={result.item.id} result={result} />)}
        </div>
      </div>

      {/* ══ Right: tips, reasoning, actions — sticks alongside on desktop ═════ */}
      <aside className="lg:col-span-5 lg:mt-[4.5rem] space-y-5">
        {/* ── Styling tips ── */}
        {stylingTips.length > 0 && (
          <div className="relative overflow-hidden rounded-3xl bg-butter-yellow p-7 shadow-lifted">
            {/* Oversized hanger watermark */}
            <HangerIcon
              size={220}
              className="absolute -right-12 -bottom-16 text-dark-purple/10 rotate-[-12deg] pointer-events-none"
            />

            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <HangerIcon size={14} className="text-gold-light dark:text-dark-purple/70" />
                <span className="text-gold-light dark:text-dark-purple/70 text-xs font-medium uppercase tracking-widest">
                  Styling tips
                </span>
              </div>
              <p className="font-display italic text-2xl text-dark-purple mb-6">
                How to wear it
              </p>

              <ol className="divide-y divide-dark-purple/15">
                {stylingTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-5 py-4 first:pt-0 last:pb-0">
                    <span className="font-display italic text-4xl leading-none text-gold-light/90 dark:text-dark-purple/60 w-10 flex-shrink-0 tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="text-sm text-dark-purple/90 leading-relaxed pt-1">{tip}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* ── Pieces to buy for whatever the Kloset couldn't supply ── */}
        <CompleteTheLook suggestion={suggestion} />

        {/* ── Actions ── */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={isSaved ? 'secondary' : 'primary'}
            size="md"
            onClick={onSave}
            disabled={isSaved}
            fullWidth
            className="gap-1 px-2 text-[10px] tracking-normal whitespace-nowrap sm:text-xs"
          >
            {isSaved ? (
              <>
                <Check size={16} />
                Saved
              </>
            ) : (
              <>
                <BookMarked size={16} />
                Save outfit
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onTryAnother}
            loading={isRegenerating}
            fullWidth
            className="gap-1 px-2 text-[10px] tracking-normal whitespace-nowrap sm:text-xs"
          >
            <RefreshCw size={16} className={isRegenerating ? 'animate-spin' : ''} />
            Try another
          </Button>
        </div>
      </aside>
    </div>
  )
}

// ─── Individual outfit item tile ──────────────────────────────────────────────

function OutfitItemTile({ result }: { result: OutfitItemResult }) {
  const { item, stylingNote } = result
  const imageUrl = useItemImage(item)
  const primaryColour = item.colour[0]
  const bgHex = primaryColour ? colourNameToHex(primaryColour) : '#EDE9E2'
  const isLight = isLightColour(bgHex)

  return (
    <div className="rounded-3xl overflow-hidden bg-surface shadow-card">
      {/* Image / placeholder */}
      <div className="relative aspect-[4/5]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: bgHex }}
          >
            <Shirt
              size={32}
              className={clsx('select-none', isLight ? 'text-text-primary opacity-30' : 'text-white opacity-40')}
            />
          </div>
        )}

      </div>

      {/* Info */}
      <div className="px-4 py-3">
        <p className="text-sm font-medium text-charcoal-900 truncate">{item.name}</p>
        {stylingNote && (
          <p className="text-2xs text-charcoal-400 mt-0.5 leading-snug">{stylingNote}</p>
        )}
      </div>
    </div>
  )
}
