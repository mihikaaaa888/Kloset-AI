import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

// Landing page for the link in the password-reset email. Supabase signs the user in
// from the link's token (detectSessionInUrl), so all that's left is setting the new password.
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    console.log('[reset-password] link opened', { hasSession: !!user })
  }, [authLoading, user])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      console.error('[reset-password] update failed', error.message)
      setError(error.message)
      setLoading(false)
      return
    }

    console.log('[reset-password] password updated')
    navigate('/home', { replace: true })
  }

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-surface border border-text-primary/10 text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-butter-yellow/50 focus:ring-1 focus:ring-butter-yellow/30 transition-all text-base'

  return (
    <div className="min-h-screen bg-warm-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <span className="font-brand text-2xl text-butter-yellow">
              Kloset
            </span>
          </Link>
          <h1 className="font-display text-3xl font-medium text-text-primary mb-1">Choose a new password</h1>
          <p className="text-text-muted text-sm">You'll stay signed in once it's saved</p>
        </div>

        {authLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 rounded-full border-2 border-butter-yellow/30 border-t-butter-yellow animate-spin" />
          </div>
        ) : !user ? (
          <div className="text-center">
            <p className="text-text-muted text-sm leading-relaxed mb-8">
              This reset link has expired or was already used. Request a new one and open it on this device.
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-2 min-h-[44px] text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={14} />
              Send a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-text-muted uppercase tracking-widest mb-2">
                New password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-text-muted hover:text-text-primary"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm" className="block text-xs font-medium text-text-muted uppercase tracking-widest mb-2">
                Confirm password
              </label>
              <input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              disabled={loading}
              className="mt-2 !bg-butter-yellow !text-dark-purple hover:!bg-soft-butter font-medium gap-2"
            >
              {loading ? 'Saving…' : (
                <>Save password <ArrowRight size={16} /></>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
