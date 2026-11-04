import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, ImagePlus, MessageCircle, Send, Smile, Trash2, UserPlus, X } from 'lucide-react'
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
  listFriendMessages,
  sendFriendMessage,
  sendShare,
  type FriendMessage,
} from '@/lib/friendService'
import { compressImage } from '@/lib/imageStorage'
import { deleteWithUndo, isPendingDelete, notify } from '@/store/undoStore'
import type { ClothingItem, Connection, Share, SharedPiece } from '@/types'

type Tab = 'chat' | 'add'

const notifyChanged = () => window.dispatchEvent(new Event(FRIENDS_CHANGED_EVENT))

export function FriendsPage() {
  const { user } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: Tab = searchParams.get('tab') === 'add' ? 'add' : 'chat'
  const setTab = (t: Tab) => setSearchParams(t === 'chat' ? {} : { tab: t }, { replace: true })
  const [shareTab, setShareTab] = useState<'received' | 'sent'>('received')

  const [connections, setConnections] = useState<Connection[]>([])
  const [shares, setShares] = useState<Share[]>([])
  const [images, setImages] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openShare, setOpenShare] = useState<Share | null>(null)

  const load = useCallback(async () => {
    try {
      const [conns, sh] = await Promise.all([listConnections(), listShares()])
      // Anything waiting on an Undo toast is still in the database; keep it hidden.
      setConnections(conns.filter((c) => !isPendingDelete(`friends:conn:${c.id}`)))
      setShares(sh.filter((s) => !isPendingDelete(`friends:share:${s.id}`)))
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
  const chatWith = (location.state as { chatWith?: string } | null)?.chatWith

  // Opening the inbox marks everything in it as seen (the "New" tags stay until next visit).
  useEffect(() => {
    if (tab !== 'add' || unseen.length === 0 || shareTab !== 'received') return
    markSharesSeen(unseen.map((s) => s.id))
      .then(notifyChanged)
      .catch(() => {})
  }, [tab, shareTab, unseen.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      await load()
      notifyChanged()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Hides the row now and only touches the database once the Undo toast closes.
  const removeWithUndo = (message: string, key: string, hide: () => void, run: () => Promise<unknown>) =>
    deleteWithUndo({
      message,
      keys: [key],
      remove: hide,
      restore: () => { load() },
      commit: async () => {
        try {
          await run()
          notifyChanged()
        } catch (err) {
          setError((err as Error).message)
          notify('That didn’t go through, so it’s been put back.')
          throw err
        } finally {
          await load()
        }
      },
    })

  const removeConnectionWithUndo = (c: Connection, message: string, run: () => Promise<unknown>) =>
    removeWithUndo(message, `friends:conn:${c.id}`, () => setConnections((prev) => prev.filter((x) => x.id !== c.id)), run)

  const tabs: [Tab, string, number][] = [['chat', 'Chat', 0], ['add', 'Add friends', incoming.length]]

  return (
    <div className="min-h-screen bg-warm-cream pt-16 lg:pt-20 pb-28 md:pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="pt-12 lg:pt-12 pb-6">
          <h1 className="font-display text-4xl lg:text-6xl font-medium text-text-primary leading-none">Friends</h1>
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
        ) : tab === 'chat' ? <FriendsChat key={chatWith ?? 'inbox'} friends={friends} myId={user?.id ?? ''} initialFriendId={chatWith} shares={shares} images={images} onOpenShare={setOpenShare} onRefresh={load} /> : <>
          <FriendsTab myId={user?.id ?? ''} incoming={incoming} outgoing={outgoing} friends={friends} shares={shares} onAct={act} onRemove={removeConnectionWithUndo} />
          <div className="mt-10">
            <div className="mb-4 flex gap-5 border-b border-text-primary/10"><button onClick={() => setShareTab('received')} className={clsx('pb-2 text-xs uppercase tracking-widest', shareTab === 'received' ? 'border-b border-text-primary text-text-primary' : 'text-text-muted')}>Received {unseen.length > 0 && `(${unseen.length})`}</button><button onClick={() => setShareTab('sent')} className={clsx('pb-2 text-xs uppercase tracking-widest', shareTab === 'sent' ? 'border-b border-text-primary text-text-primary' : 'text-text-muted')}>Sent</button></div>
            <ShareGrid shares={shareTab === 'received' ? received : sent} images={images} emptyTitle={shareTab === 'received' ? 'Nothing shared with you yet' : 'You haven’t shared anything yet'} emptyBody={shareTab === 'received' ? 'Pieces and outfits friends send you will appear here.' : 'Share a piece or outfit from your Kloset.'} onOpen={setOpenShare} />
          </div>
        </>}
      </div>

      <ShareDetail
        share={openShare}
        images={images}
        onClose={() => setOpenShare(null)}
        onDelete={(s) => {
          setOpenShare(null)
          removeWithUndo(
            `Removed ${s.payload.title}`,
            `friends:share:${s.id}`,
            () => setShares((prev) => prev.filter((x) => x.id !== s.id)),
            () => deleteShare(s.id)
          )
        }}
      />
    </div>
  )
}

function FriendsChat({ friends, myId, initialFriendId, shares, images, onOpenShare, onRefresh }: {
  friends: Connection[]
  myId: string
  initialFriendId?: string
  shares: Share[]
  images: Record<string, string>
  onOpenShare: (share: Share) => void
  onRefresh: () => Promise<void>
}) {
  const [activeId, setActiveId] = useState(initialFriendId ?? friends[0]?.otherId ?? '')
  const [mobileConversationOpen, setMobileConversationOpen] = useState(Boolean(initialFriendId))
  const [messages, setMessages] = useState<FriendMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const draftRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const activeFriend = friends.find((friend) => friend.otherId === activeId)

  useEffect(() => {
    if (!friends.some((friend) => friend.otherId === activeId)) {
      setActiveId(friends[0]?.otherId ?? '')
      setMobileConversationOpen(false)
    }
  }, [friends, activeId])

  const loadMessages = useCallback(async () => {
    if (!activeId || !myId) { setMessages([]); return }
    try {
      const rows = await listFriendMessages(activeId, myId)
      setMessages(rows)
      setError('')
    } catch (err) { setError((err as Error).message) }
  }, [activeId, myId])

  useEffect(() => {
    if (!activeId) return
    setLoadingMessages(true)
    void loadMessages().finally(() => setLoadingMessages(false))
    const timer = window.setInterval(() => { void loadMessages(); void onRefresh() }, 6000)
    return () => window.clearInterval(timer)
  }, [activeId, loadMessages, onRefresh])

  // The list scrolls inside a fixed-height chat. Follow new messages unless the reader has scrolled up to look back.
  useEffect(() => { stickToBottom.current = true }, [activeId])
  useEffect(() => {
    const el = listRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages, loadingMessages, activeId])

  const insertEmoji = (emoji: string) => {
    const input = draftRef.current
    const start = input?.selectionStart ?? draft.length
    const end = input?.selectionEnd ?? draft.length
    setDraft((d) => (d.slice(0, start) + emoji + d.slice(end)).slice(0, 2000))
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + emoji.length, start + emoji.length) })
  }

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !activeId || sending) return
    setSending(true)
    try {
      stickToBottom.current = true
      await sendFriendMessage(activeId, myId, body)
      setDraft('')
      setEmojiOpen(false)
      await loadMessages()
    } catch (err) { setError((err as Error).message) }
    finally { setSending(false) }
  }

  const sendPhotos = async (files: File[]) => {
    if (!files.length || !activeId || !myId || uploadingPhoto) return
    const images = files.filter((f) => f.type.startsWith('image/')).slice(0, MAX_PHOTOS_PER_SEND)
    if (!images.length) { setError('Choose an image to share.'); return }
    if (files.length > MAX_PHOTOS_PER_SEND) setError(`Only the first ${MAX_PHOTOS_PER_SEND} photos were sent.`)
    else setError('')
    setUploadingPhoto(true)
    stickToBottom.current = true
    try {
      for (const file of images) {
        // Resize + re-encode first so a 10 MB camera shot doesn't cost 10 MB of data on both phones.
        const imageUrl = await readFileAsDataUrl(await compressImage(file))
        const now = new Date().toISOString()
        const item: ClothingItem = {
          id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, '') || 'Photo from chat', category: 'tops',
          imageUrl, imageSource: 'local', colour: [], pattern: 'other', seasons: [], occasions: [],
          isFavourite: false, timesWorn: 0, createdAt: now, updatedAt: now,
        }
        const ids = await sendShare({ kind: 'item', item }, [activeId], myId, '')
        await sendFriendMessage(activeId, myId, `[[KLOSET_SHARE:${ids[0]}]]`)
      }
      await onRefresh()
      await loadMessages()
      window.dispatchEvent(new Event(FRIENDS_CHANGED_EVENT))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploadingPhoto(false)
    }
  }

  return <section className="grid h-[min(80vh,56rem)] grid-rows-[minmax(0,1fr)] overflow-hidden border border-text-primary/10 bg-surface md:grid-cols-[17rem_minmax(0,1fr)] md:rounded-2xl">
    <aside className={clsx('min-h-0 flex-col border-b border-text-primary/10 md:border-b-0 md:border-r', mobileConversationOpen ? 'hidden md:flex' : 'flex')}>
      <header className="flex shrink-0 items-center justify-between border-b border-text-primary/10 px-4 py-4">
        <h2 className="font-display text-2xl text-text-primary">Messages</h2>
        <span className="text-xs text-text-muted">{friends.length}</span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {friends.length ? friends.map((friend) => <button key={friend.id} onClick={() => { setActiveId(friend.otherId); setMobileConversationOpen(true) }} className={clsx('flex w-full items-center gap-3 border-b border-text-primary/5 px-4 py-3.5 text-left transition-colors', activeId === friend.otherId ? 'bg-text-primary/5' : 'hover:bg-text-primary/[0.03]')}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-butter-yellow/50 font-display text-text-primary">{friend.otherName.charAt(0).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-medium text-text-primary">{friend.otherName}</span><span className="block truncate text-xs text-text-muted">{friend.otherEmail}</span></span>
      </button>) : <p className="px-4 py-3 text-sm text-text-muted">Add a friend to start chatting.</p>}
      </div>
    </aside>
    <div className={clsx('min-h-0 min-w-0 flex-col', mobileConversationOpen ? 'flex' : 'hidden md:flex')}>
      {activeFriend ? <>
        <header className="flex shrink-0 items-center gap-3 border-b border-text-primary/10 px-4 py-3.5 sm:px-5">
          <button type="button" onClick={() => setMobileConversationOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-text-primary hover:bg-text-primary/5 md:hidden" aria-label="Back to messages"><ArrowLeft size={19}/></button>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-butter-yellow/50 font-display text-text-primary">{activeFriend.otherName.charAt(0).toUpperCase()}</span>
          <div className="min-w-0"><p className="truncate font-medium text-text-primary">{activeFriend.otherName}</p><p className="truncate text-xs text-text-muted">{activeFriend.otherEmail}</p></div>
        </header>
        {error && <p role="alert" className="mx-4 mt-3 text-xs text-red-700">{error}</p>}
        <div ref={listRef} onScroll={(e) => { const el = e.currentTarget; stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5" aria-live="polite">
          {loadingMessages ? <p className="m-auto text-sm text-text-muted">Loading messages…</p> : messages.length ? messages.map((message) => {
            const sharedId = message.body.match(/^\[\[KLOSET_SHARE:([^\]]+)\]\]$/)?.[1]
            const shared = sharedId ? shares.find((share) => share.id === sharedId) : null
            return <div key={message.id} className={clsx('max-w-[88%] shrink-0 rounded-2xl px-3 py-3 text-sm sm:max-w-[75%]', message.senderId === myId ? 'ml-auto bg-text-primary text-warm-cream' : 'mr-auto bg-text-primary/5 text-text-primary')}>
              {shared ? <button type="button" onClick={() => onOpenShare(shared)} className="block w-56 max-w-full overflow-hidden rounded-xl bg-surface text-left text-text-primary sm:w-64">
                <div className={clsx('grid aspect-[4/5] gap-px overflow-hidden bg-text-primary/10', shared.payload.pieces.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                  {shared.payload.pieces.slice(0, 4).map((piece, index) => <PieceImage key={`${shared.id}-${index}`} piece={piece} images={images} glyphSize={28} />)}
                </div>
                <div className="px-3 py-2.5"><p className="truncate font-medium">{shared.payload.title}</p><p className="mt-0.5 text-xs text-text-muted">{shared.kind === 'outfit' ? 'Outfit' : 'Photo'} · tap to view</p>{shared.message && <p className="mt-1 text-xs text-text-muted">{shared.message}</p>}</div>
              </button> : sharedId ? <p className="text-xs opacity-75">Shared an outfit</p> : <p className="whitespace-pre-wrap break-words">{message.body}</p>}
              <time className="mt-1 block text-right text-[10px] opacity-65">{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
            </div>
          }) : <div className="m-auto max-w-xs text-center"><MessageCircle size={24} className="mx-auto mb-3 text-text-muted/50"/><p className="text-sm text-text-muted">No messages yet. Say hello to {activeFriend.otherName}.</p></div>}
        </div>
        <form onSubmit={send} className="relative flex shrink-0 items-center gap-1.5 border-t border-text-primary/10 p-3 sm:gap-2 sm:p-4">
          <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { void sendPhotos(Array.from(event.target.files ?? [])); event.currentTarget.value = '' }} />
          <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto || sending} aria-label="Attach photos" title="Attach photos" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-primary hover:bg-text-primary/5 disabled:opacity-40"><ImagePlus size={20}/></button>
          <button type="button" onClick={() => setEmojiOpen((o) => !o)} aria-label="Add an emoji" aria-expanded={emojiOpen} title="Emoji" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-primary hover:bg-text-primary/5"><Smile size={20}/></button>
          {emojiOpen && <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />}
          <input ref={draftRef} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder="Message…" aria-label="Message" className="min-w-0 flex-1 rounded-full border border-text-primary/15 bg-transparent px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-text-primary/30"/>
          <button disabled={!draft.trim() || sending || uploadingPhoto} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-text-primary text-warm-cream disabled:opacity-40"><Send size={16}/></button>
          {uploadingPhoto && <span className="sr-only">Uploading photo…</span>}
        </form>
      </> : <div className="m-auto px-6 py-10 text-center"><MessageCircle size={28} className="mx-auto mb-3 text-text-muted/50"/><p className="font-display text-xl text-text-primary">Your chats</p><p className="mt-2 text-sm text-text-muted">Choose a friend or add someone to start a conversation.</p></div>}
    </div>
  </section>
}

const MAX_PHOTOS_PER_SEND = 5

const EMOJIS = ['😀','😂','🥹','😍','🥰','😘','😎','🤩','🤔','😅','😭','😮','🙌','👏','👍','🙏','🔥','✨','💖','💯','🎉','👗','👖','👕','🧥','👠','👟','👜','🕶️','💍','🧣','🧢','👀','💅','🛍️','🌸','☀️','🌙','❤️','🖤','🤍','💛','💚','💙']

/** A small emoji grid above the composer; closes on pick-outside or Escape. */
function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as Element).closest('[aria-label="Add an emoji"]')) onClose() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [onClose])
  return (
    <div ref={ref} role="dialog" aria-label="Emoji" className="absolute bottom-full left-3 z-20 mb-2 grid w-72 max-w-[calc(100%-1.5rem)] grid-cols-8 gap-0.5 rounded-2xl border border-text-primary/10 bg-surface p-2 shadow-lifted sm:left-4">
      {EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => onPick(emoji)} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-text-primary/5">{emoji}</button>)}
    </div>
  )
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read this photo.'))
    reader.onerror = () => reject(new Error('Could not read this photo.'))
    reader.readAsDataURL(file)
  })
}

// ─── Friends tab ──────────────────────────────────────────────────────────────

function FriendsTab({
  myId,
  incoming,
  outgoing,
  friends,
  shares,
  onAct,
  onRemove,
}: {
  myId: string
  incoming: Connection[]
  outgoing: Connection[]
  friends: Connection[]
  shares: Share[]
  onAct: (fn: () => Promise<unknown>) => Promise<void>
  onRemove: (c: Connection, message: string, run: () => Promise<unknown>) => void
}) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null)
  const selectedFriend = friends.find((friend) => friend.otherId === selectedFriendId) ?? null
  const friendShares = selectedFriend ? shares.filter((share) => share.kind === 'outfit' && share.otherId === selectedFriend.otherId) : []
  const sentOutfits = friendShares.filter((share) => share.direction === 'sent').length
  const receivedOutfits = friendShares.filter((share) => share.direction === 'received').length

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
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.15fr)]">
      <aside className="self-start">
        <PeopleSection title="Your friends">
          {friends.length === 0 ? <p className="py-4 text-sm text-text-muted">No friends yet. Add someone to start a chat.</p> : friends.map((c) => (
            <PersonRow key={c.id} person={c} onSelect={() => setSelectedFriendId(c.otherId)} selected={selectedFriendId === c.otherId}>
              <span className="sr-only">Friend details</span>
            </PersonRow>
          ))}
        </PeopleSection>
        {selectedFriend && (
          <section className="mt-5 border border-text-primary/10 bg-surface p-4 sm:p-5" aria-label={`${selectedFriend.otherName} friendship details`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-xl text-text-primary">{selectedFriend.otherName}</h3>
                <p className="mt-1 text-xs text-text-muted">Friends since {new Date(selectedFriend.respondedAt ?? selectedFriend.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${selectedFriend.otherName} as a friend`}
                title="Remove friend"
                onClick={() => onRemove(selectedFriend, `Removed ${selectedFriend.otherName} from your friends`, () => removeConnection(selectedFriend.id))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 size={16} strokeWidth={1.6} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-text-primary/10 pt-4">
              <div><p className="font-display text-2xl text-text-primary">{sentOutfits}</p><p className="text-xs text-text-muted">Outfits sent</p></div>
              <div><p className="font-display text-2xl text-text-primary">{receivedOutfits}</p><p className="text-xs text-text-muted">Outfits received</p></div>
            </div>
          </section>
        )}
      </aside>

      <div className="space-y-8">
        <section className="w-full max-w-2xl border border-text-primary/10 bg-surface p-4 sm:p-5">
        <h2 className="font-display text-2xl text-text-primary">Add a friend</h2>
        <p className="mt-1 text-sm text-text-muted">Enter the email they use for Kloset.</p>
        <form onSubmit={handleAdd} className="mt-4 flex items-end gap-2">
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
        </section>

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
                  onClick={() => onRemove(c, `Declined ${c.otherName}`, () => respondToRequest(c.id, false))}
                  className="h-9 px-4 text-2xs uppercase tracking-widest text-text-muted hover:text-text-primary"
                >
                  Decline
                </button>
              </PersonRow>
            ))}
          </PeopleSection>
        )}

        {outgoing.length > 0 && (
          <PeopleSection title="Waiting to accept">
            {outgoing.map((c) => (
              <PersonRow key={c.id} person={c} meta={`Sent ${timeAgo(c.createdAt)}`}>
                <button
                  onClick={() => onRemove(c, `Cancelled request to ${c.otherName}`, () => removeConnection(c.id))}
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

function PersonRow({ person, meta, children, onSelect, selected = false }: { person: Connection; meta?: string; children: React.ReactNode; onSelect?: () => void; selected?: boolean }) {
  return (
    <li className={clsx('flex items-center gap-3 py-4', selected && 'bg-text-primary/[0.025]')}>
      <Monogram name={person.otherName} size="lg" />
      <div className="flex-1 min-w-0">
        {onSelect ? <button type="button" onClick={onSelect} className="block max-w-full truncate text-left text-base text-text-primary capitalize hover:underline">{person.otherName}</button> : <p className="text-base text-text-primary truncate capitalize">{person.otherName}</p>}
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
          {s.kind === 'item' && <p className="text-2xs uppercase tracking-widest text-text-muted mt-3.5">Piece</p>}
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
            onClick={() => onDelete(share)}
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
