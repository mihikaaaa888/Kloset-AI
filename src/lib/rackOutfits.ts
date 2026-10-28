import type { ClothingCategory } from '@/types'

/**
 * Outfits shown on the landing-page rack.
 *
 * An outfit is one uploaded photo; its pieces are the garments and accessories
 * the segmenter separated out of that photo, so they stay grouped together.
 * Uploads live in IndexedDB on this device (the landing page works signed out).
 */

/** How many outfits hang on the rack at once. */
export const RACK_OUTFIT_COUNT = 6
/** Hangers on the rod, filled from the chosen outfits. */
export const RACK_HANGER_COUNT = 8

/** Hung pieces go on hangers; the rest are shown as the outfit's accessories. */
const HANGING_CATEGORIES = new Set<ClothingCategory>(['tops', 'bottoms', 'dresses', 'outerwear'])

export type SampleGarmentKind = 'top' | 'bottom' | 'coat' | 'dress' | 'skirt'

export interface RackPiece {
  id: string
  outfitId: string
  name: string
  category: ClothingCategory
  /** The transparent cut-out; absent for built-in samples. */
  blob?: Blob
  /** Natural pixel size of the cut-out, used to size it on the hanger. */
  width: number
  height: number
  /** Drawn shape for built-in samples. */
  sample?: { kind: SampleGarmentKind; colour: string }
}

export interface RackOutfit {
  id: string
  name: string
  createdAt: number
  pieces: RackPiece[]
  sample?: boolean
}

export function isHanging(piece: RackPiece): boolean {
  return HANGING_CATEGORIES.has(piece.category)
}

/** Hang order on a single outfit: layers first, then what goes underneath. */
const HANG_ORDER: Record<string, number> = { outerwear: 0, dresses: 1, tops: 2, bottoms: 3 }

export function hangingPieces(outfit: RackOutfit): RackPiece[] {
  return outfit.pieces.filter(isHanging).sort((a, b) => (HANG_ORDER[a.category] ?? 9) - (HANG_ORDER[b.category] ?? 9))
}

export function accessoryPieces(outfit: RackOutfit): RackPiece[] {
  return outfit.pieces.filter((piece) => !isHanging(piece))
}

/** "Navy shirt & black trousers" — built only from the pieces that were detected. */
export function nameOutfit(pieces: Pick<RackPiece, 'name' | 'category'>[]): string {
  const hung = pieces
    .filter((piece) => HANGING_CATEGORIES.has(piece.category))
    .sort((a, b) => (HANG_ORDER[a.category] ?? 9) - (HANG_ORDER[b.category] ?? 9))
  const named = (hung.length ? hung : pieces).map((piece) => piece.name)
  if (!named.length) return 'Untitled outfit'
  const [first, ...rest] = named
  if (!rest.length) return first
  const second = rest[0].charAt(0).toLowerCase() + rest[0].slice(1)
  return rest.length > 1 ? `${first}, ${second} + ${rest.length - 1} more` : `${first} & ${second}`
}

// ─── Choosing what hangs ─────────────────────────────────────────────────────

const LAST_SET_KEY = 'kloset.rack.lastOutfits'

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function readLastSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LAST_SET_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function writeLastSet(ids: string[]) {
  try {
    localStorage.setItem(LAST_SET_KEY, JSON.stringify(ids))
  } catch {
    // Private windows can refuse storage; the rack still works, it just may repeat a set.
  }
}

/**
 * Picks `count` outfits at random. Outfits that weren't on the rack last time
 * are preferred, so a refresh shows a different set whenever there are more
 * outfits than fit. `pinned` outfits (e.g. just uploaded) are always included.
 * The user's own outfits come first; samples only fill the remaining spaces.
 */
export function chooseRackOutfits(
  userOutfits: RackOutfit[],
  samples: RackOutfit[],
  { count = RACK_OUTFIT_COUNT, pinned = [] as string[] } = {},
): RackOutfit[] {
  const previous = readLastSet()
  const freshFirst = (outfits: RackOutfit[]) =>
    shuffle(outfits).sort((a, b) => Number(previous.has(a.id)) - Number(previous.has(b.id)))

  const hangable = userOutfits.filter((outfit) => hangingPieces(outfit).length > 0)
  const pinnedOutfits = hangable.filter((outfit) => pinned.includes(outfit.id)).slice(0, count)
  const others = freshFirst(hangable.filter((outfit) => !pinned.includes(outfit.id)))
  const chosen = [...pinnedOutfits, ...others].slice(0, count)
  if (chosen.length < count) chosen.push(...freshFirst(samples).slice(0, count - chosen.length))

  writeLastSet(chosen.map((outfit) => outfit.id))
  console.log('[rack] chose outfits', { user: hangable.length, shown: chosen.map((outfit) => outfit.name) })
  return shuffle(chosen)
}

export interface HangerSlot {
  /** Position along the rod, 0-1 across the usable span. */
  position: number
  piece: RackPiece | null
  outfitId: string | null
}

/**
 * Fills the hangers from the chosen outfits: every outfit gets one hanger,
 * then spare hangers take each outfit's next piece in turn. Pieces from the
 * same outfit hang next to each other, with a slightly wider gap between
 * outfits. Leftover hangers stay empty at the end of the rod.
 */
export function assignHangers(outfits: RackOutfit[], hangerCount = RACK_HANGER_COUNT): HangerSlot[] {
  const queues = outfits.map(hangingPieces)
  const taken = queues.map(() => 0)
  let used = 0
  for (let round = 0; used < hangerCount; round++) {
    let placed = false
    for (let i = 0; i < queues.length && used < hangerCount; i++) {
      if (round < queues[i].length) {
        taken[i]++
        used++
        placed = true
      }
    }
    if (!placed) break
  }

  const filled: Omit<HangerSlot, 'position'>[] = []
  outfits.forEach((outfit, i) => {
    for (const piece of queues[i].slice(0, taken[i])) filled.push({ piece, outfitId: outfit.id })
  })
  while (filled.length < hangerCount) filled.push({ piece: null, outfitId: null })

  // Gap units: 1 between pieces of one outfit, 1.45 between outfits.
  const offsets = [0]
  for (let i = 1; i < filled.length; i++) {
    const sameOutfit = filled[i].outfitId !== null && filled[i].outfitId === filled[i - 1].outfitId
    offsets.push(offsets[i - 1] + (sameOutfit ? 1 : 1.45))
  }
  const span = offsets[offsets.length - 1] || 1
  return filled.map((slot, i) => ({ ...slot, position: offsets[i] / span }))
}

// ─── Built-in samples (shown until the user has six outfits of their own) ─────

function sample(id: string, name: string, pieces: [string, ClothingCategory, SampleGarmentKind | null, string?][]): RackOutfit {
  return {
    id: `sample-${id}`,
    name,
    createdAt: 0,
    sample: true,
    pieces: pieces.map(([pieceName, category, kind, colour], index) => ({
      id: `sample-${id}-${index}`,
      outfitId: `sample-${id}`,
      name: pieceName,
      category,
      width: 112,
      height: 380,
      sample: kind ? { kind, colour: colour ?? '#888' } : undefined,
    })),
  }
}

export const SAMPLE_OUTFITS: RackOutfit[] = [
  sample('weekend', 'Weekend layers', [['Sage wool coat', 'outerwear', 'coat', '#526b5d'], ['Butter knit top', 'tops', 'top', '#d6b871'], ['Tan loafers', 'shoes', null]]),
  sample('terracotta', 'Terracotta midi dress', [['Terracotta midi dress', 'dresses', 'dress', '#a8614e'], ['Woven tote', 'accessories', null]]),
  sample('studio', 'Studio trousers & shirt', [['Slate relaxed shirt', 'tops', 'top', '#788895'], ['Plum wide-leg trousers', 'bottoms', 'bottom', '#64516f']]),
  sample('rose', 'Rose skirt set', [['Dusty rose skirt', 'bottoms', 'skirt', '#a36c70'], ['White ankle boots', 'shoes', null], ['Thin brown belt', 'accessories', null]]),
  sample('office', 'Navy tailoring', [['Navy blazer', 'outerwear', 'coat', '#45566b'], ['Mocha tailored trousers', 'bottoms', 'bottom', '#8b755e']]),
  sample('linen', 'Linen day look', [['Oat linen shirt', 'tops', 'top', '#c9b99b'], ['Olive straight trousers', 'bottoms', 'bottom', '#6b6a45']]),
  sample('evening', 'Evening slip', [['Ink slip dress', 'dresses', 'dress', '#2f3550'], ['Gold clutch', 'accessories', null]]),
  sample('denim', 'Denim & stripes', [['Ecru tee', 'tops', 'top', '#e4dccb'], ['Mid-blue denim skirt', 'bottoms', 'skirt', '#5d7896'], ['Canvas sneakers', 'shoes', null]]),
]

// ─── Storage ────────────────────────────────────────────────────────────────

const DB_NAME = 'kloset-rack'
const STORE = 'outfits'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error(`IndexedDB open failed: ${request.error?.message}`))
  })
}

export async function loadRackOutfits(): Promise<RackOutfit[]> {
  try {
    const db = await openDB()
    const outfits = await new Promise<RackOutfit[]>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
      request.onsuccess = () => resolve(request.result as RackOutfit[])
      request.onerror = () => reject(request.error)
    })
    db.close()
    console.log('[rack] loaded outfits', { count: outfits.length })
    return outfits.sort((a, b) => b.createdAt - a.createdAt)
  } catch (error) {
    console.error('[rack] could not load outfits', error)
    return []
  }
}

export async function saveRackOutfit(outfit: RackOutfit): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(outfit)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  console.log('[rack] saved outfit', { id: outfit.id, name: outfit.name, pieces: outfit.pieces.length })
}
