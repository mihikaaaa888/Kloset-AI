import { CATALOG_ITEMS } from '@/lib/catalogData'
import type { CatalogItem, ClothingCategory, ClothingItem, StylePreference, UserProfile } from '@/types'
import { affinityForLearnedTraits } from '@/lib/styleLearning'
import { learnStyleFromWardrobe } from '@/lib/styleLearning'

// ─── Budget ───────────────────────────────────────────────────────────────────
// One dropdown drives every shopping mode. Buying filters on the per-piece
// price; renting filters on the weekly rental price, so each band carries
// both a buy and a rent range.

export type BudgetId = 'any' | 'low' | 'mid' | 'high' | 'luxe'

interface BudgetBand {
  id: BudgetId
  buyLabel: string
  rentLabel: string
  buy: [number, number]
  rent: [number, number]
}

export const BUDGET_BANDS: BudgetBand[] = [
  { id: 'any',  buyLabel: 'Any budget',          rentLabel: 'Any budget',            buy: [0, Infinity],      rent: [0, Infinity] },
  { id: 'low',  buyLabel: 'Under ₹2,500',        rentLabel: 'Under ₹500 / wk',       buy: [0, 2499],          rent: [0, 499] },
  { id: 'mid',  buyLabel: '₹2,500 – ₹6,000',     rentLabel: '₹500 – ₹1,000 / wk',    buy: [2500, 5999],       rent: [500, 999] },
  { id: 'high', buyLabel: '₹6,000 – ₹15,000',    rentLabel: '₹1,000 – ₹2,000 / wk',  buy: [6000, 14999],      rent: [1000, 1999] },
  { id: 'luxe', buyLabel: '₹15,000+',            rentLabel: '₹2,000+ / wk',          buy: [15000, Infinity],  rent: [2000, Infinity] },
]

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

/** ₹2,499 — Indian digit grouping, no paise. */
export function formatINR(amount: number): string {
  return INR.format(amount)
}

const band = (id: BudgetId) => BUDGET_BANDS.find((b) => b.id === id) ?? BUDGET_BANDS[0]

export function fitsBuyBudget(item: CatalogItem, budget: BudgetId): boolean {
  const [lo, hi] = band(budget).buy
  return item.estimatedPrice >= lo && item.estimatedPrice <= hi
}

export function fitsRentBudget(item: CatalogItem, budget: BudgetId): boolean {
  const [lo, hi] = band(budget).rent
  return item.rentPricePerWeek >= lo && item.rentPricePerWeek <= hi
}

// ─── Personal ranking ─────────────────────────────────────────────────────────
// Pieces that match the user's onboarding answers (style aesthetic, colours,
// usual occasions), and categories their Kloset is missing or thin in, float
// to the top — that's what makes it "personal".

function gapCategories(wardrobe: ClothingItem[]): Set<ClothingCategory> {
  const counts = new Map<ClothingCategory, number>()
  for (const i of wardrobe) counts.set(i.category, (counts.get(i.category) ?? 0) + 1)
  const all: ClothingCategory[] = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories']
  return new Set(all.filter((c) => (counts.get(c) ?? 0) <= 1))
}

function personalScore(item: CatalogItem, profile: UserProfile | null, gaps: Set<ClothingCategory>, learnedStyle: ReturnType<typeof learnStyleFromWardrobe>): number {
  const styles = profile?.stylePreferences ?? []
  const lower = (list: string[] | undefined) => (list ?? []).map((c) => c.toLowerCase())
  const favourite = lower(profile?.favouriteColours)
  const avoid = lower(profile?.avoidColours)
  const colours = lower(item.colours)

  let score = 0
  score += item.styleAesthetics.filter((s) => styles.includes(s)).length * 2
  if (colours.some((c) => favourite.includes(c))) score += 1
  if (colours.some((c) => avoid.includes(c))) score -= 3
  score += Math.min(2, item.occasions.filter((o) => profile?.typicalOccasions?.includes(o)).length)
  score += affinityForLearnedTraits(learnedStyle, {
    colours: item.colours,
    subcategory: item.subcategory,
    material: item.material,
    pattern: item.pattern,
    formality: item.formality,
  })
  if (gaps.has(item.category)) score += 1
  return score
}

export function rankForUser(items: CatalogItem[], profile: UserProfile | null, wardrobe: ClothingItem[]): CatalogItem[] {
  const gaps = gapCategories(wardrobe)
  const learnedStyle = learnStyleFromWardrobe(wardrobe)
  return [...items].sort((a, b) => personalScore(b, profile, gaps, learnedStyle) - personalScore(a, profile, gaps, learnedStyle))
}

// ─── Rent ─────────────────────────────────────────────────────────────────────
// Renting makes sense for occasion pieces and investment-price pieces, not
// everyday basics.

export function isRentable(item: CatalogItem): boolean {
  const occasionPiece = item.occasions.some((o) => ['formal', 'special-event', 'date-night'].includes(o))
  const investmentPiece = item.priceRange === 'premium' || item.priceRange === 'luxury'
  return occasionPiece || investmentPiece || item.category === 'dresses'
}

// ─── Complete a piece ─────────────────────────────────────────────────────────
// Given one piece (from the user's Kloset, or read from an uploaded photo),
// recommend catalog pieces in the categories that finish an outfit around it.

export interface PieceAnchor {
  name: string
  category: ClothingCategory
  colours: string[]
  occasions: string[]
  formality?: string | null
  imageUrl?: string | null
}

const COMPLEMENTS: Record<ClothingCategory, ClothingCategory[]> = {
  tops: ['bottoms', 'outerwear', 'shoes', 'accessories'],
  bottoms: ['tops', 'outerwear', 'shoes', 'accessories'],
  dresses: ['outerwear', 'shoes', 'accessories'],
  outerwear: ['tops', 'bottoms', 'shoes'],
  shoes: ['tops', 'bottoms', 'accessories'],
  accessories: ['tops', 'bottoms', 'dresses'],
}

const NEUTRALS = new Set(['black', 'white', 'cream', 'beige', 'camel', 'tan', 'navy', 'grey', 'charcoal', 'brown', 'denim'])
const isNeutral = (c: string) => NEUTRALS.has(c.toLowerCase())

function complementScore(item: CatalogItem, anchor: PieceAnchor, styles: StylePreference[]): number {
  let score = 0
  // Shared occasions — the pieces need to be worn to the same places.
  score += item.occasions.filter((o) => anchor.occasions.includes(o)).length * 2
  // Colour harmony: neutrals go with anything; two non-neutral statement
  // colours compete, so one bold piece per outfit.
  const anchorBold = anchor.colours.some((c) => !isNeutral(c))
  const itemBold = item.colours.some((c) => !isNeutral(c))
  if (!itemBold) score += 2
  else if (!anchorBold) score += 1
  else score -= 1
  // Matching formality level.
  if (anchor.formality && item.formality && item.formality.toLowerCase() === anchor.formality.toLowerCase()) score += 1
  // The user's own aesthetic.
  score += item.styleAesthetics.filter((s) => styles.includes(s)).length
  return score
}

export interface PieceRecommendationGroup {
  category: ClothingCategory
  items: CatalogItem[]
}

export function recommendForPiece(
  anchor: PieceAnchor,
  budget: BudgetId,
  profile: UserProfile | null,
  perCategory = 4
): PieceRecommendationGroup[] {
  const styles = profile?.stylePreferences ?? []
  const groups = COMPLEMENTS[anchor.category].map((category) => ({
    category,
    items: CATALOG_ITEMS
      .filter((i) => i.category === category && fitsBuyBudget(i, budget))
      .sort((a, b) => complementScore(b, anchor, styles) - complementScore(a, anchor, styles))
      .slice(0, perCategory),
  })).filter((g) => g.items.length > 0)

  console.log('[shopping] complete-a-piece', { anchor: anchor.name, category: anchor.category, budget, groups: groups.length })
  return groups
}
