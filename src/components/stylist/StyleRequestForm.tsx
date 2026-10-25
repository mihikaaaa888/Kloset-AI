import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { HangerIcon } from '@/components/ui/HangerIcon'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import type { StyleRequest, WeatherCondition, Mood } from '@/lib/stylist'
import type { Occasion } from '@/types'

// ─── Option data ──────────────────────────────────────────────────────────────

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

const WEATHER_OPTIONS: { value: WeatherCondition; label: string; description: string }[] = [
  { value: 'hot', label: 'Hot', description: '25°C+' },
  { value: 'warm', label: 'Warm', description: '18–25°C' },
  { value: 'cool', label: 'Cool', description: '12–18°C' },
  { value: 'cold', label: 'Cold', description: 'Under 12°C' },
  { value: 'rainy', label: 'Rainy', description: 'Wet outside' },
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

// ─── Component ────────────────────────────────────────────────────────────────

interface StyleRequestFormProps {
  onSubmit: (request: StyleRequest) => void
  isLoading: boolean
}

export function StyleRequestForm({ onSubmit, isLoading }: StyleRequestFormProps) {
  const [occasion, setOccasion] = useState<Occasion | null>(null)
  const [weather, setWeather] = useState<WeatherCondition | null>(null)
  const [mood, setMood] = useState<Mood | null>(null)

  const canSubmit = occasion && weather && mood

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({ occasion, weather, mood })
  }

  return (
    <div className="space-y-10">
      {/* Question 1 — Occasion */}
      <FormQuestion
        number="01"
        question="What are you dressing for?"
        answered={!!occasion}
      >
        <div className="flex flex-wrap gap-2.5">
          {OCCASIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setOccasion(opt.value)}
              className={clsx(
                'flex items-center px-4 py-2.5 rounded-full text-sm font-medium border',
                'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow',
                occasion === opt.value
                  ? 'bg-dark-purple text-butter-yellow border-dark-purple shadow-soft'
                  : 'bg-surface text-text-primary border-text-primary/15 hover:border-text-primary/40 hover:text-text-primary'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FormQuestion>

      {/* Question 2 — Weather */}
      <FormQuestion
        number="02"
        question="What's the weather like?"
        answered={!!weather}
      >
        <div className="flex flex-wrap gap-2.5">
          {WEATHER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setWeather(opt.value)}
              className={clsx(
                'flex flex-col items-center px-5 py-3 rounded-2xl border text-center min-w-[76px]',
                'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow',
                weather === opt.value
                  ? 'bg-dark-purple text-butter-yellow border-dark-purple shadow-soft'
                  : 'bg-surface text-text-primary border-text-primary/15 hover:border-text-primary/40'
              )}
            >
              <span className="text-sm font-medium">{opt.label}</span>
              <span
                className={clsx(
                  'text-2xs mt-0.5',
                  weather === opt.value ? 'text-butter-yellow/70' : 'text-text-muted'
                )}
              >
                {opt.description}
              </span>
            </button>
          ))}
        </div>
      </FormQuestion>

      {/* Question 3 — Mood */}
      <FormQuestion
        number="03"
        question="How do you want to feel?"
        answered={!!mood}
      >
        <div className="flex flex-wrap gap-2.5">
          {MOODS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMood(opt.value)}
              className={clsx(
                'flex items-center px-4 py-2.5 rounded-full text-sm font-medium border',
                'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow',
                mood === opt.value
                  ? 'bg-dark-purple text-butter-yellow border-dark-purple shadow-soft'
                  : 'bg-surface text-text-primary border-text-primary/15 hover:border-text-primary/40 hover:text-text-primary'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FormQuestion>

      {/* Submit */}
      <div className="pt-2">
        <Button
          size="xl"
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={isLoading}
          className="group w-full sm:w-auto gap-3"
        >
          <HangerIcon size={18} />
          {isLoading ? 'Styling your look…' : 'Style Me'}
          {!isLoading && (
            <ArrowRight
              size={16}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          )}
        </Button>
        {!canSubmit && (
          <p className="text-xs text-charcoal-400 mt-3">
            Answer all three questions to generate your outfit
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function FormQuestion({
  number,
  question,
  answered,
  children,
}: {
  number: string
  question: string
  answered: boolean
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      {/* Number + question */}
      <div className="flex items-center gap-3 mb-5">
        <span
          className={clsx(
            'text-xs font-medium tabular-nums transition-colors duration-300',
            answered ? 'text-butter-yellow' : 'text-text-muted/40'
          )}
        >
          {number}
        </span>
        <div className={clsx('w-px h-4 transition-colors duration-300', answered ? 'bg-butter-yellow' : 'bg-text-primary/10')} />
        <h3 className="font-serif text-lg text-text-primary">{question}</h3>
        {answered && (
          <span className="ml-auto text-butter-yellow">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7l3.5 3.5L12 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
