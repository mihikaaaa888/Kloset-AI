import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { Check, Trash2, UserPlus, X } from 'lucide-react'
import { clsx } from 'clsx'

import { useAuth } from '@/contexts/AuthContext'
import { Monogram } from '@/components/friends/ShareSheet'
import { CATEGORY_LABEL, CategoryGlyph } from '@/components/wardrobe/categoryVisuals'
import { colourNameToHex, isLightColour } from '@/lib/colourUtils'
import {
  FRIENDS_CHANGED_EVENT,
  deleteShare,
  listConnections,
  listShares,
  markSharesSeen,
  removeConnection,
  resolveSharedImages,
  respondToRequest,
  sendFriendRequest,
} from '@/lib/friendService'
import type { Connection, Share, SharedPiece } from '@/types'

type Tab = 'inbox' | 'friends' | 'sent'

const notifyChanged = () => window.dispatchEvent(new Event(FRIENDS_CHANGED_EVENT))

export function FriendsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: Tab = (['inbox', 'friends', 'sent'] as const).find((t) => t === searchParams.get('tab')) ?? 'inbox'
  const setTab = (t: Tab) => setSearchParams(t === 'inbox' ? {} : { tab: t }, { replace: true })

  const [connections, setConnections] = useState<Connection[]>([])
  const [shares, setShares] = useState<Share[]>([])
  const [images, setImages] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openShare, setOpenShare] = useState<Share | null>(null)

  const load = useCallback(async () => {
    try {
      const [conns, sh] = await Promise.all([listConnections(), listShares()])
      setConnections(conns)
      setShares(sh)
      setError(null)
      const paths = sh.flatMap((s) => s.payload.pieces.map((p) => p.imagePath).filter((p): p is string => !!p))
      setImages(await resolveSharedImages(paths))
      console.log('[friends-page] loaded', { connections: conns.length, shares: sh.length })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const received = useMemo(() => shares.filter((s) => s.direction === 'received'), [shares])
  const sent = useMemo(() => shares.filter((s) => s.direction === 'sent'), [shares])
  const incoming = connections.filter((c) => c.status === 'pending' && c.direction === 'incoming')
  const outgoing = connections.filter((c) => c.status === 'pending' && c.direction === 'outgoing')
  const friends = connections.filter((c) => c.status === 'accepted')
  const unseen = received.filter((s) => !s.seenAt)

  // Opening the inbox marks everything in it as seen (the "New" tags stay until next visit).
  useEffect(() => {
    if (tab !== 'inbox' || unseen.length === 0) return
    markSharesSeen(unseen.map((s) => s.id))
      .then(notifyChanged)
      .catch(() => {})
  }, [tab, unseen.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      await load()
      notifyChanged()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const tabs: [Tab, string, number][] = [
    ['inbox', 'Received', unseen.length],
    ['friends', 'Friends', incoming.length],
    ['sent', 'Sent', 0],
  ]

  return (
    <div className="min-h-screen bg-warm-cream pt-16 lg:pt-20 pb-28 md:pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="pt-10 lg:pt-14 pb-6">
          <h1 className="font-display text-4xl lg:text-6xl font-medium text-text-primary leading-none">Friends</h1>
          <p className="text-text-muted text-sm mt-3">
            {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
            {received.length > 0 && <> · {received.length} {received.length === 1 ? 'thing' : 'things'} shared with you</>}
          </p>
        </div>

        <div role="tablist" aria-label="Friends sections" className="flex gap-8 border-b border-text-primary/10 mb-8">
          {tabs.map(([value, label, badge]) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={clsx(
                'relative -mb-px pt-3 pb-3 text-xs uppercase tracking-widest transition-colors flex items-center gap-2',
                tab === value
                  ? 'text-text-primary font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-text-primary'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {label}
              {badge > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-butter-yellow text-dark-purple text-2xs font-semibold flex items-center justify-center tabular-nums">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-8 flex items-start justify-between gap-4 py-3 px-4 bg-red-50 dark:bg-red-950/40 text-red-800 text-sm">
            <p>{error}</p>
            <button onClick={() => setError(null)} aria-label="Dismiss" className="flex-shrink-0">
              <X size={16} strokeWidth={1.25} />
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-text-muted py-16 text-center">Loading…</p>
        ) : tab === 'friends' ? (
          <FriendsTab
            myId={user?.id ?? ''}
            incoming={incoming}
            outgoing={outgoing}
            friends={friends}
            onAct={act}
          />
        ) : (
          <ShareGrid
            shares={tab === 'inbox' ? received : sent}
            images={images}
            emptyTitle={tab === 'inbox' ? 'Nothing here yet' : 'You haven’t sent anything'}
            emptyBody={
              tab === 'inbox'
                ? 'When friends send you a piece or an outfit, it shows up here.'
                : 'Open any piece in My Kloset, or an outfit in My Outfits, and choose “Send to a friend”.'
            }
            onOpen={setOpenShare}
          />
        )}
      </div>

      <ShareDetail
        share={openShare}
        images={images}
        onClose={() => setOpenShare(null)}
        onDelete={(s) => {
          setOpenShare(null)
          act(() => deleteShare(s.id))
        }}
      />
    </div>
  )
}

// ─── Friends tab ──────────────────────────────────────────────────────────────

function FriendsTab({
  myId,
  incoming,
  outgoing,
  friends,
  onAct,
}: {
  myId: string
  incoming: Connection[]
  outgoing: Connection[]
  friends: Connection[]
  onAct: (fn: () => Promise<unknown>) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setNote(null)
    try {
      const result = await sendFriendRequest(email, myId)
      setNote({ tone: 'ok', text: result === 'accepted' ? 'They’d already asked you, so you’re now friends.' : 'Request sent.' })
      setEmail('')
      await onAct(async () => {})
    } catch (err) {
      setNote({ tone: 'err', text: (err as Error).message })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-12">
      <aside className="lg:sticky lg:top-28 self-start">
        <h2 className="font-display text-2xl text-text-primary">Add a friend</h2>
        <p className="text-sm text-text-muted mt-1">Enter the email they use for Kloset.</p>
        <form onSubmit={handleAdd} className="mt-5 flex items-end gap-2">
          <label className="flex-1">
            <span className="sr-only">Friend’s email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@email.com"
              className="w-full bg-transparent border-b border-text-primary/25 focus:border-text-primary py-2.5 text-base text-text-primary placeholder:text-text-muted/60 focus:outline-none transition-colors"
            />
          </label>
          <button
            type="submit"
            disabled={sending}
            className="h-11 px-5 flex items-center gap-2 bg-text-primary text-warm-cream text-xs font-medium uppercase tracking-widest hover:bg-text-primary/90 disabled:opacity-50 transition-colors"
          >
            <UserPlus size={14} strokeWidth={1.5} />
            {sending ? 'Sending…' : 'Add'}
          </button>
        </form>
        {note && (
          <p className={clsx('text-sm mt-3', note.tone === 'ok' ? 'text-butter-yellow' : 'text-red-700 dark:text-red-400')} role="status">
            {note.text}
          </p>
        )}
      </aside>

      <div className="space-y-12">
        {incoming.length > 0 && (
          <PeopleSection title="Requests">
            {incoming.map((c) => (
              <PersonRow key={c.id} person={c} meta={`Asked ${timeAgo(c.createdAt)}`}>
                <button
                  onClick={() => onAct(() => respondToRequest(c.id, true))}
                  className="h-9 px-4 flex items-center gap-1.5 bg-text-primary text-warm-cream text-2xs font-semibold uppercase tracking-widest hover:bg-text-primary/90"
                >
                  <Check size={13} strokeWidth={1.75} />
                  Accept
                </button>
                <button
                  onClick={() => onAct(() => respondToRequest(c.id, false))}
                  className="h-9 px-4 text-2xs uppercase tracking-widest text-text-muted hover:text-text-primary"
                >
                  Decline
                </button>
              </PersonRow>
            ))}
          </PeopleSection>
        )}

        <PeopleSection title="Your friends">
          {friends.length === 0 ? (
            <p className="text-sm text-text-muted py-4">No friends yet. Add someone by email to start sharing looks.</p>
          ) : (
            friends.map((c) => (
              <PersonRow key={c.id} person={c} meta={c.respondedAt ? `Friends since ${formatDate(c.respondedAt)}` : undefined}>
                <button
                  onClick={() => {
                    if (window.confirm(`Remove ${c.otherName} from your friends?`)) onAct(() => removeConnection(c.id))
                  }}
                  className="h-9 px-3 text-2xs uppercase tracking-widest text-text-muted hover:text-red-700"
                >
                  Remove
                </button>
              </PersonRow>
            ))
          )}
        </PeopleSection>

        {outgoing.length > 0 && (
          <PeopleSection title="Waiting to accept">
            {outgoing.map((c) => (
              <PersonRow key={c.id} person={c} meta={`Sent ${timeAgo(c.createdAt)}`}>
                <button
                  onClick={() => onAct(() => removeConnection(c.id))}
                  className="h-9 px-3 text-2xs uppercase tracking-widest text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
              </PersonRow>
            ))}
          </PeopleSection>
        )}
      </div>
    </div>
  )
}

function PeopleSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl text-text-primary mb-3">{title}</h2>
      <ul className="border-t border-text-primary/10 divide-y divide-text-primary/10">{children}</ul>
    </section>
  )
}

function PersonRow({ person, meta, children }: { person: Connection; meta?: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-4 py-4">
      <Monogram name={person.otherName} size="lg" />
      <div className="flex-1 min-w-0">
        <p className="text-base text-text-primary truncate capitalize">{person.otherName}</p>
        <p className="text-xs text-text-muted truncate">
          {person.otherEmail}
          {meta && <> · {meta}</>}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">{children}</div>
    </li>
  )
}

// ─── Shared items ─────────────────────────────────────────────────────────────

function ShareGrid({
  shares,
  images,
  emptyTitle,
  emptyBody,
  onOpen,
}: {
  shares: Share[]
  images: Record<string, string>
  emptyTitle: string
  emptyBody: string
  onOpen: (s: Share) => void
}) {
  if (shares.length === 0) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-display text-3xl text-text-primary">{emptyTitle}</h2>
        <p className="text-sm text-text-muted mt-3 max-w-sm mx-auto leading-relaxed">{emptyBody}</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 sm:gap-x-5 gap-y-10">
      {shares.map((s) => (
        <button
          key={s.id}
          onClick={() => onOpen(s)}
          className="group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow focus-visible:ring-offset-4 focus-visible:ring-offset-warm-cream"
        >
          <div className="relative">
            {s.kind === 'item' ? (
              <div className="aspect-[3/4] overflow-hidden">
                <PieceImage piece={s.payload.pieces[0]} images={images} glyphSize={56} />
              </div>
            ) : (
              <div className="aspect-[3/4] grid grid-cols-2 gap-px bg-text-primary/5 overflow-hidden">
                {padTo4(s.payload.pieces).map((p, i) => (
                  <div key={i} className="overflow-hidden">
                    {p ? <PieceImage piece={p} images={images} glyphSize={36} /> : <div className="w-full h-full bg-tile" />}
                  </div>
                ))}
              </div>
            )}
            {s.direction === 'received' && !s.seenAt && (
              <span className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-butter-yellow text-dark-purple text-2xs font-semibold uppercase tracking-widest">
                New
              </span>
            )}
          </div>
          <p className="text-2xs uppercase tracking-widest text-text-muted mt-3.5">
            {s.kind === 'item' ? 'Piece' : `Outfit · ${s.payload.pieces.length} pieces`}
          </p>
          <h3 className="font-display text-lg leading-snug text-text-primary mt-1 truncate">{s.payload.title}</h3>
          <p className="text-xs text-text-muted mt-1 truncate">
            {s.direction === 'received' ? 'From' : 'To'} <span className="capitalize text-text-primary">{s.otherName}</span> · {timeAgo(s.createdAt)}
          </p>
          {s.message && <p className="text-sm text-text-primary/80 italic mt-2 line-clamp-2">“{s.message}”</p>}
        </button>
      ))}
    </div>
  )
}

function ShareDetail({
  share,
  images,
  onClose,
  onDelete,
}: {
  share: Share | null
  images: Record<string, string>
  onClose: () => void
  onDelete: (s: Share) => void
}) {
  useEffect(() => {
    if (!share) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [share, onClose])

  if (!share) return null

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={share.payload.title} className="fixed inset-0 z-[60] bg-warm-cream animate-fade-in flex flex-col">
      <header className="flex items-center justify-between gap-4 px-4 sm:px-8 h-16 lg:h-20 border-b border-text-primary/10 flex-shrink-0">
        <p className="text-xs text-text-muted truncate">
          {share.direction === 'received' ? 'From' : 'Sent to'}{' '}
          <span className="capitalize text-text-primary">{share.otherName}</span> · {formatDate(share.createdAt)}
        </p>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-11 h-11 rounded-full ring-1 ring-text-primary/10 flex items-center justify-center text-text-primary hover:ring-text-primary/30 transition-all flex-shrink-0"
        >
          <X size={20} strokeWidth={1.25} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 py-10">
          <p className="text-2xs uppercase tracking-widest text-text-muted">
            {share.kind === 'item' ? CATEGORY_LABEL[share.payload.pieces[0]?.category] ?? 'Piece' : 'Outfit'}
            {share.payload.occasion && <> · <span className="capitalize">{share.payload.occasion.replace('-', ' ')}</span></>}
          </p>
          <h2 className="font-display text-4xl lg:text-5xl text-text-primary leading-[1.05] mt-3 text-balance">{share.payload.title}</h2>
          {share.message && (
            <blockquote className="mt-6 max-w-xl font-display italic text-xl text-text-primary/80 leading-snug">“{share.message}”</blockquote>
          )}

          <div
            className={clsx(
              'mt-10 grid gap-x-6 gap-y-10',
              share.kind === 'item' ? 'grid-cols-1 max-w-md' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
            )}
          >
            {share.payload.pieces.map((p, i) => (
              <figure key={i}>
                <div className="aspect-[3/4] overflow-hidden">
                  <PieceImage piece={p} images={images} glyphSize={64} />
                </div>
                <figcaption className="mt-3">
                  <p className="text-2xs uppercase tracking-widest text-text-muted">
                    {p.role ?? CATEGORY_LABEL[p.category]}
                    {p.brand && <> · {p.brand}</>}
                  </p>
                  <p className="font-display text-lg text-text-primary mt-1">{p.name}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {p.colour.map((c) => (
                      <span key={c} className="flex items-center gap-1 text-xs text-text-muted capitalize">
                        <span className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: colourNameToHex(c) }} />
                        {c}
                      </span>
                    ))}
                    {p.material && <span className="text-xs text-text-muted capitalize">· {p.material}</span>}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>

          <button
            onClick={() => {
              if (window.confirm('Remove this from your list?')) onDelete(share)
            }}
            className="mt-14 flex items-center gap-2 text-2xs uppercase tracking-widest text-text-muted hover:text-red-700 transition-colors"
          >
            <Trash2 size={13} strokeWidth={1.5} />
            Remove
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function PieceImage({ piece, images, glyphSize }: { piece: SharedPiece; images: Record<string, string>; glyphSize: number }) {
  const src = piece.imagePath ? images[piece.imagePath] : piece.imageUrl
  if (src) return <img src={src} alt={piece.name} loading="lazy" className="w-full h-full object-cover bg-tile" />
  const bgHex = piece.colour[0] ? colourNameToHex(piece.colour[0]) : '#EDE9E2'
  return (
    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: bgHex }}>
      <CategoryGlyph category={piece.category} size={glyphSize} className={isLightColour(bgHex) ? 'text-text-primary/35' : 'text-white/45'} />
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function padTo4<T>(arr: T[]): (T | null)[] {
  const out: (T | null)[] = arr.slice(0, 4)
  while (out.length < 4) out.push(null)
  return out
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
