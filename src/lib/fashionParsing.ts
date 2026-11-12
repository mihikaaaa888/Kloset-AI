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
const FACE_LABELS = new Set(['face', 'hair', 'sunglasses'])
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
  /** Safe local fallback for standalone product photos; face pixels are transparent. */
  safeFallback: Blob
}

type Segmenter = (image: string) => Promise<SegmentationMask[]>
let segmenterPromise: Promise<Segmenter> | null = null

function getSegmenter(): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = import('@huggingface/transformers').then(async ({ pipeline }) => {
      const segmenter = await pipeline('image-segmentation', 'Xenova/segformer_b2_clothes', { dtype: 'q8' })
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

/** Segment locally and produce transparent, full-resolution garment cutouts. */
export async function parseOutfitPhoto(source: Blob): Promise<ParsedPhoto> {
  const image = await decodeImage(source)
  const sourceUrl = URL.createObjectURL(source)
  let masks: SegmentationMask[]
  try {
    masks = await (await getSegmenter())(sourceUrl)
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
    let minX = inputWidth, minY = inputHeight, maxX = -1, maxY = -1, pixelCount = 0
    for (let y = 0; y < inputHeight; y++) for (let x = 0; x < inputWidth; x++) {
      if (group.masks.some(({ mask }) => maskAt(mask, x, y, inputWidth, inputHeight))) {
        minX = Math.min(minX, x); minY = Math.min(minY, y)
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); pixelCount++
      }
    }
    const minGarmentPixels = Math.max(64, Math.round(inputWidth * inputHeight * 0.0003))
    if (maxX < minX || maxY < minY || pixelCount < minGarmentPixels) continue
    const padX = Math.round((maxX - minX + 1) * 0.04)
    const padY = Math.round((maxY - minY + 1) * 0.04)
    const left = Math.max(0, minX - padX), top = Math.max(0, minY - padY)
    const right = Math.min(inputWidth, maxX + padX + 1), bottom = Math.min(inputHeight, maxY + padY + 1)
    const crop = document.createElement('canvas')
    crop.width = right - left
    crop.height = bottom - top
    const context = crop.getContext('2d', { willReadFrequently: true })!
    context.drawImage(image, left, top, crop.width, crop.height, 0, 0, crop.width, crop.height)
    const pixels = context.getImageData(0, 0, crop.width, crop.height)
    for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
      const sourceX = left + x
      const sourceY = top + y
      if (!group.masks.some(({ mask }) => maskAt(mask, sourceX, sourceY, inputWidth, inputHeight))) {
        pixels.data[(y * crop.width + x) * 4 + 3] = 0
      }
    }
    context.putImageData(pixels, 0, 0)
    garments.push({ blob: await canvasBlob(crop), category: group.category, name: group.name })
  }

  // Keep a face-cleared local fallback for isolated product photos the labeler
  // cannot classify. Person photos with no garment masks are rejected upstream.
  const faceMasks = [...FACE_LABELS].map((label) => byLabel.get(label)).filter((mask): mask is SegmentationMask => !!mask)
  const safe = document.createElement('canvas')
  safe.width = inputWidth
  safe.height = inputHeight
  const safeContext = safe.getContext('2d', { willReadFrequently: true })!
  safeContext.drawImage(image, 0, 0)
  const pixels = safeContext.getImageData(0, 0, safe.width, safe.height)
  for (let y = 0; y < safe.height; y++) for (let x = 0; x < safe.width; x++) {
    if (faceMasks.some(({ mask }) => maskAt(mask, x, y, safe.width, safe.height))) {
      pixels.data[(y * safe.width + x) * 4 + 3] = 0
    }
  }
  safeContext.putImageData(pixels, 0, 0)
  return { garments, containsPerson, safeFallback: await canvasBlob(safe) }
}
