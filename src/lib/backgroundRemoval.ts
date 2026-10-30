import { apiUrl } from './apiUrl'

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

// Set once the server says PhotoRoom has no key, so later photos skip the doomed request.
let photoRoomUnconfigured = false

/** Send an image to the server's PhotoRoom endpoint; throws with a reason a person can read. */
async function callPhotoRoom(image: Blob): Promise<Blob> {
  if (photoRoomUnconfigured) throw new Error('PhotoRoom isn’t set up on the server.')
  let response: Response
  try {
    response = await fetch(apiUrl('/api/remove-background'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData: await blobToBase64(image), mediaType: image.type || 'image/png' }),
    })
  } catch {
    throw new Error('couldn’t reach the server')
  }
  if (response.status === 503) {
    photoRoomUnconfigured = true
    throw new Error('PhotoRoom isn’t set up on the server.')
  }
  const result = await response.json().catch(() => ({})) as { imageData?: string; mediaType?: string; error?: string }
  if (!response.ok || !result.imageData) throw new Error(result.error ?? 'PhotoRoom returned no image.')

  const bytes = Uint8Array.from(atob(result.imageData), (character) => character.charCodeAt(0))
  return new Blob([bytes], { type: result.mediaType || 'image/png' })
}

/** Remove a photo's background through PhotoRoom (the server holds the key). Throws if it can't. */
export const removeImageBackground = callPhotoRoom
