import { apiFetch, apiUrl } from '@/lib/apiUrl'

export interface ClothingAnalysis {
  name: string | null
  category: string | null
  subcategory: string | null
  neckline_closure: string | null
  construction: string | null
  primaryColor: string | null
  secondaryColors: string[]
  material: string | null
  pattern: string | null
  fit: string | null
  formality: string | null
  seasons: string[]
  occasions: string[]
  confidence: Record<string, number>
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data URL prefix ("data:image/jpeg;base64,")
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const MAX_ANALYSIS_EDGE = 1280

// Phone camera photos run 3–6 MB, and base64 adds a third on top — past Netlify's 6 MB
// request limit. The model doesn't need more than ~1280px to read a garment, so re-encode
// as a JPEG that size. Also turns formats the model rejects (HEIC) into JPEG.
async function shrinkForAnalysis(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, MAX_ANALYSIS_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const context = canvas.getContext('2d')!
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(img, 0, 0, canvas.width, canvas.height)
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!out) throw new Error('canvas.toBlob returned null')
    console.log('[analyzeImage] resized', { from: blob.size, to: out.size, width: canvas.width, height: canvas.height })
    return out
  } catch (e) {
    console.warn('[analyzeImage] resize failed, sending original', e)
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function analyzeImage(original: Blob): Promise<ClothingAnalysis | null> {
  const blob = await shrinkForAnalysis(original)
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp']
  const mediaType = supportedTypes.includes(blob.type) ? blob.type : 'image/jpeg'

  const imageData = await blobToBase64(blob)

  const res = await apiFetch(apiUrl('/api/analyze-image'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData, mediaType }),
  })

  if (!res.ok) {
    console.error('[analyzeImage] request failed', res.status)
    return null
  }

  const data = await res.json()
  return (data.analysis as ClothingAnalysis) ?? null
}

export interface DetectedOutfitPiece {
  name: string
  category: string
  box: [number, number, number, number]
}

/** Cloud fallback for multi-piece outfit photos when local segmentation cannot load. */
export async function detectOutfitPieces(original: Blob): Promise<DetectedOutfitPiece[]> {
  const blob = await shrinkForAnalysis(original)
  const imageData = await blobToBase64(blob)
  const res = await apiFetch(apiUrl('/api/detect-outfit-pieces'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData, mediaType: blob.type || 'image/jpeg' }),
  })
  if (!res.ok) throw new Error('Could not detect separate clothing pieces.')
  const data = await res.json() as { pieces?: unknown[] }
  return (data.pieces ?? []).flatMap((piece) => {
    const candidate = piece as Partial<DetectedOutfitPiece>
    if (typeof candidate.name !== 'string' || typeof candidate.category !== 'string' || !Array.isArray(candidate.box) || candidate.box.length !== 4) return []
    const box = candidate.box.map(Number)
    if (box.some((n) => !Number.isFinite(n) || n < 0 || n > 1000) || box[2] <= box[0] || box[3] <= box[1]) return []
    return [{ name: candidate.name.slice(0, 100), category: candidate.category, box: box as [number, number, number, number] }]
  }).slice(0, 8)
}

/**
 * Same analysis, but for an image the browser can display (via <img>) but
 * can't read the bytes of client-side — a pasted URL or a Pexels search
 * result. The server fetches it directly, sidestepping the CORS
 * restriction that blocks a client-side fetch() of most third-party images.
 */
export async function analyzeImageFromUrl(url: string): Promise<ClothingAnalysis | null> {
  const res = await apiFetch(apiUrl('/api/analyze-image-url'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  if (!res.ok) return null

  const data = await res.json()
  return (data.analysis as ClothingAnalysis) ?? null
}
