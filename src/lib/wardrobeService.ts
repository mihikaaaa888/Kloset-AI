import { supabase } from './supabase'
import type { ClothingItem } from '@/types'
import { getImage, replaceImage, toPortableDataUrl } from './imageStorage'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { removeImageBackground } from './backgroundRemoval'

type DbItem = {
  id: string
  user_id: string
  name: string
  category: string
  subcategory: string | null
  image_id: string | null
  image_url: string | null
  image_storage_path: string | null
  image_source: string
  colour: string[]
  material: string | null
  pattern: string | null
  fit: string | null
  formality: string | null
  seasons: string[]
  occasions: string[]
  brand: string | null
  notes: string | null
  is_favourite: boolean
  times_worn: number
  last_worn: string | null
  created_at: string
  updated_at: string
}

function toItem(row: DbItem): ClothingItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category as ClothingItem['category'],
    subcategory: row.subcategory ?? undefined,
    imageId: row.image_id ?? undefined,
    imageStoragePath: row.image_storage_path ?? undefined,
    imageUrl: row.image_url,
    imageSource: row.image_source as ClothingItem['imageSource'],
    colour: row.colour,
    material: row.material ?? undefined,
    pattern: (row.pattern ?? undefined) as ClothingItem['pattern'],
    fit: row.fit ?? undefined,
    formality: row.formality ?? undefined,
    seasons: row.seasons as ClothingItem['seasons'],
    occasions: row.occasions as ClothingItem['occasions'],
    brand: row.brand ?? undefined,
    notes: row.notes ?? undefined,
    isFavourite: row.is_favourite,
    timesWorn: row.times_worn,
    lastWorn: row.last_worn ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toRow(userId: string, item: ClothingItem): Omit<DbItem, 'user_id'> & { user_id: string } {
  return {
    id: item.id,
    user_id: userId,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory ?? null,
    image_id: item.imageId ?? null,
    image_url: item.imageUrl,
    image_storage_path: item.imageStoragePath ?? null,
    image_source: item.imageSource,
    colour: item.colour,
    material: item.material ?? null,
    pattern: item.pattern ?? null,
    fit: item.fit ?? null,
    formality: item.formality ?? null,
    seasons: item.seasons,
    occasions: item.occasions,
    brand: item.brand ?? null,
    notes: item.notes ?? null,
    is_favourite: item.isFavourite,
    times_worn: item.timesWorn,
    last_worn: item.lastWorn ?? null,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  }
}

/** The user's wardrobe, or null when the fetch failed (so callers don't mistake an error for an empty Kloset). */
export async function fetchWardrobe(userId: string): Promise<ClothingItem[] | null> {
  const { data, error } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error || !data) {
    console.error('[wardrobe] fetch failed', error?.message)
    return null
  }
  console.log('[wardrobe] fetched', data.length, 'items')
  return (data as DbItem[]).map(toItem)
}

// ─── Photos ─────────────────────────────────────────────────────────────────
// Photos are captured into this browser's IndexedDB. A copy goes to the private
// wardrobe-images bucket (supabase/wardrobe_photos.sql) so the phone can show
// pieces added on the laptop and vice versa. If that upload fails (bucket
// missing, policy error, flaky mobile network) a small PNG goes on the row
// itself as image_url, so the other device never ends up with a blank card.

const PHOTO_BUCKET = 'wardrobe-images'

function photoPath(userId: string, item: ClothingItem, contentType = 'image/jpeg'): string | null {
  if (!item.imageId) return null
<<<<<<< HEAD
  return `${userId}/${item.imageId}.${contentType === 'image/png' ? 'png' : 'jpg'}`
=======
  const extension = contentType === 'image/png' ? 'png' : 'jpg'
  return `${userId}/${item.imageId}.${extension}`
>>>>>>> 7c62c2527df94c605f8ce52db10495139f7ef55c
}

/** True when another device can't show this item's photo yet. */
function needsPhotoSync(item: ClothingItem): boolean {
  return !!item.imageId && !item.imageStoragePath && !item.imageUrl
}

/** Uploads the item's local photo if other devices can't see it yet. Returns the item to save. */
async function withUploadedPhoto(userId: string, item: ClothingItem): Promise<ClothingItem> {
  if (!needsPhotoSync(item)) return item
  const blob = await getImage(item.imageId!).catch(() => null)
  if (!blob) return item // Photo lives on another device; nothing to upload from here.
  const path = photoPath(userId, item, blob.type || 'image/jpeg')!

  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true })
  if (!error) {
    console.log('[wardrobe] photo uploaded', { itemId: item.id })
    useWardrobeStore.getState().updateItem(item.id, { imageStoragePath: path })
    return { ...item, imageStoragePath: path }
  }

  console.error('[wardrobe] photo upload failed, saving a small copy on the row instead — run supabase/wardrobe_photos.sql if the bucket is missing', error.message)
  const dataUrl = await toPortableDataUrl(blob)
  if (!dataUrl) return item
  useWardrobeStore.getState().updateItem(item.id, { imageUrl: dataUrl })
  return { ...item, imageUrl: dataUrl }
}

const signedUrlCache = new Map<string, Promise<string | null>>()

/** Signed URL for a stored photo, cached for the session (valid a day). */
export function getPhotoUrl(path: string): Promise<string | null> {
  let cached = signedUrlCache.get(path)
  if (!cached) {
    cached = supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24)
      .then(({ data, error }) => {
        if (error) {
          console.error('[wardrobe] photo url failed', path, error.message)
          signedUrlCache.delete(path)
          return null
        }
        return data.signedUrl
      })
    signedUrlCache.set(path, cached)
  }
  return cached
}

/**
 * Convert older user-uploaded photos (JPEGs) to transparent PNGs. PNG paths
 * mark completed items, so subsequent syncs skip them without database schema changes.
 */
export async function removeBackgroundsFromExistingPhotos(
  userId: string,
  items: ClothingItem[],
  onProgress: (done: number, total: number, failed: number) => void,
): Promise<void> {
  const candidates = items.filter((item) =>
    item.imageSource === 'local' &&
    !!item.imageId &&
    !(item.imageStoragePath?.toLowerCase().endsWith('.png') ||
      (!item.imageStoragePath && item.imageUrl?.startsWith('data:image/png')))
  )
  let done = 0
  let failed = 0

  for (const item of candidates) {
    try {
      let photo = await getImage(item.imageId!).catch(() => null)
      const oldPath = item.imageStoragePath
      if (!photo && oldPath) {
        const signedUrl = await getPhotoUrl(oldPath)
        if (signedUrl) {
          const response = await fetch(signedUrl)
          if (!response.ok) throw new Error(`Could not download the existing photo (${response.status}).`)
          photo = await response.blob()
        }
      }
      if (!photo && item.imageUrl?.startsWith('data:image/')) {
        photo = await fetch(item.imageUrl).then((response) => response.blob())
      }
      if (!photo) throw new Error('The existing photo is not available on this device or in storage.')

      // A local PNG may be left from an interrupted prior migration; reuse it.
      const transparentPng = photo.type === 'image/png' ? photo : await removeImageBackground(photo)
      await replaceImage(item.imageId!, transparentPng)

      const newPath = photoPath(userId, item, transparentPng.type)!
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(newPath, transparentPng, { contentType: 'image/png', upsert: true })

      let imageUrl: string | null = null
      let imageStoragePath: string | undefined = newPath
      if (uploadError) {
        imageUrl = await toPortableDataUrl(transparentPng)
        if (!imageUrl) throw new Error(`Photo sync failed: ${uploadError.message}`)
        imageStoragePath = undefined
      }

      const { error: rowError } = await supabase
        .from('wardrobe_items')
        .update({
          image_storage_path: imageStoragePath ?? null,
          image_url: imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .eq('user_id', userId)
      if (rowError) throw new Error(`Could not save the updated photo: ${rowError.message}`)

      useWardrobeStore.getState().updateItem(item.id, { imageStoragePath, imageUrl })
      if (oldPath && oldPath !== imageStoragePath) {
        signedUrlCache.delete(oldPath)
        await supabase.storage.from(PHOTO_BUCKET).remove([oldPath])
      }
    } catch (error) {
      failed++
      console.warn('[wardrobe] existing photo background removal failed', item.id, error)
    }
    done++
    onProgress(done, candidates.length, failed)
  }
}

/** Uploads photos this device has that other devices can't see — heals items whose upload failed. */
export async function backfillPhotos(userId: string, items: ClothingItem[]): Promise<void> {
  const pending = items.filter((i) => needsPhotoSync(i))
  if (pending.length === 0) return
  console.log('[wardrobe] checking', pending.length, 'photos for upload')
  for (const item of pending) {
    const saved = await withUploadedPhoto(userId, item)
    if (saved === item) continue
    const { error } = await supabase
      .from('wardrobe_items')
      .update({ image_storage_path: saved.imageStoragePath ?? null, image_url: saved.imageUrl })
      .eq('id', item.id)
      .eq('user_id', userId)
    if (error) console.error('[wardrobe] saving photo path failed', item.id, error.message)
  }
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function insertItem(userId: string, item: ClothingItem): Promise<void> {
  const saved = await withUploadedPhoto(userId, item)
  const { error } = await supabase.from('wardrobe_items').insert(toRow(userId, saved))
  if (error) {
    console.error('[wardrobe] insert failed', item.id, error.message)
    throw new Error(error.message)
  }
  console.log('[wardrobe] item saved', item.id)
}

export async function updateItem(userId: string, item: ClothingItem): Promise<void> {
  const saved = await withUploadedPhoto(userId, item)
  const { id, user_id: _uid, created_at: _ca, ...updates } = toRow(userId, saved)
  const { error } = await supabase
    .from('wardrobe_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) {
    console.error('[wardrobe] update failed', item.id, error.message)
    throw new Error(error.message)
  }
  console.log('[wardrobe] item updated', item.id)
}

export async function deleteItem(userId: string, itemId: string, imageStoragePath?: string): Promise<void> {
  const { error } = await supabase
    .from('wardrobe_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId)
  if (error) {
    console.error('[wardrobe] delete failed', itemId, error.message)
    throw new Error(error.message)
  }
  console.log('[wardrobe] item deleted', itemId)
  if (imageStoragePath) {
    const { error: photoError } = await supabase.storage.from(PHOTO_BUCKET).remove([imageStoragePath])
    if (photoError) console.warn('[wardrobe] deleted item photo could not be removed', photoError.message)
    signedUrlCache.delete(imageStoragePath)
  }
}
