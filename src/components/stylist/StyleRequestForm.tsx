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
  const [mood, setMood] = useState<Mood | null>(null)
  const [step, setStep] = useState(1)
  const [showMoreOccasions, setShowMoreOccasions] = useState(false)
  const completionStarted = useRef(false)
  const weatherPromise = useRef<Promise<WeatherCondition> | null>(null)

  useEffect(() => { onStepChange?.(step) }, [step, onStepChange])
  useEffect(() => {
    weatherPromise.current = getLocalWeather().then(({ condition }) => condition).catch(() => 'warm')
  }, [])

  const finishQuiz = (selectedMood: Mood) => {
    if (!occasion || completionStarted.current) return
    completionStarted.current = true
    setMood(selectedMood)
    setStep(0)
    const detectedWeather = weatherPromise.current ?? getLocalWeather().then(({ condition }) => condition).catch(() => 'warm' as WeatherCondition)
    void detectedWeather.then((weather) => onSubmit({ occasion, weather, mood: selectedMood }))
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
            <h2 className="mb-4 font-serif text-xl text-text-primary">What are you dressing for?</h2>
            <div className="flex flex-wrap gap-2">
              {commonOccasions.map((option) => <ChoiceChip key={option.value} selected={occasion === option.value} onClick={() => { setOccasion(option.value); setStep(2) }}>{option.label}</ChoiceChip>)}
              {OCCASIONS.length > 6 && <button type="button" aria-expanded={showMoreOccasions} onClick={() => setShowMoreOccasions((shown) => !shown)} className="px-2 py-2.5 text-sm text-text-muted underline decoration-text-primary/25 underline-offset-4 transition-colors hover:text-text-primary">{showMoreOccasions ? '− Less' : '+ More'}</button>}
            </div>
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

function ChoiceChip({ children, selected, onClick }: { children: React.ReactNode; selected: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={clsx('rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow', selected ? 'border-dark-purple bg-dark-purple text-butter-yellow shadow-soft' : 'border-text-primary/15 bg-surface text-text-primary hover:border-text-primary/40')}>{children}</button>
}
