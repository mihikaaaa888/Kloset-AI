import { useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { clsx } from 'clsx'

import { getLocalWeather } from '@/lib/weather'
import type { StyleRequest, WeatherCondition, Mood } from '@/lib/stylist'
import type { Occasion } from '@/types'

const OCCASIONS: { value: Occasion; label: string }[] = [
  { value: 'work', label: 'Work' },
  { value: 'casual', label: 'Casual' },
  { value: 'date-night', label: 'Date Night' },
  { value: 'formal', label: 'Formal' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'travel', label: 'Travel' },
  { value: 'special-event', label: 'Special Event' },
  { value: 'gym', label: 'Gym' },
]

const MOODS: { value: Mood; label: string }[] = [
  { value: 'confident', label: 'Confident' },
  { value: 'polished', label: 'Polished' },
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'creative', label: 'Creative' },
  { value: 'playful', label: 'Playful' },
  { value: 'understated', label: 'Understated' },
  { value: 'romantic', label: 'Romantic' },
]

interface StyleRequestFormProps {
  onSubmit: (request: StyleRequest) => void
  isLoading: boolean
  onStepChange?: (step: number) => void
}

export function StyleRequestForm({ onSubmit, isLoading, onStepChange }: StyleRequestFormProps) {
  const [occasion, setOccasion] = useState<Occasion | null>(null)
  const [otherOccasion, setOtherOccasion] = useState('')
  const [mood, setMood] = useState<Mood | null>(null)
  const [step, setStep] = useState(1)
  const [showMoreOccasions, setShowMoreOccasions] = useState(false)
  const [showOtherOccasion, setShowOtherOccasion] = useState(false)
  const completionStarted = useRef(false)
  const weatherPromise = useRef<Promise<WeatherCondition> | null>(null)

  useEffect(() => { onStepChange?.(step) }, [step, onStepChange])
  useEffect(() => {
    weatherPromise.current = getLocalWeather().then(({ condition }) => condition).catch(() => 'warm')
  }, [])

  const finishQuiz = (selectedMood: Mood) => {
    const selectedOccasion = occasion ?? (otherOccasion.trim() ? inferOccasion(otherOccasion) : null)
    if (!selectedOccasion || completionStarted.current) return
    completionStarted.current = true
    setMood(selectedMood)
    setStep(0)
    const detectedWeather = weatherPromise.current ?? getLocalWeather().then(({ condition }) => condition).catch(() => 'warm' as WeatherCondition)
    void detectedWeather.then((weather) => onSubmit({
      occasion: selectedOccasion,
      ...(otherOccasion.trim() ? { customOccasion: otherOccasion.trim() } : {}),
      weather,
      mood: selectedMood,
    }))
  }

  const continueWithOtherOccasion = () => {
    if (!otherOccasion.trim()) return
    setOccasion(inferOccasion(otherOccasion))
    setStep(2)
  }

  const commonOccasions = showMoreOccasions ? OCCASIONS : OCCASIONS.slice(0, 6)

  return (
    <div className="space-y-6">
      {step === 0 ? (
        <p role="status" className="flex items-center gap-3 py-4 text-sm text-text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-text-primary/15 border-t-butter-yellow" />
          Checking local weather and putting your outfit together…
        </p>
      ) : (
        <section aria-live="polite" aria-label={`Question ${step} of 2`}>
          {step === 2 && <button onClick={() => setStep(1)} className="mb-3 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"><ArrowLeft size={13} /> Back</button>}
          <div className="mb-4 grid w-full grid-cols-2 gap-1.5" role="img" aria-label={`Progress: step ${step} of 2`}>
            {[1, 2].map((number) => <span key={number} className={clsx('h-1 rounded-full', number <= step ? 'bg-butter-yellow' : 'bg-text-primary/10')} />)}
          </div>

          {step === 1 && <>
            <div className="flex flex-wrap gap-2">
              {commonOccasions.map((option) => <ChoiceChip key={option.value} selected={occasion === option.value} onClick={() => { setOccasion(option.value); setStep(2) }}>{option.label}</ChoiceChip>)}
              {OCCASIONS.length > 6 && <button type="button" aria-expanded={showMoreOccasions} onClick={() => setShowMoreOccasions((shown) => !shown)} className="px-2 py-2.5 text-sm text-text-muted underline decoration-text-primary/25 underline-offset-4 transition-colors hover:text-text-primary">{showMoreOccasions ? '− Less' : '+ More'}</button>}
              <button type="button" aria-expanded={showOtherOccasion} onClick={() => setShowOtherOccasion((shown) => !shown)} className="px-2 py-2.5 text-sm text-text-muted underline decoration-text-primary/25 underline-offset-4 transition-colors hover:text-text-primary">+ Other</button>
            </div>
            {showOtherOccasion && <form onSubmit={(event) => { event.preventDefault(); continueWithOtherOccasion() }} className="mt-4 flex max-w-lg flex-wrap gap-3">
              <input autoFocus value={otherOccasion} onChange={(event) => setOtherOccasion(event.target.value)} maxLength={60} placeholder="What are you dressing for?" aria-label="Other occasion" className="min-w-56 flex-1 border-b border-text-primary/25 bg-transparent px-1 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-text-primary focus:outline-none" />
              <button type="submit" disabled={!otherOccasion.trim()} className="border border-text-primary/25 px-4 py-2 text-sm text-text-primary transition-colors hover:border-text-primary/50 disabled:cursor-not-allowed disabled:opacity-40">Continue</button>
            </form>}
          </>}

          {step === 2 && <>
            <div className="mb-4 flex items-baseline gap-2"><h2 className="font-serif text-xl text-text-primary">How do you want to feel?</h2><span className="text-xs text-text-muted">Optional</span></div>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((option) => <ChoiceChip key={option.value} selected={mood === option.value} onClick={() => finishQuiz(option.value)}>{option.label}</ChoiceChip>)}
              <button onClick={() => finishQuiz('relaxed')} disabled={isLoading} className="px-3 py-2 text-xs text-text-muted underline decoration-text-primary/20 underline-offset-4 hover:text-text-primary disabled:opacity-50">Skip</button>
            </div>
          </>}
        </section>
      )}
    </div>
  )
}

function inferOccasion(value: string): Occasion {
  const text = value.toLowerCase()
  if (/work|office|meeting|interview/.test(text)) return 'work'
  if (/date|dinner|evening|romantic/.test(text)) return 'date-night'
  if (/wedding|party|gala|ceremony|celebration|event/.test(text)) return 'special-event'
  if (/gym|workout|exercise|training/.test(text)) return 'gym'
  if (/travel|flight|airport|trip|vacation/.test(text)) return 'travel'
  if (/weekend|brunch|cosy|cozy|relax|home|coffee/.test(text)) return 'weekend'
  if (/formal|black tie/.test(text)) return 'formal'
  return 'casual'
}

function ChoiceChip({ children, selected, onClick }: { children: React.ReactNode; selected: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={clsx('rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow', selected ? 'border-dark-purple bg-dark-purple text-butter-yellow shadow-soft' : 'border-text-primary/15 bg-surface text-text-primary hover:border-text-primary/40')}>{children}</button>
}
