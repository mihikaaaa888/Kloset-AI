import { useCallback, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { buildSampleKloset, findSamplePhoto, isSamplePiece } from '@/lib/sampleData'
import { deleteItem, insertItem, updateItem as saveItem } from '@/lib/wardrobeService'
import { useUserStore } from '@/store/userStore'
import { useWardrobeStore } from '@/store/wardrobeStore'
import type { ClothingItem } from '@/types'

/**
 * Load or remove the sample Kloset. Loading adds the basics for this person
 * right away, then fills in stock photos for pieces that need one.
 */
export function useSampleKloset() {
  const { user } = useAuth()
  const profile = useUserStore((state) => state.profile)
  const items = useWardrobeStore((state) => state.items)
  const [loading, setLoading] = useState(false)
  const samples = items.filter(isSamplePiece)

  const load = useCallback(async (): Promise<ClothingItem[]> => {
    const { items: current, addItem, updateItem } = useWardrobeStore.getState()
    const pieces = buildSampleKloset(profile, current)
    console.log('[sample] loading', pieces.length, 'sample pieces')
    // Saved first, so a photo found later updates a row that exists.
    const saved = new Map<string, Promise<boolean>>()
    for (const piece of pieces) {
      addItem(piece)
      if (user) saved.set(piece.id, insertItem(user.id, piece).then(() => true, (error) => { console.error('[sample] save failed', piece.name, error); return false }))
    }
    const needPhotos = pieces.filter((piece) => !piece.imageUrl)
    if (needPhotos.length) {
      setLoading(true)
      await Promise.all(needPhotos.map(async (piece) => {
        const imageUrl = await findSamplePhoto(piece)
        if (!imageUrl) return
        const updated: ClothingItem = { ...piece, imageUrl, imageSource: 'remote' }
        updateItem(piece.id, { imageUrl, imageSource: 'remote' })
        if (user && await saved.get(piece.id)) await saveItem(user.id, updated).catch((error) => console.error('[sample] photo save failed', piece.name, error))
      }))
      setLoading(false)
    }
    return pieces
  }, [profile, user])

  const remove = useCallback(() => {
    const { items: current, removeItem } = useWardrobeStore.getState()
    const toRemove = current.filter(isSamplePiece)
    console.log('[sample] removing', toRemove.length, 'sample pieces')
    for (const piece of toRemove) {
      removeItem(piece.id)
      if (user) deleteItem(user.id, piece.id, piece.imageStoragePath).catch((error) => console.error('[sample] delete failed', piece.name, error))
    }
    return toRemove.length
  }, [user])

  return { samples, hasSamples: samples.length > 0, loading, load, remove }
}
