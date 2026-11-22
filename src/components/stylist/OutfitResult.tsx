import { useEffect, useState } from 'react'
import { RefreshCw, BookMarked, Check, Shirt, ThumbsUp, ThumbsDown, X } from 'lucide-react'
import { HangerIcon } from '@/components/ui/HangerIcon'
import { CompleteTheLook } from '@/components/stylist/CompleteTheLook'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { colourNameToHex, isLightColour } from '@/lib/colourUtils'
import { useItemImage } from '@/hooks/useItemImage'
import { getDailyStylingTip, rateStylingTip, type StylingTip } from '@/lib/stylingTipEngine'
import { outfitRatingEvents } from '@/lib/recommendationFeedback'
import { MisfitPicker } from '@/components/stylist/MisfitPicker'
import { useRecommendationStore } from '@/store/recommendationStore'
import type { OutfitSuggestion, OutfitItemResult } from '@/lib/stylist'
import type { ClothingItem, UserProfile } from '@/types'

// ─── Occasion + weather display labels ───────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────

interface OutfitResultProps {
  suggestion: OutfitSuggestion
  onTryAnother: () => void
  onSave: () => void
  /** Tapping Saved again takes the outfit out of saved outfits. */
  onUnsave?: () => void
  isSaved: boolean
  isRegenerating: boolean
  userId: string
  profile: UserProfile | null
  wardrobe: ClothingItem[]
}

export function OutfitResult({
  suggestion,
  onTryAnother,
  onSave,
  onUnsave,
  isSaved,
  isRegenerating,
  userId,
  profile,
  wardrobe,
}: OutfitResultProps) {
  const { name, items, stylingTips } = suggestion
  const [workbookTip, setWorkbookTip] = useState<StylingTip | null>(null)
  const outfitItems = items.map((result) => result.item)
  const outfitItemKey = outfitItems.map((item) => item.id).join('|')

  // Likes and dislikes here teach Kloset the same way Home's outfit of the day
  // does: saved per piece, with the outfit they were in, and synced to the account.
  const feedback = useRecommendationStore((state) => state.feedbackByUser[userId] ?? [])
  const recordFeedbackBatch = useRecommendationStore((state) => state.recordFeedbackBatch)
  const combinationId = outfitItems.map((item) => item.id).sort().join('|')
  const rating = feedback.find((event) => event.source === 'stylist-outfit' && event.combinationId === combinationId)?.action ?? null
  const misfitIds = feedback
    .filter((event) => event.source === 'stylist-outfit' && event.combinationId === combinationId && event.misfit)
    .map((event) => event.itemId.slice(event.itemId.lastIndexOf(':') + 1))
  const rateOutfit = (action: 'like' | 'dislike', misfits: string[] = []) => {
    if (!outfitItems.length) return
    if (workbookTip && action !== rating) rateStylingTip(userId, workbookTip, action === 'like' ? 'helpful' : 'not-helpful')
    console.log('[stylist] rated outfit', { action, pieces: outfitItems.length, misfits: misfits.length, occasion: suggestion.occasion })
    recordFeedbackBatch(userId, outfitRatingEvents(outfitItems, action, 'stylist-outfit', { misfitIds: misfits, occasions: [suggestion.occasion] }))
  }

  useEffect(() => {
    setWorkbookTip(getDailyStylingTip(
      userId,
      outfitItems,
      wardrobe,
      suggestion.weather,
      profile,
      new Date(),
      `stylist:${suggestion.occasion}:${outfitItemKey}`,
      [suggestion.occasion],
    ))
  }, [userId, outfitItemKey, wardrobe, suggestion.id, suggestion.weather, suggestion.occasion, profile])
  // The engine's tips are about this exact outfit ("Half-tuck the top"), so they
  // lead; a matching workbook tip adds to them instead of replacing them.
  const displayedTips = [...new Set([...stylingTips, ...(workbookTip ? [workbookTip.text] : [])])].slice(0, 3)

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

        {/* ── Actions, right under the pieces ── */}
        <div className="grid max-w-xl grid-cols-2 gap-2">
          <Button
            variant={isSaved ? 'secondary' : 'primary'}
            size="md"
            onClick={isSaved ? onUnsave : onSave}
            disabled={isSaved && !onUnsave}
            fullWidth
            aria-pressed={isSaved}
            title={isSaved ? 'Saved. Tap to unsave' : undefined}
            className="group gap-1 px-2 text-[10px] tracking-normal whitespace-nowrap sm:text-xs"
          >
            {isSaved ? (
              <>
                <Check size={16} className="group-hover:hidden" />
                <X size={16} className="hidden group-hover:block" />
                <span className="group-hover:hidden">Saved</span>
                <span className="hidden group-hover:inline">Unsave</span>
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
      </div>

      {/* ══ Right: tips, reasoning, actions — sticks alongside on desktop ═════ */}
      <aside className="lg:col-span-5 lg:mt-[4.5rem] space-y-5">
        {/* ── Styling tips ── */}
        {displayedTips.length > 0 && (
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
                {displayedTips.map((tip, i) => (
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

        {/* ── Rate it: teaches Kloset what this person likes to wear ── */}
        <div className="rounded-3xl border border-text-primary/10 bg-surface px-5 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-text-muted">{rating === 'like' ? 'Glad you like it. Noted for next time.' : rating === 'dislike' ? (misfitIds.length ? 'Got it. The rest goes well together.' : 'Got it. Less like this next time.') : 'Rate this outfit'}</span>
          <div className="flex gap-2">
            <button type="button" aria-label="I like this outfit" aria-pressed={rating === 'like'} onClick={() => rateOutfit('like')} className={clsx('rounded-full p-2 transition', rating === 'like' ? 'bg-[#355E3B] text-white' : 'text-text-muted hover:bg-text-primary/5')}><ThumbsUp size={15} /></button>
            <button type="button" aria-label="I don't like this outfit" aria-pressed={rating === 'dislike'} onClick={() => rateOutfit('dislike')} className={clsx('rounded-full p-2 transition', rating === 'dislike' ? 'bg-text-primary/10 text-text-primary' : 'text-text-muted hover:bg-text-primary/5')}><ThumbsDown size={15} /></button>
          </div>
        </div>
        {rating === 'dislike' && outfitItems.length > 1 && (
          <MisfitPicker items={outfitItems} misfitIds={misfitIds} onChange={(ids) => rateOutfit('dislike', ids)} />
        )}
        </div>

        {/* ── Pieces to buy for whatever the Kloset couldn't supply ── */}
        <CompleteTheLook suggestion={suggestion} />

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
