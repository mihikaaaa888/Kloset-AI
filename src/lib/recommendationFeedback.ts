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
  source?: 'daily-outfit' | 'outfit-photo'
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

export function dislikedOutfitCombinationTypes(feedback: RecommendationFeedback[]): Set<string> {
  return new Set(feedback
    .filter((event) => event.action === 'dislike' && event.source === 'daily-outfit' && event.combinationType)
    .map((event) => event.combinationType as string))
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
    if (similarity === 0) continue

    const weight = event.action === 'like'
      ? (event.source === 'daily-outfit' ? 1.5 : event.source === 'outfit-photo' ? 0.65 : 1)
      : event.action === 'dislike'
        ? (event.source === 'daily-outfit' ? -3 : -1.25)
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
      ? (event.source === 'daily-outfit' ? 1.5 : event.source === 'outfit-photo' ? 0.65 : 1)
      : (event.source === 'daily-outfit' ? -1.5 : -1)
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
