import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowRight, Camera, ShoppingBag, Sparkles, type LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { PIECES } from './landingData'
import { usePointer } from './cursor'
import { CursorBlob } from './CursorBlob'
import { ArcText, Hint, OvalTag } from './ornaments'

const RAIL = PIECES.slice(0, 5)

const POINTS: { icon: LucideIcon; text: string }[] = [
  { icon: Camera, text: 'One photo per piece. Kloset fills in the details.' },
  { icon: Sparkles, text: 'Kaia styles you from what you already own.' },
  { icon: ShoppingBag, text: 'Buy or rent only the pieces that fill a gap.' },
]

/** Restart the swing animation on a hanger, pushed in the pointer's direction. */
function swing(el: HTMLElement, dir: number) {
  el.style.setProperty('--dir', String(dir))
  el.classList.remove('hanger-swing')
  void el.offsetWidth // reflow so the animation restarts
  el.classList.add('hanger-swing')
}

/**
 * A headline line set letter by letter in variable Syne. Letters near the
 * cursor ease toward `pull` weight (like cloth stretching under a hand) and
 * settle back to `base` when it moves on.
 */
function KineticLine({
  text,
  base,
  pull,
  colors,
  border,
  className,
}: {
  text: string
  base: number
  pull: number
  /** Gradient stops for the fill; it drifts slowly and a highlight follows the cursor. */
  colors: string[]
  /** CSS filter that draws the border (shadows trace only the outer edge, so no seams inside letters). */
  border: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  usePointer((x, y) => {
    const line = ref.current
    if (!line) return
    const box = line.getBoundingClientRect()
    if (box.bottom < 0 || box.top > window.innerHeight) return
    line.style.setProperty('--hx', `${Math.round(x - box.left)}px`)
    line.style.setProperty('--hy', `${Math.round(y - box.top)}px`)
    const letters = line.children
    // Read every position first, then write, so layout runs once per frame.
    const dist: number[] = []
    for (let i = 0; i < letters.length; i++) {
      const r = letters[i].getBoundingClientRect()
      dist.push(Math.hypot(x - (r.left + r.width / 2), (y - (r.top + r.height / 2)) * 1.4))
    }
    const reach = box.height * 1.6
    for (let i = 0; i < letters.length; i++) {
      const t = Math.max(0, 1 - dist[i] / reach)
      const w = Math.round(base + (pull - base) * t * t)
      ;(letters[i] as HTMLElement).style.fontVariationSettings = `'wght' ${w}`
    }
  })
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={clsx('ink-fill block w-max whitespace-nowrap', className)}
      style={{
        // One gradient across the whole line (it clips to every letter), plus a soft
        // highlight that sits under the cursor.
        backgroundImage: `radial-gradient(240px circle at var(--hx, -400px) var(--hy, -400px), rgb(255 236 214 / 0.95), transparent 70%), linear-gradient(100deg, ${[...colors, colors[0]].join(', ')})`,
        filter: border,
      }}
    >
      {[...text].map((ch, i) => (
        <span
          key={i}
          className="inline-block transition-[font-variation-settings] duration-300 ease-out motion-reduce:transition-none"
          style={{ fontVariationSettings: `'wght' ${base}` }}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  )
}

export function LandingHero({ onCTA }: { onCTA: () => void }) {
  const [picked, setPicked] = useState<string | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const pickedPiece = RAIL.find((p) => p.id === picked)

  const onEnter = (e: ReactPointerEvent<HTMLElement>) => {
    swing(e.currentTarget, e.movementX < 0 ? -1 : 1)
  }

  const pickedIndex = RAIL.findIndex((p) => p.id === picked)

  const rail = (
    <div className="relative h-full w-full">
      <img src="/images/landing-antique-gold-rod.svg" alt="" aria-hidden="true" className="absolute inset-x-0 top-0 w-full" />
      {RAIL.map((piece, i) => {
        const isPicked = picked === piece.id
        // When a piece is picked, its neighbours glide aside to give it room.
        const shift = pickedIndex < 0 || isPicked ? 0 : i < pickedIndex ? -16 : 16
        return (
          <div
            key={piece.id}
            className="absolute top-[1.2%] w-[23%] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{ left: `${11 + i * 19.5}%`, zIndex: isPicked ? 10 : i, transform: `translateX(calc(-50% + ${shift}%))` }}
          >
            <div className="hang-in" style={{ ['--d' as string]: `${350 + i * 110}ms` }}>
              <div className="origin-[50%_2%]" onPointerEnter={onEnter}>
                <button
                  type="button"
                  onClick={(e) => {
                    setPicked(isPicked ? null : piece.id)
                    if (e.currentTarget.parentElement) swing(e.currentTarget.parentElement, 1)
                  }}
                  aria-pressed={isPicked}
                  aria-label={`${piece.name}: see how Kloset tags it`}
                  className="block w-full rounded-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-butter-yellow"
                  style={{ transform: isPicked ? 'translateY(-3%) scale(1.12)' : undefined }}
                >
                  <img
                    src={piece.image}
                    alt=""
                    draggable={false}
                    width={480}
                    height={636}
                    className="h-auto w-full select-none drop-shadow-[0_22px_22px_rgba(36,27,41,0.22)]"
                    fetchPriority={i < 3 ? 'high' : 'auto'}
                  />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <section id="top" ref={sectionRef} className="relative scroll-mt-20 overflow-hidden bg-warm-cream">
      {/* A pastel glow that trails the cursor */}
      <CursorBlob areaRef={sectionRef} />

      <div className="relative mx-auto min-h-[100dvh] max-w-[1440px] px-4 pb-10 pt-28 sm:px-8 lg:pt-24">
        {/* Masthead, kept clear so it always reads cleanly. */}
        <div className="reveal relative font-syne text-[clamp(1.8rem,7.9vw,8rem)] leading-[0.88] tracking-[-0.045em] text-text-primary">
          <ArcText className="!mx-0 mb-1 !h-9 !w-60 text-butter-yellow">your closet, styled</ArcText>
          <h1 aria-label="Your wardrobe, reimagined." className="text-[1em] font-normal">
            <KineticLine text="Your wardrobe," base={800} pull={420} colors={['#241b29', '#355e3b', '#5b3a6e', '#2f4a3a']} border="drop-shadow(0.045em 0.045em 0 #e9c46a)" />
            <span className="relative block pl-[0.06em] lg:pl-[0.5em]">
              <KineticLine text="reimagined." base={400} pull={800} colors={['#355e3b', '#7fbf92', '#e9c46a', '#f2a991', '#9d86d9']} border="drop-shadow(1.5px 0 0 #355e3b) drop-shadow(-1.5px 0 0 #355e3b) drop-shadow(0 1.5px 0 #355e3b) drop-shadow(0 -1.5px 0 #355e3b)" />
              <OvalTag className="absolute left-[38%] top-full z-20 mt-1 rotate-[-8deg] !px-4 !py-1.5 !text-sm text-butter-yellow sm:!text-xl lg:left-[56%] lg:top-[38%] lg:mt-0">with Kloset!</OvalTag>
            </span>
          </h1>
        </div>

        {/* Under the masthead: the pitch on the left, the rail hanging on the right. */}
        <div className="mt-12 grid items-start gap-12 lg:mt-6 lg:grid-cols-12 lg:gap-8">
          <div className="reveal lg:col-span-5 lg:pt-20" style={{ ['--reveal-delay' as string]: '140ms' }}>
            <p className="max-w-[34ch] text-lg leading-relaxed text-text-muted sm:text-xl">
              Snap your clothes once. Kloset tags them, styles them with Kaia, and finds only what's missing.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button onClick={onCTA} className="btn-ticket group px-8 py-4">
                Build my Kloset
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
              </button>
              <a href="#features" className="rounded-full px-4 py-4 font-display text-xl italic text-text-primary underline decoration-text-primary/25 underline-offset-8 transition-colors hover:decoration-text-primary">
                See how it works
              </a>
            </div>

            <ul className="mt-14 grid max-w-md gap-3 border-t border-text-primary/10 pt-6 text-sm text-text-muted">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-deep-purple text-butter-yellow"><Icon size={15} strokeWidth={1.8} /></span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-7">
            <div className="relative mt-16 aspect-[10/3.7] w-full lg:mt-14">{rail}</div>

            {/* What Kloset reads from the picked piece, or a nudge to try. Fixed height so nothing jumps. */}
            <div className="relative mt-6 min-h-[88px]" aria-live="polite">
              {pickedPiece ? (
                <div key={pickedPiece.id} className="w-full text-center">
                  <p className="chip-pop mb-3 flex items-center justify-center gap-2 text-sm font-medium text-text-primary">
                    <Sparkles size={15} className="text-butter-yellow" />
                    Kloset tagged this {pickedPiece.name.toLowerCase()}
                  </p>
                  <ul className="flex flex-wrap justify-center gap-2">
                    {pickedPiece.tags.map((tag, t) => (
                      <li
                        key={tag}
                        className={clsx('chip-pop rounded-full border px-3.5 py-1.5 text-xs font-semibold', t === 0 ? 'border-butter-yellow bg-butter-yellow text-dark-purple' : 'border-butter-yellow/40 bg-[#fffdf3] text-text-primary')}
                        style={{ ['--d' as string]: `${120 + t * 90}ms` }}
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                // Arrow points straight up at the garments.
                <Hint text="brush the rail, or tap a piece" arrowFirst rotate={135} className="ml-[4%] !text-[1.4rem] sm:ml-[18%] sm:!text-[1.7rem]" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
