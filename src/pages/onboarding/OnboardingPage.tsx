import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowRight, Check, type LucideIcon } from 'lucide-react'
import { HangerIcon } from '@/components/ui/HangerIcon'
import { clsx } from 'clsx'

import { OnboardingLayout } from './OnboardingLayout'
import {
  styleOptions,
  occasionOptions,
  occupationOptions,
  COLOUR_PALETTE,
  ageRangeOptions,
  frequencyOptions,
  genderStyleOptions,
} from './onboardingData'
import { CATALOGUE_ITEMS, CATALOGUE_CATEGORIES } from './catalogueData'
import { SelectChip } from '@/components/ui/SelectChip'
import { ColourSwatch } from '@/components/ui/ColourSwatch'
import { TextInput } from '@/components/ui/TextInput'
import { Button } from '@/components/ui/Button'
import { useUserStore } from '@/store/userStore'
import { useAuth } from '@/contexts/AuthContext'
import { upsertProfile } from '@/lib/profileService'
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
  recommendationFrequency: '',
}

const TOTAL_STEPS = 10

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
      case 4: return true // catalogue selection optional
      case 5: return draft.stylePreferences.length >= 1
      case 6: return draft.typicalOccasions.length >= 1
      case 7: return true // colours optional
      case 8: return true // avoid colours optional
      case 9: return true // gender optional
      case 10: return draft.recommendationFrequency !== ''
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
      stylePreferences: draft.stylePreferences,
      typicalOccasions: draft.typicalOccasions,
      favouriteColours: draft.favouriteColours,
      avoidColours: draft.avoidColours,
      genderStylePreference: (draft.genderStylePreference as UserProfile['genderStylePreference']) || undefined,
      recommendationFrequency: draft.recommendationFrequency as RecommendationFrequency,
      onboardingComplete: true,
      createdAt: now,
      updatedAt: now,
    }
    setProfile(newProfile)
    if (user) {
      // On failure the local copy stays and useDataSync re-uploads it on the next load.
      const saved = await upsertProfile(user.id, newProfile)
      console.log('[onboarding] completed', { savedToServer: saved })
    }
    navigate(isEditMode ? '/profile' : '/wardrobe')
  }

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
          <Step4Catalogue
            selected={draft.styleItemSelections}
            onToggle={(id) => toggleArray('styleItemSelections', id)}
            onNext={goNext}
          />
        )}
        {step === 5 && (
          <Step5Style
            selected={draft.stylePreferences}
            onToggle={(v) => toggleArray('stylePreferences', v)}
            onNext={goNext}
            canAdvance={canAdvance()}
          />
        )}
        {step === 6 && (
          <Step6Occasions
            selected={draft.typicalOccasions}
            onToggle={(v) => toggleArray('typicalOccasions', v)}
            onNext={goNext}
            canAdvance={canAdvance()}
          />
        )}
        {step === 7 && (
          <StepColours
            title="Colours you love"
            subtitle="Pick all that apply."
            selected={draft.favouriteColours}
            onToggle={(v) => toggleArray('favouriteColours', v)}
            onNext={goNext}
          />
        )}
        {step === 8 && (
          <StepColours
            title="Colours you avoid"
            subtitle="Pick all that apply."
            selected={draft.avoidColours}
            onToggle={(v) => toggleArray('avoidColours', v)}
            onNext={goNext}
            skipLabel="None"
          />
        )}
        {step === 9 && (
          <Step9Gender
            value={draft.genderStylePreference ?? ''}
            onChange={(v) => update('genderStylePreference', v)}
            onNext={goNext}
          />
        )}
        {step === 10 && (
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

// Step 2 — Age Range
function Step2Age({
  value,
  onChange,
  onNext,
}: {
  value: string
  onChange: (v: AgeRange) => void
  onNext: () => void
}) {
  return (
    <div>
      <StepHeading
        eyebrow="About you"
        title="How old are you?"
      />
      <div className="flex flex-wrap gap-3">
        {ageRangeOptions.map((opt) => (
          <SelectChip
            key={opt.value}
            label={opt.label}
            selected={value === opt.value}
            onClick={() => {
              onChange(opt.value as AgeRange)
              setTimeout(onNext, 250)
            }}
          />
        ))}
      </div>
    </div>
  )
}

// Step 3 — Occupation (pick one; moves on by itself)
function Step3Occupation({
  value,
  onChange,
  onNext,
}: {
  value: string
  onChange: (v: string) => void
  onNext: () => void
}) {
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
              onChange(opt.label)
              setTimeout(onNext, 250)
            }}
          />
        ))}
      </div>
    </div>
  )
}

// Step 4 — Style Catalogue
function Step4Catalogue({
  selected,
  onToggle,
  onNext,
}: {
  selected: string[]
  onToggle: (id: string) => void
  onNext: () => void
}) {
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const filtered = activeCategory === 'all'
    ? CATALOGUE_ITEMS
    : CATALOGUE_ITEMS.filter((item) => item.category === activeCategory)

  return (
    <div>
      <StepHeading
        eyebrow="Style inspiration"
        title="Pick pieces you'd wear"
        subtitle="Pick as many as you like."
      />

      {/* Category tabs */}
      <div className="flex gap-6 overflow-x-auto pb-2 mb-5" style={{ scrollbarWidth: 'none' }}>
        {CATALOGUE_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={clsx('text-tab flex-shrink-0', activeCategory === cat.value && 'text-tab-active')}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Count pill */}
      {selected.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 bg-text-primary/10 text-butter-yellow text-xs font-semibold px-3 py-1 rounded-full">
            <Check size={11} />
            {selected.length} selected
          </span>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {filtered.map((item) => {
          const isSelected = selected.includes(item.id)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={clsx(
                'relative rounded-xl overflow-hidden aspect-[3/4] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow',
                isSelected
                  ? 'ring-2 ring-butter-yellow ring-offset-1 scale-[0.97]'
                  : 'hover:scale-[0.97] hover:shadow-medium'
              )}
            >
              <img
                src={item.imageUrl}
                alt={item.label}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="w-full h-full object-cover object-top"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement
                  el.style.display = 'none'
                  const parent = el.parentElement
                  if (parent) parent.style.backgroundColor = item.fallbackColor
                }}
              />
              {/* subtle bottom gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              {/* label */}
              <p className="absolute bottom-0 inset-x-0 px-2 pb-2 text-white text-2xs font-medium leading-tight">
                {item.label}
              </p>
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/40 backdrop-blur-sm text-white/90 text-[9px] tracking-wide">
                {item.brand}
              </span>
              {/* checkmark */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-dark-purple flex items-center justify-center shadow-soft">
                  <Check size={11} className="text-butter-yellow" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-col sm:flex-row items-start gap-4">
        <Button size="lg" onClick={onNext} className="group">
          {selected.length > 0
            ? `Continue with ${selected.length} picks`
            : 'Continue'}
          <ArrowRight
            size={16}
            className="transition-transform duration-200 group-hover:translate-x-1"
          />
        </Button>
        {selected.length === 0 && (
          <button
            onClick={onNext}
            className="text-text-muted hover:text-text-primary text-sm underline underline-offset-4 transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  )
}

// Step 5 — Style aesthetics (visual cards)
function Step5Style({
  selected,
  onToggle,
  onNext,
  canAdvance,
}: {
  selected: StylePreference[]
  onToggle: (v: StylePreference) => void
  onNext: () => void
  canAdvance: boolean
}) {
  return (
    <div>
      <StepHeading
        eyebrow="Your aesthetic"
        title="Which styles feel like you?"
        subtitle="Pick all that apply."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {styleOptions.map((opt) => {
          const isSelected = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className={clsx(
                'relative rounded-2xl overflow-hidden aspect-[3/4] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow',
                isSelected
                  ? 'ring-2 ring-butter-yellow ring-offset-2 scale-[0.98]'
                  : 'hover:scale-[0.97] hover:shadow-medium'
              )}
            >
              <img
                src={opt.imageUrl}
                alt={opt.label}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="w-full h-full object-cover object-top"
                onError={(e) => {
                  const el = e.currentTarget
                  el.style.display = 'none'
                  const parent = el.parentElement
                  if (parent) parent.style.backgroundColor = opt.accent
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 text-left">
                <p className="text-white text-sm font-semibold leading-none">{opt.label}</p>
                <p className="text-white/70 text-2xs mt-0.5">{opt.description}</p>
              </div>
              <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm text-white/90 text-[10px] tracking-wide">
                {opt.brand}
              </span>
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-dark-purple flex items-center justify-center shadow-soft">
                  <Check size={13} className="text-butter-yellow" />
                </div>
              )}
            </button>
          )
        })}
      </div>
      <StepActions onNext={onNext} canAdvance={canAdvance} />
    </div>
  )
}

// Step 6 — Occasions (pick several)
function Step6Occasions({
  selected,
  onToggle,
  onNext,
  canAdvance,
}: {
  selected: Occasion[]
  onToggle: (v: Occasion) => void
  onNext: () => void
  canAdvance: boolean
}) {
  return (
    <div>
      <StepHeading eyebrow="Your week" title="What do you dress for?" subtitle="Pick all that apply." />
      <div className={TILE_GRID}>
        {occasionOptions.map((opt) => (
          <OptionTile
            key={opt.value}
            label={opt.label}
            icon={opt.icon}
            selected={selected.includes(opt.value)}
            onClick={() => onToggle(opt.value)}
          />
        ))}
      </div>
      <StepActions onNext={onNext} canAdvance={canAdvance} />
    </div>
  )
}

// Steps 7 & 8 — Colours (reused for both)
function StepColours({
  title,
  subtitle,
  selected,
  onToggle,
  onNext,
  skipLabel,
}: {
  title: string
  subtitle: string
  selected: string[]
  onToggle: (v: string) => void
  onNext: () => void
  skipLabel?: string
}) {
  return (
    <div>
      <StepHeading eyebrow="Your palette" title={title} subtitle={subtitle} />
      <div className="flex flex-wrap gap-3">
        {COLOUR_PALETTE.map((colour) => (
          <div key={colour.name} className="flex flex-col items-center gap-1.5">
            <ColourSwatch
              name={colour.name}
              hex={colour.hex}
              selected={selected.includes(colour.name)}
              onClick={() => onToggle(colour.name)}
            />
            <span className="text-2xs text-text-muted text-center max-w-[48px] leading-tight">
              {colour.name}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-col sm:flex-row items-start gap-4">
        <Button size="lg" onClick={onNext} className="group">
          {selected.length > 0 ? `Continue with ${selected.length} selected` : 'Continue'}
          <ArrowRight
            size={16}
            className="transition-transform duration-200 group-hover:translate-x-1"
          />
        </Button>
        {skipLabel && (
          <button
            onClick={onNext}
            className="text-text-muted hover:text-text-primary text-sm underline underline-offset-4 transition-colors"
          >
            {skipLabel}
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
