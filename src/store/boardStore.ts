import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ClothingCategory } from '@/types'

/** A piece pinned to the Build board. Position and size are fractions of the board, so it survives resizing. */
export interface BoardPiece {
  id: string
  /** Wardrobe item id, `shop-<url>` for a live shop piece, or `pexels-<id>` for an inspiration photo. */
  itemId: string
  source: 'kloset' | 'shop' | 'inspiration'
  name: string
  category: ClothingCategory
  /** Null for Kloset photos that live in IndexedDB; those resolve through the wardrobe item. */
  imageUrl: string | null
  colour: string[]
  catalogId?: string
  x: number
  y: number
  w: number
  rotation: number
  z: number
}

interface BoardStore {
  pieces: BoardPiece[]
  setPieces: (pieces: BoardPiece[]) => void
}

export const useBoardStore = create<BoardStore>()(
  persist(
    (set) => ({
      pieces: [],
      setPieces: (pieces) => set({ pieces }),
    }),
    { name: 'kloset-board' }
  )
)
