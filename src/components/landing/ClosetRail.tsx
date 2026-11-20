import type { PointerEvent as ReactPointerEvent } from 'react'

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
    <div className="pan-section relative border-t border-text-primary/10 bg-surface">
      <div className="pan-sticky flex flex-col justify-center pb-6 pt-[calc(7rem-0.9in)] lg:py-0 lg:pt-24">
        {/* Giant category words drift behind at half speed. */}
        <div
          className="pan-words pointer-events-none absolute left-0 top-[46%] flex w-max gap-[6vw] whitespace-nowrap pl-[6vw] font-sans text-[30vw] font-extrabold lowercase leading-[0.8] tracking-[-0.06em] text-text-primary/[0.035] lg:text-[20vw]"
          aria-hidden="true"
        >
          {WORDS.map((w) => <span key={w}>{w}</span>)}
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:-translate-x-8 lg:-translate-y-[calc(6rem-0.6in)] lg:px-8">
          <h2 className="max-w-[18ch] font-display text-5xl font-medium leading-[0.95] tracking-tight text-text-primary sm:text-7xl">
            Every piece you own, <em className="whitespace-nowrap italic text-[#355E3B]">in one place.</em>
          </h2>
        </div>

        <div className="pan-track relative mt-[calc(5rem-0.5in)] w-max pl-4 pr-[12vw] sm:mt-[calc(6rem-0.5in)] sm:pl-6 lg:-top-[0.5in] lg:mt-24 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))]">
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

      </div>
    </div>
  )
}
