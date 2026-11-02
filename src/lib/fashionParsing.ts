import type { ClothingCategory } from '@/types'

const CLOTHING: Record<string, { category: ClothingCategory; name: string }> = {
  'upper-clothes': { category: 'tops', name: 'Top' },
  'upper clothes': { category: 'tops', name: 'Top' },
  'skirt': { category: 'bottoms', name: 'Skirt' },
  'pants': { category: 'bottoms', name: 'Pants' },
  'dress': { category: 'dresses', name: 'Dress' },
  'belt': { category: 'accessories', name: 'Belt' },
  'left-shoe': { category: 'shoes', name: 'Shoes' },
  'right-shoe': { category: 'shoes', name: 'Shoes' },
  'bag': { category: 'accessories', name: 'Bag' },
  'scarf': { category: 'accessories', name: 'Scarf' },
  'hat': { category: 'accessories', name: 'Hat' },
  'sunglasses': { category: 'accessories', name: 'Sunglasses' },
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
}

type Segmenter = (image: string) => Promise<SegmentationMask[]>
let segmenterPromise: Promise<Segmenter> | null = null

function getSegmenter(): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = import('@huggingface/transformers').then(async ({ pipeline }) => {
      const segmenter = await pipeline('image-segmentation', 'Xenova/segformer_b2_clothes', { dtype: 'q8' })
      // Let Transformers.js select and bind the semantic post-processor from
      // the model's image processor. Passing `subtask: 'semantic'` explicitly
      // leaves a method name string unbound in the current library version.
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

function maskAt(mask: SegmentationMask['mask'], x: number, y: number, width: number, height: number): boolean {
  const mx = Math.min(mask.width - 1, Math.floor(x / width * mask.width))
  const my = Math.min(mask.height - 1, Math.floor(y / height * mask.height))
  return mask.data[(my * mask.width + mx) * mask.channels] > 127
}

/**
 * Clothing segmentation is semantic, so a mask can contain multiple garments
 * of the same type (for example worn trousers plus trousers on a hanger).
 * For photos containing a person, keep only mask components that meet the
 * person's segmented silhouette. This avoids saving nearby background clothes
 * as part of the outfit while still retaining disconnected product-photo items.
 */
function keepPersonAttachedComponents(
  garment: SegmentationMask,
  bodyMasks: SegmentationMask[],
): SegmentationMask {
  const { width, height, channels } = garment.mask
  const source = garment.mask.data
  const body = new Uint8Array(width * height)
  let hasBodyPixels = false
  for (const bodyMask of bodyMasks) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (maskAt(bodyMask.mask, x, y, width, height)) {
        body[y * width + x] = 1
        hasBodyPixels = true
      }
    }
  }
  // If the model failed to produce a usable silhouette, don't erase the item.
  if (!hasBodyPixels) return garment

  // A tiny dilation handles the narrow semantic seams between a garment and
  // the adjacent arm, leg, or torso label without reaching nearby objects.
  const nearBody = new Uint8Array(body.length)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!body[y * width + x]) continue
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) nearBody[ny * width + nx] = 1
    }
  }

  const visited = new Uint8Array(width * height)
  const keep = new Uint8Array(width * height)
  for (let start = 0; start < width * height; start++) {
    if (visited[start] || source[start * channels] <= 127) continue
    const component: number[] = [start]
    visited[start] = 1
    let touchesPerson = false
    for (let i = 0; i < component.length; i++) {
      const index = component[i]
      if (nearBody[index]) touchesPerson = true
      const x = index % width, y = Math.floor(index / width)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        const neighbor = ny * width + nx
        if (!visited[neighbor] && source[neighbor * channels] > 127) {
          visited[neighbor] = 1
          component.push(neighbor)
        }
      }
    }
    if (touchesPerson) for (const index of component) keep[index] = 1
  }

  const filtered = new Uint8Array(source.length)
  for (let i = 0; i < keep.length; i++) {
    if (!keep[i]) continue
    const offset = i * channels
    for (let channel = 0; channel < channels; channel++) filtered[offset + channel] = source[offset + channel]
  }
  return { ...garment, mask: { ...garment.mask, data: filtered } }
}

/** Segment locally and save rectangular crops from the untouched source photo. */
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
  const bodyMasks = [...HUMAN_LABELS]
    .filter((label) => !['face', 'hair', 'sunglasses'].includes(label))
    .map((label) => byLabel.get(label))
    .filter((mask): mask is SegmentationMask => !!mask)
  // Keep crop geometry at the uploaded image's resolution. The old fixed
  // 512x512 canvas made every saved garment look blurry on phone screens.
  const inputWidth = image.naturalWidth
  const inputHeight = image.naturalHeight
  const garmentGroups = new Map<string, { masks: SegmentationMask[]; category: ClothingCategory; name: string }>()
  for (const [label, info] of Object.entries(CLOTHING)) {
    const mask = byLabel.get(label)
    if (!mask) continue
    const key = info.category === 'shoes' ? 'shoes' : label
    const existing = garmentGroups.get(key)
    const relevantMask = containsPerson && bodyMasks.length > 0
      ? keepPersonAttachedComponents(mask, bodyMasks)
      : mask
    if (existing) existing.masks.push(relevantMask)
    else garmentGroups.set(key, { masks: [relevantMask], category: info.category, name: info.name })
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
    crop.width = right - left; crop.height = bottom - top
    const context = crop.getContext('2d')!
    // Keep every original pixel in the crop, including the background. The
    // segmentation mask is used only to locate and label each piece.
    context.drawImage(image, left, top, crop.width, crop.height, 0, 0, crop.width, crop.height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      crop.toBlob((result) => result ? resolve(result) : reject(new Error('Could not create item crop.')), 'image/png')
    })
    garments.push({ blob, category: group.category, name: group.name })
  }
  return { garments, containsPerson }
}
