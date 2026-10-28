import type { ClothingCategory } from '@/types'
import { analyzeImage } from '@/lib/analyzeImage'
import { removeImageBackground } from '@/lib/backgroundRemoval'
import { parseOutfitPhoto } from '@/lib/fashionParsing'
import { nameOutfit, saveRackOutfit, type RackOutfit, type RackPiece } from '@/lib/rackOutfits'

/**
 * Turns an uploaded outfit photo into a rack outfit: each detected garment and
 * accessory is cut out of the photo (only its visible pixels; nothing is
 * redrawn or filled in), named, and saved together under one outfit id.
 */

// The segmenter works on every pixel; phone photos are 12MP+, which makes the
// mask pass slow without making the cut-outs any better on a hanger.
const MAX_PARSE_EDGE = 1600
const NAMING_TIMEOUT_MS = 20_000

const ANALYSIS_CATEGORIES = new Set<ClothingCategory>(['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories'])

async function decode(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function downscale(file: Blob): Promise<Blob> {
  const image = await decode(file)
  const scale = Math.min(1, MAX_PARSE_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
  if (scale === 1) return file
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob((out) => out ? resolve(out) : reject(new Error('Could not resize photo.')), 'image/jpeg', 0.92))
}

const COLOUR_NAMES: [string, number, number, number][] = [
  // name, hue, saturation, lightness (0-360, 0-1, 0-1)
  ['Red', 0, 0.6, 0.45], ['Burgundy', 345, 0.5, 0.25], ['Pink', 340, 0.6, 0.75], ['Rose', 350, 0.35, 0.6],
  ['Rust', 18, 0.6, 0.38], ['Orange', 28, 0.8, 0.55], ['Camel', 32, 0.4, 0.55], ['Brown', 25, 0.4, 0.28],
  ['Beige', 38, 0.35, 0.78], ['Mustard', 45, 0.7, 0.5], ['Yellow', 52, 0.8, 0.62], ['Olive', 65, 0.35, 0.35],
  ['Green', 120, 0.4, 0.4], ['Sage', 110, 0.15, 0.6], ['Teal', 180, 0.5, 0.35], ['Blue', 212, 0.6, 0.5],
  ['Light blue', 205, 0.5, 0.75], ['Denim', 215, 0.3, 0.45], ['Navy', 225, 0.5, 0.2], ['Purple', 275, 0.4, 0.4],
  ['Lilac', 270, 0.35, 0.75],
]

/** Names the average colour of the cut-out's visible pixels. */
function colourName(pixels: Uint8ClampedArray): string | null {
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < pixels.length; i += 16) {
    if (pixels[i + 3] < 200) continue
    r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; n++
  }
  if (!n) return null
  r /= n * 255; g /= n * 255; b /= n * 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1))
  if (s < 0.12) return l > 0.85 ? 'White' : l > 0.68 ? 'Cream' : l > 0.4 ? 'Grey' : l > 0.18 ? 'Charcoal' : 'Black'
  let h = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4
  h = (h * 60 + 360) % 360
  let best = COLOUR_NAMES[0], bestDistance = Infinity
  for (const entry of COLOUR_NAMES) {
    const hueGap = Math.min(Math.abs(h - entry[1]), 360 - Math.abs(h - entry[1])) / 180
    const distance = hueGap * 2 + Math.abs(s - entry[2]) + Math.abs(l - entry[3]) * 1.5
    if (distance < bestDistance) { best = entry; bestDistance = distance }
  }
  return best[0]
}

async function describeCutout(blob: Blob): Promise<{ width: number; height: number; colour: string | null }> {
  const image = await decode(blob)
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 200 / Math.max(image.naturalWidth, image.naturalHeight))
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return { width: image.naturalWidth, height: image.naturalHeight, colour: colourName(context.getImageData(0, 0, canvas.width, canvas.height).data) }
}

/** Asks the vision model for a retailer-style name; falls back to the local name if it's unavailable. */
async function nameFromVision(blob: Blob): Promise<{ name: string | null; category: ClothingCategory | null }> {
  try {
    const analysis = await Promise.race([
      analyzeImage(blob),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), NAMING_TIMEOUT_MS)),
    ])
    const category = analysis?.category && ANALYSIS_CATEGORIES.has(analysis.category as ClothingCategory)
      ? analysis.category as ClothingCategory
      : null
    return { name: analysis?.name?.trim() || null, category }
  } catch (error) {
    console.warn('[outfitSeparation] vision naming unavailable', error)
    return { name: null, category: null }
  }
}

export type SeparationProgress = (message: string) => void

/** Separates one photo into pieces and saves them as an outfit. Returns null if nothing wearable was found. */
export async function separateOutfitPhoto(file: File, onProgress?: SeparationProgress): Promise<RackOutfit | null> {
  const started = performance.now()
  const outfitId = crypto.randomUUID()
  onProgress?.('Finding each piece…')
  const photo = await downscale(file)
  const parsed = await parseOutfitPhoto(photo)

  let found = parsed.garments.map((garment) => ({ ...garment, label: garment.name }))
  if (!found.length && !parsed.containsPerson) {
    // A single product photo (no one wearing it): keep the whole item.
    onProgress?.('Cutting out the piece…')
    const blob = await removeImageBackground(parsed.safeFallback)
    found = [{ blob, category: 'tops', name: 'Piece', label: 'Piece' }]
  }
  if (!found.length) {
    console.warn('[outfitSeparation] no clothing detected', { file: file.name })
    return null
  }

  onProgress?.(`Naming ${found.length} piece${found.length === 1 ? '' : 's'}…`)
  const pieces: RackPiece[] = await Promise.all(found.map(async (garment) => {
    const [shape, vision] = await Promise.all([describeCutout(garment.blob), nameFromVision(garment.blob)])
    // Trust the segmenter's slot (top/bottom/shoes…) — it is what was actually
    // detected — but let vision recognise a top as outerwear (jackets, coats).
    let category = garment.category
    if (category === 'tops' && vision.category === 'outerwear') category = 'outerwear'
    if (garment.label === 'Piece' && vision.category) category = vision.category
    const localName = shape.colour ? `${shape.colour} ${garment.label.toLowerCase()}` : garment.label
    return {
      id: crypto.randomUUID(),
      outfitId,
      name: vision.name ?? localName,
      category,
      blob: garment.blob,
      width: shape.width,
      height: shape.height,
    }
  }))

  const outfit: RackOutfit = { id: outfitId, name: nameOutfit(pieces), createdAt: Date.now(), pieces }
  await saveRackOutfit(outfit)
  console.log('[outfitSeparation] separated photo', {
    file: file.name,
    pieces: pieces.map((piece) => `${piece.category}: ${piece.name}`),
    ms: Math.round(performance.now() - started),
  })
  return outfit
}
