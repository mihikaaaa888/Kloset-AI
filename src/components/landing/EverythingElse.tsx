import { useState, type CSSProperties, type MouseEvent } from 'react'
import { Check, CloudSun, Lock, Scissors } from 'lucide-react'
import { clsx } from 'clsx'
import { Diamond, Hint, OvalTag, Stamp, INKS } from './ornaments'

const STYLES = ['Minimal', 'Streetwear', 'Indo-western', 'Classic', 'Boho', 'Old money', 'Y2K', 'Athleisure', 'Romantic']

const FOREST_PAPER = { '--paper': 'rgb(var(--c-butter-yellow))', '--rule': '#fffdf3' } as CSSProperties
const BUTTER_PAPER = { '--paper': '#f5f0b8' } as CSSProperties
const GINGHAM_PAPER = {
  '--paper': '#fffdf3',
  backgroundImage: 'linear-gradient(90deg, rgb(53 94 59 / 0.08) 50%, transparent 50%), linear-gradient(rgb(53 94 59 / 0.08) 50%, transparent 50%)',
  backgroundSize: '28px 28px',
} as CSSProperties

const BURST_COLOURS = ['#e9c46a', '#fffdf3', '#f2a991', '#a9d1b2']

interface Burst {
  id: number
  rays: { a: number; r0: number; r1: number; len: number; c: string }[]
  bits: { dx: number; dy: number; rot: number; c: string; round: boolean }[]
}

/** Paper rays and confetti thrown out from the tag's outline (an ellipse w x h). */
function makeBurst(w: number, h: number): Burst {
  const rx = w / 2 + 6
  const ry = h / 2 + 6
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * 360 + (Math.random() * 10 - 5)
    const t = (a * Math.PI) / 180
    // Distance from the centre to the ellipse, in the ray's direction.
    const r0 = 1 / Math.sqrt((Math.sin(t) / rx) ** 2 + (Math.cos(t) / ry) ** 2)
    return { a, r0, r1: r0 + 16 + Math.random() * 14, len: i % 2 ? 11 : 18, c: BURST_COLOURS[i % 2] }
  })
  const bits = Array.from({ length: 10 }, (_, i) => {
    const t = Math.random() * Math.PI * 2
    const dist = 40 + Math.random() * 40
    return { dx: Math.cos(t) * dist * (w / h > 2 ? 1.6 : 1), dy: Math.sin(t) * dist + 26, rot: Math.random() * 540 - 270, c: BURST_COLOURS[i % 4], round: i % 3 === 0 }
  })
  return { id: Date.now() + Math.random(), rays, bits }
}

/** A cream paper luggage tag. Choosing it stamps it mustard and throws a paper sunburst. */
function PaperTag({ label, on, tilt, onToggle }: { label: string; on: boolean; tilt: number; onToggle: () => void }) {
  const [bursts, setBursts] = useState<Burst[]>([])
  const [pop, setPop] = useState(0)

  const click = (e: MouseEvent<HTMLButtonElement>) => {
    onToggle()
    setPop((p) => p + 1)
    if (on || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = e.currentTarget.getBoundingClientRect()
    const burst = makeBurst(r.width, r.height)
    setBursts((b) => [...b, burst])
    window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== burst.id)), 1000)
  }

  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={on}
      className="group relative isolate py-2.5 pl-8 pr-5 font-display text-lg font-semibold italic text-butter-yellow transition-transform duration-300 hover:-translate-y-0.5"
      style={{ rotate: `${on ? tilt * 2 : tilt}deg` }}
    >
      {/* paper, clipped to a tag shape (shadow on the wrapper so the clip keeps it) */}
      <span key={pop} className={clsx('absolute inset-0 -z-10 drop-shadow-[0_6px_6px_rgba(10,25,12,0.35)]', pop > 0 && 'tag-stamp')} aria-hidden="true">
        <span
          className="absolute inset-0 transition-colors duration-300"
          style={{
            clipPath: 'polygon(14px 0, 100% 0, 100% 100%, 14px 100%, 0 50%)',
            backgroundColor: on ? '#e9c46a' : '#fffdf3',
            backgroundImage: 'repeating-linear-gradient(115deg, rgba(36,27,41,0.035) 0 1px, transparent 1px 4px)',
          }}
        />
      </span>
      {/* punched hole and its reinforcing ring */}
      <span className="absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-butter-yellow ring-2 ring-[#d9cf9a]" aria-hidden="true" />
      <span className="flex items-center gap-1.5">
        {label}
        {on && <Check size={15} strokeWidth={3} className="chip-pop" />}
      </span>

      {bursts.map((b) => (
        <span key={b.id} className="pointer-events-none absolute left-1/2 top-1/2 -z-20" aria-hidden="true">
          {b.rays.map((ray, i) => (
            <span
              key={`r${i}`}
              className="burst-ray"
              style={{ ['--a' as string]: `${ray.a}deg`, ['--r0' as string]: `${ray.r0}px`, ['--r1' as string]: `${ray.r1}px`, ['--len' as string]: `${ray.len}px`, ['--c' as string]: ray.c }}
            />
          ))}
          {b.bits.map((bit, i) => (
            <span
              key={`b${i}`}
              className={clsx('burst-bit', bit.round && 'rounded-full')}
              style={{ ['--dx' as string]: `${bit.dx}px`, ['--dy' as string]: `${bit.dy}px`, ['--rot' as string]: `${bit.rot}deg`, ['--c' as string]: bit.c }}
            />
          ))}
        </span>
      ))}
    </button>
  )
}

/** The rest of Kloset, as five framed cards on tailor's pattern paper. */
export function EverythingElse() {
  const [chosen, setChosen] = useState<string[]>(['Minimal', 'Indo-western'])
  const [touched, setTouched] = useState(false)
  const toggle = (s: string) => setChosen((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s]))

  return (
    <section
      id="more"
      className="relative scroll-mt-20 overflow-hidden bg-warm-cream px-4 py-24 sm:px-6 lg:px-8 lg:py-32"
      // Tailor's pattern paper: a fine grid with a heavier line every fifth square.
      style={{
        backgroundImage:
          'linear-gradient(rgb(var(--c-butter-yellow) / 0.10) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-butter-yellow) / 0.10) 1px, transparent 1px), linear-gradient(rgb(var(--c-butter-yellow) / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-butter-yellow) / 0.05) 1px, transparent 1px)',
        backgroundSize: '120px 120px, 120px 120px, 24px 24px, 24px 24px',
      }}
    >
      <div className="mx-auto max-w-7xl">
        <h2 className="reveal relative max-w-[16ch] font-display text-5xl font-medium uppercase leading-[0.95] tracking-tight text-text-primary sm:text-7xl">
          Everything else in the drawer
          <OvalTag className="absolute -bottom-3 left-[46%] rotate-[-7deg] text-butter-yellow">and more</OvalTag>
        </h2>

        {/* Cut line: the scissors snip across as the section scrolls by. */}
        <div className="relative mt-12 h-8 [container-type:inline-size]" aria-hidden="true">
          <span className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-text-primary/25" />
          <span className="scissors-run absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-warm-cream text-butter-yellow">
            <Scissors size={22} strokeWidth={1.8} className="-scale-x-100" />
          </span>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-6">
          {/* Style profile, on forest paper */}
          <div className="frame-2 reveal relative flex flex-col justify-between p-10 text-dark-purple md:col-span-4 md:row-span-2 md:p-12" style={FOREST_PAPER}>
            <Stamp ring="NINE STEPS · YOUR STYLE · NINE STEPS · " fill={INKS.mustard} className="absolute -right-5 -top-8" size={104}>
              All<br />about you
            </Stamp>
            <div>
              <h3 className="max-w-[16ch] font-display text-4xl font-medium uppercase leading-[1] sm:text-5xl">A style profile in nine short steps</h3>
              <p className="mt-4 max-w-[44ch] text-dark-purple/80">Tell Kloset what you like, where you go and how you dress. Every suggestion starts from there. Try a few:</p>
            </div>
            <div className="relative mt-10 flex flex-wrap gap-x-3 gap-y-4" role="group" aria-label="Example style choices">
              <Hint text="tap a few" tone="cream" hidden={touched} className="absolute -top-16 right-[6%] hidden sm:flex" />
              {STYLES.map((s, i) => (
                <PaperTag key={s} label={s} on={chosen.includes(s)} tilt={[-2, 1.5, -1, 2, -1.5, 1, -2.5, 2, -1][i]} onToggle={() => { toggle(s); setTouched(true) }} />
              ))}
            </div>
          </div>

          {/* Weather */}
          <div className="frame-2 reveal relative p-8 md:col-span-2" style={{ ...BUTTER_PAPER, ['--reveal-delay' as string]: '80ms' }}>
            <Diamond className="absolute -right-4 -top-6" style={{ rotate: '6deg' }}>31°</Diamond>
            <CloudSun size={30} strokeWidth={1.5} className="text-butter-yellow" />
            <h3 className="mt-5 font-display text-3xl font-medium uppercase leading-[1] text-text-primary">Dressed for the weather</h3>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">Kloset checks your local forecast, so a humid day gets linen, not the wool knit.</p>
          </div>

          {/* Rent, with a photo */}
          <div className="frame-2 reveal relative overflow-hidden p-3 md:col-span-2" style={{ ['--reveal-delay' as string]: '160ms' }}>
            <div className="relative h-full min-h-[240px] overflow-hidden rounded-[2px]">
              <img src="/images/landing/photo-hanging-rail.webp" alt="A hanging rail of shirts and jackets" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[50%_78%]" />
              <div className="absolute inset-0 bg-gradient-to-t from-text-primary/80 via-text-primary/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-[#fffdf3]">
                <h3 className="font-display text-3xl font-medium uppercase leading-[1]">Rent it for the week</h3>
                <p className="mt-2 text-sm text-[#fffdf3]/85">For the wedding you'll wear it to once.</p>
              </div>
            </div>
          </div>

          {/* Friends, with a photo */}
          <div className="frame-2 reveal grid overflow-hidden p-3 sm:grid-cols-2 md:col-span-3">
            <img src="/images/landing/photo-fabric-bunting.webp" alt="Strips of printed fabric strung up as bunting against a blue sky" loading="lazy" className="h-48 w-full rounded-[2px] object-cover sm:h-full" />
            <div className="p-6">
              <div className="flex -space-x-3" aria-hidden="true">
                {['AR', 'KM', 'IS'].map((initials, i) => (
                  <span key={initials} className={clsx('flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#fffdf3] text-xs font-semibold', ['bg-butter-yellow text-dark-purple', 'bg-[#f2a991] text-text-primary', 'bg-[#e9c46a] text-text-primary'][i])}>
                    {initials}
                  </span>
                ))}
              </div>
              <h3 className="mt-5 font-display text-3xl font-medium uppercase leading-[1] text-text-primary">Friends for a second opinion</h3>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">Share a look and get their take. They only see what you choose to send.</p>
            </div>
          </div>

          {/* Privacy, on gingham */}
          <div className="frame-2 reveal relative p-8 md:col-span-3" style={{ ...GINGHAM_PAPER, ['--reveal-delay' as string]: '80ms' }}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-butter-yellow text-dark-purple"><Lock size={18} /></span>
            <h3 className="mt-5 font-display text-3xl font-medium uppercase leading-[1] text-text-primary">Your photos stay yours</h3>
            <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-text-muted">Wardrobe photos live in private storage that only your account can open.</p>
            <OvalTag className="absolute bottom-6 right-6 rotate-[6deg] text-butter-yellow">private</OvalTag>
          </div>
        </div>
      </div>
    </section>
  )
}
