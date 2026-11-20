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

// Smaller photos cost Groq fewer tokens, and the per-minute token limit is
// what makes tagging "busy". 1024px still reads fabric and detail; finding
// piece boxes needs even less.
const MAX_ANALYSIS_EDGE = 1024
const MAX_DETECTION_EDGE = 768

/** Called when tagging is rate limited and will retry after `seconds`. */
export type TaggingWaitHandler = (seconds: number) => void
const MAX_RETRY_WAIT_SECONDS = 30

// POST to a vision route. On 429, wait as long as the server says (from
// Groq's Retry-After) and try once more, instead of failing straight away.
async function postVision(path: string, body: unknown, onWait?: TaggingWaitHandler): Promise<Response> {
  const send = () => apiFetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const first = await send()
  if (first.status !== 429) return first
  const header = Number(first.headers.get('Retry-After'))
  const seconds = Number.isFinite(header) && header > 0 ? Math.ceil(header) : 10
  if (seconds > MAX_RETRY_WAIT_SECONDS) return first
  console.warn('[analyzeImage] rate limited, retrying', { path, seconds })
  onWait?.(seconds)
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
  return send()
}

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

export async function analyzeImage(original: Blob, onWait?: TaggingWaitHandler): Promise<ClothingAnalysis> {
  const blob = await shrinkForAnalysis(original)
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp']
  const mediaType = supportedTypes.includes(blob.type) ? blob.type : 'image/jpeg'

  const imageData = await blobToBase64(blob)

  let res: Response
  try {
    res = await postVision('/api/analyze-image', { imageData, mediaType }, onWait)
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

// Maps a 0–1000 box on the padded square back to 0–1000 per axis of the photo.
type BoxMapper = (box: [number, number, number, number]) => [number, number, number, number]
const identityBox: BoxMapper = (box) => box

// The vision model measures box coordinates against the image's longest side,
// not each side separately, so boxes on tall or wide photos came back squashed
// and crops landed in the wrong place. Padding the photo into a white square
// makes both readings agree; the boxes are mapped back to the photo after.
async function squareForDetection(blob: Blob): Promise<{ blob: Blob; mapBox: BoxMapper }> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const { naturalWidth: width, naturalHeight: height } = img
    const scale = Math.min(1, MAX_DETECTION_EDGE / Math.max(width, height))
    const drawnWidth = Math.round(width * scale)
    const drawnHeight = Math.round(height * scale)
    const side = Math.max(drawnWidth, drawnHeight)
    const offsetX = Math.floor((side - drawnWidth) / 2)
    const offsetY = Math.floor((side - drawnHeight) / 2)
    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = side
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No 2D canvas context')
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, side, side)
    context.drawImage(img, offsetX, offsetY, drawnWidth, drawnHeight)
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!out) throw new Error('canvas.toBlob returned null')
    const toPhoto = (value: number, offset: number, drawn: number) =>
      Math.round(Math.max(0, Math.min(1000, ((value / 1000) * side - offset) / drawn * 1000)))
    const mapBox: BoxMapper = ([left, top, right, bottom]) => [
      toPhoto(left, offsetX, drawnWidth), toPhoto(top, offsetY, drawnHeight),
      toPhoto(right, offsetX, drawnWidth), toPhoto(bottom, offsetY, drawnHeight),
    ]
    return { blob: out, mapBox }
  } catch (e) {
    console.warn('[analyzeImage] square padding failed, sending photo as is', e)
    return { blob: await shrinkForAnalysis(blob), mapBox: identityBox }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Cloud fallback for multi-piece outfit photos when local segmentation cannot load. */
export async function detectOutfitPieces(original: Blob, onWait?: TaggingWaitHandler): Promise<DetectedOutfitPiece[]> {
  const { blob, mapBox } = await squareForDetection(original)
  const imageData = await blobToBase64(blob)
  const res = await postVision('/api/detect-outfit-pieces', { imageData, mediaType: blob.type || 'image/jpeg' }, onWait)
  if (!res.ok) throw new Error('Could not detect separate clothing pieces.')
  const data = await res.json() as { pieces?: unknown[] }
  return (data.pieces ?? []).flatMap((piece) => {
    const candidate = piece as Partial<DetectedOutfitPiece>
    if (typeof candidate.name !== 'string' || typeof candidate.category !== 'string' || !Array.isArray(candidate.box) || candidate.box.length !== 4) return []
    const raw = candidate.box.map(Number)
    if (raw.some((n) => !Number.isFinite(n) || n < 0 || n > 1000)) return []
    const box = mapBox(raw as [number, number, number, number])
    // Boxes that fall in the padding map to a zero-size area; drop those.
    if (box[2] - box[0] < 10 || box[3] - box[1] < 10) return []
    return [{ name: candidate.name.slice(0, 100), category: candidate.category, box }]
  }).slice(0, 8)
}

/**
 * Same analysis, but for an image the browser can display (via <img>) but
 * can't read the bytes of client-side — a pasted URL or a Pexels search
 * result. The server fetches it directly, sidestepping the CORS
 * restriction that blocks a client-side fetch() of most third-party images.
 */
export async function analyzeImageFromUrl(url: string, onWait?: TaggingWaitHandler): Promise<ClothingAnalysis> {
  const res = await postVision('/api/analyze-image-url', { url }, onWait)

  return readAnalysisResponse(res)
}
