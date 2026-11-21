import { useState, useEffect } from 'react'
import { getImage } from '@/lib/imageStorage'
import { getPhotoUrl } from '@/lib/wardrobeService'
import type { ClothingItem } from '@/types'

/**
 * Resolves a displayable image URL for a ClothingItem.
 *
 * Priority:
 *   1. item.imageId  — photo taken on this device: loads the Blob from IndexedDB
 *   2. item.imageStoragePath — photo taken on another device, served from Supabase Storage
 *   3. item.imageUrl — remote photo (e.g. a shop find), legacy base64, or the small copy saved
 *                      when a photo couldn't be uploaded to Storage
 *   4. null          — no image; show placeholder
 *
 * Automatically revokes any created object URLs on unmount or item change.
 */
export function useItemImage(item: ClothingItem | null | undefined): string | null {
  // Seed state immediately so there's no placeholder flash while the full photo loads
  const [url, setUrl] = useState<string | null>(item?.imageUrl ?? null)

  useEffect(() => {
    if (!item) { setUrl(null); return }

    if (!item.imageId && !item.imageStoragePath) { setUrl(item.imageUrl ?? null); return }
    if (item.imageUrl) setUrl(item.imageUrl)

    let objectUrl: string | null = null
    let cancelled = false

    // Local copy first; a photo added on another device only exists in storage or on the row.
    const local = item.imageId ? getImage(item.imageId).catch(() => null) : Promise.resolve(null)
    local
      .then(async (blob) => {
        if (cancelled) return
        if (blob) {
          objectUrl = URL.createObjectURL(blob)
          setUrl(objectUrl)
          return
        }
        const remote = item.imageStoragePath ? await getPhotoUrl(item.imageStoragePath) : null
        if (!cancelled) setUrl(remote ?? item.imageUrl ?? null)
      })
      .catch(() => { if (!cancelled) setUrl(item.imageUrl ?? null) })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [item?.id, item?.imageId, item?.imageUrl, item?.imageStoragePath])

  return url
}
