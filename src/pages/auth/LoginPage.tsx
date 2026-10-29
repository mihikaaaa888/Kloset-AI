import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from ?? '/wardrobe'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    navigate(from, { replace: true })
  }

  return (
    <div className="min-h-screen bg-warm-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
<<<<<<< HEAD
            <span className="font-brand [word-spacing:-0.2em] text-2xl text-butter-yellow">
              Kloset AI
=======
            <span className="font-brand text-2xl text-butter-yellow">
              Kloset
>>>>>>> 7c62c2527df94c605f8ce52db10495139f7ef55c
            </span>
          </Link>
          <h1 className="font-display text-3xl font-medium text-text-primary mb-1">Welcome back</h1>
          <p className="text-text-muted text-sm">Sign in to your Kloset</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-text-muted uppercase tracking-widest mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl bg-surface border border-text-primary/10 text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-butter-yellow/50 focus:ring-1 focus:ring-butter-yellow/30 transition-all text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-text-muted uppercase tracking-widest mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-12 rounded-xl bg-surface border border-text-primary/10 text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-butter-yellow/50 focus:ring-1 focus:ring-butter-yellow/30 transition-all text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="flex justify-end mt-1.5">
              <Link
                to="/forgot-password"
                className="inline-block py-2 text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            fullWidth
            size="lg"
            disabled={loading}
            className="mt-2 !bg-butter-yellow !text-dark-purple hover:!bg-soft-butter font-medium gap-2"
          >
            {loading ? 'Signing in…' : (
              <>Sign in <ArrowRight size={16} /></>
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted mt-8">
          Don't have an account?{' '}
          <Link to="/signup" className="inline-block py-2 text-butter-yellow hover:text-soft-butter transition-colors font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
