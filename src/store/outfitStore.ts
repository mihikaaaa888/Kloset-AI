import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Outfit } from '@/types'

interface OutfitStore {
  savedOutfits: Outfit[]
  trashedOutfits: Outfit[]
  currentOutfit: Outfit | null
  saveOutfit: (outfit: Outfit) => void
  trashOutfit: (id: string) => void
  restoreOutfit: (id: string) => void
  permanentlyDeleteOutfit: (id: string) => void
  pruneExpiredTrashedOutfits: () => void
  clearOutfits: () => void
  setCurrentOutfit: (outfit: Outfit | null) => void
  isOutfitSaved: (id: string) => boolean
}

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

function isWithinTrashRetention(outfit: Outfit): boolean {
  const trashedAt = Date.parse(outfit.trashedAt ?? '')
  return Number.isFinite(trashedAt) && Date.now() - trashedAt < TRASH_RETENTION_MS
}

export const useOutfitStore = create<OutfitStore>()(
  persist(
    (set, get) => ({
      savedOutfits: [],
      trashedOutfits: [],
      currentOutfit: null,

      saveOutfit: (outfit) =>
        set((state) => ({
          savedOutfits: [
            ...state.savedOutfits.filter((o) => o.id !== outfit.id),
            { ...outfit, isSaved: true, savedAt: new Date().toISOString() },
          ],
          trashedOutfits: state.trashedOutfits.filter((o) => o.id !== outfit.id),
        })),

      trashOutfit: (id) => set((state) => {
        const outfit = state.savedOutfits.find((item) => item.id === id)
        if (!outfit) return state
        return {
          savedOutfits: state.savedOutfits.filter((item) => item.id !== id),
          trashedOutfits: [{ ...outfit, trashedAt: new Date().toISOString() }, ...state.trashedOutfits.filter((item) => item.id !== id)],
        }
      }),

      restoreOutfit: (id) => set((state) => {
        const outfit = state.trashedOutfits.find((item) => item.id === id)
        if (!outfit) return state
        return {
          trashedOutfits: state.trashedOutfits.filter((item) => item.id !== id),
          savedOutfits: [...state.savedOutfits.filter((item) => item.id !== id), { ...outfit, isSaved: true }],
        }
      }),

      permanentlyDeleteOutfit: (id) => set((state) => ({
        trashedOutfits: state.trashedOutfits.filter((item) => item.id !== id),
      })),

      pruneExpiredTrashedOutfits: () => set((state) => {
        const trashedOutfits = state.trashedOutfits.filter(isWithinTrashRetention)
        return trashedOutfits.length === state.trashedOutfits.length ? state : { trashedOutfits }
      }),

      clearOutfits: () => set({ savedOutfits: [], trashedOutfits: [], currentOutfit: null }),

      setCurrentOutfit: (outfit) => set({ currentOutfit: outfit }),

      isOutfitSaved: (id) => get().savedOutfits.some((o) => o.id === id),
    }),
    {
      name: 'kloset-outfits',
      version: 1,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<OutfitStore>
        if (version < 1) {
          const migratedAt = new Date().toISOString()
          return {
            ...state,
            trashedOutfits: (state.trashedOutfits ?? []).map((outfit) => ({
              ...outfit,
              trashedAt: outfit.trashedAt ?? migratedAt,
            })),
          }
        }
        return state as OutfitStore
      },
      onRehydrateStorage: () => (state) => {
        state?.pruneExpiredTrashedOutfits()
      },
    }
  )
)
