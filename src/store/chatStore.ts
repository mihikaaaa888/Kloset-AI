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
  const first = messages.find((m) => m.role === 'user')
  const text = first?.content.replace(/\s+/g, ' ').trim()
  if (text) return text.length > 48 ? `${text.slice(0, 48)}…` : text
  return first ? 'Outfit photo' : 'New chat'
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
