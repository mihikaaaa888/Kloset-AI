import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { Navigation } from '@/components/layout/Navigation'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { useDataSync } from '@/hooks/useDataSync'
import { LandingPage } from '@/pages/LandingPage'

// Everything past the landing page loads on demand, so a first visit to /
// doesn't download the whole app before anything shows.
const OnboardingPage = lazy(() => import('@/pages/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const WardrobePage = lazy(() => import('@/pages/WardrobePage').then((m) => ({ default: m.WardrobePage })))
const StylistPage = lazy(() => import('@/pages/StylistPage').then((m) => ({ default: m.StylistPage })))
const FriendsPage = lazy(() => import('@/pages/FriendsPage').then((m) => ({ default: m.FriendsPage })))
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const DiscoverPage = lazy(() => import('@/pages/DiscoverPage').then((m) => ({ default: m.DiscoverPage })))
const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const SignupPage = lazy(() => import('@/pages/auth/SignupPage').then((m) => ({ default: m.SignupPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

// Redirects unauthenticated users to /login, preserving the intended destination.
function PageSpinner() {
  return (
    <div className="min-h-screen bg-dark-purple flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-butter-yellow/30 border-t-butter-yellow animate-spin" />
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageSpinner />

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}

// Redirects already-authenticated users away from auth pages.
function RedirectIfAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (user) return <Navigate to="/home" replace />
  return <>{children}</>
}

function AppRoutes() {
  useDataSync()

  return (
    <>
      <ScrollToTop />
      <Navigation />
      <Suspense fallback={<PageSpinner />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
        <Route path="/signup" element={<RedirectIfAuth><SignupPage /></RedirectIfAuth>} />
        <Route path="/forgot-password" element={<RedirectIfAuth><ForgotPasswordPage /></RedirectIfAuth>} />
        {/* Not wrapped in RedirectIfAuth: the reset link signs the user in before they pick a password. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected */}
        <Route path="/home" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
        <Route path="/wardrobe" element={<RequireAuth><WardrobePage /></RequireAuth>} />
        <Route path="/stylist" element={<RequireAuth><StylistPage /></RequireAuth>} />
        <Route path="/discover" element={<RequireAuth><DiscoverPage /></RequireAuth>} />
        <Route path="/saved" element={<Navigate to="/wardrobe?view=outfits" replace />} />
        <Route path="/friends" element={<RequireAuth><FriendsPage /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      </Routes>
      </Suspense>
    </>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
