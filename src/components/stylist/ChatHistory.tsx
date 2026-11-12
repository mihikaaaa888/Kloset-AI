import { Plus, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useChatStore, type Conversation } from '@/store/chatStore'
import { deleteWithUndo } from '@/store/undoStore'

const DAY = 24 * 60 * 60 * 1000

function groupLabel(updatedAt: number): string {
  const startOfToday = new Date().setHours(0, 0, 0, 0)
  if (updatedAt >= startOfToday) return 'Today'
  if (updatedAt >= startOfToday - DAY) return 'Yesterday'
  if (updatedAt >= startOfToday - 7 * DAY) return 'Previous 7 days'
  return 'Older'
}

/** The saved-conversations list: a New chat button, then past chats grouped by day. */
export function ChatHistory({ onPick, className }: { onPick?: () => void; className?: string }) {
  const ownerId = useChatStore((s) => s.ownerId)
  const activeId = useChatStore((s) => s.activeId)
  const conversations = useChatStore((s) => s.conversations)
  const newChat = useChatStore((s) => s.newChat)
  const openChat = useChatStore((s) => s.openChat)

  const mine = conversations.filter((c) => c.ownerId === ownerId)
  const groups = new Map<string, Conversation[]>()
  for (const c of mine) groups.set(groupLabel(c.updatedAt), [...(groups.get(groupLabel(c.updatedAt)) ?? []), c])

  const remove = (c: Conversation) => deleteWithUndo({
    message: 'Chat deleted',
    remove: () => useChatStore.getState().deleteChat(c.id),
    restore: () => useChatStore.setState((s) => ({ conversations: [c, ...s.conversations.filter((x) => x.id !== c.id)].sort((a, b) => b.updatedAt - a.updatedAt) })),
  })

  return (
    <nav aria-label="Chat history" className={clsx('flex flex-col', className)}>
      <button
        type="button"
        onClick={() => { newChat(); onPick?.() }}
        aria-label="New chat"
        title="New chat"
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-text-primary/15 bg-surface text-text-primary transition-colors hover:border-text-primary/40"
      >
        <Plus size={18} />
      </button>

      <div className="-mr-2 flex-1 overflow-y-auto pr-2">
        {mine.length === 0 && <p className="px-1 text-xs leading-relaxed text-text-muted">Your past conversations with Kaia will show up here.</p>}
        {[...groups].map(([label, list]) => (
          <section key={label} className="mb-4">
            <h3 className="mb-1 px-2 text-2xs uppercase tracking-widest text-text-muted">{label}</h3>
            <ul>
              {list.map((c) => (
                <li key={c.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => { openChat(c.id); onPick?.() }}
                    aria-current={c.id === activeId ? 'true' : undefined}
                    title={c.title}
                    className={clsx(
                      'w-full truncate rounded-lg py-2 pl-2 pr-8 text-left text-sm transition-colors',
                      c.id === activeId ? 'bg-text-primary/8 text-text-primary' : 'text-text-muted hover:bg-text-primary/5 hover:text-text-primary'
                    )}
                  >
                    {c.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    aria-label={`Delete chat: ${c.title}`}
                    className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-text-muted opacity-0 transition-opacity hover:text-red-700 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  )
}
