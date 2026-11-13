/**
 * Kloset Stylist Engine
 *
 * Public interface is designed for an easy drop-in AI API swap:
 *   generateOutfit(request, wardrobe, profile, attempt?) → Promise<StylistEngineResult>
 *
 * Replace the mock implementation below with a fetch() to your LLM endpoint
 * without touching any component code.
 */

import type { ClothingItem, Occasion, StylePreference, Season, UserProfile } from '@/types'
import { affinityForLearnedTraits } from '@/lib/styleLearning'
import { learnStyleFromWardrobe } from '@/lib/styleLearning'
import { scoreColourSets } from '@/lib/colourHarmony'
import type { ColourHarmonyConfig } from '@/lib/colourHarmony'
import { getColourHarmonyConfig } from '@/lib/colourHarmonyService'
import indianWearGuide from '../../indian-wear-guide.json'
import recommendationWorkbookGuide from '../../recommendation-workbook-guidance.json'
import { scoreRecommendationFeedback, traitsFromWardrobe, feedbackFromFavourites } from '@/lib/recommendationFeedback'
import type { RecommendationFeedback } from '@/lib/recommendationFeedback'

// ─── Public types ─────────────────────────────────────────────────────────────

export type WeatherCondition = 'hot' | 'warm' | 'cool' | 'cold' | 'rainy'

export type Mood =
  | 'confident'
  | 'relaxed'
  | 'polished'
  | 'creative'
  | 'playful'
  | 'understated'
  | 'romantic'

export interface StyleRequest {
  occasion: Occasion
  customOccasion?: string
  weather: WeatherCondition
  mood: Mood
  stylePreference?: StylePreference
  additionalNotes?: string
}

export interface OutfitItemResult {
  item: ClothingItem
  role: 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory'
  stylingNote?: string
}

export interface OutfitSuggestion {
  id: string
  name: string
  colourSubtitle: string
  items: OutfitItemResult[]
  whyItWorks: string
  stylingTips: string[]
  occasion: Occasion
  weather: WeatherCondition
  mood: Mood
  generatedAt: string
  source: 'mock' | 'api'
}

export interface StylistEngineResult {
  suggestion: OutfitSuggestion | null
  error?: string
}

// ─── Main public function ─────────────────────────────────────────────────────

/**
 * Generate an outfit suggestion.
 * `attempt` increments on "try another" to get a varied result.
 * `pinnedItem` is always included in the outfit (for "Style This Item" mode).
 */
export async function generateOutfit(
  request: StyleRequest,
  wardrobe: ClothingItem[],
  profile: UserProfile | null,
  attempt = 0,
  pinnedItem?: ClothingItem,
  feedback: RecommendationFeedback[] = [],
): Promise<StylistEngineResult> {
  // Simulate network latency for a realistic feel
  await new Promise((r) => setTimeout(r, 900 + Math.random() * 500))

  // ── Future API integration point ──────────────────────────────────────────
  // const AI_API_KEY = import.meta.env.VITE_STYLIST_API_KEY
  // if (AI_API_KEY) {
  //   return callStylistAPI(request, wardrobe, profile)
  // }
  // ──────────────────────────────────────────────────────────────────────────

  const colourConfig = await getColourHarmonyConfig()
  return mockEngine(request, wardrobe, profile, attempt, pinnedItem, colourConfig, [...feedback, ...feedbackFromFavourites(wardrobe)])
}

// ─── Colour data ──────────────────────────────────────────────────────────────

const NEUTRALS = new Set([
  'Black', 'White', 'Cream', 'Beige', 'Charcoal', 'Grey', 'Camel', 'Tan', 'Silver',
])

// ─── Weather → Season mapping ─────────────────────────────────────────────────

function weatherToSeasons(weather: WeatherCondition): Season[] {
  switch (weather) {
    case 'hot': return ['summer']
    case 'warm': return ['summer', 'spring']
    case 'cool': return ['spring', 'autumn']
    case 'cold': return ['winter', 'autumn']
    case 'rainy': return ['autumn', 'spring']
  }
}

// ─── Item scoring ─────────────────────────────────────────────────────────────

function scoreItem(
  item: ClothingItem,
  request: StyleRequest,
  profile: UserProfile | null,
  learnedStyle: ReturnType<typeof learnStyleFromWardrobe>,
  alreadySelected: ClothingItem[],
  colourConfig: ColourHarmonyConfig,
  feedback: RecommendationFeedback[],
): number {
  let score = 0

  // Duplicate guard
  if (alreadySelected.some((s) => s.id === item.id)) return -9999

  // Apply the workbook's outfit-balance starter rules while ranking daily
  // recommendations. They remain soft signals because the workbook marks
  // these thresholds as assumptions to validate, not universal dress rules.
  const { maxPatternedItems, patternedTypes, boldColourHints } = recommendationWorkbookGuide.outfitRules
  const isPatterned = patternedTypes.includes(item.pattern)
  const existingPatterns = alreadySelected.filter((selected) => patternedTypes.includes(selected.pattern)).length
  if (isPatterned && existingPatterns >= maxPatternedItems) score -= 7
  const itemIsBold = item.colour.some((colour) => boldColourHints.some((hint) => colour.toLowerCase().includes(hint)))
  const existingBoldItems = alreadySelected.filter((selected) => selected.colour.some((colour) => boldColourHints.some((hint) => colour.toLowerCase().includes(hint)))).length
  if (itemIsBold && existingBoldItems >= recommendationWorkbookGuide.outfitRules.maxBoldColourItems) score -= 5
  const itemFit = `${item.fit ?? ''} ${item.name}`.toLowerCase()
  if (item.category === 'bottoms' && /loose|oversized|wide-leg/.test(itemFit)) {
    const selectedTop = alreadySelected.find((selected) => selected.category === 'tops')
    if (selectedTop && /loose|oversized/.test(`${selectedTop.fit ?? ''} ${selectedTop.name}`.toLowerCase())) score -= 4
  }
  if (item.category === 'tops' && /loose|oversized/.test(itemFit)) {
    const selectedBottom = alreadySelected.find((selected) => selected.category === 'bottoms')
    if (selectedBottom && /loose|oversized|wide-leg/.test(`${selectedBottom.fit ?? ''} ${selectedBottom.name}`.toLowerCase())) score -= 4
  }

  // Occasion match
  if (item.occasions.includes(request.occasion)) score += 10
  else if (item.occasions.length === 0) score += 1 // no tags = versatile assumption
  else {
    // Partial credit: some occasions have natural overlaps
    const fallbacks: Record<Occasion, Occasion[]> = {
      work: ['casual', 'formal'],
      casual: ['weekend', 'work'],
      formal: ['work', 'date-night', 'special-event'],
      'date-night': ['formal', 'casual', 'special-event'],
      weekend: ['casual', 'travel'],
      travel: ['casual', 'weekend'],
      gym: [],
      'special-event': ['formal', 'date-night'],
    }
    const related = fallbacks[request.occasion] ?? []
    if (item.occasions.some((o) => related.includes(o))) score += 4
  }

  // Season match
  const targetSeasons = weatherToSeasons(request.weather)
  const seasonMatch =
    item.seasons.includes('all-season') ||
    item.seasons.some((s) => targetSeasons.includes(s))
  if (seasonMatch) score += 6
  else if (item.seasons.length === 0) score += 2

  // Use garment descriptors to make the same closet read differently for a
  // relaxed weekend and an evening occasion, even when an item has broad
  // occasion tags.
  const garmentDetails = [item.name, item.subcategory, item.fit, item.formality, item.material]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const dressy = /formal|dress|evening|occasion|elegant|satin|silk|heel|blazer|tailored/.test(garmentDetails)
  const relaxed = /casual|relaxed|cozy|cosy|soft|knit|sweat|sneaker|loose|comfortable/.test(garmentDetails)
  if (['date-night', 'formal', 'special-event'].includes(request.occasion)) {
    if (dressy) score += 5
    if (relaxed && !dressy) score -= 2
  } else if (['casual', 'weekend', 'travel'].includes(request.occasion)) {
    if (relaxed) score += 4
    if (dressy) score -= 2
  } else if (request.occasion === 'work' && /professional|business|tailored|blazer/.test(garmentDetails)) {
    score += 4
  }

  score += scoreIndianWearFit(item, request)

  // Colour harmony with already selected items
  for (const selected of alreadySelected) {
    const pair = scoreColourSets(item.colour, selected.colour, colourConfig)
    if (pair?.score != null) {
      const roles = [item.category, selected.category].sort().join('|')
      const roleImportance: Record<string, number> = {
        'bottoms|tops': 1,
        'outerwear|tops': 0.7,
        'bottoms|shoes': 0.6,
        'shoes|tops': 0.5,
        'accessories|bottoms': 0.3,
        'accessories|outerwear': 0.3,
        'accessories|shoes': 0.25,
        'accessories|tops': 0.35,
      }
      const colourWeight = Math.max(0, Math.min(1, colourConfig.outfitWeights?.pairwiseColour ?? 0.55))
      // Keep colour as a ranking signal beside occasion and personal fit, while
      // giving the workbook's 55% pairwise-colour weight enough influence to
      // change daily outfit picks instead of acting as a barely visible tie-break.
      score += (pair.score - 70) * 0.18 * (colourWeight / 0.55) * (roleImportance[roles] ?? 0.35)
    }
  }

  // User preferences
  if (profile) {
    if (item.colour.some((c) => profile.favouriteColours.includes(c))) score += 5
    if (item.colour.some((c) => profile.avoidColours.includes(c))) score -= 15
    // Simply having many items with a trait doesn't prove that trait is a
    // preference. Keep closet-wide frequency as a weak tie-breaker; explicit
    // favourites and colour preferences carry the stronger signal.
    score += Math.min(4, affinityForLearnedTraits(learnedStyle, {
      colours: item.colour,
      subcategory: item.subcategory,
      material: item.material,
      pattern: item.pattern,
      formality: item.formality,
    }) * 0.4)
  }
  if (item.isFavourite) score += 2
  score += scoreRecommendationFeedback(traitsFromWardrobe(item), feedback)

  // Gently rotate away from pieces worn very recently or very often, so
  // favourites don't crowd out the rest of the closet.
  score -= Math.min(item.timesWorn, 8) * 0.35
  if (item.lastWorn) {
    const daysSinceWear = (Date.now() - new Date(item.lastWorn).getTime()) / 86_400_000
    if (Number.isFinite(daysSinceWear) && daysSinceWear >= 0) {
      if (daysSinceWear < 7) score -= 4
      else if (daysSinceWear < 21) score -= 2
    }
  }

  // Style alignment
  if (request.stylePreference) {
    const styleOccasionMap: Record<StylePreference, Occasion[]> = {
      business: ['work', 'formal'],
      classic: ['work', 'formal', 'date-night'],
      minimalist: ['casual', 'work', 'weekend'],
      romantic: ['date-night', 'special-event'],
      bohemian: ['casual', 'weekend', 'travel'],
      streetwear: ['casual', 'weekend'],
      athleisure: ['gym', 'casual'],
      eclectic: ['casual', 'weekend', 'special-event'],
    }
    if (item.occasions.some((o) => styleOccasionMap[request.stylePreference!]?.includes(o))) {
      score += 3
    }
  }

  // Weather-specific outerwear boost
  if (
    item.category === 'outerwear' &&
    (request.weather === 'cold' || request.weather === 'rainy' || request.weather === 'cool')
  ) {
    score += 8
  }

  return score
}

/**
 * Apply the workbook's context-sensitive Indian-wear guidance as a small
 * ranking signal. This does not replace user tags, occasion compatibility,
 * or personal preferences, and wedding colours are only tempered for a
 * specifically identified ceremony.
 */
function scoreIndianWearFit(item: ClothingItem, request: StyleRequest): number {
  const details = [item.name, item.subcategory, item.material, item.formality].filter(Boolean).join(' ').toLowerCase()
  const isIndianWear = indianWearGuide.garments.some((garment) => garment.terms.some((term) => details.includes(term)))
  if (!isIndianWear) return 0

  const occasionText = `${request.customOccasion ?? ''} ${request.occasion}`.toLowerCase()
  const officeContext = /office|work|meeting|corporate|traditional workplace|startup|mnc/.test(occasionText)
  const functionKey = ['haldi', 'mehendi', 'sangeet', 'wedding ceremony', 'ceremony', 'reception']
    .find((key) => occasionText.includes(key))
  const profileEntry = functionKey
    ? indianWearGuide.occasionGuidance.find((entry) => entry.occasion === (functionKey === 'ceremony' ? 'wedding ceremony' : functionKey))
    : officeContext
      ? indianWearGuide.occasionGuidance.find((entry) => entry.occasion === 'regular office')
      : request.occasion === 'work'
        ? indianWearGuide.occasionGuidance.find((entry) => entry.occasion === 'regular office')
        : ['college', 'casual'].some((key) => occasionText.includes(key))
          ? indianWearGuide.occasionGuidance.find((entry) => entry.occasion === 'college')
          : undefined

  let score = 0
  if (profileEntry) {
    const bestText = profileEntry.best.toLowerCase()
    const garment = indianWearGuide.garments.find((entry) => entry.terms.some((term) => details.includes(term)))
    const typeTokens = garment?.terms.filter((term) => details.includes(term)) ?? []
    if (typeTokens.some((term) => bestText.includes(term))) score += 5
    if (/traditional/.test(occasionText) && /saree|salwar suit|kurta|anarkali/.test(details)) score += 2
    if (/corporate|mnc|startup/.test(occasionText) && /heavy|embroidered|party/.test(details)) score -= 3
    if (functionKey === 'wedding ceremony') {
      const colours = item.colour.map((colour) => colour.toLowerCase())
      if (colours.some((colour) => /^(white|ivory)$/.test(colour))) score -= 8
      if (colours.includes('black')) score -= 5
      if (colours.includes('red') && /lehenga|saree|anarkali|salwar suit/.test(details)) score -= 4
    }
    if (functionKey === 'haldi' && item.colour.some((colour) => /yellow|mustard|orange|green/i.test(colour))) score += 2
    if (functionKey === 'mehendi' && item.colour.some((colour) => /green/i.test(colour))) score += 2
    if (functionKey === 'sangeet' && /lehenga|sharara|saree|anarkali/.test(details)) score += 2
    if (functionKey === 'reception' && /indo-western|gown|saree|lehenga/.test(details)) score += 2
  }
  return score
}

// ─── Outfit assembly ──────────────────────────────────────────────────────────

function pickBest(
  items: ClothingItem[],
  category: ClothingItem['category'],
  request: StyleRequest,
  profile: UserProfile | null,
  selected: ClothingItem[],
  attempt: number,
  colourConfig: ColourHarmonyConfig,
  feedback: RecommendationFeedback[],
): ClothingItem | null {
  const candidates = items.filter((i) => i.category === category)
  if (candidates.length === 0) return null
  const learnedStyle = learnStyleFromWardrobe(items)

  const scored = candidates.map((item) => ({
    item,
    score: scoreItem(item, request, profile, learnedStyle, selected, colourConfig, feedback),
  }))
  scored.sort((a, b) => b.score - a.score || a.item.timesWorn - b.item.timesWorn || (a.item.lastWorn ?? '').localeCompare(b.item.lastWorn ?? '') || a.item.id.localeCompare(b.item.id))
  if (scored[0].score <= -100) return null

  // Rotate across every close-fit option, rather than a short prefix of the
  // ranked list. Capping this list made pieces later in a large wardrobe
  // effectively invisible to daily recommendations.
  const bestScore = scored[0].score
  const contenders = scored
    .filter((candidate) => bestScore - candidate.score <= 8)
  if (category === 'accessories' && contenders.length > 1) {
    return contenders[Math.floor(Math.random() * contenders.length)].item
  }
  const variationKey = `${attempt}|${request.occasion}|${category}`
  const variationOffset = [...variationKey].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 7)
  return contenders[variationOffset % contenders.length].item
}

// ─── Text generation ──────────────────────────────────────────────────────────

const OUTFIT_NAMES: Partial<Record<Occasion, Partial<Record<Mood, string>>>> = {
  work: {
    confident: 'The Power Look',
    polished: 'Board Room Ready',
    relaxed: 'Smart & Easy',
    creative: 'Creative Professional',
    understated: 'Quiet Luxury',
    playful: 'Work, Elevated',
    romantic: 'Softly Professional',
  },
  casual: {
    relaxed: 'Off Duty',
    confident: 'Effortlessly Chic',
    creative: 'Creative Energy',
    playful: 'Weekend Mood',
    understated: 'Minimal Vibes',
    polished: 'Casual Chic',
    romantic: 'Soft & Easy',
  },
  'date-night': {
    confident: 'The Head Turner',
    romantic: 'Date Night Allure',
    polished: 'Evening Edit',
    playful: 'Playfully Dressed',
    understated: 'Understated Allure',
    relaxed: 'Laid-Back Luxe',
    creative: 'Dressed to Intrigue',
  },
  formal: {
    confident: 'The Statement',
    polished: 'Formal Finesse',
    understated: 'Quiet Elegance',
    creative: 'Modern Formal',
    relaxed: 'Relaxed Formality',
    romantic: 'Elegant Evening',
    playful: 'Dressed Up',
  },
  weekend: {
    relaxed: 'Weekend Wanderer',
    confident: 'Chic Off-Duty',
    playful: 'Saturday Energy',
    creative: 'Weekend Creative',
    understated: 'Easy Weekend',
    polished: 'Polished Downtime',
    romantic: 'Soft Saturday',
  },
  travel: {
    relaxed: 'Travel Ready',
    confident: 'Jet Set Style',
    playful: 'Adventure Mode',
    understated: 'Carry-On Chic',
    polished: 'First Class Look',
    creative: 'Wanderlust Edit',
    romantic: 'Destination Dressing',
  },
  'special-event': {
    confident: 'Showstopper',
    polished: 'Event Ready',
    playful: 'Celebration Mode',
    understated: 'Elegant Affair',
    romantic: 'Dressed for the Moment',
    creative: 'Statement Moment',
    relaxed: 'Effortlessly Formal',
  },
  gym: {
    confident: 'Performance Mode',
    relaxed: 'Active & Easy',
    playful: 'Gym Energy',
    understated: 'Clean Active',
    polished: 'Athleisure Edit',
    creative: 'Workout Style',
    romantic: 'Soft Active',
  },
}

function getOutfitName(occasion: Occasion, mood: Mood): string {
  return OUTFIT_NAMES[occasion]?.[mood] ?? 'A Curated Look'
}

function getColourSubtitle(items: ClothingItem[]): string {
  const allColours = [...new Set(items.flatMap((i) => i.colour))]
  if (allColours.length === 0) return ''
  const top = allColours.slice(0, 3)
  return top.join(' · ')
}

function generateWhyItWorks(
  items: ClothingItem[],
  request: StyleRequest
): string {
  const allColours = [...new Set(items.flatMap((i) => i.colour))]
  const neutralCount = allColours.filter((c) => NEUTRALS.has(c)).length
  const accentColours = allColours.filter((c) => !NEUTRALS.has(c))
  const isAllNeutral = allColours.length > 0 && neutralCount === allColours.length
  const hasImage = items.some((i) => i.imageUrl)

  // Colour story
  let colourLine = ''
  if (isAllNeutral) {
    const palette = allColours.slice(0, 2).join(' and ')
    colourLine = `The ${palette} palette reads as effortlessly curated — neutral tones that work across seasons and always photograph well.`
  } else if (accentColours.length > 0 && neutralCount > 0) {
    colourLine = `The ${accentColours[0]} piece brings character while the neutral base keeps the look grounded and easy to style.`
  } else if (accentColours.length >= 2) {
    colourLine = `The colour mix works because both tones share an underlying warmth — the eye reads them as intentional rather than accidental.`
  }

  // Occasion rationale
  const occasionLines: Record<Occasion, string> = {
    work: 'Each piece is calibrated for a professional setting without feeling stiff — authority without effort.',
    casual: 'The combination is relaxed without looking thrown together — a balance that defines real personal style.',
    formal: 'The silhouette communicates elegance. Clean lines and considered choices make the dressing look easy.',
    'date-night': 'The outfit has enough polish to feel special without trying too hard — exactly the right register.',
    weekend: 'Comfort-led but considered. This is the kind of outfit that looks like you just always dress this well.',
    travel: 'Versatile pieces that transition easily between contexts — the sign of a well-edited wardrobe.',
    gym: 'Function-first without sacrificing intention. The pieces work hard so you can.',
    'special-event': 'The occasion deserves a look that will still feel right in photographs years from now. This is it.',
  }
  const occasionLine = request.customOccasion
    ? `For ${request.customOccasion}, this look balances comfort and polish with pieces from your Kloset.`
    : occasionLines[request.occasion] ?? ''

  const weatherBonus =
    request.weather === 'cold'
      ? ' The layers are considered — each one earns its place.'
      : request.weather === 'rainy'
      ? ' The outerwear choice keeps you practical without sacrificing the look.'
      : ''

  return [colourLine, occasionLine + weatherBonus].filter(Boolean).join(' ')

  // Suppress unused var warning — hasImage is available for future enhancement
  void hasImage
}

function generateStylingTips(
  items: ClothingItemResult[],
  request: StyleRequest
): string[] {
  const tips: string[] = []
  const roles = items.map((i) => i.role)

  if (roles.includes('top') && roles.includes('bottom')) {
    tips.push('Half-tuck the top for an easy waistline.')
  }
  if (roles.includes('outerwear')) {
    tips.push('Wear the outer layer open to show the look underneath.')
  }
  if (roles.includes('accessory')) {
    tips.push('Choose one statement accessory.')
  }
  if (request.occasion === 'work' && roles.includes('top')) {
    tips.push('Roll the sleeves for an easy, polished finish.')
  }
  if (request.occasion === 'date-night') {
    tips.push('Add a light fragrance for a finishing touch.')
  }
  if (request.weather === 'cold') {
    tips.push('Layer a fine knit underneath on colder days.')
  }
  if (request.mood === 'confident') {
    tips.push('Stand tall; confidence completes the look.')
  }

  return tips.slice(0, 3)
}

// Rename to avoid conflict with public type
type ClothingItemResult = OutfitItemResult

// ─── Styling notes per role ───────────────────────────────────────────────────

function getStylingNote(
  _item: ClothingItem,
  role: OutfitItemResult['role'],
  occasion: Occasion
): string | undefined {
  if (role === 'top' && occasion === 'work') return 'Tuck neatly or half-tuck for different looks'
  if (role === 'outerwear') return 'Wear open over the outfit'
  if (role === 'shoes') return 'Anchors the whole look'
  if (role === 'accessory') return 'Keep as the single statement'
  return undefined
}

// ─── Mock engine ──────────────────────────────────────────────────────────────

function mockEngine(
  request: StyleRequest,
  wardrobe: ClothingItem[],
  profile: UserProfile | null,
  attempt: number,
  pinnedItem: ClothingItem | undefined,
  colourConfig: ColourHarmonyConfig,
  feedback: RecommendationFeedback[],
): StylistEngineResult {
  if (wardrobe.length === 0) {
    return { suggestion: null, error: 'Your Kloset is empty. Add some items first.' }
  }
  if (wardrobe.length < 2) {
    return { suggestion: null, error: 'Add at least 2 items to your Kloset to generate an outfit.' }
  }

  const selected: ClothingItem[] = []
  const resultItems: OutfitItemResult[] = []

  const addItem = (item: ClothingItem, role: OutfitItemResult['role']) => {
    selected.push(item)
    resultItems.push({
      item,
      role,
      stylingNote: getStylingNote(item, role, request.occasion),
    })
  }

  // 0. If a pinned item was provided, add it first
  if (pinnedItem) {
    const roleMap: Record<string, OutfitItemResult['role']> = {
      tops: 'top', bottoms: 'bottom', dresses: 'dress', outerwear: 'outerwear', shoes: 'shoes', accessories: 'accessory',
    }
    addItem(pinnedItem, roleMap[pinnedItem.category] ?? 'top')
  }

  // 1. Try a dress first for certain occasions (skip if pinned item is a dress or top/bottom)
  const hasPinnedBase = pinnedItem && ['tops', 'bottoms', 'dresses'].includes(pinnedItem.category)
  const preferDress = ['date-night', 'formal', 'special-event'].includes(request.occasion)
  if (!hasPinnedBase && preferDress && Math.random() + attempt * 0.2 < 0.6) {
    const dress = pickBest(wardrobe, 'dresses', request, profile, selected, attempt, colourConfig, feedback)
    if (dress) addItem(dress, 'dress')
  }

  // 2. If no dress, pick top + bottom (skip categories covered by pinned item)
  if (!resultItems.some((r) => r.role === 'dress')) {
    if (!pinnedItem || pinnedItem.category !== 'tops') {
      const top = pickBest(wardrobe, 'tops', request, profile, selected, attempt, colourConfig, feedback)
      if (top) addItem(top, 'top')
    }
    if (!pinnedItem || pinnedItem.category !== 'bottoms') {
      const bottom = pickBest(wardrobe, 'bottoms', request, profile, selected, attempt, colourConfig, feedback)
      if (bottom) addItem(bottom, 'bottom')
    }
  }

  // 3. Outerwear if weather warrants
  const needsOuterwear = ['cold', 'cool', 'rainy'].includes(request.weather)
  if (needsOuterwear && pinnedItem?.category !== 'outerwear') {
    const outer = pickBest(wardrobe, 'outerwear', request, profile, selected, attempt, colourConfig, feedback)
    if (outer) addItem(outer, 'outerwear')
  }

  // 4. Shoes
  if (pinnedItem?.category !== 'shoes') {
    const shoes = pickBest(wardrobe, 'shoes', request, profile, selected, attempt, colourConfig, feedback)
    if (shoes) addItem(shoes, 'shoes')
  }

  // 5. Accessories (max 1)
  if (pinnedItem?.category !== 'accessories') {
    const accessory = pickBest(wardrobe, 'accessories', request, profile, selected, attempt, colourConfig, feedback)
    if (accessory) addItem(accessory, 'accessory')
  }

  // Must have at least one base garment
  const hasBase = resultItems.some((r) => ['top', 'bottom', 'dress'].includes(r.role))
  const hasCompleteBase = resultItems.some((r) => r.role === 'dress')
    || (resultItems.some((r) => r.role === 'top') && resultItems.some((r) => r.role === 'bottom'))
  if (!hasBase || !hasCompleteBase) {
    return {
      suggestion: null,
      error: "We couldn't find enough items for this occasion. Try adding more clothes or adjusting the filters.",
    }
  }

  const name = getOutfitName(request.occasion, request.mood)
  const colourSubtitle = getColourSubtitle(selected)
  const whyItWorks = generateWhyItWorks(selected, request)
  const stylingTips = generateStylingTips(resultItems, request)

  const suggestion: OutfitSuggestion = {
    id: crypto.randomUUID(),
    name,
    colourSubtitle,
    items: resultItems,
    whyItWorks,
    stylingTips,
    occasion: request.occasion,
    weather: request.weather,
    mood: request.mood,
    generatedAt: new Date().toISOString(),
    source: 'mock',
  }

  return { suggestion }
}
