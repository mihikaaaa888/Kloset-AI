import { analyzeImage, analyzeImageFromUrl, type ClothingAnalysis } from '@/lib/analyzeImage'
import { getImage } from '@/lib/imageStorage'
import { isSamplePiece } from '@/lib/sampleData'
import { getPhotoUrl } from '@/lib/wardrobeService'
import { useWardrobeStore } from '@/store/wardrobeStore'
import type { ClothingItem } from '@/types'

// Pieces saved while photo tagging was down have a name and nothing else (no
// type, fabric or formality), so outfits can't tell brown jeans from
// trousers. ReviewPieces walks through them with suggested tags.

/** A piece with a photo but none of the details outfits rely on. */
export function isUntagged(item: ClothingItem): boolean {
  if (isSamplePiece(item)) return false
  if (!item.imageId && !item.imageStoragePath && !item.imageUrl) return false
  return !item.subcategory && !item.material && !item.formality
}

// Draws an image the page can show onto a canvas to get its bytes. A plain
// fetch of a data: URL is blocked by the site's Content-Security-Policy.
async function imageToBlob(src: string): Promise<Blob | null> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = src
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext('2d')?.drawImage(img, 0, 0)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
}

export async function analyzePiece(item: ClothingItem): Promise<ClothingAnalysis> {
  const local = item.imageId ? await getImage(item.imageId).catch(() => null) : null
  if (local) return analyzeImage(local)
  const stored = item.imageStoragePath ? await getPhotoUrl(item.imageStoragePath) : null
  if (stored) {
    const blob = await imageToBlob(stored)
    if (blob) return analyzeImage(blob)
  }
  if (item.imageUrl?.startsWith('data:')) {
    const blob = await imageToBlob(item.imageUrl)
    if (blob) return analyzeImage(blob)
  }
  if (item.imageUrl?.startsWith('http')) return analyzeImageFromUrl(item.imageUrl)
  throw new Error('No photo to read')
}

/** The pieces that still need a review (see ReviewPieces). */
export function useRetagPieces() {
  const items = useWardrobeStore((state) => state.items)
  return { untagged: items.filter(isUntagged) }
}
