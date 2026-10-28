let removerPromise: Promise<(image: string) => Promise<Blob>> | null = null

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      if (comma < 0) reject(new Error('Could not read image.'))
      else resolve(result.slice(comma + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image.'))
    reader.readAsDataURL(blob)
  })
}

/** Use PhotoRoom to clean up a garment mask; null means use the original mask. */
export async function refineGarmentImage(image: Blob): Promise<Blob | null> {
  try {
    const response = await fetch('/api/refine-garment-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData: await blobToBase64(image), mediaType: image.type || 'image/png' }),
    })
    if (!response.ok) return null

    const result = await response.json() as { imageData?: string; mediaType?: string }
    if (!result.imageData) return null
    const bytes = Uint8Array.from(atob(result.imageData), (character) => character.charCodeAt(0))
    return new Blob([bytes], { type: result.mediaType || 'image/png' })
  } catch {
    return null
  }
}

/** Remove a photo's background locally in the browser. */
export async function removeImageBackground(image: Blob): Promise<Blob> {
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
