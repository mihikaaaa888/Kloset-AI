import type { ClothingCategory } from '@/types'
import { reportIssue } from '@/lib/clientReport'

const CLOTHING: Record<string, { category: ClothingCategory; name: string }> = {
  'upper-clothes': { category: 'tops', name: 'Top' },
  'upper clothes': { category: 'tops', name: 'Top' },
  skirt: { category: 'bottoms', name: 'Skirt' },
  pants: { category: 'bottoms', name: 'Pants' },
  dress: { category: 'dresses', name: 'Dress' },
  belt: { category: 'accessories', name: 'Belt' },
  'left-shoe': { category: 'shoes', name: 'Shoes' },
  'right-shoe': { category: 'shoes', name: 'Shoes' },
  bag: { category: 'accessories', name: 'Bag' },
  scarf: { category: 'accessories', name: 'Scarf' },
  hat: { category: 'accessories', name: 'Hat' },
  sunglasses: { category: 'accessories', name: 'Sunglasses' },
}
const HUMAN_LABELS = new Set(['face', 'hair', 'sunglasses', 'left-arm', 'right-arm', 'arms', 'left-leg', 'right-leg', 'legs', 'torso', 'hands', 'feet'])

interface SegmentationMask {
  label: string
  mask: { data: Uint8Array | Uint8ClampedArray; width: number; height: number; channels: number }
}

interface ParsedGarment {
  blob: Blob
  category: ClothingCategory
  name: string
}

export interface ParsedPhoto {
  garments: ParsedGarment[]
  containsPerson: boolean
  segmentationAvailable: boolean
  /** Original photo, kept intact if segmentation cannot identify a garment. */
  sourceFallback: Blob
  /**
   * The clothing inside a 0–1000 box (from cloud detection) cut out onto
   * white, using this photo's clothing outline; null when there's too little
   * clothing in the box to cut out.
   */
  cutoutForBox: (box: [number, number, number, number]) => Promise<Blob | null>
  /** What the on-device model saw (for problem reports). */
  foundLabels: string[]
}

type Segmenter = (image: string) => Promise<SegmentationMask[]>
let segmenterPromise: Promise<Segmenter> | null = null

function getSegmenter(): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = import('@huggingface/transformers').then(async ({ env, pipeline }) => {
      // Serve ONNX Runtime from this origin. Mobile browsers and deployed CSPs
      // can fail to import the runtime's remotely resolved module script.
      env.backends.onnx.wasm!.wasmPaths = {
        mjs: '/onnx-runtime/ort-wasm-simd-threaded.asyncify.mjs',
        wasm: '/onnx-runtime/ort-wasm-simd-threaded.asyncify.wasm',
      }
      const segmenter = await pipeline('image-segmentation', 'Xenova/segformer_b2_clothes', { dtype: 'q8', device: 'wasm' })
      return (image: string) => segmenter(image) as Promise<SegmentationMask[]>
    }).catch((error) => {
      segmenterPromise = null
      throw error
    })
  }
  return segmenterPromise
}

function decodeImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read uploaded image.')) }
    image.src = url
  })
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create garment image.')), 'image/png'))
}

function maskAt(mask: SegmentationMask['mask'], x: number, y: number, width: number, height: number): boolean {
  const mx = Math.min(mask.width - 1, Math.floor(x / width * mask.width))
  const my = Math.min(mask.height - 1, Math.floor(y / height * mask.height))
  return mask.data[(my * mask.width + mx) * mask.channels] > 127
}

// ─── Cutouts ──────────────────────────────────────────────────────────────────
// Each piece is lifted out along its own outline (no face, arms, room or
// phone) and centred on a white square, so it reads like a product photo.

type Inside = (x: number, y: number) => boolean

function jpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create garment image.')), 'image/jpeg', 0.92))
}

/** The pixels of `image` within [left, top, width, height] where `inside` holds, on white. Null if almost nothing is inside. */
async function cutoutOnWhite(image: HTMLImageElement, inside: Inside, left: number, top: number, width: number, height: number, minShare = 0.05): Promise<Blob | null> {
  const mask = document.createElement('canvas')
  mask.width = width
  mask.height = height
  const maskContext = mask.getContext('2d')
  if (!maskContext) return null
  const pixels = maskContext.createImageData(width, height)
  let count = 0
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!inside(left + x, top + y)) continue
    pixels.data[(y * width + x) * 4 + 3] = 255
    count++
  }
  if (count < width * height * minShare) return null
  maskContext.putImageData(pixels, 0, 0)

  // Soften the outline a touch so edges don't look cut with scissors.
  const piece = document.createElement('canvas')
  piece.width = width
  piece.height = height
  const pieceContext = piece.getContext('2d')
  if (!pieceContext) return null
  pieceContext.drawImage(image, left, top, width, height, 0, 0, width, height)
  pieceContext.globalCompositeOperation = 'destination-in'
  pieceContext.filter = 'blur(1.2px)'
  pieceContext.drawImage(mask, 0, 0)

  const side = Math.round(Math.max(width, height) * 1.12)
  const out = document.createElement('canvas')
  out.width = side
  out.height = side
  const outContext = out.getContext('2d')
  if (!outContext) return null
  outContext.fillStyle = '#ffffff'
  outContext.fillRect(0, 0, side, side)
  outContext.drawImage(piece, Math.round((side - width) / 2), Math.round((side - height) / 2))
  return jpegBlob(out)
}

/** Split disconnected pieces of the same semantic class into separate items. */
function connectedGarments(masks: SegmentationMask[]): SegmentationMask['mask'][] {
  if (!masks.length) return []
  const { width, height } = masks[0].mask
  const total = width * height
  const foreground = new Uint8Array(total)
  for (const { mask } of masks) {
    for (let i = 0; i < total; i++) {
      if (mask.data[i * mask.channels] > 127) foreground[i] = 1
    }
  }

  const seen = new Uint8Array(total)
  const components: SegmentationMask['mask'][] = []
  const queue = new Int32Array(total)
  const minimumArea = Math.max(180, Math.round(total * 0.0007))
  for (let seed = 0; seed < total; seed++) {
    if (!foreground[seed] || seen[seed]) continue
    let head = 0, tail = 0
    let minX = width, minY = height, maxX = 0, maxY = 0
    const indices: number[] = []
    queue[tail++] = seed
    seen[seed] = 1
    while (head < tail) {
      const index = queue[head++]
      const x = index % width
      const y = Math.floor(index / width)
      indices.push(index)
      minX = Math.min(minX, x); minY = Math.min(minY, y)
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
      const neighbors = [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1,
        y > 0 ? index - width : -1, y + 1 < height ? index + width : -1]
      for (const next of neighbors) {
        if (next >= 0 && foreground[next] && !seen[next]) {
          seen[next] = 1
          queue[tail++] = next
        }
      }
    }
    if (indices.length < minimumArea || maxX - minX < 12 || maxY - minY < 12) continue
    const data = new Uint8Array(total)
    for (const index of indices) data[index] = 255
    components.push({ data, width, height, channels: 1 })
  }
  return components
}

/** Segment locally and crop each garment while preserving the original photo pixels. */
export async function parseOutfitPhoto(source: Blob): Promise<ParsedPhoto> {
  const image = await decodeImage(source)
  const sourceUrl = URL.createObjectURL(source)
  let masks: SegmentationMask[] = []
  let segmentationAvailable = true
  const started = performance.now()
  let stage = 'loading the model'
  try {
    const segmenter = await getSegmenter()
    stage = 'reading the photo'
    masks = await segmenter(sourceUrl)
  } catch (error) {
    // Don't discard a user's upload if the model fails to load. The original
    // photo remains available for manual tagging and can be retried later.
    segmentationAvailable = false
    console.warn('[wardrobe] garment segmentation unavailable; keeping source photo', error)
    // Tell the server log what broke and on what device (phones especially).
    reportIssue('splitter', error, { stage, seconds: Math.round((performance.now() - started) / 100) / 10, width: image.naturalWidth, height: image.naturalHeight })
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }

  const byLabel = new Map(masks.map((mask) => [mask.label.toLowerCase(), mask]))
  const containsPerson = masks.some(({ label }) => HUMAN_LABELS.has(label.toLowerCase()))
  const inputWidth = image.naturalWidth
  const inputHeight = image.naturalHeight
  const garmentGroups = new Map<string, { masks: SegmentationMask[]; category: ClothingCategory; name: string }>()
  for (const [label, info] of Object.entries(CLOTHING)) {
    const mask = byLabel.get(label)
    if (!mask) continue
    const key = info.category === 'shoes' ? 'shoes' : label
    const existing = garmentGroups.get(key)
    if (existing) existing.masks.push(mask)
    else garmentGroups.set(key, { masks: [mask], category: info.category, name: info.name })
  }

  const garments: Array<ParsedGarment & { pixels: number }> = []
  for (const group of garmentGroups.values()) {
    // On a person, the model can fragment sleeves and panels into separate
    // islands. Keep each worn garment whole; split disconnected items in
    // closet/flat-lay photos. Shoes remain grouped as a pair.
    const components = containsPerson || group.category === 'shoes'
      ? [null]
      : connectedGarments(group.masks)
    for (const component of components) {
      const masksForItem = component ? [{ label: group.masks[0].label, mask: component }] : group.masks
      let minX = inputWidth, minY = inputHeight, maxX = -1, maxY = -1, pixelCount = 0
      for (let y = 0; y < inputHeight; y++) for (let x = 0; x < inputWidth; x++) {
        if (masksForItem.some(({ mask }) => maskAt(mask, x, y, inputWidth, inputHeight))) {
          minX = Math.min(minX, x); minY = Math.min(minY, y)
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); pixelCount++
        }
      }
      // Too small to be a real piece: slivers where the model half-saw something
      // (a bag mostly read as part of the top). Bags, hats and belts need a bit more.
      const minShare = group.category === 'accessories' ? 0.008 : group.category === 'shoes' ? 0.002 : 0.004
      const minGarmentPixels = Math.max(64, Math.round(inputWidth * inputHeight * minShare))
      if (maxX < minX || maxY < minY || pixelCount < minGarmentPixels) continue
      // Keep enough surrounding scene to preserve the item's true appearance;
      // this is a zoomed crop, not a background-removal cutout.
      const padX = Math.round((maxX - minX + 1) * 0.1)
      const padY = Math.round((maxY - minY + 1) * 0.1)
      const left = Math.max(0, minX - padX), top = Math.max(0, minY - padY)
      const right = Math.min(inputWidth, maxX + padX + 1), bottom = Math.min(inputHeight, maxY + padY + 1)
      // The piece on its own, on white; the plain crop if the outline is too thin to use.
      const cutout = await cutoutOnWhite(image, (x, y) => masksForItem.some(({ mask }) => maskAt(mask, x, y, inputWidth, inputHeight)), left, top, right - left, bottom - top)
      if (cutout) {
        garments.push({ blob: cutout, category: group.category, name: group.name, pixels: pixelCount })
        continue
      }
      const crop = document.createElement('canvas')
      crop.width = right - left
      crop.height = bottom - top
      const context = crop.getContext('2d', { willReadFrequently: true })!
      context.drawImage(image, left, top, crop.width, crop.height, 0, 0, crop.width, crop.height)
      garments.push({ blob: await canvasBlob(crop), category: group.category, name: group.name, pixels: pixelCount })
    }
  }

  // A top, bottom or dress tiny next to the main garment is a scrap the model
  // split off it (a kurti's shoulder read as a separate "top"), not a piece.
  const CLOTHES = new Set<ClothingCategory>(['tops', 'bottoms', 'dresses', 'outerwear'])
  const largest = Math.max(0, ...garments.filter((g) => CLOTHES.has(g.category)).map((g) => g.pixels))
  const pieces: ParsedGarment[] = garments
    .filter((g) => !CLOTHES.has(g.category) || g.pixels >= largest * 0.2)
    .map(({ blob, category, name }) => ({ blob, category, name }))

  // For boxes found by cloud detection: cut out whatever clothing the outline
  // shows inside the box.
  const clothingMasks = masks.filter((mask) => CLOTHING[mask.label.toLowerCase()])
  const cutoutForBox = async ([x1, y1, x2, y2]: [number, number, number, number]): Promise<Blob | null> => {
    if (!clothingMasks.length) return null
    const left = Math.max(0, Math.floor((x1 / 1000) * inputWidth))
    const top = Math.max(0, Math.floor((y1 / 1000) * inputHeight))
    const right = Math.min(inputWidth, Math.ceil((x2 / 1000) * inputWidth))
    const bottom = Math.min(inputHeight, Math.ceil((y2 / 1000) * inputHeight))
    if (right - left < 8 || bottom - top < 8) return null
    // A box from cloud detection must really hold clothing (a fifth of it at
    // least); boxes that landed on the wall or floor are dropped.
    return cutoutOnWhite(image, (x, y) => clothingMasks.some(({ mask }) => maskAt(mask, x, y, inputWidth, inputHeight)), left, top, right - left, bottom - top, 0.2)
  }

  return { garments: pieces, containsPerson: segmentationAvailable && containsPerson, segmentationAvailable, sourceFallback: source, cutoutForBox, foundLabels: masks.map((mask) => mask.label) }
}

/** Crop a detected garment from the original photo using normalized 0–1000 boxes. */
export async function cropPhotoToBounds(
  source: Blob,
  box: [number, number, number, number],
): Promise<Blob> {
  const image = await decodeImage(source)
  const [x1, y1, x2, y2] = box
  const left = Math.max(0, Math.floor((x1 / 1000) * image.naturalWidth))
  const top = Math.max(0, Math.floor((y1 / 1000) * image.naturalHeight))
  const right = Math.min(image.naturalWidth, Math.ceil((x2 / 1000) * image.naturalWidth))
  const bottom = Math.min(image.naturalHeight, Math.ceil((y2 / 1000) * image.naturalHeight))
  if (right <= left || bottom <= top) throw new Error('The clothing crop was invalid.')
  const padX = Math.round((right - left) * 0.06)
  const padY = Math.round((bottom - top) * 0.06)
  const cropLeft = Math.max(0, left - padX)
  const cropTop = Math.max(0, top - padY)
  const cropRight = Math.min(image.naturalWidth, right + padX)
  const cropBottom = Math.min(image.naturalHeight, bottom + padY)
  const canvas = document.createElement('canvas')
  canvas.width = cropRight - cropLeft
  canvas.height = cropBottom - cropTop
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the clothing crop.')
  context.drawImage(image, cropLeft, cropTop, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
  return canvasBlob(canvas)
}
