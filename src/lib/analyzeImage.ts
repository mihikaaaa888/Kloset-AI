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

async function readAnalysisResponse(res: Response): Promise<ClothingAnalysis> {
  let data: { analysis?: ClothingAnalysis | null; error?: string } = {}
  try {
    data = await res.json()
  } catch {
    // Keep the user-facing message below useful even if an upstream proxy
    // returns a non-JSON error page.
  }

  if (!res.ok) {
    const fallback = res.status === 401
      ? 'Your session expired. Sign in again to tag this item.'
      : res.status === 429
        ? 'Photo tagging is busy right now. Wait a moment and try again, or add the item manually.'
        : res.status === 503
          ? 'Photo tagging is temporarily unavailable. You can still add the item manually.'
          : 'Photo tagging could not read this image. Try again or add the item manually.'
    throw new Error(data.error || fallback)
  }

  if (!data.analysis) {
    throw new Error('Kloset could not read this photo. Try a clearer, closer photo or enter the item details manually.')
  }
  return data.analysis
}

// Phone camera photos run 3–6 MB, and base64 adds a third on top. The model
// doesn't need more than ~1280px to read a garment, so re-encode
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

export async function analyzeImage(original: Blob): Promise<ClothingAnalysis> {
  const blob = await shrinkForAnalysis(original)
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp']
  const mediaType = supportedTypes.includes(blob.type) ? blob.type : 'image/jpeg'

  const imageData = await blobToBase64(blob)

  let res: Response
  try {
    res = await apiFetch(apiUrl('/api/analyze-image'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData, mediaType }),
    })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Could not reach Kloset’s photo tagging service. Check your connection and try again.')
    }
    throw error
  }

  return readAnalysisResponse(res)
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
export async function analyzeImageFromUrl(url: string): Promise<ClothingAnalysis> {
  const res = await apiFetch(apiUrl('/api/analyze-image-url'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  return readAnalysisResponse(res)
}
