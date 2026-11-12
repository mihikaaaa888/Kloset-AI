import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Shirt, Check } from 'lucide-react'
import { HangerIcon } from '@/components/ui/HangerIcon'
import { clsx } from 'clsx'

import { StyleRequestForm } from '@/components/stylist/StyleRequestForm'
import { OutfitResult } from '@/components/stylist/OutfitResult'
import { StylistChat } from '@/components/stylist/StylistChat'
import { Button } from '@/components/ui/Button'
import { generateOutfit } from '@/lib/stylist'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useUserStore } from '@/store/userStore'
import { useOutfitStore } from '@/store/outfitStore'
import { useRecommendationStore } from '@/store/recommendationStore'
import { useItemImage } from '@/hooks/useItemImage'
import { colourNameToHex, isLightColour } from '@/lib/colourUtils'
import type { StyleRequest, OutfitSuggestion } from '@/lib/stylist'
import type { ClothingItem, OutfitItem, Outfit } from '@/types'

type StylistMode = 'wardrobe' | 'item' | 'chat'
type PageState = 'mode-select' | 'item-pick' | 'form' | 'loading' | 'result'

export function StylistPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const navState = (location.state ?? {}) as { mode?: StylistMode; itemId?: string; outfitItemIds?: string[]; initialPrompt?: string }

  const items = useWardrobeStore((s) => s.items)
  const profile = useUserStore((s) => s.profile)
  const feedback = useRecommendationStore((state) => profile?.id ? state.feedbackByUser[profile.id] ?? [] : [])
  const { saveOutfit, isOutfitSaved } = useOutfitStore()

  const [mode, setMode] = useState<StylistMode>(navState.mode ?? 'chat')
  const [pageState, setPageState] = useState<PageState>(() => {
    if (navState.mode === 'chat') return 'mode-select'
    if (navState.mode === 'item') return 'item-pick'
    return 'form'
  })
  const [pinnedItem, setPinnedItem] = useState<ClothingItem | null>(() => {
    if (navState.itemId) return items.find((i) => i.id === navState.itemId) ?? null
    return null
  })
  const [currentRequest, setCurrentRequest] = useState<StyleRequest | null>(null)
  const [suggestion, setSuggestion] = useState<OutfitSuggestion | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [formStep, setFormStep] = useState(1)

  // If navigated with a specific item, skip item-pick and go to form
  useEffect(() => {
    if (navState.mode === 'item' && navState.itemId) {
      const found = items.find((i) => i.id === navState.itemId)
      if (found) {
        setPinnedItem(found)
        setPageState('form')
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectMode = (m: StylistMode) => {
    setMode(m)
    setSuggestion(null)
    setError(null)
    setPinnedItem(null)
    setAttempt(0)
    setFormStep(1)
    if (m === 'chat') setPageState('mode-select')
    else if (m === 'item') setPageState('item-pick')
    else setPageState('form')
  }

  const runGeneration = async (request: StyleRequest, currentAttempt: number) => {
    setPageState('loading')
    setError(null)
    setIsSaved(false)
    try {
      const result = await generateOutfit(request, items, profile, currentAttempt, pinnedItem ?? undefined, feedback)
      if (result.suggestion) {
        setSuggestion(result.suggestion)
        setPageState('result')
        setIsSaved(isOutfitSaved(result.suggestion.id))
      } else {
        setError(result.error ?? 'Could not generate an outfit. Try adjusting your wardrobe.')
        setPageState('form')
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setPageState('form')
    }
  }

  const handleFormSubmit = (request: StyleRequest) => {
    setCurrentRequest(request)
    // Give each fresh outfit request its own deterministic rotation seed;
    // Try Another increments from it without resetting to the same first picks.
    const initialAttempt = Math.floor(Math.random() * 1_000_000)
    setAttempt(initialAttempt)
    runGeneration(request, initialAttempt)
  }

  const handleTryAnother = () => {
    if (!currentRequest) return
    const next = attempt + 1
    setAttempt(next)
    runGeneration(currentRequest, next)
  }

  const handleSave = () => {
    if (!suggestion) return
    const outfitItems: OutfitItem[] = suggestion.items.map((r) => ({ itemId: r.item.id, role: r.role }))
    const outfit: Outfit = {
      id: suggestion.id,
      name: suggestion.name,
      items: outfitItems,
      occasion: suggestion.occasion,
      weather: suggestion.weather,
      mood: suggestion.mood,
      stylingNotes: suggestion.stylingTips.join(' '),
      whyItWorks: suggestion.whyItWorks,
      generatedAt: suggestion.generatedAt,
      isSaved: true,
      source: 'ai-mock',
    }
    saveOutfit(outfit)
    setIsSaved(true)
  }

  const resetToForm = () => {
    if (mode === 'item') {
      setPinnedItem(null)
      setPageState('item-pick')
      setSuggestion(null)
      setError(null)
      return
    }
    setPageState('form')
    setSuggestion(null)
    setError(null)
  }

  const isEmpty = items.length < 2

  return (
    <div className="min-h-screen bg-warm-cream pt-16 lg:pt-20 pb-28 md:pb-12">
      {/* Results get the full width (outfit + side panel); forms stay narrow and focused. */}
      <div className={clsx(
        'mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8 lg:pt-12 lg:pb-10',
        mode === 'chat' ? 'max-w-4xl' : pageState === 'result' ? 'max-w-6xl' : 'max-w-2xl'
      )}>

        {/* ── Mode tabs ── */}
        {mode !== 'chat' && <div className="mb-8 flex items-start justify-between gap-4">
          <nav className="flex min-w-0 items-center gap-6 overflow-x-auto" role="tablist" aria-label="Stylist mode">
            {([
              { id: 'wardrobe', label: 'Style my wardrobe' },
              { id: 'item', label: 'Style an item' },
            ] as { id: 'wardrobe' | 'item'; label: string }[]).map((tab) => (
              <button key={tab.id} role="tab" aria-selected={mode === tab.id} onClick={() => selectMode(tab.id)} className={clsx('relative shrink-0 pb-2 text-sm transition-colors sm:text-base', mode === tab.id ? 'font-medium text-text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-text-primary' : 'text-text-muted hover:text-text-primary')}>
                {tab.label}
              </button>
            ))}
          </nav>
          <button type="button" onClick={() => selectMode('chat')} aria-label="Ask Kaia" title="Ask Kaia" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-text-primary/5 hover:text-text-primary">
            <MessageCircle size={18} strokeWidth={1.7} />
          </button>
        </div>}

        {/* ── Mode: Chat ── */}
        {mode === 'chat' && (
          <StylistChat
            initialPrompt={navState.initialPrompt}
            initialImageItemIds={navState.outfitItemIds}
          />
        )}

        {/* ── Mode: Wardrobe / Item ── */}
        {mode !== 'chat' && (
          <>
            {/* Header */}
            {pageState === 'result' ? (
              <button
                onClick={resetToForm}
                className="flex items-center gap-2 text-text-muted hover:text-text-primary text-sm font-medium mb-6 transition-colors"
              >
                <ArrowLeft size={16} />
                New request
              </button>
            ) : (
              <div className="mb-8">
                {mode === 'item' && pinnedItem && pageState === 'form' ? (
                  <PinnedItemBanner item={pinnedItem} onClear={() => { setPinnedItem(null); setPageState('item-pick') }} />
                ) : (
                  <>
                    <h1 className="font-display text-3xl lg:text-4xl font-medium text-text-primary leading-tight">
                    {mode === 'item' ? 'Pick a piece to style' : 'What are you dressing for?'}
                    </h1>
                    {mode !== 'item' && formStep === 1 && <p className="text-text-muted text-sm mt-2 leading-relaxed">Two quick questions</p>}
                  </>
                )}
              </div>
            )}

            {/* Empty wardrobe */}
            {isEmpty && <EmptyWardrobeState onGoToWardrobe={() => navigate('/wardrobe')} />}

            {/* Error */}
            {error && !isEmpty && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-100 text-sm text-red-700 dark:text-red-400">{error}</div>
            )}

            {/* Item picker (mode = item, no pinned item yet) */}
            {!isEmpty && mode === 'item' && pageState === 'item-pick' && (
              <ItemPicker
                items={items}
                onSelect={(item) => {
                  setPinnedItem(item)
                  setPageState('form')
                }}
              />
            )}

            {/* Style form */}
            {!isEmpty && pageState === 'form' && (mode === 'wardrobe' || (mode === 'item' && pinnedItem)) && (
              <StyleRequestForm onSubmit={handleFormSubmit} isLoading={false} onStepChange={setFormStep} />
            )}

            {/* Loading */}
            {pageState === 'loading' && <LoadingState occasion={currentRequest?.occasion} />}

            {/* Result */}
            {pageState === 'result' && suggestion && (
              <>
                {mode === 'item' && pinnedItem && (
                  <div className="mb-4 flex items-center gap-2 text-xs text-text-muted">
                    <HangerIcon size={12} className="text-text-primary/40" />
                    Styled around <span className="font-medium text-text-primary">{pinnedItem.name}</span>
                  </div>
                )}
                <OutfitResult
                  suggestion={suggestion}
                  onTryAnother={handleTryAnother}
                  onSave={handleSave}
                  isSaved={isSaved}
                  isRegenerating={false}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Item picker ──────────────────────────────────────────────────────────────

function ItemPicker({ items, onSelect }: { items: ClothingItem[]; onSelect: (item: ClothingItem) => void }) {
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const categories = ['all', ...Array.from(new Set(items.map((i) => i.category)))]
  const filtered = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory)

  return (
    <div>
      {/* Category filter */}
      <div className="flex gap-6 mb-5 overflow-x-auto no-scrollbar pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={clsx('text-tab flex-shrink-0', activeCategory === cat && 'text-tab-active')}
          >
            {cat === 'all' ? 'All' : cat === 'outerwear' ? 'Woolens' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {filtered.map((item) => (
          <ItemPickCard
            key={item.id}
            item={item}
            selected={false}
            onClick={() => onSelect(item)}
          />
        ))}
      </div>
    </div>
  )
}

function ItemPickCard({ item, selected, onClick }: { item: ClothingItem; selected: boolean; onClick: () => void }) {
  const imageUrl = useItemImage(item)
  const bgHex = item.colour[0] ? colourNameToHex(item.colour[0]) : '#EDE9E2'
  const isLight = isLightColour(bgHex)

  return (
    <button
      onClick={onClick}
      className={clsx(
        'relative rounded-2xl overflow-hidden aspect-[3/4] transition-all duration-200',
        selected
          ? 'ring-2 ring-butter-yellow ring-offset-2 shadow-medium'
          : 'ring-1 ring-text-primary/10 hover:ring-text-primary/30 hover:shadow-soft'
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: bgHex }}>
          <Shirt size={28} className={isLight ? 'text-text-primary opacity-30' : 'text-white opacity-40'} />
        </div>
      )}
      {selected && (
        <div className="absolute inset-0 bg-text-primary/20 flex items-center justify-center">
          <div className="w-7 h-7 rounded-full bg-dark-purple flex items-center justify-center">
            <Check size={14} className="text-butter-yellow" />
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 py-2">
        <p className="text-white text-2xs font-medium truncate">{item.name}</p>
      </div>
    </button>
  )
}

// ─── Pinned item banner ───────────────────────────────────────────────────────

function PinnedItemBanner({ item, onClear }: { item: ClothingItem; onClear: () => void }) {
  const imageUrl = useItemImage(item)

  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-text-primary/5 border border-text-primary/10 mb-6">
      <div className="w-16 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-text-primary/10">
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Shirt size={20} className="text-text-primary/30" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xs text-text-muted uppercase tracking-widest mb-0.5">Building around</p>
        <p className="text-sm font-semibold text-text-primary truncate">{item.name}</p>
        <p className="text-xs text-text-muted mt-0.5">{item.category === 'outerwear' ? 'Woolens' : item.category} · {item.colour.join(', ')}</p>
      </div>
      <button onClick={onClear} aria-label="Choose a different item" title="Choose a different item" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-text-primary/5 hover:text-text-primary transition-colors"><ArrowLeft size={17} strokeWidth={1.5} /></button>
    </div>
  )
}

// ─── Empty wardrobe ───────────────────────────────────────────────────────────

function EmptyWardrobeState({ onGoToWardrobe }: { onGoToWardrobe: () => void }) {
  return (
    <div className="py-16 flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-3xl bg-text-primary/8 flex items-center justify-center mb-5">
        <Shirt size={32} className="text-text-primary/40" />
      </div>
      <h2 className="font-display text-2xl font-medium text-text-primary mb-2">
        Your Kloset needs a few pieces first
      </h2>
      <p className="text-text-muted text-base max-w-sm leading-relaxed mb-8">
        Add at least 2 items to your wardrobe and your stylist can start building outfits for you.
      </p>
      <Button size="lg" onClick={onGoToWardrobe} className="gap-2">
        <Shirt size={16} />
        Go to My Kloset
      </Button>
    </div>
  )
}

// ─── Loading ──────────────────────────────────────────────────────────────────

const LOADING_PHRASES = [
  'Curating your look…',
  'Checking colour harmony…',
  'Considering the occasion…',
  'Pulling pieces together…',
  'Finishing the edit…',
]

function LoadingState({ occasion }: { occasion?: string }) {
  return (
    <div className="py-20 flex flex-col items-center text-center">
      <div className="relative w-20 h-20 mb-8">
        <div className="absolute inset-0 rounded-full border-2 border-text-primary/10 animate-ping opacity-30" />
        <div className="absolute inset-2 rounded-full border-2 border-text-primary/10 animate-ping opacity-20" style={{ animationDelay: '150ms' }} />
        <div className="w-20 h-20 rounded-full bg-dark-purple flex items-center justify-center">
          <HangerIcon size={28} className="text-butter-yellow animate-pulse" />
        </div>
      </div>
      <p className="font-display text-xl text-text-primary mb-2">
        Styling your {occasion ? <strong>{occasion}</strong> : ''} look
      </p>
      <p className="text-text-muted text-sm animate-pulse">
        {LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)]}
      </p>
      <div className="flex gap-1.5 mt-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-text-primary/30 animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
