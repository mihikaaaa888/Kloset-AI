import { Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { HangerIcon } from '@/components/ui/HangerIcon'

export const LANDING_SECTIONS = [
  { id: 'features', label: 'How it works' },
  { id: 'rail', label: 'Every piece' },
] as const

interface LandingNavProps {
  signedIn: boolean
  onCTA: () => void
  onOpenMenu: () => void
  menuOpen: boolean
}

/** Compact landing header with the primary action and mobile menu. */
export function LandingNav({ signedIn, onCTA, onOpenMenu, menuOpen }: LandingNavProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-2 sm:px-5">
      <div className="tape-progress pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-butter-yellow bg-[repeating-linear-gradient(90deg,rgb(var(--c-dark-purple))_0_1px,transparent_1px_12px)]" aria-hidden="true" />
      <nav
        aria-label="Landing page"
        className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 rounded-full border border-text-primary/10 bg-warm-cream/95 pl-5 pr-2 shadow-soft"
      >
        <a href="#top" className="flex items-center gap-2 font-brand text-xl text-butter-yellow">
          <HangerIcon size={22} />
          Kloset
        </a>

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
