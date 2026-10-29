import { apiUrl } from '@/lib/apiUrl'

export interface ClothingAnalysis {
  name: string | null
  category: string | null
  subcategory: string | null
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

  const res = await fetch(apiUrl('/api/analyze-image'), {
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

/**
 * Same analysis, but for an image the browser can display (via <img>) but
 * can't read the bytes of client-side — a pasted URL or a Pexels search
 * result. The server fetches it directly, sidestepping the CORS
 * restriction that blocks a client-side fetch() of most third-party images.
 */
export async function analyzeImageFromUrl(url: string): Promise<ClothingAnalysis | null> {
  const res = await fetch(apiUrl('/api/analyze-image-url'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  if (!res.ok) return null

  const data = await res.json()
  return (data.analysis as ClothingAnalysis) ?? null
}
