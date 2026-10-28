import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-warm-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <span className="font-brand [word-spacing:-0.2em] text-2xl text-butter-yellow">
              Kloset AI
            </span>
          </Link>
          <h1 className="font-display text-3xl font-medium text-text-primary mb-1">Reset password</h1>
          <p className="text-text-muted text-sm">We'll send you a link to reset it</p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-butter-yellow/10 border border-butter-yellow/20 flex items-center justify-center mx-auto mb-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-butter-yellow">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="font-display text-xl font-medium text-text-primary mb-2">Email sent</h2>
            <p className="text-text-muted text-sm leading-relaxed mb-8">
              Check <strong className="text-text-primary">{email}</strong> for a reset link. It expires in 1 hour.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 min-h-[44px] text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={14} />
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-xs font-medium text-text-muted uppercase tracking-widest mb-2">
                  Email address
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

              <Button
                type="submit"
                fullWidth
                size="lg"
                disabled={loading}
                className="mt-2 !bg-butter-yellow !text-dark-purple hover:!bg-soft-butter font-medium gap-2"
              >
                {loading ? 'Sending…' : (
                  <>Send reset link <ArrowRight size={16} /></>
                )}
              </Button>
            </form>

            <div className="text-center mt-6">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 min-h-[44px] text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                <ArrowLeft size={14} />
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
