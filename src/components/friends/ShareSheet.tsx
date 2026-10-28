import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { listConnections, sendShare, type ShareTarget } from '@/lib/friendService'
import type { Connection } from '@/types'

interface ShareSheetProps {
  target: ShareTarget | null
  onClose: () => void
}

/** Pick friends, add a note, send a piece or outfit. */
export function ShareSheet({ target, onClose }: ShareSheetProps) {
  const { user } = useAuth()
  const [friends, setFriends] = useState<Connection[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [sendError, setSendError] = useState<string | null>(null)

  const open = !!target

  useEffect(() => {
    if (!open) return
    setPicked([])
    setMessage('')
    setStatus('idle')
    setSendError(null)
    setFriends(null)
    setLoadError(null)
    listConnections()
      .then((conns) => setFriends(conns.filter((c) => c.status === 'accepted')))
      .catch((err: Error) => setLoadError(err.message))
  }, [open])

  useEffect(() => {
    if (!open) return
    // Capture phase + stopPropagation so Esc closes only this sheet, not the page under it.
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [open, onClose])

  if (!target) return null

  const title = target.kind === 'item' ? target.item.name : target.outfit.name

  const handleSend = async () => {
    if (!user || picked.length === 0) return
    setStatus('sending')
    setSendError(null)
    try {
      await sendShare(target, picked, user.id, message)
      setStatus('sent')
      setTimeout(onClose, 1200)
    } catch (err) {
      setStatus('error')
      setSendError((err as Error).message)
    }
  }

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-scrim/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Send ${title}`}
        className="relative w-full sm:max-w-md bg-warm-cream shadow-lifted animate-slide-up sm:animate-fade-up max-h-[85vh] flex flex-col"
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div className="min-w-0">
            <p className="text-2xs uppercase tracking-widest text-text-muted">
              Send {target.kind === 'item' ? 'piece' : 'outfit'}
            </p>
            <h2 className="font-display text-2xl text-text-primary truncate mt-1">{title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-text-primary hover:bg-text-primary/5 flex-shrink-0"
          >
            <X size={18} strokeWidth={1.25} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6">
          {loadError ? (
            <p className="text-sm text-red-700 dark:text-red-400 py-6">{loadError}</p>
          ) : friends === null ? (
            <p className="text-sm text-text-muted py-6">Loading friends…</p>
          ) : friends.length === 0 ? (
            <div className="py-6">
              <p className="text-sm text-text-muted leading-relaxed">You haven’t added any friends yet.</p>
              <Link
                to="/friends"
                onClick={onClose}
                className="inline-block mt-3 text-2xs uppercase tracking-widest font-semibold text-butter-yellow hover:underline underline-offset-4"
              >
                Add friends
              </Link>
            </div>
          ) : (
            <ul className="border-y border-text-primary/10 divide-y divide-text-primary/10">
              {friends.map((f) => {
                const on = picked.includes(f.otherId)
                return (
                  <li key={f.id}>
                    <button
                      onClick={() => toggle(f.otherId)}
                      aria-pressed={on}
                      className="w-full flex items-center gap-3 py-3 text-left"
                    >
                      <Monogram name={f.otherName} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-text-primary truncate capitalize">{f.otherName}</span>
                        <span className="block text-xs text-text-muted truncate">{f.otherEmail}</span>
                      </span>
                      <span
                        className={clsx(
                          'w-6 h-6 rounded-full flex items-center justify-center transition-colors',
                          on ? 'bg-text-primary text-warm-cream' : 'ring-1 ring-text-primary/20 text-transparent'
                        )}
                      >
                        <Check size={13} strokeWidth={1.75} />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {friends && friends.length > 0 && (
            <label className="block mt-6 mb-2">
              <span className="text-2xs uppercase tracking-widest text-text-muted">Note (optional)</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={280}
                rows={2}
                placeholder="Thought of you when I wore this"
                className="mt-2 w-full resize-none bg-transparent border-b border-text-primary/25 focus:border-text-primary py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none"
              />
            </label>
          )}
          {sendError && <p className="text-sm text-red-700 dark:text-red-400 mt-2">{sendError}</p>}
        </div>

        <footer className="px-6 py-5">
          <button
            onClick={handleSend}
            disabled={picked.length === 0 || status === 'sending' || status === 'sent'}
            className="w-full h-12 bg-text-primary text-warm-cream text-xs font-medium uppercase tracking-widest hover:bg-text-primary/90 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'sending'
              ? 'Sending…'
              : status === 'sent'
                ? 'Sent'
                : picked.length > 1
                  ? `Send to ${picked.length} friends`
                  : 'Send'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}

export function Monogram({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      className={clsx(
        'flex-shrink-0 rounded-full bg-butter-yellow text-dark-purple flex items-center justify-center font-display',
        size === 'lg' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-sm'
      )}
    >
      {initials || '·'}
    </span>
  )
}
