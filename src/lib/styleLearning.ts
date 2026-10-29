import type { ClothingItem } from '@/types'

interface LearnedStyleProfile {
  colours: Record<string, number>
  subcategories: Record<string, number>
  materials: Record<string, number>
  patterns: Record<string, number>
  formality: Record<string, number>
}

function count(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => {
    const normalized = value.trim().toLowerCase()
    if (normalized) result[normalized] = (result[normalized] ?? 0) + 1
    return result
  }, {})
}

/** Learn from items the user chose to keep in their own wardrobe. */
export function learnStyleFromWardrobe(items: ClothingItem[]): LearnedStyleProfile {
  return {
    colours: count(items.flatMap((item) => item.colour)),
    subcategories: count(items.map((item) => item.subcategory ?? '').filter(Boolean)),
    materials: count(items.map((item) => item.material ?? '').filter(Boolean)),
    patterns: count(items.map((item) => item.pattern)),
    formality: count(items.map((item) => item.formality ?? '').filter(Boolean)),
  }
}

export function affinityForLearnedTraits(
  learned: LearnedStyleProfile | undefined,
  traits: { colours?: string[]; subcategory?: string; material?: string; pattern?: string; formality?: string },
): number {
  if (!learned) return 0
  const repeated = (map: Record<string, number> | undefined, value?: string) => {
    if (!value) return 0
    const hits = map?.[value.toLowerCase()] ?? 0
    return hits > 1 ? Math.min(4, (hits - 1) * 1.5) : hits ? 0.5 : 0
  }
  return Math.max(0, ...(traits.colours ?? []).map((colour) => repeated(learned.colours, colour)))
    + repeated(learned.subcategories, traits.subcategory)
    + repeated(learned.materials, traits.material)
    + repeated(learned.patterns, traits.pattern)
    + repeated(learned.formality, traits.formality)
}
