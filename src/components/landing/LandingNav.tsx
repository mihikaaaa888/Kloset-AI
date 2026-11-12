import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { clsx } from 'clsx'
import { HangerIcon } from '@/components/ui/HangerIcon'

export const LANDING_SECTIONS = [
  { id: 'features', label: 'How it works' },
  { id: 'rail', label: 'Every piece' },
  { id: 'laundry', label: 'Laundry day' },
  { id: 'more', label: 'Extras' },
] as const

interface LandingNavProps {
  signedIn: boolean
  onCTA: () => void
  onOpenMenu: () => void
  menuOpen: boolean
}

/** Section links hang off a rail; a hanger slides along it to the section in view. */
export function LandingNav({ signedIn, onCTA, onOpenMenu, menuOpen }: LandingNavProps) {
  const [active, setActive] = useState<string | null>(null)
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const [marker, setMarker] = useState<{ x: number; visible: boolean }>({ x: 0, visible: false })

  // Track which section sits in the middle band of the viewport.
  useEffect(() => {
    // Pinned panels stay "in view" under the one covering them, so the active
    // section is the last one (in page order) crossing the middle band.
    const watched = ['top', 'features', 'rail', 'laundry', 'more', 'join']
    const inBand = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id)
          else inBand.delete(entry.target.id)
        }
        const current = [...watched].reverse().find((id) => inBand.has(id))
        if (current) setActive(current)
      },
      { rootMargin: '-45% 0px -50% 0px' }
    )
    for (const id of watched) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const link = active ? linkRefs.current[active] : null
    if (!link) {
      setMarker((m) => ({ ...m, visible: false }))
      return
    }
    setMarker({ x: link.offsetLeft + link.offsetWidth / 2, visible: true })
  }, [active])

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5">
      <div className="tape-progress pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-butter-yellow bg-[repeating-linear-gradient(90deg,rgb(var(--c-dark-purple))_0_1px,transparent_1px_12px)]" aria-hidden="true" />
      <nav
        aria-label="Landing page"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 rounded-full border border-text-primary/10 bg-warm-cream/95 pl-5 pr-2 shadow-soft"
      >
        <a href="#top" className="flex items-center gap-2 font-brand text-xl text-butter-yellow">
          <HangerIcon size={22} />
          Kloset
        </a>

        {/* The rail: a hairline the links hang from. */}
        <div className="relative hidden h-full items-center lg:flex">
          <span className="absolute inset-x-0 top-3 h-px bg-text-primary/20" aria-hidden="true" />
          <span
            className={clsx(
              'absolute top-[5px] -translate-x-1/2 text-butter-yellow transition-[left,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
              marker.visible ? 'opacity-100' : 'opacity-0'
            )}
            style={{ left: marker.x }}
            aria-hidden="true"
          >
            <span key={active ?? 'none'} className="hanger-swing block origin-top" style={{ ['--dir' as string]: 1 }}>
              <HangerIcon size={18} />
            </span>
          </span>
          <ul className="flex items-center gap-1">
            {LANDING_SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  ref={(el) => { linkRefs.current[s.id] = el }}
                  href={`#${s.id}`}
                  aria-current={active === s.id ? 'location' : undefined}
                  className={clsx(
                    'block rounded-full px-4 pb-1 pt-5 text-xs font-medium uppercase tracking-widest transition-colors',
                    active === s.id ? 'text-butter-yellow' : 'text-text-primary/60 hover:text-text-primary'
                  )}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {!signedIn && (
            <Link to="/login" className="hidden rounded-full px-4 py-2.5 text-sm font-medium text-text-primary/75 transition-colors hover:text-text-primary sm:block">
              Sign in
            </Link>
          )}
          <button
            onClick={onCTA}
            className="btn-ticket px-5 py-3 !text-[11px]"
          >
            Build my Kloset
          </button>
          <button
            onClick={onOpenMenu}
            aria-expanded={menuOpen}
            aria-controls="landing-sidebar"
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-full text-text-primary transition-colors hover:bg-text-primary/5 lg:hidden"
          >
            <Menu size={22} strokeWidth={1.8} />
          </button>
        </div>
      </nav>
    </header>
  )
}
