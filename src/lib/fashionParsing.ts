import type { ClothingCategory } from '@/types'

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
  try {
    masks = await (await getSegmenter())(sourceUrl)
  } catch (error) {
    // Don't discard a user's upload if the model fails to load. The original
    // photo remains available for manual tagging and can be retried later.
    segmentationAvailable = false
    console.warn('[wardrobe] garment segmentation unavailable; keeping source photo', error)
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

  const garments: ParsedGarment[] = []
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
      const minGarmentPixels = Math.max(64, Math.round(inputWidth * inputHeight * 0.0003))
      if (maxX < minX || maxY < minY || pixelCount < minGarmentPixels) continue
      // Keep enough surrounding scene to preserve the item's true appearance;
      // this is a zoomed crop, not a background-removal cutout.
      const padX = Math.round((maxX - minX + 1) * 0.1)
      const padY = Math.round((maxY - minY + 1) * 0.1)
      const left = Math.max(0, minX - padX), top = Math.max(0, minY - padY)
      const right = Math.min(inputWidth, maxX + padX + 1), bottom = Math.min(inputHeight, maxY + padY + 1)
      const crop = document.createElement('canvas')
      crop.width = right - left
      crop.height = bottom - top
      const context = crop.getContext('2d', { willReadFrequently: true })!
      context.drawImage(image, left, top, crop.width, crop.height, 0, 0, crop.width, crop.height)
      garments.push({ blob: await canvasBlob(crop), category: group.category, name: group.name })
    }
  }

  return { garments, containsPerson: segmentationAvailable && containsPerson, segmentationAvailable, sourceFallback: source }
}
