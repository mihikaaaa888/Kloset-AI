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
  clearOutfits: () => void
  setCurrentOutfit: (outfit: Outfit | null) => void
  isOutfitSaved: (id: string) => boolean
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
          trashedOutfits: [outfit, ...state.trashedOutfits.filter((item) => item.id !== id)],
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

      clearOutfits: () => set({ savedOutfits: [], trashedOutfits: [], currentOutfit: null }),

      setCurrentOutfit: (outfit) => set({ currentOutfit: outfit }),

      isOutfitSaved: (id) => get().savedOutfits.some((o) => o.id === id),
    }),
    { name: 'kloset-outfits' }
  )
)
