import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowDown, ArrowRight, Camera, ShoppingBag, Sparkles, type LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { PIECES } from './landingData'
import { CursorBlob } from './CursorBlob'
import { ArcText, Hint, OvalTag } from './ornaments'
import { HangerIcon } from '@/components/ui/HangerIcon'

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

/** Ease-in-out scroll to the top of `el`, re-aiming every frame in case content above it shifts. */
function glideTo(el: HTMLElement, duration = 750) {
  const from = window.scrollY
  const t0 = performance.now()
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / duration)
    const to = el.getBoundingClientRect().top + window.scrollY
    // 'instant' so the html { scroll-behavior: smooth } rule doesn't fight each frame.
    window.scrollTo({ top: from + (to - from) * ease(p), behavior: 'instant' })
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/**
 * A garment swing tag hanging on a thread from the top of the page. It sways once
 * shortly after load to catch the eye, sways again when brushed, and on click tugs
 * down like a pull cord, then glides the page to "How it works".
 * Only on wide screens, where it clears the nav pill.
 */
function SwingTag() {
  const swingRef = useRef<HTMLDivElement>(null)
  const pullRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setTimeout(() => { if (swingRef.current) swing(swingRef.current, -1) }, 2200)
    return () => window.clearTimeout(id)
  }, [])

  const onPull = () => {
    const target = document.getElementById('features')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { target?.scrollIntoView({ behavior: 'instant' }); return }
    const el = pullRef.current
    if (el) {
      el.classList.remove('tag-pull')
      void el.offsetWidth // reflow so the animation restarts
      el.classList.add('tag-pull')
    }
    // Start moving as the tug bottoms out.
    window.setTimeout(() => { if (target) glideTo(target) }, 260)
  }

  return (
    <div
      ref={swingRef}
      className="absolute -top-6 right-[6.5%] z-30 hidden origin-top select-none min-[1400px]:block"
      onPointerEnter={(e) => swing(e.currentTarget, e.movementX < 0 ? -1 : 1)}
    >
      <div className="hang-in" style={{ ['--d' as string]: '900ms' }}>
        <div ref={pullRef} className="flex flex-col items-center">
          {/* Starts above the page edge so the tug never shows a gap at the top. */}
          <span aria-hidden="true" className="block h-[136px] w-px bg-text-primary/35" />
          <button
            type="button"
            onClick={onPull}
            aria-label="See how Kloset works"
            className="group relative -mt-1 w-[88px] cursor-pointer rounded-md drop-shadow-[0_12px_16px_rgba(36,27,41,0.16)] transition-[filter,transform] duration-300 ease-out hover:-translate-y-0.5 hover:drop-shadow-[0_18px_22px_rgba(36,27,41,0.22)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-butter-yellow"
          >
            <svg viewBox="0 0 88 150" aria-hidden="true" className="block h-auto w-full">
              <path
                d="M24 1 H64 L87 24 V145 Q87 149 83 149 H5 Q1 149 1 145 V24 Z"
                fill="#fffdf3"
                stroke="rgb(var(--c-butter-yellow) / 0.6)"
                strokeWidth="1.2"
              />
              {/* Stitched inner border, like a woven label. */}
              <path
                d="M26 7 H62 L81 26 V141 Q81 143 79 143 H9 Q7 143 7 141 V26 Z"
                fill="none"
                stroke="rgb(var(--c-butter-yellow) / 0.35)"
                strokeWidth="0.8"
                strokeDasharray="2.5 2.5"
              />
              <circle cx="44" cy="17" r="4.5" fill="rgb(var(--c-warm-cream))" stroke="rgb(var(--c-butter-yellow) / 0.65)" strokeWidth="1.2" />
            </svg>
            <span aria-hidden="true" className="absolute inset-x-0 top-10 flex flex-col items-center text-butter-yellow">
              <HangerIcon size={24} />
              <span className="mt-1 font-brand text-lg leading-none">Kloset</span>
              <span className="mt-2.5 h-px w-10 bg-butter-yellow/30" />
              <span className="mt-2 whitespace-nowrap text-[8px] font-semibold uppercase tracking-[0.1em] text-text-primary/70">How it works</span>
              <ArrowDown size={13} strokeWidth={1.8} className="mt-1 transition-transform duration-300 group-hover:translate-y-0.5" />
            </span>
          </button>
        </div>
      </div>
    </div>
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
      <div aria-hidden="true" className="hero-linen pointer-events-none absolute inset-0" />
      <CursorBlob areaRef={sectionRef} />
      <SwingTag />

      <div className="relative mx-auto min-h-[100dvh] max-w-[1440px] px-4 pb-10 pt-28 sm:px-8 lg:pt-24">
        {/* Masthead, kept clear so it always reads cleanly. */}
        {/* Masthead in the house serif. Each line rises out of its own mask once, on load. */}
        <div className="relative font-display text-[clamp(2.9rem,8.4vw,6rem)] leading-[0.95] tracking-[-0.02em] text-text-primary">
          <ArcText className="reveal !mx-0 mb-2 !h-9 !w-60 text-butter-yellow">your closet, styled</ArcText>
          <h1 className="font-medium">
            <span className="block overflow-hidden pb-[0.08em]">
              <span className="line-rise block">Your wardrobe,</span>
            </span>
            {/* The tag rides on the same line as "reimagined." so it reads as part of the title. */}
            <span className="flex flex-wrap items-center gap-x-[0.3em] gap-y-2 pl-[0.04em] lg:pl-[0.9em]">
              <span className="block overflow-hidden pb-[0.12em]">
                <span className="line-rise block italic text-butter-yellow" style={{ ['--d' as string]: '140ms' }}>reimagined.</span>
              </span>
              <OvalTag className="line-fade rotate-[-6deg] !px-4 !py-1.5 !text-sm text-butter-yellow sm:!text-lg" style={{ ['--d' as string]: '700ms' }}>with Kloset</OvalTag>
            </span>
          </h1>
        </div>

        {/* Under the masthead: the pitch on the left; the rail, its hint and the CTAs on the right. */}
        <div className="mt-12 grid items-start gap-12 lg:mt-6 lg:grid-cols-12 lg:gap-8">
          <div className="reveal lg:col-span-5 lg:pt-20" style={{ ['--reveal-delay' as string]: '140ms' }}>
            <p className="max-w-[34ch] text-lg leading-relaxed text-text-muted sm:text-xl">
              Snap your clothes once. Kloset tags them, styles them with Kaia, and finds only what's missing.
            </p>

            <ul className="mt-10 grid max-w-md gap-3 border-t border-text-primary/10 pt-6 text-sm text-text-muted">
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
            <div className="relative mt-4 flex min-h-[88px] justify-center" aria-live="polite">
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
                <Hint text="brush the rail, or tap a piece" arrowFirst rotate={135} className="!text-[1.4rem] sm:!text-[1.7rem]" />
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
              <button onClick={onCTA} className="btn-ticket group px-8 py-4">
                Build my Kloset
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
              </button>
              <a href="#features" className="rounded-full px-4 py-4 font-display text-xl italic text-text-primary underline decoration-text-primary/25 underline-offset-8 transition-colors hover:decoration-text-primary">
                See how it works
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
