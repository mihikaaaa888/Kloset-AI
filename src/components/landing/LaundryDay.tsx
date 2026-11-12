import { useEffect, useRef, useState } from 'react'
import { Play, RotateCw } from 'lucide-react'
import { clsx } from 'clsx'
import { usePointerVars } from './cursor'
import { Hint, Stamp, INKS } from './ornaments'

interface Look {
  caption: string
  pieces: { src: string; alt: string }[]
}

const PROGRAMS: { id: string; label: string; looks: Look[] }[] = [
  {
    id: 'work',
    label: 'Work',
    looks: [
      { caption: 'Navy pinstripe set, worn as a suit', pieces: [{ src: '/images/landing/sm/navy-pinstripe-set-on-hanger.webp', alt: 'Navy pinstripe set' }] },
      {
        caption: 'Burgundy button-up with white trousers',
        pieces: [
          { src: '/images/landing/sm/burgundy-button-up-shirt-on-hanger.webp', alt: 'Burgundy button-up shirt' },
          { src: '/images/landing/sm/white-trousers-on-hanger.webp', alt: 'White trousers' },
        ],
      },
    ],
  },
  {
    id: 'date',
    label: 'Date night',
    looks: [
      {
        caption: 'Chartreuse wrap top with the olive skirt',
        pieces: [
          { src: '/images/landing/sm/chartreuse-wrap-top-on-hanger.webp', alt: 'Chartreuse buckle-wrap top' },
          { src: '/images/landing/sm/olive-gathered-skirt-on-hanger.webp', alt: 'Olive gathered skirt' },
        ],
      },
      { caption: 'The red asymmetric skirt look', pieces: [{ src: '/images/landing/sm/red-asymmetric-skirt-on-hanger.webp', alt: 'Red asymmetric skirt' }] },
    ],
  },
  {
    id: 'weekend',
    label: 'Weekend',
    looks: [
      { caption: 'Navy layers and wide-leg denim', pieces: [{ src: '/images/landing/sm/navy-denim-clothing-on-hanger.webp', alt: 'Navy overshirt with light-wash jeans' }] },
      { caption: 'White tee and the butter satin skirt', pieces: [{ src: '/images/landing/sm/white-tee-butter-skirt-on-hanger.webp', alt: 'White tee with a butter-yellow satin skirt' }] },
    ],
  },
]

// What tumbles in the drum while it spins.
const LOAD = [
  '/images/landing/sm/burgundy-rib-knit-top-on-hanger.webp',
  '/images/landing/sm/pale-blue-wrap-skirt-on-hanger.webp',
  '/images/landing/sm/chartreuse-wrap-top-on-hanger.webp',
  '/images/landing/sm/white-trousers-on-hanger.webp',
]

const SPIN_MS = 2400

// [left %, size px, duration s, delay s]
const BUBBLES: [number, number, number, number][] = [
  [6, 18, 11, 0], [14, 34, 14, 3], [27, 12, 9, 6], [39, 26, 13, 1.5], [52, 16, 10, 4.5],
  [63, 40, 16, 2], [74, 14, 9, 7], [83, 28, 12, 0.5], [92, 20, 11, 5], [47, 10, 8, 8],
]

type Phase = 'idle' | 'spinning' | 'done'

export function LaundryDay() {
  const [program, setProgram] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<Look | null>(null)
  const spins = useRef(0)
  const timer = useRef<number>()
  const [touched, setTouched] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  usePointerVars(sectionRef)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const start = () => {
    if (phase === 'spinning') return
    setTouched(true)
    const looks = PROGRAMS[program].looks
    const next = looks[spins.current % looks.length]
    spins.current += 1
    setPhase('spinning')
    setResult(null)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    timer.current = window.setTimeout(() => {
      setResult(next)
      setPhase('done')
    }, reduce ? 0 : SPIN_MS)
  }

  const turnDial = () => {
    if (phase === 'spinning') return
    setProgram((p) => (p + 1) % PROGRAMS.length)
    setPhase('idle')
  }

  const dialAngle = -60 + program * 60

  return (
    <section id="laundry" ref={sectionRef} className="relative scroll-mt-20 overflow-hidden bg-butter-yellow px-4 py-24 text-dark-purple sm:px-6 lg:px-8 lg:py-32">
      {/* Laundromat tiles, and suds drifting up (they shy away from the cursor). */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ backgroundImage: 'linear-gradient(rgb(var(--c-dark-purple) / 0.07) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-dark-purple) / 0.07) 1px, transparent 1px)', backgroundSize: '72px 72px' }}
        aria-hidden="true"
      />
      <div className="parallax pointer-events-none absolute inset-0" style={{ ['--depth' as string]: 60 }} aria-hidden="true">
        {BUBBLES.map(([left, size, dur, delay], i) => (
          <span
            key={i}
            className="bubble absolute -bottom-16 rounded-full border border-dark-purple/40 bg-[radial-gradient(circle_at_30%_30%,rgb(var(--c-dark-purple)/0.35),transparent_45%)]"
            style={{ left: `${left}%`, width: size, height: size, ['--dur' as string]: `${dur}s`, ['--d' as string]: `${delay}s` }}
          />
        ))}
      </div>
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-12">
        <div className="reveal lg:col-span-5">
          <h2 className="font-display text-5xl font-medium uppercase leading-[0.95] tracking-tight sm:text-7xl">
            Laundry day, but for <em className="normal-case italic text-[#e9c46a]">outfits.</em>
          </h2>
          <p className="mt-6 max-w-[40ch] text-lg leading-relaxed text-dark-purple/80">
            Kaia remixes what's already in your closet. Turn the dial to pick the occasion, press start, and see what comes out.
          </p>
          <div className="mt-8 flex flex-wrap gap-2" role="radiogroup" aria-label="Programme">
            {PROGRAMS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={program === i}
                onClick={() => { if (phase !== 'spinning') { setProgram(i); setPhase('idle') } }}
                className={clsx(
                  'rounded-[50%] border px-6 py-2.5 font-display text-lg italic transition-[background-color,color,transform]',
                  program === i ? 'rotate-[-4deg] border-dark-purple bg-dark-purple text-butter-yellow' : 'border-dark-purple/35 text-dark-purple hover:border-dark-purple'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* The real thing, pegged to the page */}
          <figure className="frame-2 relative mt-14 hidden w-72 rotate-[-4deg] p-3 sm:block">
            <span className="absolute -top-5 left-1/2 h-10 w-4 -translate-x-1/2 rounded-sm bg-[#c9a36b] shadow-[inset_-3px_0_0_rgba(0,0,0,0.15),0_4px_6px_rgba(0,0,0,0.25)]" aria-hidden="true" />
            <img src="/images/landing/photo-shirts-line.webp" alt="White shirts drying on a washing line" loading="lazy" className="aspect-[4/3] w-full rounded-[2px] object-cover" />
            <Stamp ring="SPIN · RINSE · RESTYLE · SPIN · RINSE · " fill={INKS.mustard} className="absolute -bottom-10 -right-12" size={100}>
              Clean<br />looks
            </Stamp>
          </figure>
        </div>

        <div className="grid items-end gap-10 sm:grid-cols-[minmax(0,320px)_1fr] lg:col-span-7">
          {/* The machine */}
          <div className={clsx('reveal relative mx-auto w-full max-w-[320px]', phase === 'spinning' && 'machine-shake')}>
            <Hint text="turn me" tone="cream" hidden={touched} rotate={-20} className="absolute -top-14 -left-4 hidden sm:flex" />
            <Hint text="then press start" tone="cream" hidden={touched} className="absolute -right-28 -top-14 hidden sm:flex" />
            <div className="rounded-[2rem] bg-[#f6f3ea] p-4 shadow-[0_30px_60px_-20px_rgba(10,30,15,0.55)]">
              {/* Control panel */}
              <div className="flex items-center justify-between rounded-2xl bg-[#e9e5d8] px-3 py-2.5">
                <button
                  type="button"
                  onClick={turnDial}
                  aria-label={`Change programme, now ${PROGRAMS[program].label}`}
                  className="relative h-11 w-11 rounded-full bg-[#fbfaf5] shadow-[inset_0_-3px_0_rgba(0,0,0,0.12),0_2px_4px_rgba(0,0,0,0.15)] transition-transform duration-500"
                  style={{ transform: `rotate(${dialAngle}deg)` }}
                >
                  <span className="absolute left-1/2 top-1.5 h-3 w-1 -translate-x-1/2 rounded-full bg-butter-yellow" />
                </button>
                <div className="min-w-[96px] rounded-lg bg-text-primary px-3 py-1.5 text-center font-mono text-xs uppercase tracking-wider text-[#b8f5c8]" aria-hidden="true">
                  {phase === 'spinning' ? 'Spinning' : phase === 'done' ? 'Ready' : PROGRAMS[program].label}
                </div>
                <button
                  type="button"
                  onClick={start}
                  disabled={phase === 'spinning'}
                  className="flex h-11 items-center gap-1.5 rounded-full bg-butter-yellow px-4 text-xs font-semibold text-dark-purple transition-transform active:scale-[0.97] disabled:opacity-60"
                >
                  {phase === 'done' ? <RotateCw size={14} /> : <Play size={14} />}
                  {phase === 'done' ? 'Again' : 'Start'}
                </button>
              </div>

              {/* Porthole */}
              <div className="relative mx-auto mt-6 aspect-square w-[84%] rounded-full bg-[#d8d3c4] p-[7%] shadow-[inset_0_4px_10px_rgba(0,0,0,0.15)]">
                <div className="relative h-full w-full overflow-hidden rounded-full bg-[#2c2431] shadow-[inset_0_0_30px_rgba(0,0,0,0.6)]">
                  <div className={clsx('absolute inset-0', phase === 'spinning' && 'drum-spin')}>
                    {/* drum holes */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,253,208,0.12)_1.5px,transparent_2px)] bg-[length:14px_14px]" />
                    {LOAD.map((src, i) => (
                      <img
                        key={src}
                        src={src}
                        alt=""
                        loading="lazy"
                        className="absolute w-[42%]"
                        style={{
                          left: `${[8, 50, 46, 4][i]}%`,
                          top: `${[10, 6, 50, 52][i]}%`,
                          transform: `rotate(${[-20, 25, 160, 200][i]}deg)`,
                        }}
                      />
                    ))}
                  </div>
                  {/* glass */}
                  <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(135deg,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0.05)_40%,transparent_60%,rgba(255,255,255,0.12)_100%)]" />
                </div>
              </div>
              <div className="mx-auto mt-5 h-2 w-16 rounded-full bg-[#e2ddcf]" />
            </div>
          </div>

          {/* The clothesline */}
          <div className="relative min-h-[300px]" aria-live="polite">
            <div className="absolute inset-x-0 top-0 h-12 rounded-[50%] border-b-2 border-dark-purple/60" aria-hidden="true" />
            {result ? (
              <div key={result.caption} className="relative pt-9">
                <div className="flex justify-center gap-4">
                  {result.pieces.map((piece, i) => (
                    <figure key={piece.src} className="hang-in w-[46%] max-w-[180px]" style={{ ['--d' as string]: `${i * 180}ms` }}>
                      <span className="mx-auto -mb-2 block h-6 w-3 rounded-sm bg-dark-purple shadow" aria-hidden="true" />
                      <img src={piece.src} alt={piece.alt} className="w-full drop-shadow-[0_16px_20px_rgba(0,0,0,0.3)]" />
                    </figure>
                  ))}
                </div>
                <p className="chip-pop mt-6 text-center font-display text-2xl italic" style={{ ['--d' as string]: '400ms' }}>
                  {result.caption}
                </p>
              </div>
            ) : (
              <p className="relative pt-24 text-center text-sm text-dark-purple/75">
                {phase === 'spinning' ? 'Mixing your closet...' : 'Fresh outfits hang here.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
