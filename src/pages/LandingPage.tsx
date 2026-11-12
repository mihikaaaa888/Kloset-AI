import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { Heart, X } from 'lucide-react'
import { HangerIcon } from '@/components/ui/HangerIcon'
import { LandingNav, LANDING_SECTIONS } from '@/components/landing/LandingNav'
import { LandingHero } from '@/components/landing/LandingHero'
import { FeatureWalkthrough } from '@/components/landing/FeatureWalkthrough'
import { LaundryDay } from '@/components/landing/LaundryDay'
import { EverythingElse } from '@/components/landing/EverythingElse'
import { ClosetDoorsCTA } from '@/components/landing/ClosetDoorsCTA'
import { ClosetRail } from '@/components/landing/ClosetRail'
import { Checker } from '@/components/landing/ornaments'
import { authNavItems, publicNavItems } from '@/components/layout/Navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useUserStore } from '@/store/userStore'

export function LandingPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const profile = useUserStore((s) => s.profile)
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  // Fade sections up as they scroll into view (see .reveal in globals.css).
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.setAttribute('data-shown', '')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
    )
    root.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // Close the sidebar on Escape, and stop the page behind it from scrolling while open.
  useEffect(() => {
    if (!menuOpen) return
    console.log('[landing-sidebar] opened')
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      console.log('[landing-sidebar] closed')
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const handleCTA = () => {
    if (user && profile?.onboardingComplete) {
      navigate('/wardrobe', { state: { fromBuildMyKloset: true } })
    } else if (user) {
      navigate('/onboarding')
    } else {
      navigate('/signup')
    }
  }

  const handleSignOut = async () => {
    console.log('[landing-sidebar] signing out')
    setMenuOpen(false)
    await signOut()
    navigate('/')
  }

  return (
    <div ref={rootRef} className="min-h-screen bg-warm-cream">
      <a href="#features" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-24 focus:z-50 focus:rounded-full focus:bg-butter-yellow focus:px-4 focus:py-2 focus:text-dark-purple">
        Skip to features
      </a>
      <LandingNav signedIn={!!user} onCTA={handleCTA} onOpenMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />

      <main>
        <LandingHero onCTA={handleCTA} />
        <FeatureWalkthrough />
        <ClosetRail />
        <LaundryDay />
        <EverythingElse />
        <ClosetDoorsCTA onCTA={handleCTA} />
      </main>

      <Checker />
      <footer className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <span className="flex items-center gap-2 font-brand text-lg text-butter-yellow">
            <HangerIcon size={20} />
            Kloset
          </span>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-text-muted">
            {LANDING_SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="transition-colors hover:text-text-primary">{s.label}</a>
            ))}
            <NavLink to="/privacy" className="transition-colors hover:text-text-primary">Privacy</NavLink>
            {!user && <NavLink to="/login" className="transition-colors hover:text-text-primary">Sign in</NavLink>}
          </nav>
          <p className="text-xs text-text-muted">&copy; {new Date().getFullYear()} Kloset. All rights reserved.</p>
        </div>
      </footer>

      {/* ── Sidebar menu ──────────────────────────────────────────────────── */}
      <div
        className={clsx('fixed inset-0 z-50 transition-[opacity,visibility] duration-300', menuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none')}
        aria-hidden={!menuOpen}
      >
        <div className="absolute inset-0 bg-scrim/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
        <aside
          id="landing-sidebar"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className={clsx(
            'absolute top-0 left-0 h-full w-72 max-w-[85vw] bg-deep-purple shadow-lifted flex flex-col transition-transform duration-300',
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex items-center justify-between px-6 h-20 border-b border-butter-yellow/15">
            <span className="font-brand text-xl text-butter-yellow">Kloset</span>
            <button
              onClick={() => setMenuOpen(false)}
              className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-butter-yellow/70 hover:text-butter-yellow hover:bg-butter-yellow/10 transition-colors"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="flex flex-col px-6 py-6 flex-1 overflow-y-auto" aria-label="Site">
            {LANDING_SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setMenuOpen(false)}
                className="block py-3 text-base uppercase tracking-wider text-butter-yellow/70 transition-colors hover:text-butter-yellow"
              >
                {s.label}
              </a>
            ))}
            <span className="my-3 h-px bg-butter-yellow/15" aria-hidden="true" />
            {(user && profile?.onboardingComplete ? authNavItems : publicNavItems).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => clsx(
                  'block py-3 text-base uppercase tracking-wider transition-colors',
                  isActive ? 'text-butter-yellow font-semibold' : 'text-butter-yellow/70 hover:text-butter-yellow'
                )}
              >
                {item.label}
              </NavLink>
            ))}
            {user && profile?.onboardingComplete && (
              <NavLink to="/for-you" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 py-3 text-base uppercase tracking-wider text-butter-yellow/70 transition-colors hover:text-butter-yellow">
                <Heart size={16} /> For you
              </NavLink>
            )}
          </nav>
          <div className="px-6 py-6 border-t border-butter-yellow/15">
            <NavLink to="/privacy" onClick={() => setMenuOpen(false)} className="mb-3 block py-2 text-sm text-butter-yellow/70 transition-colors hover:text-butter-yellow">Privacy Policy</NavLink>
            {user ? (
              <button
                onClick={handleSignOut}
                className="block py-3 text-sm uppercase tracking-wider text-butter-yellow/70 hover:text-butter-yellow transition-colors"
              >
                Sign out
              </button>
            ) : (
              <NavLink
                to="/signup"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center px-4 py-3 rounded-2xl text-sm font-medium uppercase tracking-widest bg-butter-yellow text-dark-purple hover:bg-soft-butter transition-colors"
              >
                Build my Kloset
              </NavLink>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
