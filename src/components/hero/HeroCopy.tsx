import { ArrowRight } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'

interface HeroCopyProps {
  onCTA: () => void
  /** Skips the entrance animation delays — used when this copy is revealed mid-scroll rather than on page load. */
  animate?: boolean
  /** 'center' is used by the cinematic hero, where the copy grows outward from the closet's centre. */
  align?: 'left' | 'center'
  /** 'light' = green text on the cream hero; 'green' = cream text on the forest-green section. */
  tone?: 'light' | 'green'
}

/**
 * The headline/CTA block — "Your wardrobe, curated for you" + Build My Kloset.
 * Shown below the interactive rack hero on the landing page.
 */
export function HeroCopy({ onCTA, animate = true, align = 'left', tone = 'light' }: HeroCopyProps) {
  const delay = (ms: number) => (animate ? { animationDelay: `${ms}ms`, opacity: 0 } : undefined)
  const animClass = animate ? 'animate-fade-up' : ''
  const centered = align === 'center'

  return (
    <div className={clsx('max-w-4xl', centered && 'text-center mx-auto')}>
      <h1
        className={`font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-medium ${tone === 'green' ? 'text-dark-purple' : 'text-butter-yellow'} leading-[1.05] tracking-tight mb-12 ${animClass}`}
        style={delay(100)}
      >
        Your wardrobe,
        <br />
        <em className="italic">curated for you</em>
      </h1>

      <div
        className={clsx(
          'flex flex-col sm:flex-row gap-4',
          centered ? 'items-center justify-center' : 'items-start sm:items-center',
          animClass
        )}
        style={delay(300)}
      >
        <Button
          size="xl"
          onClick={onCTA}
          className={clsx(
            'group !rounded-full shadow-lifted',
            tone === 'green'
              ? '!bg-dark-purple !text-butter-yellow hover:!bg-deep-purple'
              : '!bg-butter-yellow !text-dark-purple hover:!bg-soft-butter'
          )}
        >
          Build My Kloset
          <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-1" />
        </Button>
      </div>
    </div>
  )
}
