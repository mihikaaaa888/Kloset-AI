import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage } from '@/lib/chatService'

export interface Conversation {
  id: string
  ownerId: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
}

interface ChatStore {
  /** Saved conversations for every account used in this browser; the sidebar filters by owner. */
  conversations: Conversation[]
  /** Not persisted: a reload or a new login always starts on a blank chat. */
  ownerId: string | null
  activeId: string | null
  messages: ChatMessage[]
  setOwner: (ownerId: string | null) => void
  setMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void
  newChat: () => void
  openChat: (id: string) => void
  deleteChat: (id: string) => void
  /** Clears the open conversation (removes it from the history). */
  clear: () => void
}

const MAX_CONVERSATIONS = 50

function titleFor(messages: ChatMessage[]): string {
  const userMessages = messages.filter((message) => message.role === 'user')
  const allText = userMessages.map((message) => message.content).join(' ').replace(/\s+/g, ' ').trim()
  if (!allText) return userMessages.length ? 'Outfit check' : 'New chat'

  const topics: Array<[RegExp, string]> = [
    [/\bsmart[ -]casual\b/i, 'Smart casual outfit'],
    [/\bboard ?room\b/i, 'Boardroom outfit'],
    [/\bmeeting|client meeting|interview\b/i, 'Meeting outfit'],
    [/\bwedding|haldi|mehendi|sangeet|reception\b/i, 'Wedding outfit'],
    [/\bdate[ -]?night\b/i, 'Date night outfit'],
    [/\bdinner\b/i, 'Dinner outfit'],
    [/\bwork|office|corporate\b/i, 'Work outfit'],
    [/\bformal|black tie\b/i, 'Formal outfit'],
    [/\bweekend|cosy|cozy\b/i, 'Weekend outfit'],
    [/\btravel|trip|vacation\b/i, 'Travel outfit'],
    [/\bcollege|campus\b/i, 'Campus outfit'],
    [/\bcasual\b/i, 'Casual outfit'],
    [/\bwhat should i wear today|outfit for today|today's outfit\b/i, "Today's outfit"],
  ]
  const match = topics.find(([pattern]) => pattern.test(allText))
  if (match) return match[1]

  const firstPrompt = userMessages[0]?.content.replace(/\s+/g, ' ').trim()
  if (!firstPrompt) return 'Outfit check'
  const cleaned = firstPrompt
    .replace(/^(please\s+)?(help me|can you|could you|i need|i want to|style me|what should i wear)\s*/i, '')
    .replace(/[?.!,]+$/g, '')
    .trim()
  if (!cleaned) return 'Style advice'
  const title = cleaned.length > 36 ? `${cleaned.slice(0, 36).trimEnd()}…` : cleaned
  return title.charAt(0).toUpperCase() + title.slice(1)
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      ownerId: null,
      activeId: null,
      messages: [],

      setOwner: (ownerId) => {
        if (get().ownerId === ownerId) return
        set({ ownerId, activeId: null, messages: [] })
      },

      setMessages: (update) =>
        set((state) => {
          const messages = typeof update === 'function' ? update(state.messages) : update
          // Nothing to save until there's a message, and nobody to save it for while signed out.
          if (!messages.length || !state.ownerId) return { messages }
          const id = state.activeId ?? crypto.randomUUID()
          const conversation: Conversation = { id, ownerId: state.ownerId, title: titleFor(messages), updatedAt: Date.now(), messages }
          return {
            messages,
            activeId: id,
            conversations: [conversation, ...state.conversations.filter((c) => c.id !== id)].slice(0, MAX_CONVERSATIONS),
          }
        }),

      newChat: () => set({ activeId: null, messages: [] }),

      openChat: (id) => {
        const conversation = get().conversations.find((c) => c.id === id && c.ownerId === get().ownerId)
        if (conversation) set({ activeId: id, messages: conversation.messages })
      },

      deleteChat: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          ...(state.activeId === id ? { activeId: null, messages: [] } : {}),
        })),

      clear: () => get().deleteChat(get().activeId ?? ''),
    }),
    {
      name: 'kloset-chat',
      // Photo previews are blob URLs that die with the page.
      partialize: (state) => ({
        conversations: state.conversations.map((c) => ({
          ...c,
          messages: c.messages.map(({ imagePreviewUrl: _preview, imagePreviewUrls: _previews, ...message }) => message),
        })),
      }),
      // Older builds stored a single `messages` list under this key; don't load it as the open chat.
      merge: (persisted, current) => ({ ...current, conversations: (persisted as Partial<ChatStore> | undefined)?.conversations ?? [] }),
    }
  )
)
