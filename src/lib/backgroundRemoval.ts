import { apiUrl } from './apiUrl'

let removerPromise: Promise<(image: string) => Promise<Blob>> | null = null

/**
 * Remove the background from a wardrobe photo in the user's browser.
 * The image itself is never sent to the model host; only the model files are
 * downloaded on first use and cached by the browser.
 */
async function removeImageBackgroundLocally(image: Blob): Promise<Blob> {
  if (!removerPromise) {
    removerPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers')
      const removeBackground = await pipeline(
        'background-removal',
        'onnx-community/ormbg-ONNX',
        { dtype: 'q8' },
      )

      return async (imageUrl: string) => {
        const result = await removeBackground(imageUrl)
        const transparentPng = await result.toBlob('image/png')
        if (!transparentPng || transparentPng.type !== 'image/png') {
          throw new Error('Background removal did not return a transparent PNG.')
        }
        return transparentPng
      }
    })().catch((error) => {
      // Let a later upload retry model initialization after a transient failure.
      removerPromise = null
      throw error
    })
  }

  const removeBackground = await removerPromise
  const imageUrl = URL.createObjectURL(image)
  try {
    return await removeBackground(imageUrl)
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      if (comma < 0) reject(new Error('Could not read the image.'))
      else resolve(result.slice(comma + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image.'))
    reader.readAsDataURL(blob)
  })
}

async function postImage(path: string, image: Blob, fallbackType: string): Promise<Blob> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData: await blobToBase64(image), mediaType: image.type || fallbackType }),
  })
  if (!response.ok) throw new Error(`PhotoRoom returned ${response.status}`)

  const result = await response.json() as { imageData?: string; mediaType?: string }
  if (!result.imageData) throw new Error('PhotoRoom returned no image.')
  const bytes = Uint8Array.from(atob(result.imageData), (character) => character.charCodeAt(0))
  return new Blob([bytes], { type: result.mediaType || 'image/png' })
}

/** Use PhotoRoom to clean up a garment mask; null means use the original mask. */
export async function refineGarmentImage(image: Blob): Promise<Blob | null> {
  try {
    return await postImage('/api/refine-garment-image', image, 'image/png')
  } catch {
    return null
  }
}

/** Prefer the server-side PhotoRoom API; fall back to the on-device model. */
export async function removeImageBackground(image: Blob): Promise<Blob> {
  try {
    return await postImage('/api/remove-background', image, 'image/jpeg')
  } catch (error) {
    console.warn('[backgroundRemoval] PhotoRoom unavailable; using on-device removal.', error)
    return removeImageBackgroundLocally(image)
  }
}
