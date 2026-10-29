import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface KlosetCollection {
  id: string
  name: string
  /** Saved outfit IDs are references; an outfit can stay in Main and appear here too. */
  outfitIds: string[]
}

interface KlosetStore {
  collections: KlosetCollection[]
  activeCollectionId: string
  createCollection: (name: string) => string | null
  selectCollection: (id: string) => void
  addOutfits: (collectionId: string, outfitIds: string[]) => void
  removeOutfit: (collectionId: string, outfitId: string) => void
  deleteCollection: (id: string) => void
}

const MAIN_COLLECTION: KlosetCollection = { id: 'main', name: 'Main Kloset', outfitIds: [] }

export const useKlosetStore = create<KlosetStore>()(
  persist(
    (set) => ({
      collections: [MAIN_COLLECTION],
      activeCollectionId: 'main',

      createCollection: (rawName) => {
        const name = rawName.trim()
        if (!name) return null
        const id = crypto.randomUUID()
        set((state) => ({
          collections: [...state.collections, { id, name, outfitIds: [] }],
          activeCollectionId: id,
        }))
        return id
      },

      selectCollection: (activeCollectionId) => set({ activeCollectionId }),

      addOutfits: (collectionId, outfitIds) => set((state) => ({
        collections: state.collections.map((collection) => collection.id !== collectionId
          ? collection
          : { ...collection, outfitIds: [...new Set([...collection.outfitIds, ...outfitIds])] }),
      })),

      removeOutfit: (collectionId, outfitId) => set((state) => ({
        collections: state.collections.map((collection) => collection.id !== collectionId
          ? collection
          : { ...collection, outfitIds: collection.outfitIds.filter((id) => id !== outfitId) }),
      })),

      deleteCollection: (id) => set((state) => {
        if (id === 'main') return state
        const collections = state.collections.filter((collection) => collection.id !== id)
        return {
          collections,
          activeCollectionId: state.activeCollectionId === id ? 'main' : state.activeCollectionId,
        }
      }),
    }),
    {
      name: 'kloset-collections',
      merge: (persisted, current) => {
        const stored = persisted as Partial<KlosetStore> | undefined
        const collections = stored?.collections?.filter((collection) => collection.id !== 'main') ?? []
        return {
          ...current,
          ...stored,
          collections: [MAIN_COLLECTION, ...collections],
          activeCollectionId: stored?.activeCollectionId ?? 'main',
        }
      },
    },
  ),
)
