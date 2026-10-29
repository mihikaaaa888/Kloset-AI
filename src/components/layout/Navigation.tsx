import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { Home, Shirt, User, Menu, X, Compass, Users } from 'lucide-react'
import { HangerIcon } from '@/components/ui/HangerIcon'
import { ThemeToggleButton } from '@/components/ui/ThemeToggle'
import { useUserStore } from '@/store/userStore'
import { useAuth } from '@/contexts/AuthContext'
import { countFriendActivity, FRIENDS_CHANGED_EVENT } from '@/lib/friendService'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  requiresAuth?: boolean
}

export const publicNavItems: NavItem[] = [
  { label: 'Home', to: '/', icon: <Home size={18} /> },
]

export const authNavItems: NavItem[] = [
  { label: 'Home', to: '/home', icon: <Home size={18} />, requiresAuth: true },
  { label: 'My Kloset', to: '/wardrobe', icon: <Shirt size={18} />, requiresAuth: true },
  { label: 'Shop', to: '/discover', icon: <Compass size={18} />, requiresAuth: true },
  { label: 'AI Stylist', to: '/stylist', icon: <HangerIcon size={18} />, requiresAuth: true },
  { label: 'Friends', to: '/friends', icon: <Users size={18} />, requiresAuth: true },
  { label: 'Profile', to: '/profile', icon: <User size={18} />, requiresAuth: true },
]

export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const profile = useUserStore((s) => s.profile)
  const { user } = useAuth()

  const isOnboarding = location.pathname.startsWith('/onboarding')
  const isAuthPage = ['/login', '/signup', '/forgot-password', '/reset-password'].includes(location.pathname)
  const isLanding = location.pathname === '/'

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Pending requests + unseen shares, refreshed on navigation, every minute, and when the Friends page changes something.
  const [friendBadge, setFriendBadge] = useState(0)
  useEffect(() => {
    if (!user) { setFriendBadge(0); return }
    const refresh = () => countFriendActivity().then(setFriendBadge).catch(() => setFriendBadge(0))
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener(FRIENDS_CHANGED_EVENT, refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(FRIENDS_CHANGED_EVENT, refresh)
    }
  }, [user, location.pathname])

  const badgeFor = (to: string) =>
    to === '/friends' && friendBadge > 0 ? (
      <span
        aria-label={`${friendBadge} new`}
        className="min-w-[16px] h-4 px-1 rounded-full bg-butter-yellow text-dark-purple text-[9px] leading-none font-semibold flex items-center justify-center tabular-nums"
      >
        {friendBadge}
      </span>
    ) : null

  // The landing page has no top nav — its links live in the footer instead.
  if (isOnboarding || isAuthPage || isLanding) return null

  // On phones, signed-in users get the bottom tab bar, so the hamburger would just repeat it.
  const hasTabBar = !!user && !!profile?.onboardingComplete

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-warm-cream/95 backdrop-blur-md border-b border-text-primary/10"
      >
        <nav className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">

            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2" aria-label="Kloset AI home">
              <span className={clsx(
                'font-brand [word-spacing:-0.1em] text-xl tracking-tight transition-colors duration-300',
                'text-text-primary'
              )}>
                Kloset AI
              </span>
            </NavLink>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-7 lg:gap-9">
              {(user && profile?.onboardingComplete ? authNavItems : publicNavItems).map((item) => {
                if (item.requiresAuth && !user) return null
                if (item.requiresAuth && !profile?.onboardingComplete) return null
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/' || item.to === '/home'}
                    className={({ isActive }) => clsx('text-tab', isActive && 'text-tab-active')}
                  >
                    {item.label}
                    {badgeFor(item.to)}
                  </NavLink>
                )
              })}

              <ThemeToggleButton className="-mx-2" />

              {!user && (
                <NavLink
                  to="/signup"
                  className="ml-2 px-5 py-2 rounded-full text-sm font-medium uppercase tracking-widest transition-all duration-200 bg-dark-purple text-butter-yellow hover:bg-deep-purple"
                >
                  Get Started
                </NavLink>
              )}
            </div>

            <div className="flex items-center md:hidden">
            <ThemeToggleButton className={clsx(!hasTabBar && 'mr-1')} />
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className={clsx(
                'md:hidden w-11 h-11 -mr-2.5 flex items-center justify-center rounded-full transition-colors text-text-primary hover:bg-text-primary/5',
                hasTabBar && 'hidden'
              )}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            </div>
          </div>
        </nav>
      </header>

      {/* Mobile menu overlay */}
      {mobileOpen && !hasTabBar && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-scrim/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-16 left-0 right-0 bg-warm-cream border-b border-text-primary/10 shadow-lifted animate-fade-up">
            <div className="px-6 py-6 flex flex-col">
              {(user && profile?.onboardingComplete ? authNavItems : publicNavItems).map((item) => {
                if (item.requiresAuth && !user) return null
                if (item.requiresAuth && !profile?.onboardingComplete) return null
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/' || item.to === '/home'}
                    className={({ isActive }) => clsx(
                      'flex items-center gap-2 py-3 text-base uppercase tracking-wider transition-colors',
                      isActive ? 'text-butter-yellow font-semibold' : 'text-text-primary hover:text-butter-yellow'
                    )}
                  >
                    {item.label}
                    {badgeFor(item.to)}
                  </NavLink>
                )
              })}

              {!user && (
                <NavLink
                  to="/signup"
                  className="mt-2 flex items-center justify-center px-4 py-3 rounded-2xl bg-dark-purple text-butter-yellow text-sm font-medium uppercase tracking-widest"
                >
                  Get Started
                </NavLink>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom mobile nav */}
      {hasTabBar && (
        <nav
          aria-label="Main"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-warm-cream/95 backdrop-blur-md border-t border-text-primary/10"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-stretch px-1">
            {authNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/home'}
                className={({ isActive }) => clsx(
                  'flex-1 min-w-0 min-h-[56px] flex flex-col items-center justify-center gap-1 px-0.5 text-[11px] leading-none whitespace-nowrap transition-colors duration-150',
                  isActive ? 'text-butter-yellow font-semibold' : 'text-text-muted active:text-text-primary'
                )}
              >
                <span className="relative">
                  {item.icon}
                  {badgeFor(item.to) && <span className="absolute -top-1.5 -right-2.5">{badgeFor(item.to)}</span>}
                </span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </>
  )
}
