import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { clsx } from 'clsx'
import { Stamp, INKS } from './ornaments'

const PEEK = [
  '/images/landing/sm/burgundy-rib-knit-top-on-hanger.webp',
  '/images/landing/sm/floral-midi-dress-on-hanger.webp',
  '/images/landing/sm/chocolate-leather-trench-on-hanger.webp',
  '/images/landing/sm/pale-blue-wrap-skirt-on-hanger.webp',
  '/images/landing/sm/chartreuse-wrap-top-on-hanger.webp',
]

function Door({ side, open }: { side: 'left' | 'right'; open: boolean }) {
  const left = side === 'left'
  return (
    <div
      className={clsx(
        'absolute inset-y-0 w-1/2 bg-deep-purple p-4 transition-transform duration-[1200ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none sm:p-6',
        left ? 'left-0 origin-left rounded-l-[2rem] border-r border-text-primary/15' : 'right-0 origin-right rounded-r-[2rem]'
      )}
      style={{ transform: open ? `rotateY(${left ? -104 : 104}deg)` : 'rotateY(0deg)', backfaceVisibility: 'hidden' }}
    >
      {/* moulded panels */}
      <div className="flex h-full flex-col gap-4">
        <div className="flex-[2] rounded-2xl border-2 border-text-primary/10 shadow-[inset_0_2px_6px_rgba(36,27,41,0.08)]" />
        <div className="flex-1 rounded-2xl border-2 border-text-primary/10 shadow-[inset_0_2px_6px_rgba(36,27,41,0.08)]" />
      </div>
      <span className={clsx('absolute top-1/2 h-12 w-2.5 -translate-y-1/2 rounded-full bg-butter-yellow', left ? 'right-4' : 'left-4')} />
    </div>
  )
}

/** Closing CTA: wardrobe doors swing open when it scrolls into view. */
export function ClosetDoorsCTA({ onCTA }: { onCTA: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setOpen(true); observer.disconnect() }
    }, { threshold: 0.55 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="join" className="scroll-mt-20 px-4 pb-24 pt-24 sm:px-6 lg:px-8 lg:pb-32">
      <div
        ref={ref}
        onFocus={() => setOpen(true)}
        className="relative mx-auto max-w-5xl [perspective:1800px]"
      >
        <Stamp ring="YOUR CLOSET · STYLED · YOUR CLOSET · STYLED · " fill={INKS.mustard} className="absolute -left-6 -top-10 z-20" size={120}>
          Open<br />me
        </Stamp>
        {/* Inside the closet */}
        <div className="relative flex min-h-[520px] flex-col items-center justify-end overflow-hidden rounded-[2rem] bg-text-primary px-6 pb-12 pt-10 text-center sm:min-h-[560px]">
          <img src="/images/landing-antique-gold-rod.svg" alt="" aria-hidden="true" className="absolute inset-x-[6%] top-8 w-[88%]" />
          <div className="pointer-events-none absolute inset-x-[10%] top-10 flex justify-between opacity-90" aria-hidden="true">
            {PEEK.map((src) => <img key={src} src={src} alt="" loading="lazy" className="w-[19%]" />)}
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-text-primary via-text-primary/85 to-transparent" />
          <div className="relative">
            <h2 className="font-display text-5xl font-medium leading-[1.05] tracking-tight text-dark-purple sm:text-7xl">
              Your closet is <em className="italic">waiting.</em>
            </h2>
            <p className="mx-auto mt-4 max-w-[36ch] text-lg text-dark-purple/75">Snap a few pieces today and Kaia can start styling you tonight.</p>
            <button
              onClick={onCTA}
              className="btn-ticket group mt-8 px-8 py-4"
            >
              Build my Kloset
              <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-1" />
            </button>
          </div>
        </div>
        <div className={clsx('absolute inset-0', open && 'pointer-events-none')} aria-hidden="true" onClick={() => setOpen(true)}>
          <Door side="left" open={open} />
          <Door side="right" open={open} />
        </div>
      </div>
    </section>
  )
}
