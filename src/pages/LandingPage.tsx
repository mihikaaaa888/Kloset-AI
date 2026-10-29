import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { Menu, X } from 'lucide-react'
import { CinematicClosetHero } from '@/components/hero/CinematicClosetHero'
import { HeroCopy } from '@/components/hero/HeroCopy'
import { authNavItems, publicNavItems } from '@/components/layout/Navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useUserStore } from '@/store/userStore'

export function LandingPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const profile = useUserStore((s) => s.profile)
  const [menuOpen, setMenuOpen] = useState(false)
  const [doorOpen, setDoorOpen] = useState(false)

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
      navigate('/wardrobe')
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
    <div className="min-h-screen bg-warm-cream">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <CinematicClosetHero onDoorOpenChange={setDoorOpen} />

      {/* Brand bar belongs to the rack page and appears after the door is fully open. */}
      <header className={clsx(
        'fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between bg-[#355f43] px-5 text-[#fffbd5] shadow-[0_2px_16px_rgba(26,46,33,0.14)] transition-[opacity,visibility] duration-500',
        doorOpen ? 'visible opacity-100' : 'invisible pointer-events-none opacity-0'
      )}>
        <span className="font-brand [word-spacing:-0.2em] text-xl tracking-wide">
          Kloset AI
        </span>
        <button
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-controls="landing-sidebar"
          aria-label="Open menu"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-[#fffbd5] transition-colors hover:bg-[#fffbd5]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fffbd5]"
        >
          <Menu size={22} strokeWidth={1.8} />
        </button>
      </header>

      {/* ── Intro copy and CTA ──────────────────────────────────────────────── */}
      <section className="py-10 md:py-16 lg:py-20 bg-butter-yellow">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <HeroCopy onCTA={handleCTA} animate={false} align="center" tone="green" />
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-butter-yellow border-t border-dark-purple/15 py-10">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-brand [word-spacing:-0.2em] text-lg text-dark-purple/80">Kloset AI</span>
            </div>
            <p className="text-dark-purple/60 text-xs">&copy; {new Date().getFullYear()} Kloset AI. All rights reserved.</p>
          </div>
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
            <span className="font-brand [word-spacing:-0.2em] text-xl text-butter-yellow">Kloset AI</span>
            <button
              onClick={() => setMenuOpen(false)}
              className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-butter-yellow/70 hover:text-butter-yellow hover:bg-butter-yellow/10 transition-colors"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="flex flex-col px-6 py-6 flex-1 overflow-y-auto" aria-label="Site">
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
          </nav>
          <div className="px-6 py-6 border-t border-butter-yellow/15">
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
                Get Started
              </NavLink>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
