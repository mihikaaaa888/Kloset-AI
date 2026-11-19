import { scoreColourSets, type ColourHarmonyConfig } from '@/lib/colourHarmony'
import { ALL_CATALOG_ITEMS, matchesStylePreference } from '@/lib/catalogData'
import type { CatalogItem, ClothingCategory, ClothingItem, StylePreference, UserProfile } from '@/types'
import { affinityForLearnedTraits } from '@/lib/styleLearning'
import { learnStyleFromWardrobe } from '@/lib/styleLearning'
import { scoreRecommendationFeedback, traitsFromCatalog, feedbackFromFavourites } from '@/lib/recommendationFeedback'
import type { RecommendationFeedback } from '@/lib/recommendationFeedback'

// ─── Budget ───────────────────────────────────────────────────────────────────
// One dropdown drives every shopping mode. Buying filters on the per-piece
// price; renting filters on the weekly rental price, so each band carries
// both a buy and a rent range.

export type BudgetId = 'any' | 'under1000' | '1000to2500' | '2500to4000' | '4000to6500' | 'custom'

interface BudgetBand {
  id: BudgetId
  buyLabel: string
  rentLabel: string
  buy: [number, number]
  rent: [number, number]
}

export const BUDGET_BANDS: BudgetBand[] = [
  { id: 'any',  buyLabel: 'None',               rentLabel: 'None',                  buy: [0, Infinity],      rent: [0, Infinity] },
  { id: 'under1000', buyLabel: 'Under ₹1,000', rentLabel: 'Under ₹1,000 / wk', buy: [0, 999], rent: [0, 999] },
  { id: '1000to2500', buyLabel: '₹1,000 – ₹2,500', rentLabel: '₹1,000 – ₹2,500 / wk', buy: [1000, 2499], rent: [1000, 2499] },
  { id: '2500to4000', buyLabel: '₹2,500 – ₹4,000', rentLabel: '₹2,500 – ₹4,000 / wk', buy: [2500, 3999], rent: [2500, 3999] },
  { id: '4000to6500', buyLabel: '₹4,000 – ₹6,500', rentLabel: '₹4,000 – ₹6,500 / wk', buy: [4000, 6500], rent: [4000, 6500] },
  { id: 'custom', buyLabel: 'Custom', rentLabel: 'Custom', buy: [0, Infinity], rent: [0, Infinity] },
]

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

/** ₹2,499 — Indian digit grouping, no paise. */
export function formatINR(amount: number): string {
  return INR.format(amount)
}

const band = (id: BudgetId) => BUDGET_BANDS.find((b) => b.id === id) ?? BUDGET_BANDS[0]

export function fitsBuyBudget(item: CatalogItem, budget: BudgetId, customAmount?: number): boolean {
  const [lo, hi] = band(budget).buy
  if (budget === 'custom') return Number.isFinite(customAmount) && customAmount! > 0 && item.estimatedPrice <= customAmount!
  return item.estimatedPrice >= lo && item.estimatedPrice <= hi
}

export function fitsRentBudget(item: CatalogItem, budget: BudgetId, customAmount?: number): boolean {
  const [lo, hi] = band(budget).rent
  if (budget === 'custom') return Number.isFinite(customAmount) && customAmount! > 0 && item.rentPricePerWeek <= customAmount!
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

function personalScore(item: CatalogItem, profile: UserProfile | null, gaps: Set<ClothingCategory>, learnedStyle: ReturnType<typeof learnStyleFromWardrobe>, feedback: RecommendationFeedback[]): number {
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
  score += scoreRecommendationFeedback(traitsFromCatalog(item), feedback)
  if (gaps.has(item.category)) score += 1
  return score
}

export function rankForUser(items: CatalogItem[], profile: UserProfile | null, wardrobe: ClothingItem[], feedback: RecommendationFeedback[] = []): CatalogItem[] {
  const gaps = gapCategories(wardrobe)
  const learnedStyle = learnStyleFromWardrobe(wardrobe)
  const signals = [...feedback, ...feedbackFromFavourites(wardrobe)]
  return [...items].sort((a, b) => personalScore(b, profile, gaps, learnedStyle, signals) - personalScore(a, profile, gaps, learnedStyle, signals))
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
    items: ALL_CATALOG_ITEMS
      .filter((i) => {
        return matchesStylePreference(i, profile?.genderStylePreference) && i.category === category && fitsBuyBudget(i, budget)
      })
      .sort((a, b) => complementScore(b, anchor, styles) - complementScore(a, anchor, styles))
      .slice(0, perCategory),
  })).filter((g) => g.items.length > 0)

  console.log('[shopping] complete-a-piece', { anchor: anchor.name, category: anchor.category, budget, groups: groups.length })
  return groups
}

// ─── Suggested from your Kloset ───────────────────────────────────────────────
// "Suggested for you" on Shop: pieces that work with what the user already
// owns. Taste still counts, but the deciding signals are the wardrobe's:
// does it pair (complementary category, colours that go) with pieces they
// have, does it fill a category they're short on, and is it not a near-copy
// of something they already own.

export interface KlosetSuggestion {
  item: CatalogItem
  /** Short "why", e.g. "Goes with your Black Wide-Leg Trousers". */
  reason: string | null
}

const normalizeWord = (value?: string) => (value ?? '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()
const CATEGORY_NOUN: Record<ClothingCategory, string> = { tops: 'tops', bottoms: 'bottoms', dresses: 'dresses', outerwear: 'layers', shoes: 'shoes', accessories: 'accessories' }

function partnerRank(category: ClothingCategory, partner: ClothingCategory): number {
  const index = COMPLEMENTS[category].indexOf(partner)
  return index === -1 ? 9 : index
}

export function suggestFromKloset(
  items: CatalogItem[],
  profile: UserProfile | null,
  wardrobe: ClothingItem[],
  feedback: RecommendationFeedback[],
  colourConfig: ColourHarmonyConfig,
): KlosetSuggestion[] {
  if (!wardrobe.length) return rankForUser(items, profile, wardrobe, feedback).map((item) => ({ item, reason: null }))
  const gaps = gapCategories(wardrobe)
  const learnedStyle = learnStyleFromWardrobe(wardrobe)
  const signals = [...feedback, ...feedbackFromFavourites(wardrobe)]

  const scored = items.map((item) => {
    // Owned pieces this one would be worn with.
    const partners = wardrobe.filter((owned) => COMPLEMENTS[item.category].includes(owned.category) || COMPLEMENTS[owned.category]?.includes(item.category))
    const matches = partners
      .map((owned) => {
        const engine = scoreColourSets(item.colours, owned.colour, colourConfig)?.score ?? 60
        // Neutrals go with anything; the engine underrates high contrast (white + black ≈ 64).
        const neutral = [...item.colours, ...owned.colour].some((c) => NEUTRALS.has(c.toLowerCase()))
        return { owned, colour: neutral ? Math.max(engine, 75) : engine }
      })
      .filter((m) => m.colour >= 70)
      // Name the most natural partner first (a top's bottoms before its shoes), then the best colour match.
      .sort((a, b) => partnerRank(item.category, a.owned.category) - partnerRank(item.category, b.owned.category) || b.colour - a.colour || Number(b.owned.isFavourite) - Number(a.owned.isFavourite))
    const pairing = Math.min(3, matches.length * 0.6) + (matches[0] ? (matches[0].colour / 100) * 1.5 : 0)

    // Already owns something very like it.
    const sameType = wardrobe.filter((owned) => owned.category === item.category && normalizeWord(owned.subcategory) && normalizeWord(owned.subcategory) === normalizeWord(item.subcategory))
    const nameWords = (name: string) => new Set(normalizeWord(name).split(' ').filter((word) => word.length > 2))
    const itemWords = nameWords(item.name)
    // Same type and colour, or nearly the same name ("White Leather Sneakers" twice).
    const nearCopy = sameType.some((owned) => owned.colour.some((c) => item.colours.map((x) => x.toLowerCase()).includes(c.toLowerCase())))
      || wardrobe.some((owned) => {
        if (owned.category !== item.category) return false
        const ownedWords = nameWords(owned.name)
        const shared = [...itemWords].filter((word) => ownedWords.has(word)).length
        return shared >= Math.max(2, Math.ceil(Math.min(itemWords.size, ownedWords.size) * 0.7))
      })
    const duplicate = sameType.length ? -1 : 0

    const gap = gaps.has(item.category) ? 1.5 : 0
    const score = personalScore(item, profile, new Set(), learnedStyle, signals) + pairing + duplicate + gap

    const reason = matches.length >= 2
      ? `Goes with your ${matches[0].owned.name} and ${matches.length - 1} more`
      : matches.length === 1
        ? `Goes with your ${matches[0].owned.name}`
        : gap
          ? `You have few ${CATEGORY_NOUN[item.category]}`
          : null
    return { item, reason, score, nearCopy }
  })
  // A balanced set: at most two per category up front (accessories "go with"
  // everything and would otherwise fill the row), no repeated names; the
  // rest follow in score order.
  // Something they already own isn't a suggestion; it still shows under More pieces.
  const ranked = scored.filter((entry) => !entry.nearCopy).sort((a, b) => b.score - a.score)
  const perCategory = new Map<ClothingCategory, number>()
  const names = new Set<string>()
  const lead: typeof ranked = []
  const tail: typeof ranked = []
  for (const entry of ranked) {
    const name = entry.item.name.toLowerCase()
    if (names.has(name)) continue
    names.add(name)
    const count = perCategory.get(entry.item.category) ?? 0
    if (count < 2) { perCategory.set(entry.item.category, count + 1); lead.push(entry) } else tail.push(entry)
  }
  return [...lead, ...tail].map(({ item, reason }) => ({ item, reason }))
}
