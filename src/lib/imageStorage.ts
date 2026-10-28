/**
 * IndexedDB-based image storage service.
 *
 * Images are stored as Blobs keyed by a UUID string.
 * Only the UUID (imageId) is persisted in the Zustand/localStorage wardrobe store;
 * the actual Blob data lives here, in the browser's quota-exempt storage.
 *
 * Swap saveImage / getImage for cloud storage API calls when moving to a backend.
 */

const DB_NAME = 'kloset-images'
const STORE_NAME = 'images'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(new Error(`IndexedDB open failed: ${request.error?.message}`))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

/** Store an image Blob and return its new UUID key. */
export async function saveImage(blob: Blob): Promise<string> {
  const db = await openDB()
  const id = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(blob, id)
    req.onsuccess = () => resolve(id)
    req.onerror = () => reject(new Error(`Failed to store image: ${req.error?.message}`))
    tx.oncomplete = () => db.close()
  })
}

/** Retrieve a stored image Blob by its UUID key. Returns null if not found. */
export async function getImage(id: string): Promise<Blob | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => {
      db.close()
      resolve((req.result as Blob | undefined) ?? null)
    }
    req.onerror = () => reject(new Error(`Failed to retrieve image: ${req.error?.message}`))
  })
}

/** Delete a stored image by its UUID key. No-ops gracefully if the key doesn't exist. */
export async function deleteImage(id: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(new Error(`Failed to delete image: ${req.error?.message}`))
      tx.oncomplete = () => db.close()
    })
  } catch {
    console.warn(`[imageStorage] Could not delete image ${id} from IndexedDB`)
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB

/** Returns a human-readable error string if the file is invalid, otherwise null. */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type.toLowerCase())) {
    return `Unsupported type "${file.type || 'unknown'}". Use JPG, PNG, or WEBP.`
  }
  if (file.size > MAX_FILE_SIZE) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    return `File too large (${mb} MB). Maximum is 15 MB.`
  }
  return null
}

// ─── Compression ──────────────────────────────────────────────────────────────

const MAX_DIMENSION = 1200
const TARGET_SIZE = 600 * 1024 // 600 KB — keeps wardrobe browsing snappy

/**
 * Compress an image File to a JPEG Blob.
 * Scales down images larger than 1200px and applies a white background
 * so transparent PNGs compress well.
 * Throws a user-readable Error if the file is corrupted or unreadable.
 */
export async function compressImage(file: File): Promise<Blob> {
  const blobUrl = URL.createObjectURL(file)

  try {
    return await new Promise<Blob>((resolve, reject) => {
      const img = new Image()

      img.onload = () => {
        let w = img.naturalWidth
        let h = img.naturalHeight

        if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!

        ctx.fillStyle = '#FFFFFF' // white background for transparent PNGs
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)

        canvas.toBlob(
          (blob1) => {
            if (!blob1) { reject(new Error('Compression failed')); return }

            if (blob1.size <= TARGET_SIZE) {
              resolve(blob1)
            } else {
              // Second pass at lower quality
              canvas.toBlob(
                (blob2) => resolve(blob2 ?? blob1),
                'image/jpeg',
                0.65
              )
            }
          },
          'image/jpeg',
          0.82
        )
      }

      img.onerror = () =>
        reject(new Error('Could not read this image. The file may be corrupted.'))
      img.src = blobUrl
    })
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

// ─── Portable copy ────────────────────────────────────────────────────────────

const PORTABLE_EDGE = 800

/**
 * A small PNG data URL of a stored photo. Saved on the wardrobe row when the
 * Storage upload fails, so transparent cutouts still show on every device.
 */
export async function toPortableDataUrl(blob: Blob): Promise<string | null> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, PORTABLE_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } catch (e) {
    console.warn('[imageStorage] portable copy failed', e)
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
