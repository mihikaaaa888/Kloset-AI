import type { CatalogItem, ClothingItem, ClothingCategory, Pattern, Occasion, StylePreference } from '@/types'

export type FeedbackAction = 'like' | 'dislike' | 'dwell'

export interface RecommendationTraits {
  category: ClothingCategory
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
  createdAt: string
}

export function traitsFromCatalog(item: CatalogItem): RecommendationTraits {
  return {
    category: item.category,
    subcategory: item.subcategory,
    colours: item.colours,
    material: item.material,
    pattern: item.pattern,
    formality: item.formality,
    occasions: item.occasions,
    aesthetics: item.styleAesthetics,
  }
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
    if (normalize(traits.subcategory) && normalize(traits.subcategory) === normalize(other.subcategory)) similarity += 1.5
    if (overlap(traits.colours, other.colours)) similarity += 0.8
    if (normalize(traits.material) && normalize(traits.material) === normalize(other.material)) similarity += 0.65
    if (normalize(traits.pattern) && normalize(traits.pattern) === normalize(other.pattern)) similarity += 0.65
    if (normalize(traits.formality) && normalize(traits.formality) === normalize(other.formality)) similarity += 0.55
    if (overlap(traits.occasions, other.occasions)) similarity += 0.35
    if (overlap(traits.aesthetics, other.aesthetics)) similarity += 1.1
    if (similarity === 0) continue

    const weight = event.action === 'like'
      ? 1
      : event.action === 'dislike'
        ? -1.25
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
    const weight = event.action === 'like' ? 1 : event.action === 'dislike' ? -1 : 0
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
      if (weight > 0) entry.likes += 1
      if (weight < 0) entry.dislikes += 1
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
