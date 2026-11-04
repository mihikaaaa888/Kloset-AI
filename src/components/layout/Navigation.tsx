import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { Home, Shirt, User, Menu, X, Compass, Users, Settings, LogOut } from 'lucide-react'
import { HangerIcon } from '@/components/ui/HangerIcon'
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
  { label: 'Stylist', to: '/stylist', icon: <HangerIcon size={18} />, requiresAuth: true },
  { label: 'Friends', to: '/friends', icon: <Users size={18} />, requiresAuth: true },
]

export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const profile = useUserStore((s) => s.profile)
  const { user, signOut } = useAuth()

  const isOnboarding = location.pathname.startsWith('/onboarding')
  const isAuthPage = ['/login', '/signup', '/forgot-password', '/reset-password'].includes(location.pathname)
  const isLanding = location.pathname === '/'

  useEffect(() => { setMobileOpen(false); setDrawerOpen(false) }, [location.pathname, location.search])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const handleSignOut = async () => {
    setDrawerOpen(false)
    try { await signOut(); navigate('/') } catch (error) { console.error('[nav] sign out failed', error) }
  }

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

            <div className="flex items-center">
            {hasTabBar ? (
              // Signed in: a home icon to today's outfit replaces the logo and the "Home" tab.
              <NavLink
                to="/home"
                end
                aria-label="Today's outfit"
                title="Today's outfit"
                className={({ isActive }) => clsx(
                  'w-11 h-11 -ml-2.5 flex items-center justify-center rounded-full transition-colors hover:bg-text-primary/5',
                  isActive ? 'text-butter-yellow' : 'text-text-primary'
                )}
              >
                <Home size={21} />
              </NavLink>
            ) : (
              <NavLink to="/" className="flex items-center gap-2" aria-label="Kloset home">
                <span className="font-brand text-xl tracking-tight text-text-primary transition-colors duration-300">
                  Kloset
                </span>
              </NavLink>
            )}
            </div>

            <div className="flex items-center gap-4 lg:gap-6">
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-7 lg:gap-9">
              {(user && profile?.onboardingComplete ? authNavItems.filter((item) => item.to !== '/home') : publicNavItems).map((item) => {
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

              {!user && (
                <NavLink
                  to="/signup"
                  className="ml-2 px-5 py-2 rounded-full text-sm font-medium uppercase tracking-widest transition-all duration-200 bg-dark-purple text-butter-yellow hover:bg-deep-purple"
                >
                  Get Started
                </NavLink>
              )}
            </div>

            {/* Account menu (Profile, Settings, Log out), top right */}
            {hasTabBar && (
              <button
                onClick={() => setDrawerOpen(true)}
                className="w-11 h-11 -mr-2.5 flex items-center justify-center rounded-full text-text-primary transition-colors hover:bg-text-primary/5"
                aria-label="Open menu"
                aria-expanded={drawerOpen}
              >
                <Menu size={22} />
              </button>
            )}
            </div>

            <div className={clsx('flex items-center md:hidden', hasTabBar && 'hidden')}>
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

      {/* Account drawer: Profile, Settings, Log out */}
      {drawerOpen && hasTabBar && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Account menu">
          <div className="absolute inset-0 bg-scrim/40 backdrop-blur-sm animate-fade-in" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col bg-warm-cream shadow-lifted animate-drawer-in-right" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="flex h-16 lg:h-20 items-center justify-between border-b border-text-primary/10 px-6">
              <span className="font-brand text-xl tracking-tight text-text-primary">Kloset</span>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="-mr-2.5 flex h-11 w-11 items-center justify-center rounded-full text-text-primary hover:bg-text-primary/5">
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col px-3 py-4">
              {[
                { label: 'Profile', icon: <User size={18} />, onClick: () => navigate('/profile') },
                { label: 'Settings', icon: <Settings size={18} />, onClick: () => navigate('/profile?settings=1') },
                { label: 'Privacy Policy', icon: <span className="w-[18px] text-center text-sm">ⓘ</span>, onClick: () => navigate('/privacy') },
              ].map((row) => (
                <button key={row.label} onClick={row.onClick} className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-base text-text-primary transition-colors hover:bg-text-primary/5">
                  {row.icon}
                  {row.label}
                </button>
              ))}
            </div>
            <div className="mt-auto border-t border-text-primary/10 px-3 py-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base text-text-primary transition-colors hover:bg-text-primary/5">
                <LogOut size={18} />
                Log out
              </button>
            </div>
          </aside>
        </div>
      )}

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
            {/* Home lives in the top bar's home icon, so the tab bar leaves it out. */}
            {authNavItems.filter((item) => item.to !== '/home').map((item) => (
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
