import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { clsx } from 'clsx'
import { PIECES } from './landingData'
import { Peeker, usePointerVars } from './cursor'
import { PaperBlob } from './PaperBlob'
import { CursorBlob } from './CursorBlob'
import { ArcText, Checker, Hint, OvalTag, INKS } from './ornaments'

const RAIL = PIECES.slice(0, 5)

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

/** Restart the swing animation on a hanger, pushed in the pointer's direction. */
function swing(el: HTMLElement, dir: number) {
  el.style.setProperty('--dir', String(dir))
  el.classList.remove('hanger-swing')
  void el.offsetWidth // reflow so the animation restarts
  el.classList.add('hanger-swing')
}

export function LandingHero({ onCTA }: { onCTA: () => void }) {
  const [picked, setPicked] = useState<string | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  usePointerVars(sectionRef)
  const pickedPiece = RAIL.find((p) => p.id === picked)

  const onEnter = (e: ReactPointerEvent<HTMLElement>) => {
    swing(e.currentTarget, e.movementX < 0 ? -1 : 1)
  }

  return (
    <section
      id="top"
      ref={sectionRef}
      className="relative scroll-mt-20 overflow-hidden bg-warm-cream"
      // Faint paper grain
      style={{ backgroundImage: GRAIN }}
    >
      {/* Paper cut-outs that turn slowly and drift away from the cursor */}
      <PaperBlob seed={7} color="#f3eab0" depth={26} spin={90} className="-right-[12%] -top-[18%] h-[78vmin] w-[78vmin]" />
      <PaperBlob seed={21} color="#d7e6d4" depth={44} spin={70} reverse className="right-[24%] top-[44%] h-[46vmin] w-[46vmin]" />
      <PaperBlob seed={42} color="#f6ddd1" depth={16} spin={110} className="-bottom-[22%] -left-[10%] h-[60vmin] w-[60vmin]" />
      {/* A pastel glow that trails the cursor */}
      <CursorBlob areaRef={sectionRef} />

      <div className="relative mx-auto grid min-h-[100dvh] max-w-7xl items-center gap-14 px-4 pb-24 pt-28 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-8 lg:pt-24">
        <div className="lg:col-span-6">
          <ArcText className="reveal !mx-0 text-butter-yellow">your closet, styled</ArcText>
          <h1 className="reveal mt-2 font-display text-[3.6rem] font-medium leading-[0.98] tracking-tight text-text-primary sm:text-7xl xl:text-[5.6rem]">
            Your wardrobe,
            <span className="relative block">
              <em className="inline-block pb-3 pr-2 italic text-butter-yellow">
                reimagined.
              </em>
              <OvalTag className="absolute -bottom-1 left-[52%] rotate-[-9deg] text-butter-yellow sm:left-[56%]">with Kloset!</OvalTag>
            </span>
          </h1>
          <p className="reveal mt-8 max-w-[34ch] text-lg leading-relaxed text-text-muted sm:text-xl" style={{ ['--reveal-delay' as string]: '120ms' }}>
            Snap your clothes once. Kloset tags them, styles them with Kaia, and finds only what's missing.
          </p>
          <div className="reveal mt-10 flex flex-wrap items-center gap-4" style={{ ['--reveal-delay' as string]: '240ms' }}>
            <button onClick={onCTA} className="btn-ticket group px-8 py-4">
              Build my Kloset
              <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
            </button>
            <a href="#features" className="rounded-full px-4 py-4 font-display text-xl italic text-text-primary underline decoration-text-primary/25 underline-offset-8 transition-colors hover:decoration-text-primary">
              See how it works
            </a>
          </div>
        </div>

        {/* The rail, in a double-ruled frame */}
        <div className="relative lg:col-span-6">
          <Peeker color={INKS.mustard} className="hang-in absolute -top-11 right-10 h-16 w-20" style={{ ['--d' as string]: '1200ms' }} />

          <Hint text="brush or tap a piece" hidden={picked !== null} arrowFirst rotate={135} className="absolute -bottom-16 left-10 hidden sm:flex" />
          <div className="frame-2 relative p-3">
            <div className="relative rounded-[2px] bg-[#f5f0b8] px-3 pb-6 pt-8 sm:px-6">
              <div className="relative mx-auto aspect-[10/7] w-full max-w-[560px]">
                <img src="/images/landing-antique-gold-rod.svg" alt="" aria-hidden="true" className="absolute inset-x-[-2%] top-[2%] w-[104%]" />
                {RAIL.map((piece, i) => {
                  const isPicked = picked === piece.id
                  return (
                    <div
                      key={piece.id}
                      className="absolute top-[5%] w-[34%] origin-top -translate-x-1/2 transition-[rotate] duration-700 ease-out motion-reduce:transition-none"
                      // Garments lean away from the cursor, as if it brushed past them.
                      style={{ left: `${14 + i * 18}%`, zIndex: isPicked ? 10 : i, rotate: `calc(var(--px, 0) * ${-5 + i}deg)` }}
                    >
                      <div className="hang-in" style={{ ['--d' as string]: `${200 + i * 110}ms` }}>
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
                            style={{ transform: isPicked ? 'translateY(-3%) scale(1.06)' : undefined }}
                          >
                            <img
                              src={piece.image}
                              alt=""
                              draggable={false}
                              width={1090}
                              height={1443}
                              className="h-auto w-full select-none drop-shadow-[0_14px_18px_rgba(36,27,41,0.18)]"
                              fetchPriority={i < 3 ? 'high' : 'auto'}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* What Kloset reads from the picked piece. Fixed height so the page doesn't jump. */}
              <div className="relative mt-2 flex min-h-[92px] items-center justify-center px-2 text-center" aria-live="polite">
                {pickedPiece ? (
                  <div key={pickedPiece.id} className="w-full">
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
                  <p className="font-display text-lg italic text-text-primary/75">Brush the rail, or tap a piece to see what Kloset reads.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Checker />
    </section>
  )
}
