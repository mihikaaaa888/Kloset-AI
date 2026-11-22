import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowRight, Check, Search, type LucideIcon } from 'lucide-react'
import { HangerIcon } from '@/components/ui/HangerIcon'
import { clsx } from 'clsx'

import { OnboardingLayout } from './OnboardingLayout'
import {
  occupationOptions,
  frequencyOptions,
  genderStyleOptions,
} from './onboardingData'
import { buildOnboardingQueries, buildSimilarQueries, isForAdults } from '@/lib/discoverFeed'
import { fetchLiveProducts, smallImage, useLiveProducts, type LiveProduct } from '@/lib/liveShop'
import { ALL_BRANDS, brandKey, canonicalBrand, moreBrandsFor, relatedBrands, searchBrands, suggestedBrandsFor } from '@/lib/brands'
import { useRecommendationStore } from '@/store/recommendationStore'
import { SelectChip } from '@/components/ui/SelectChip'
import { AgeRuler } from '@/components/ui/AgeRuler'
import { TextInput } from '@/components/ui/TextInput'
import { Button } from '@/components/ui/Button'
import { useUserStore } from '@/store/userStore'
import { useAuth } from '@/contexts/AuthContext'
import { saveFavouriteBrands, upsertProfile } from '@/lib/profileService'
import type { UserProfile, StylePreference, Occasion, AgeRange, RecommendationFrequency } from '@/types'

// ─── Draft state ─────────────────────────────────────────────────────────────

interface OnboardingDraft {
  name: string
  ageRange: AgeRange | ''
  occupation: string
  lifestyle: string
  styleItemSelections: string[]
  stylePreferences: StylePreference[]
  typicalOccasions: Occasion[]
  favouriteColours: string[]
  avoidColours: string[]
  genderStylePreference: UserProfile['genderStylePreference'] | ''
  favouriteBrands: string[]
  recommendationFrequency: RecommendationFrequency | ''
}

const INITIAL_DRAFT: OnboardingDraft = {
  name: '',
  ageRange: '',
  occupation: '',
  lifestyle: '',
  styleItemSelections: [],
  stylePreferences: [],
  typicalOccasions: [],
  favouriteColours: [],
  avoidColours: [],
  genderStylePreference: '',
  favouriteBrands: [],
  recommendationFrequency: '',
}

const TOTAL_STEPS = 7

function profileToDraft(profile: UserProfile): OnboardingDraft {
  return {
    name: profile.name,
    ageRange: profile.ageRange,
    occupation: profile.occupation,
    lifestyle: profile.lifestyle,
    styleItemSelections: profile.styleItemSelections ?? [],
    stylePreferences: profile.stylePreferences,
    typicalOccasions: profile.typicalOccasions,
    favouriteColours: profile.favouriteColours,
    avoidColours: profile.avoidColours,
    genderStylePreference: profile.genderStylePreference ?? '',
    favouriteBrands: profile.favouriteBrands ?? [],
    recommendationFrequency: profile.recommendationFrequency,
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OnboardingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const profile = useUserStore((s) => s.profile)
  const loadedForUserId = useUserStore((s) => s.loadedForUserId)

  const isEditMode = new URLSearchParams(location.search).get('edit') === 'true'
  // Until Supabase answers we can't tell a new user from a returning one on a fresh device.
  const profileLoaded = !!user && loadedForUserId === user.id
  const alreadyOnboarded = profileLoaded && !!profile?.onboardingComplete && !isEditMode

  useEffect(() => {
    if (alreadyOnboarded) {
      console.log('[onboarding] already complete, skipping to wardrobe')
      navigate('/wardrobe', { replace: true })
    }
  }, [alreadyOnboarded, navigate])

  if (!profileLoaded || alreadyOnboarded) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-butter-yellow/30 border-t-butter-yellow animate-spin" />
      </div>
    )
  }

  return <OnboardingFlow isEditMode={isEditMode} />
}

function OnboardingFlow({ isEditMode }: { isEditMode: boolean }) {
  const navigate = useNavigate()
  const setProfile = useUserStore((s) => s.setProfile)
  const recordFeedbackBatch = useRecommendationStore((s) => s.recordFeedbackBatch)
  // The live pieces behind each pick, so finishing can record them as likes.
  const pickedProducts = useRef(new Map<string, LiveProduct>())
  const profile = useUserStore((s) => s.profile)
  const { user } = useAuth()

  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<OnboardingDraft>(
    isEditMode && profile ? profileToDraft(profile) : INITIAL_DRAFT
  )
  const [animating, setAnimating] = useState(false)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')

  const update = useCallback(
    <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => {
      setDraft((d) => ({ ...d, [key]: value }))
    },
    []
  )

  const toggleArray = useCallback(
    <T,>(key: keyof OnboardingDraft, value: T) => {
      setDraft((d) => {
        const arr = d[key] as T[]
        const exists = arr.includes(value)
        return {
          ...d,
          [key]: exists ? arr.filter((v) => v !== value) : [...arr, value],
        }
      })
    },
    []
  )

  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return draft.name.trim().length >= 2
      case 2: return draft.ageRange !== ''
      case 3: return draft.occupation !== ''
      case 4: return true // gender optional
      case 5: return true // piece picks optional
      case 6: return true // brands optional
      case 7: return draft.recommendationFrequency !== ''
      default: return false
    }
  }

  const transition = (nextStep: number, dir: 'forward' | 'back') => {
    setAnimating(true)
    setDirection(dir)
    setTimeout(() => {
      setStep(nextStep)
      setAnimating(false)
    }, 220)
  }

  const goNext = () => {
    if (step < TOTAL_STEPS) {
      transition(step + 1, 'forward')
    } else {
      handleComplete()
    }
  }

  const goBack = () => {
    if (step > 1) transition(step - 1, 'back')
  }

  const handleComplete = async () => {
    const now = new Date().toISOString()
    const newProfile: UserProfile = {
      id: user?.id ?? crypto.randomUUID(),
      name: draft.name.trim(),
      ageRange: draft.ageRange as AgeRange,
      occupation: draft.occupation.trim(),
      // No longer asked; an older profile keeps what it had.
      lifestyle: draft.lifestyle.trim(),
      styleItemSelections: draft.styleItemSelections,
      // No longer asked; an older profile keeps what it had.
      stylePreferences: draft.stylePreferences,
      typicalOccasions: draft.typicalOccasions,
      favouriteColours: draft.favouriteColours,
      avoidColours: draft.avoidColours,
      genderStylePreference: (draft.genderStylePreference as UserProfile['genderStylePreference']) || undefined,
      favouriteBrands: draft.favouriteBrands,
      // Skipping the survey before this question leaves it empty; default to daily suggestions.
      recommendationFrequency: (draft.recommendationFrequency || 'daily') as RecommendationFrequency,
      onboardingComplete: true,
      createdAt: now,
      updatedAt: now,
    }
    setProfile(newProfile)
    // Picked pieces teach Kloset their taste, like a heart on Shop (same ids).
    const picks = draft.styleItemSelections.map((key) => pickedProducts.current.get(key)).filter((p): p is LiveProduct => !!p)
    if (picks.length) {
      recordFeedbackBatch(newProfile.id, picks.map((product) => ({
        id: `like:web:${product.id}:onboarding`,
        itemId: `web:${product.id}`,
        action: 'like' as const,
        traits: product.search.traits,
        createdAt: now,
      })))
    }
    if (user) {
      // On failure the local copy stays and useDataSync re-uploads it on the next load.
      const saved = await upsertProfile(user.id, newProfile)
      const brandsSaved = await saveFavouriteBrands(user.id, draft.favouriteBrands)
      console.log('[onboarding] completed', { savedToServer: saved, brandsSaved, picks: picks.length, brands: draft.favouriteBrands.length })
    }
    navigate(isEditMode ? '/profile' : '/wardrobe')
  }

  const audience: 'all' | 'women' | 'men' = draft.genderStylePreference === 'masculine' ? 'men' : draft.genderStylePreference === 'feminine' ? 'women' : 'all'

  const stepClass = clsx(
    'transition-all duration-200',
    animating
      ? direction === 'forward'
        ? 'opacity-0 translate-x-6'
        : 'opacity-0 -translate-x-6'
      : 'opacity-100 translate-x-0'
  )

  return (
    <OnboardingLayout
      step={step}
      totalSteps={TOTAL_STEPS}
      onBack={step > 1 ? goBack : undefined}
      // Name and age are required; everything after them can be skipped.
      onSkip={step >= 3 && !isEditMode && !animating ? handleComplete : undefined}
    >
      <div className={stepClass}>
        {step === 1 && (
          <Step1Name
            value={draft.name}
            onChange={(v) => update('name', v)}
            onNext={goNext}
            canAdvance={canAdvance()}
          />
        )}
        {step === 2 && (
          <Step2Age
            value={draft.ageRange}
            onChange={(v) => update('ageRange', v)}
            onNext={goNext}
          />
        )}
        {step === 3 && (
          <Step3Occupation
            value={draft.occupation}
            onChange={(v) => update('occupation', v)}
            onNext={goNext}
          />
        )}
        {step === 4 && (
          <Step9Gender
            value={draft.genderStylePreference ?? ''}
            onChange={(v) => update('genderStylePreference', v)}
            onNext={goNext}
          />
        )}
        {step === 5 && (
          <Step4Catalogue
            selected={draft.styleItemSelections}
            styles={draft.stylePreferences}
            ageRange={draft.ageRange}
            preferredAudience={audience}
            onToggle={(key, product) => { pickedProducts.current.set(key, product); toggleArray('styleItemSelections', key) }}
            onNext={goNext}
          />
        )}
        {step === 6 && (
          <StepBrands
            selected={draft.favouriteBrands}
            ageRange={draft.ageRange}
            audience={audience}
            onToggle={(brand) => setDraft((d) => ({
              ...d,
              favouriteBrands: d.favouriteBrands.some((b) => brandKey(b) === brandKey(brand))
                ? d.favouriteBrands.filter((b) => brandKey(b) !== brandKey(brand))
                : [...d.favouriteBrands, brand].slice(-50),
            }))}
            onNext={goNext}
          />
        )}
        {step === 7 && (
          <Step10Frequency
            name={draft.name}
            value={draft.recommendationFrequency}
            onChange={(v) => update('recommendationFrequency', v)}
            onNext={goNext}
            canAdvance={canAdvance()}
          />
        )}
      </div>
    </OnboardingLayout>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StepHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-8">
      {eyebrow && (
        <p className="text-text-primary/50 text-xs font-medium uppercase tracking-ultra-wide mb-3">
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-3xl sm:text-4xl font-medium text-text-primary leading-tight mb-3">
        {title}
      </h2>
      {subtitle && (
        <p className="text-text-muted text-base leading-relaxed">{subtitle}</p>
      )}
    </div>
  )
}

function StepActions({
  onNext,
  canAdvance,
  nextLabel = 'Continue',
  loading = false,
}: {
  onNext: () => void
  canAdvance: boolean
  nextLabel?: string
  loading?: boolean
}) {
  return (
    <div className="mt-10">
      <Button
        size="lg"
        onClick={onNext}
        disabled={!canAdvance}
        loading={loading}
        className="group"
      >
        {nextLabel}
        <ArrowRight
          size={16}
          className="transition-transform duration-200 group-hover:translate-x-1"
        />
      </Button>
    </div>
  )
}

// A tap-to-pick tile: icon plus a short label. Used for every single- and multi-choice step.
function OptionTile({
  label,
  icon: Icon,
  selected,
  onClick,
}: {
  label: string
  icon?: LucideIcon
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        'relative flex flex-col items-start gap-3 p-4 rounded-2xl border text-left transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow',
        selected
          ? 'bg-dark-purple text-butter-yellow border-dark-purple shadow-soft'
          : 'bg-surface text-text-primary border-text-primary/15 hover:border-text-primary/40'
      )}
    >
      {Icon && (
        <span
          className={clsx(
            'w-9 h-9 rounded-full flex items-center justify-center',
            selected ? 'bg-butter-yellow/15' : 'bg-text-primary/5'
          )}
        >
          <Icon size={18} strokeWidth={1.5} />
        </span>
      )}
      <span className="text-sm font-medium leading-tight">{label}</span>
      {selected && <Check size={14} className="absolute top-3 right-3" />}
    </button>
  )
}

const TILE_GRID = 'grid grid-cols-2 sm:grid-cols-3 gap-3'

// Step 1 — Name
function Step1Name({
  value,
  onChange,
  onNext,
  canAdvance,
}: {
  value: string
  onChange: (v: string) => void
  onNext: () => void
  canAdvance: boolean
}) {
  return (
    <div>
      <StepHeading
        eyebrow="Welcome"
        title="What should we call you?"
      />
      <TextInput
        autoFocus
        placeholder="Your name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && canAdvance && onNext()}
        className="text-lg"
      />
      <StepActions onNext={onNext} canAdvance={canAdvance} />
    </div>
  )
}

// Step 2 — Age: pick an exact age on a ruler; it's saved as its age group.
const MIN_AGE = 10
const MAX_AGE = 80
const DEFAULT_AGE = 25

function ageToRange(age: number): AgeRange {
  if (age < 18) return 'under-18'
  if (age <= 24) return '18-24'
  if (age <= 34) return '25-34'
  if (age <= 44) return '35-44'
  if (age <= 54) return '45-54'
  return '55+'
}

// Where the ruler starts when editing a saved profile, which only has the group.
const RANGE_START_AGE: Record<AgeRange, number> = {
  'under-18': 16, '18-24': 21, 'under-25': 21, '25-34': 29, '35-44': 39, '45-54': 49, '55+': 58,
}

function Step2Age({
  value,
  onChange,
  onNext,
}: {
  value: AgeRange | ''
  onChange: (v: AgeRange) => void
  onNext: () => void
}) {
  const [age, setAge] = useState(value ? RANGE_START_AGE[value] : DEFAULT_AGE)

  return (
    <div>
      <StepHeading eyebrow="About you" title="How old are you?" />
      <p className="text-center text-7xl sm:text-8xl font-light text-text-primary tabular-nums leading-none mb-6" aria-live="polite">
        {age}
      </p>
      <AgeRuler value={age} min={MIN_AGE} max={MAX_AGE} onChange={setAge} />
      <StepActions
        onNext={() => {
          onChange(ageToRange(age))
          onNext()
        }}
        canAdvance
      />
    </div>
  )
}

// Step 3 — Occupation (pick a tile, which moves on by itself, or type your own)
function Step3Occupation({
  value,
  onChange,
  onNext,
}: {
  value: string
  onChange: (v: string) => void
  onNext: () => void
}) {
  const isPreset = occupationOptions.some((opt) => opt.label === value)
  const [custom, setCustom] = useState(isPreset ? '' : value)
  const canAdvance = custom.trim() !== '' || isPreset

  return (
    <div>
      <StepHeading eyebrow="Your life" title="What do you do?" />
      <div className={TILE_GRID}>
        {occupationOptions.map((opt) => (
          <OptionTile
            key={opt.label}
            label={opt.label}
            icon={opt.icon}
            selected={value === opt.label}
            onClick={() => {
              setCustom('')
              onChange(opt.label)
              setTimeout(onNext, 250)
            }}
          />
        ))}
      </div>
      <div className="mt-6">
        <TextInput
          placeholder="Something else? Type it here"
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value)
            onChange(e.target.value)
          }}
          onKeyDown={(e) => e.key === 'Enter' && canAdvance && onNext()}
        />
      </div>
      <StepActions onNext={onNext} canAdvance={canAdvance} />
    </div>
  )
}

// Step 4 — Style Catalogue
// "Pick pieces you'd wear", Spotify-style: photos only, no store names or
// filters. Tapping a piece adds a few more like it right after it, so the grid
// follows their taste. Pieces suit their age and mix clothes, shoes and the
// odd bag. Each pick is kept as readable text for Kaia ("tops: Linen shirt")
// and recorded as a like when onboarding finishes.
const pickKey = (item: LiveProduct) => `${item.search.category}: ${item.title.slice(0, 100)}`

function Step4Catalogue({
  selected,
  styles,
  ageRange,
  preferredAudience,
  onToggle,
  onNext,
}: {
  selected: string[]
  styles: StylePreference[]
  ageRange: string
  preferredAudience: 'all' | 'women' | 'men'
  onToggle: (key: string, product: LiveProduct) => void
  onNext: () => void
}) {
  const { items, loading, status, loadMore, retry } = useLiveProducts((page) => buildOnboardingQueries(styles, preferredAudience, page, ageRange))
  // Pieces found after a pick, shown right after the piece that was picked.
  const [moreLike, setMoreLike] = useState<Record<string, LiveProduct[]>>({})
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const pickPiece = (item: LiveProduct) => {
    const key = pickKey(item)
    const wasPicked = selected.includes(key)
    onToggle(key, item)
    if (wasPicked || moreLike[item.id]) return
    void fetchLiveProducts(buildSimilarQueries(item, preferredAudience)).then(({ items: found }) => {
      setMoreLike((current) => {
        const shown = new Set([...items.map((p) => p.id), ...Object.values(current).flat().map((p) => p.id)])
        return { ...current, [item.id]: found.filter((p) => !shown.has(p.id) && p.id !== item.id).slice(0, 3) }
      })
    })
  }

  const [loaded, setLoaded] = useState<Set<string>>(new Set())
  // Base pieces with each pick's "more like this" right after it; only clothes for adults, each once.
  const grid = items.flatMap((item) => [item, ...(moreLike[item.id] ?? [])])
    .filter((item, i, all) => !hidden.has(item.id) && !!item.imageUrl && isForAdults(item) && all.findIndex((other) => other.id === item.id) === i)

  // Every photo in a batch failed or was filtered out: fetch the next batch
  // rather than leave the grid empty (at most twice).
  const refills = useRef(0)
  useEffect(() => {
    if (loading || status !== 'ok' || !items.length || grid.length || refills.current >= 2) return
    refills.current += 1
    void loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadMore is recreated each render
  }, [loading, status, items.length, grid.length])

  return (
    <div>
      <StepHeading
        eyebrow="Your taste"
        title="Pick pieces you'd wear"
        subtitle="Tap what you like. We'll show more like it."
      />

      {status !== 'ok' && !grid.length && (
        <p className="py-8 text-center text-sm text-text-muted">Couldn’t load pieces right now. <button type="button" onClick={() => void retry()} className="underline underline-offset-4">Try again</button>, or continue without picks.</p>
      )}

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
        {grid.map((item, index) => {
          const isSelected = selected.includes(pickKey(item))
          const isLoaded = loaded.has(item.id)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => pickPiece(item)}
              aria-pressed={isSelected}
              aria-label={item.title}
              className={clsx(
                'relative aspect-[3/4] overflow-hidden rounded-2xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow',
                // A soft placeholder until the photo arrives, so the grid never looks empty.
                isLoaded ? 'bg-white' : 'animate-pulse bg-text-primary/10',
                isSelected ? 'scale-[0.95] ring-2 ring-[#355E3B] ring-offset-2 ring-offset-warm-cream' : 'hover:scale-[0.98]'
              )}
            >
              <img
                src={smallImage(item.imageUrl)}
                alt=""
                referrerPolicy="no-referrer"
                // The first rows load straight away; the rest as they scroll in.
                loading={index < 10 ? 'eager' : 'lazy'}
                decoding="async"
                className={clsx('h-full w-full object-cover object-top transition-opacity duration-300', isLoaded ? 'opacity-100' : 'opacity-0')}
                onError={(e) => {
                  // The smaller copy didn't work: try the original once, then give up on this piece.
                  const original = item.imageUrl ?? ''
                  if (original && e.currentTarget.src !== original) { e.currentTarget.src = original; return }
                  setHidden((current) => new Set(current).add(item.id))
                }}
                // Logos and banners load tiny or very wide; product photos don't.
                onLoad={(e) => {
                  const { naturalWidth: w, naturalHeight: h } = e.currentTarget
                  if (w < 160 || h < 160 || w / h > 1.6) setHidden((current) => new Set(current).add(item.id))
                  else setLoaded((current) => new Set(current).add(item.id))
                }}
              />
              {isSelected && (
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#355E3B] shadow-soft">
                  <Check size={13} className="text-white" />
                </span>
              )}
            </button>
          )
        })}
        {(loading || (!grid.length && status === 'ok')) && Array.from({ length: grid.length ? 5 : 10 }).map((_, i) => <div key={`skeleton-${i}`} className="aspect-[3/4] animate-pulse rounded-2xl bg-text-primary/8" />)}
      </div>

      {!loading && grid.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => void loadMore()} className="rounded-full border border-text-primary/20 px-5 py-2 text-xs text-text-primary hover:bg-text-primary/5">Show more</button>
        </div>
      )}

      <div className="mt-8 flex flex-col sm:flex-row items-start gap-4">
        <Button size="lg" onClick={onNext} className="group">
          {selected.length > 0 ? `Continue with ${selected.length} ${selected.length === 1 ? 'pick' : 'picks'}` : 'Continue'}
          <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
        </Button>
        {selected.length === 0 && (
          <button onClick={onNext} className="text-text-muted hover:text-text-primary text-sm underline underline-offset-4 transition-colors">
            Skip for now
          </button>
        )}
      </div>
    </div>
  )
}

// "Brands you like": round brand bubbles, Spotify-artist style. Suggestions
// lean on age and who they shop for; any brand can be searched and picked.
// Saved as favourite brands, which Shop shows first under its search.
const BUBBLE_COLOURS = ['#355E3B', '#6B4E71', '#8C5A3C', '#2F4858', '#9C6644', '#4A5D23', '#7A3B4F', '#3D5A80']
const nameHash = (name: string) => [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
const bubbleColour = (name: string) => BUBBLE_COLOURS[nameHash(name) % BUBBLE_COLOURS.length]
// Bubbles come in three sizes, so the field looks loose and alive rather than a grid.
const BUBBLE_SIZES = ['h-[84px] w-[84px] text-xs', 'h-[100px] w-[100px] text-sm', 'h-[116px] w-[116px] text-sm']

// Spotify-style brand bubbles: tap one and a few brands like it pop in beside it.
function StepBrands({
  selected,
  ageRange,
  audience,
  onToggle,
  onNext,
}: {
  selected: string[]
  ageRange: string
  audience: 'all' | 'women' | 'men'
  onToggle: (brand: string) => void
  onNext: () => void
}) {
  const [query, setQuery] = useState('')
  // Brands brought in by tapping another, keyed by the brand that was tapped.
  const [revealed, setRevealed] = useState<Record<string, string[]>>({})
  // A first field of brands for their age; "Show more brands" keeps adding
  // (the rest of their age's list, then other ages', then every brand we know).
  const BRAND_STEP = 24
  const [shownCount, setShownCount] = useState(BRAND_STEP)
  const allSuggested = useMemo(() => {
    const base = suggestedBrandsFor(ageRange, audience)
    return [...base, ...moreBrandsFor(ageRange, audience, base)]
  }, [ageRange, audience])
  const suggested = allSuggested.slice(0, shownCount)
  const typed = query.trim()
  const field = useMemo(() => {
    const out: string[] = []
    const add = (name: string) => { if (!out.some((other) => brandKey(other) === brandKey(name))) out.push(name) }
    // Tapped bubbles stay where they are; brands picked by search join at the front.
    const searched = selected.filter((brand) => !suggested.some((other) => brandKey(other) === brandKey(brand)))
    for (const name of [...searched, ...suggested]) {
      add(name)
      for (const related of revealed[brandKey(name)] ?? []) add(related)
    }
    return out
  }, [selected, suggested, revealed])
  const shown = typed
    ? [...new Set([...searchBrands(typed).slice(0, 15), ...(typed.length >= 2 && !ALL_BRANDS.some((name) => brandKey(name) === brandKey(canonicalBrand(typed))) ? [typed] : [])])]
    : field
  const isSelected = (name: string) => selected.some((brand) => brandKey(brand) === brandKey(name))
  const newlyRevealed = new Set(Object.values(revealed).flat().map(brandKey))

  const tap = (name: string) => {
    const brand = canonicalBrand(name)
    if (!isSelected(brand) && !revealed[brandKey(brand)]) {
      setRevealed((current) => ({ ...current, [brandKey(brand)]: relatedBrands(brand, audience, field) }))
    }
    onToggle(brand)
  }

  return (
    <div>
      <StepHeading eyebrow="Your brands" title="Brands you like" subtitle="Tap the ones you like, and we’ll show you more like them." />
      <label className="mb-6 flex items-center gap-2 border-b border-text-primary/15 px-1 py-2 text-text-muted focus-within:border-text-primary/50">
        <Search size={15} strokeWidth={1.5} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search any brand" aria-label="Search brands" className="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none" />
      </label>
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 py-2">
        {shown.map((name) => {
          const on = isSelected(name)
          const hash = nameHash(name)
          return (
            <div key={name} className="motion-safe:animate-bubble-float" style={{ animationDelay: `${-(hash % 7)}s`, animationDuration: `${6 + (hash % 4)}s` }}>
              <button
                type="button"
                onClick={() => tap(name)}
                aria-pressed={on}
                className={clsx(
                  'relative flex items-center justify-center rounded-full px-2 text-center font-medium leading-tight text-white shadow-soft transition-transform duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow',
                  BUBBLE_SIZES[on ? 2 : hash % 3],
                  on ? 'scale-105 ring-2 ring-butter-yellow ring-offset-2 ring-offset-warm-cream' : 'hover:scale-[1.04]',
                  newlyRevealed.has(brandKey(name)) && 'motion-safe:animate-bubble-in',
                )}
                style={{ backgroundColor: bubbleColour(name) }}
              >
                <span className="line-clamp-2 break-words">{name}</span>
                {on && <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-butter-yellow text-dark-purple"><Check size={13} /></span>}
              </button>
            </div>
          )
        })}
      </div>
      {!typed && shownCount < allSuggested.length && (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={() => setShownCount((count) => count + BRAND_STEP)} className="rounded-full border border-text-primary/20 px-5 py-2 text-xs text-text-primary hover:bg-text-primary/5">Show more brands</button>
        </div>
      )}
      <div className="mt-8 flex flex-col sm:flex-row items-start gap-4">
        <Button size="lg" onClick={onNext} className="group">
          {selected.length > 0 ? `Continue with ${selected.length} ${selected.length === 1 ? 'brand' : 'brands'}` : 'Continue'}
          <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
        </Button>
        {selected.length === 0 && (
          <button onClick={onNext} className="text-text-muted hover:text-text-primary text-sm underline underline-offset-4 transition-colors">
            Skip for now
          </button>
        )}
      </div>
    </div>
  )
}

// Step 9 — Gender style preference
function Step9Gender({
  value,
  onChange,
  onNext,
}: {
  value: string
  onChange: (v: UserProfile['genderStylePreference']) => void
  onNext: () => void
}) {
  return (
    <div>
      <StepHeading
        eyebrow="Optional"
        title="Which way do you dress?"
      />
      <div className="flex flex-wrap gap-3">
        {genderStyleOptions.map((opt) => (
          <SelectChip
            key={opt.value}
            label={opt.label}
            selected={value === opt.value}
            onClick={() => {
              onChange(opt.value as UserProfile['genderStylePreference'])
              setTimeout(onNext, 250)
            }}
          />
        ))}
      </div>
      <div className="mt-10">
        <button
          onClick={onNext}
          className="text-text-muted hover:text-text-primary text-sm underline underline-offset-4 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  )
}

// Step 10 — Frequency (pick one)
function Step10Frequency({
  name,
  value,
  onChange,
  onNext,
  canAdvance,
}: {
  name: string
  value: string
  onChange: (v: RecommendationFrequency) => void
  onNext: () => void
  canAdvance: boolean
}) {
  return (
    <div>
      <StepHeading
        eyebrow="Almost done"
        title={`How often should we suggest outfits, ${name.split(' ')[0]}?`}
      />
      <div className="grid grid-cols-2 gap-3">
        {frequencyOptions.map((opt) => (
          <OptionTile
            key={opt.value}
            label={opt.label}
            icon={opt.icon}
            selected={value === opt.value}
            onClick={() => onChange(opt.value)}
          />
        ))}
      </div>
      <div className="mt-10">
        <Button
          size="lg"
          onClick={onNext}
          disabled={!canAdvance}
          className="group"
        >
          <HangerIcon size={16} />
          Build My Kloset
          <ArrowRight
            size={16}
            className="transition-transform duration-200 group-hover:translate-x-1"
          />
        </Button>
      </div>
    </div>
  )
}
