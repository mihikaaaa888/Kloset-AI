import type { ClothingItem, ClothingCategory, Pattern, Occasion, StylePreference } from '@/types'

export type FeedbackAction = 'like' | 'dislike' | 'dwell'

export interface RecommendationTraits {
  category: ClothingCategory
  pairingCategories?: ClothingCategory[]
  subcategory?: string
  colours: string[]
  material?: string
  pattern?: Pattern | string
  formality?: string
  occasions: Occasion[] | string[]
  aesthetics?: StylePreference[]
}

export interface RecommendationFeedback {
  id: string
  itemId: string
  action: FeedbackAction
  traits: RecommendationTraits
  dwellSeconds?: number
  /** Shared by the piece-level events created from one outfit rating. */
  combinationId?: string
  /** Garment-type signature used to avoid repeating a disliked pairing. */
  combinationType?: string
  /** On a disliked outfit: true for the piece named as not fitting, false for the rest. */
  misfit?: boolean
  // 'daily-outfit': Home's outfit of the day; 'stylist-outfit': a What to wear result.
  // Both are rated whole outfits and weigh the same.
  source?: 'daily-outfit' | 'stylist-outfit' | 'outfit-photo'
  createdAt: string
}

export interface OutfitPhotoStyleSignal {
  items: Array<{
    category: ClothingCategory
    subcategory?: string
    colours: string[]
    pattern?: Pattern | string
    material?: string
    formality?: string
  }>
  confidence: number
}

function normalizeGarmentType(value?: string) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function outfitCombinationType(items: ClothingItem[]): string {
  return items.map((item) => `${item.category}:${normalizeGarmentType(item.subcategory || item.name)}`).sort().join('|')
}

const isOutfitRating = (event: RecommendationFeedback) => event.source === 'daily-outfit' || event.source === 'stylist-outfit'

// A disliked outfit's kind of pairing (e.g. jeans + tee + sneakers) is skipped
// for a few weeks, not forever: permanent bans piled up until only a few
// pairings were left and "Try another" kept showing the same looks.
const DISLIKED_PAIRING_DAYS = 21
export function dislikedOutfitCombinationTypes(feedback: RecommendationFeedback[]): Set<string> {
  const since = Date.now() - DISLIKED_PAIRING_DAYS * 86_400_000
  return new Set(feedback
    .filter((event) => event.action === 'dislike' && isOutfitRating(event) && event.combinationType && new Date(event.createdAt).getTime() >= since)
    .map((event) => event.combinationType as string))
}

// ─── What goes together ───────────────────────────────────────────────────────
// Rating a whole outfit down says its pieces don't go together, more than that
// each piece is bad. Every pair of pieces in it is remembered as a clash, and
// its colour pairs (when one of them isn't a neutral) as a gentler hint.
// A liked outfit marks its pairs as working.

const NEUTRAL_HINT = new Set(['black', 'white', 'off white', 'ivory', 'cream', 'beige', 'grey', 'gray', 'charcoal', 'navy', 'tan', 'camel', 'brown', 'denim', 'khaki'])
const pairKey = (a: string, b: string) => (a < b ? `${a}+${b}` : `${b}+${a}`)

export interface OutfitPairVerdicts {
  /** Piece-id pairs from disliked outfits. */
  clashingPieces: Set<string>
  /** Piece-id pairs from liked outfits. */
  workingPieces: Set<string>
  /** Colour pairs from disliked outfits, with how many outfits had them. */
  clashingColours: Map<string, number>
}

const verdictCache = new WeakMap<RecommendationFeedback[], OutfitPairVerdicts>()

export function outfitPairVerdicts(feedback: RecommendationFeedback[]): OutfitPairVerdicts {
  const cached = verdictCache.get(feedback)
  if (cached) return cached
  // Latest rating of each outfit: its pieces, their colours, and which ones
  // were named as the piece that didn't fit.
  type Piece = { id: string; colour?: string; misfit?: boolean }
  const outfits = new Map<string, { action: FeedbackAction; createdAt: string; pieces: Piece[] }>()
  for (const event of feedback) {
    if (!isOutfitRating(event) || !event.combinationId || event.action === 'dwell') continue
    const piece: Piece = { id: event.itemId.slice(event.itemId.lastIndexOf(':') + 1), colour: event.traits.colours[0]?.toLowerCase(), misfit: event.misfit }
    const current = outfits.get(event.combinationId)
    if (!current || event.createdAt > current.createdAt) outfits.set(event.combinationId, { action: event.action, createdAt: event.createdAt, pieces: [piece] })
    else if (event.createdAt === current.createdAt) current.pieces.push(piece)
  }
  const verdicts: OutfitPairVerdicts = { clashingPieces: new Set(), workingPieces: new Set(), clashingColours: new Map() }
  const addColourClash = (a?: string, b?: string) => {
    if (!a || !b || a === b || (NEUTRAL_HINT.has(a) && NEUTRAL_HINT.has(b))) return
    const key = pairKey(a, b)
    verdicts.clashingColours.set(key, (verdicts.clashingColours.get(key) ?? 0) + 1)
  }
  for (const outfit of outfits.values()) {
    const { pieces } = outfit
    const named = outfit.action === 'dislike' && pieces.some((piece) => piece.misfit)
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        const [a, b] = [pieces[i], pieces[j]]
        const key = pairKey(a.id, b.id)
        if (outfit.action === 'like') { verdicts.workingPieces.add(key); continue }
        // "The shoes don't fit": only the shoes' pairs clash; the rest of the
        // outfit went well together.
        if (named && !a.misfit && !b.misfit) { verdicts.workingPieces.add(key); continue }
        if (named && a.misfit && b.misfit) continue
        verdicts.clashingPieces.add(key)
        addColourClash(a.colour, b.colour)
      }
    }
  }
  verdictCache.set(feedback, verdicts)
  return verdicts
}

/**
 * The feedback events for rating a whole outfit (one per piece). `misfitIds`
 * names the pieces that didn't go with the rest, when the person said which.
 */
export function outfitRatingEvents(
  items: ClothingItem[],
  action: 'like' | 'dislike',
  source: 'daily-outfit' | 'stylist-outfit',
  options: { misfitIds?: string[]; occasions?: Occasion[]; createdAt?: string } = {},
): RecommendationFeedback[] {
  const combinationId = items.map((item) => item.id).sort().join('|')
  const combinationType = outfitCombinationType(items)
  const misfits = new Set(action === 'dislike' ? options.misfitIds ?? [] : [])
  const createdAt = options.createdAt ?? new Date().toISOString()
  return items.map((item) => ({
    id: `${source}:${combinationId}:${item.id}`,
    itemId: `${source}:${combinationId}:${item.id}`,
    action,
    traits: options.occasions ? { ...traitsFromWardrobe(item), occasions: options.occasions } : traitsFromWardrobe(item),
    combinationId,
    combinationType,
    ...(misfits.size ? { misfit: misfits.has(item.id) } : {}),
    source,
    createdAt,
  }))
}

/** Whether a piece was in a disliked outfit with any of the pieces already picked. */
export function clashesWithPicked(itemId: string, selected: Array<{ id: string }>, verdicts: OutfitPairVerdicts): boolean {
  return selected.some((piece) => verdicts.clashingPieces.has(pairKey(itemId, piece.id)))
}

/** How well a piece goes with the pieces already picked, from past outfit ratings. */
export function pairingFeedbackScore(item: { id: string; colour: string[] }, selected: Array<{ id: string; colour: string[] }>, verdicts: OutfitPairVerdicts): number {
  let score = 0
  let colourScore = 0
  const colour = item.colour[0]?.toLowerCase()
  for (const piece of selected) {
    const key = pairKey(item.id, piece.id)
    if (verdicts.clashingPieces.has(key)) score -= 15
    else if (verdicts.workingPieces.has(key)) score += 1.5
    const other = piece.colour[0]?.toLowerCase()
    if (colour && other && colour !== other) colourScore -= 2 * (verdicts.clashingColours.get(pairKey(colour, other)) ?? 0)
  }
  return score + Math.max(-5, colourScore)
}

/** Treat items visible together in a user-uploaded outfit as a gentle style signal. */
export function feedbackFromOutfitPhoto(signal: OutfitPhotoStyleSignal, photoId: string, createdAt = new Date().toISOString()): RecommendationFeedback[] {
  if (!Number.isFinite(signal.confidence) || signal.confidence < 0.45) return []
  const pairingCategories = [...new Set(signal.items.map((item) => item.category))]
  return signal.items.slice(0, 8).map((item, index) => {
    const itemId = `outfit-photo:${photoId}:${index}`
    return {
      id: itemId,
      itemId,
      action: 'like' as const,
      source: 'outfit-photo' as const,
      traits: {
        category: item.category,
        pairingCategories: pairingCategories.filter((category) => category !== item.category),
        subcategory: item.subcategory,
        colours: item.colours.slice(0, 4),
        pattern: item.pattern,
        material: item.material,
        formality: item.formality,
        occasions: [],
      },
      createdAt,
    }
  })
}

export function traitsFromWardrobe(item: ClothingItem): RecommendationTraits {
  return {
    category: item.category,
    subcategory: item.subcategory,
    colours: item.colour,
    material: item.material,
    pattern: item.pattern,
    formality: item.formality,
    occasions: item.occasions,
  }
}

export function feedbackFromFavourites(items: ClothingItem[]): RecommendationFeedback[] {
  return items.filter((item) => item.isFavourite).map((item) => ({
    id: `favourite:${item.id}`,
    itemId: item.id,
    action: 'like' as const,
    traits: traitsFromWardrobe(item),
    createdAt: item.updatedAt || item.createdAt,
  }))
}

/** Score how well a product matches the user's likes, dislikes and considered views. */
export function scoreRecommendationFeedback(
  traits: RecommendationTraits,
  feedback: RecommendationFeedback[],
): number {
  let score = 0
  const normalize = (value?: string) => value?.trim().toLowerCase() ?? ''
  const overlap = (left: string[] = [], right: string[] = []) => {
    const values = new Set(right.map(normalize).filter(Boolean))
    return left.some((value) => values.has(normalize(value)))
  }

  for (const event of feedback) {
    // The pieces that went fine in an outfit whose other piece didn't fit.
    if (event.action === 'dislike' && event.misfit === false) continue
    const ageDays = Math.max(0, (Date.now() - new Date(event.createdAt).getTime()) / 86_400_000)
    const decay = Math.exp(-ageDays / 120)
    const other = event.traits
    let similarity = 0
    if (traits.category === other.category) similarity += 0.5
    if (other.pairingCategories?.includes(traits.category) || traits.pairingCategories?.includes(other.category)) similarity += 0.35
    if (normalize(traits.subcategory) && normalize(traits.subcategory) === normalize(other.subcategory)) similarity += 1.5
    if (overlap(traits.colours, other.colours)) similarity += 0.8
    if (normalize(traits.material) && normalize(traits.material) === normalize(other.material)) similarity += 0.65
    if (normalize(traits.pattern) && normalize(traits.pattern) === normalize(other.pattern)) similarity += 0.65
    if (normalize(traits.formality) && normalize(traits.formality) === normalize(other.formality)) similarity += 0.55
    if (overlap(traits.occasions, other.occasions)) similarity += 0.35
    if (overlap(traits.aesthetics, other.aesthetics)) similarity += 1.1
    // Sharing only a category (or a pairing) isn't similar enough: every
    // disliked top used to pull down every top until all scored the same.
    if (similarity < 1.5) continue

    // Rating a whole outfit is mostly a verdict on the combination (handled by
    // outfitPairVerdicts and dislikedOutfitCombinationTypes); each piece in it only gets a light
    // nudge. At full weight one disliked look sank every piece in it, and a
    // liked look pinned its pieces to the top of every "Try another".
    const weight = event.action === 'like'
      ? (isOutfitRating(event) ? 0.5 : event.source === 'outfit-photo' ? 0.65 : 1)
      : event.action === 'dislike'
        ? (isOutfitRating(event) ? -0.25 : -1.25)
        : Math.min(0.35, Math.max(0, (event.dwellSeconds ?? 0) - 3) * 0.07)
    score += similarity * weight * decay
  }

  return Math.max(-10, Math.min(10, score))
}

/** A compact, safe-to-send summary for Kaia; excludes item names, notes and other free text. */
export function summarizeRecommendationFeedback(feedback: RecommendationFeedback[]): string {
  const counts = new Map<string, { likes: number; dislikes: number; dwell: number }>()
  const safeTrait = (value: string) => value.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().slice(0, 32)
  for (const event of feedback) {
    const weight = event.action === 'like' ? (event.source === 'outfit-photo' ? 0.35 : 1) : event.action === 'dislike' ? -1 : 0
    const candidates = [
      event.traits.subcategory,
      ...event.traits.colours.slice(0, 2),
      event.traits.material,
      event.traits.pattern,
      ...(event.traits.aesthetics ?? []),
    ].filter(Boolean) as string[]
    for (const raw of candidates) {
      const label = safeTrait(raw)
      if (!label) continue
      const entry = counts.get(label) ?? { likes: 0, dislikes: 0, dwell: 0 }
      if (weight > 0) entry.likes += weight
      if (weight < 0) entry.dislikes -= weight
      if (event.action === 'dwell') entry.dwell += 1
      counts.set(label, entry)
    }
  }
  const ranked = [...counts.entries()]
    .map(([label, value]) => ({ label, score: value.likes * 2 - value.dislikes * 2.5 + Math.min(2, value.dwell * 0.25) }))
    .filter((entry) => entry.score >= 2 || entry.score <= -2)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 10)
  const likes = ranked.filter((entry) => entry.score > 0).map((entry) => entry.label)
  const avoids = ranked.filter((entry) => entry.score < 0).map((entry) => entry.label)
  return [
    likes.length ? `Often liked: ${likes.join(', ')}` : '',
    avoids.length ? `Often skipped: ${avoids.join(', ')}` : '',
  ].filter(Boolean).join('. ')
}

export interface TasteProfile {
  /** Thumbs up / down counted (views excluded). */
  ratedCount: number
  /** 'prints' or 'solids' once one clearly wins, else null. */
  patternLean: 'prints' | 'solids' | null
  loves: { colours: string[]; patterns: string[]; styles: string[]; materials: string[]; pieces: string[] }
  avoids: { colours: string[]; patterns: string[]; styles: string[]; materials: string[]; pieces: string[] }
}

/**
 * What a user's likes and dislikes say about their taste, per dimension —
 * shown on For You so the learning is visible ("leans towards prints, loves
 * black and navy"). Uses the same weights and fading as recommendation
 * scoring: outfit ratings count more, older ratings count less.
 */
export function learnTasteProfile(feedback: RecommendationFeedback[]): TasteProfile {
  const dimensions = ['colours', 'patterns', 'styles', 'materials', 'pieces'] as const
  const scores = Object.fromEntries(dimensions.map((d) => [d, new Map<string, number>()])) as Record<(typeof dimensions)[number], Map<string, number>>
  const add = (dimension: (typeof dimensions)[number], raw: string | undefined, weight: number) => {
    const label = raw?.toLowerCase().replace(/[^a-z0-9 &-]/g, '').trim()
    if (!label || label === 'other' || label === 'mixed') return
    scores[dimension].set(label, (scores[dimension].get(label) ?? 0) + weight)
  }
  let prints = 0
  let solids = 0
  let ratedCount = 0

  for (const event of feedback) {
    if (event.action === 'dwell') continue
    ratedCount += 1
    const ageDays = Math.max(0, (Date.now() - new Date(event.createdAt).getTime()) / 86_400_000)
    const decay = Math.exp(-ageDays / 120)
    const base = event.action === 'like'
      ? (isOutfitRating(event) ? 0.6 : event.source === 'outfit-photo' ? 0.65 : 1)
      : (isOutfitRating(event) ? -0.6 : -1)
    const weight = base * decay
    const { traits } = event
    for (const colour of traits.colours.slice(0, 2)) add('colours', colour, weight)
    if (traits.pattern) {
      if (traits.pattern === 'solid') solids += weight
      else if (traits.pattern !== 'mixed') { prints += weight; add('patterns', traits.pattern, weight) }
    }
    for (const style of traits.aesthetics ?? []) add('styles', style, weight)
    add('materials', traits.material, weight)
    // Pairing cards join subcategories with " + "; count each piece type.
    for (const piece of (traits.subcategory ?? '').split('+')) add('pieces', piece, weight)
  }

  // Needs a clear signal: at least two net ratings' worth, and ahead of the other side.
  const pick = (map: Map<string, number>, sign: 1 | -1) => [...map.entries()]
    .filter(([, score]) => score * sign >= 1.5)
    .sort((a, b) => (b[1] - a[1]) * sign)
    .slice(0, 4)
    .map(([label]) => label)
  const loves = Object.fromEntries(dimensions.map((d) => [d, pick(scores[d], 1)])) as TasteProfile['loves']
  const avoids = Object.fromEntries(dimensions.map((d) => [d, pick(scores[d], -1)])) as TasteProfile['avoids']
  const patternLean = prints >= 2 && prints > solids + 1 ? 'prints' : solids >= 2 && solids > prints + 1 ? 'solids' : null
  return { ratedCount, patternLean, loves, avoids }
}
