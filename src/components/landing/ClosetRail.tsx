import type { PointerEvent as ReactPointerEvent } from 'react'
import { Hint } from './ornaments'

const GARMENTS = [
  'white-tee-butter-skirt', 'burgundy-rib-knit-top', 'red-asymmetric-skirt', 'cream-faux-fur-coat', 'pale-blue-wrap-skirt',
  'chartreuse-wrap-top', 'olive-gathered-skirt', 'navy-pinstripe-set', 'floral-midi-dress', 'chocolate-leather-trench',
  'navy-denim-clothing', 'burgundy-button-up-shirt', 'white-trousers', 'brown-faux-fur-collar-jacket', 'charcoal-pinstripe-wrap-trousers',
  'olive-linen-cream-trousers', 'burgundy-leather-zip-jacket', 'blue-layered-skirt', 'chocolate-suede-belted-jacket', 'navy-quarter-zip-ivory-jeans',
].map((name) => `/images/landing/sm/${name}-on-hanger.webp`)

const WORDS = ['Tops', 'Skirts', 'Dresses', 'Denim', 'Coats', 'Sets', 'Knits', 'Everything']

const GOLD = 'linear-gradient(180deg,#71572f,#d0b276 22%,#987644 45%,#e0cb97 60%,#a17e48 82%,#594326)'

function swing(e: ReactPointerEvent<HTMLElement>) {
  const el = e.currentTarget
  el.style.setProperty('--dir', e.movementX < 0 ? '-1' : '1')
  el.classList.remove('hanger-swing')
  void el.offsetWidth
  el.classList.add('hanger-swing')
}

/** Scroll down, the rail slides sideways: every piece in one closet. */
export function ClosetRail() {
  return (
    <section id="rail" className="pan-section relative bg-tile" aria-label="Every piece on one rail">
      <div className="pan-sticky flex flex-col justify-center py-20 lg:py-0">
        {/* Giant category words drift behind at half speed. */}
        <div
          className="pan-words pointer-events-none absolute left-0 top-[46%] flex w-max gap-[6vw] whitespace-nowrap pl-[6vw] font-sans text-[30vw] font-extrabold lowercase leading-[0.8] tracking-[-0.06em] text-white lg:text-[20vw]"
          aria-hidden="true"
        >
          {WORDS.map((w) => <span key={w}>{w}</span>)}
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <Hint text="hover to swing them" rotate={-25} className="absolute -bottom-12 right-[18%] hidden sm:flex" />
          <h2 className="max-w-[18ch] font-display text-5xl font-medium uppercase leading-[0.95] tracking-tight text-text-primary sm:text-7xl">
            Every piece you own, <em className="normal-case italic text-butter-yellow">on one rail.</em>
          </h2>
        </div>

        <div className="pan-track relative mt-12 w-max pl-4 pr-[12vw] sm:pl-6 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))]">
          <div className="absolute inset-x-0 top-1 h-2.5 rounded-full shadow-[0_6px_10px_-4px_rgba(36,27,41,0.4)]" style={{ background: GOLD }} aria-hidden="true" />
          <ul className="flex items-start">
            {GARMENTS.map((src, i) => (
              <li key={src} className="relative -mx-3 w-[150px] shrink-0 sm:w-[190px] lg:w-[min(17vw,230px)]" style={{ marginTop: i % 3 === 1 ? 6 : 0 }}>
                <div className="origin-[50%_2%]" onPointerEnter={swing}>
                  <img src={src} alt="" loading="lazy" draggable={false} className="w-full select-none drop-shadow-[0_18px_18px_rgba(36,27,41,0.18)]" />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto mt-10 flex w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <p className="text-sm text-text-muted">{GARMENTS.length} pieces, tagged and ready to style</p>
          <span className="relative hidden h-px flex-1 bg-text-primary/15 lg:block" aria-hidden="true">
            <span className="pan-progress absolute inset-0 bg-butter-yellow" />
          </span>
        </div>
      </div>
    </section>
  )
}
