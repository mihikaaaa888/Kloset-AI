import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage } from '@/lib/chatService'

interface ChatStore {
  messages: ChatMessage[]
  setMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void
  clear: () => void
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      messages: [],
      setMessages: (messages) =>
        set((state) => ({
          messages: typeof messages === 'function' ? messages(state.messages) : messages,
        })),
      clear: () => set({ messages: [] }),
    }),
    {
      name: 'kloset-chat',
      partialize: (state) => ({
        messages: state.messages.map(({ imagePreviewUrl: _preview, ...message }) => message),
      }),
    }
  )
)
