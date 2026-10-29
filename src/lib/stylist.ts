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
  pinnedItem?: ClothingItem
): Promise<StylistEngineResult> {
  // Simulate network latency for a realistic feel
  await new Promise((r) => setTimeout(r, 900 + Math.random() * 500))

  // ── Future API integration point ──────────────────────────────────────────
  // const AI_API_KEY = import.meta.env.VITE_STYLIST_API_KEY
  // if (AI_API_KEY) {
  //   return callStylistAPI(request, wardrobe, profile)
  // }
  // ──────────────────────────────────────────────────────────────────────────

  return mockEngine(request, wardrobe, profile, attempt, pinnedItem)
}

// ─── Colour data ──────────────────────────────────────────────────────────────

const NEUTRALS = new Set([
  'Black', 'White', 'Cream', 'Beige', 'Charcoal', 'Grey', 'Camel', 'Tan', 'Silver',
])

// Pairs (a, b) that look good together — stored as sorted key for lookup
const HARMONY_BONUS: Record<string, number> = buildHarmonyMap([
  ['Black', 'White', 5], ['Black', 'Cream', 4], ['Black', 'Camel', 4],
  ['Black', 'Burgundy', 4], ['Black', 'Gold', 3], ['Black', 'Blush', 3],
  ['Black', 'Dusty Rose', 3], ['Black', 'Sage', 3],
  ['Navy', 'White', 5], ['Navy', 'Cream', 5], ['Navy', 'Camel', 4],
  ['Navy', 'Gold', 3], ['Navy', 'Burgundy', 3], ['Navy', 'Grey', 3],
  ['Grey', 'Burgundy', 4], ['Grey', 'Blush', 4], ['Grey', 'Navy', 3],
  ['Grey', 'Camel', 3], ['Grey', 'Lavender', 3],
  ['Camel', 'White', 4], ['Camel', 'Cream', 3], ['Camel', 'Burgundy', 4],
  ['Camel', 'Forest Green', 3], ['Camel', 'Brown', 3], ['Camel', 'Black', 4],
  ['Rust', 'Cream', 4], ['Rust', 'Camel', 3], ['Rust', 'Navy', 3],
  ['Rust', 'Olive', 3], ['Rust', 'Brown', 3],
  ['Olive', 'Cream', 3], ['Olive', 'Camel', 3], ['Olive', 'Brown', 3],
  ['Burgundy', 'Cream', 4], ['Burgundy', 'Gold', 3], ['Burgundy', 'Grey', 4],
  ['Blush', 'Cream', 4], ['Blush', 'Grey', 4], ['Blush', 'Navy', 3],
  ['Dusty Rose', 'Cream', 4], ['Dusty Rose', 'Grey', 3],
  ['Forest Green', 'Cream', 4], ['Forest Green', 'Camel', 3],
  ['Terracotta', 'Cream', 4], ['Terracotta', 'Olive', 3],
  ['Cobalt', 'White', 4], ['Cobalt', 'Cream', 3], ['Cobalt', 'Camel', 3],
  ['Sky Blue', 'White', 4], ['Sky Blue', 'Cream', 3], ['Sky Blue', 'Navy', 3],
])

function buildHarmonyMap(triples: [string, string, number][]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const [a, b, score] of triples) {
    const key1 = [a, b].sort().join('|')
    const key2 = [b, a].sort().join('|')
    map[key1] = score
    map[key2] = score
  }
  return map
}

function harmonyScore(c1: string, c2: string): number {
  if (c1 === c2) return -1 // avoid same colour in both pieces
  const key = [c1, c2].sort().join('|')
  if (HARMONY_BONUS[key]) return HARMONY_BONUS[key]
  if (NEUTRALS.has(c1) || NEUTRALS.has(c2)) return 2 // neutral + anything = fine
  return 0
}

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
  alreadySelected: ClothingItem[],
  attempt: number
): number {
  let score = 0

  // Duplicate guard
  if (alreadySelected.some((s) => s.id === item.id)) return -9999

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

  // Colour harmony with already selected items
  for (const selected of alreadySelected) {
    for (const c1 of item.colour) {
      for (const c2 of selected.colour) {
        score += harmonyScore(c1, c2)
      }
    }
  }

  // User preferences
  if (profile) {
    if (item.colour.some((c) => profile.favouriteColours.includes(c))) score += 5
    if (item.colour.some((c) => profile.avoidColours.includes(c))) score -= 15
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

  // Add slight randomness per attempt so "try another" gives different results
  // Use item id as a stable seed component so results are reproducible per attempt
  const idSeed = item.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  score += ((idSeed + attempt * 37) % 7) - 3

  return score
}

// ─── Outfit assembly ──────────────────────────────────────────────────────────

function pickBest(
  items: ClothingItem[],
  category: ClothingItem['category'],
  request: StyleRequest,
  profile: UserProfile | null,
  selected: ClothingItem[],
  attempt: number
): ClothingItem | null {
  const candidates = items.filter((i) => i.category === category)
  if (candidates.length === 0) return null

  const scored = candidates.map((item) => ({
    item,
    score: scoreItem(item, request, profile, selected, attempt),
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored[0].score > -100 ? scored[0].item : null
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
  const occasionLine = occasionLines[request.occasion] ?? ''

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
    tips.push('Try half-tucking the top for a relaxed but intentional look.')
  }
  if (roles.includes('outerwear')) {
    tips.push('Wear the outer layer open to let the outfit underneath do the talking.')
  }
  if (roles.includes('accessory')) {
    tips.push('Less is more with accessories — one statement piece keeps the outfit sharp.')
  }
  if (request.occasion === 'work' && roles.includes('top')) {
    tips.push('Roll the sleeves once or twice for a polished-but-relaxed finish.')
  }
  if (request.occasion === 'date-night') {
    tips.push('Add a simple fragrance — the invisible accessory that completes any look.')
  }
  if (request.weather === 'cold') {
    tips.push('A fine-knit turtleneck underneath layers beautifully with what you have here.')
  }
  if (request.mood === 'confident') {
    tips.push('Posture and intention do as much as the clothes. Wear it like you mean it.')
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
  pinnedItem?: ClothingItem
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
    const dress = pickBest(wardrobe, 'dresses', request, profile, selected, attempt)
    if (dress) addItem(dress, 'dress')
  }

  // 2. If no dress, pick top + bottom (skip categories covered by pinned item)
  if (!resultItems.some((r) => r.role === 'dress')) {
    if (!pinnedItem || pinnedItem.category !== 'tops') {
      const top = pickBest(wardrobe, 'tops', request, profile, selected, attempt)
      if (top) addItem(top, 'top')
    }
    if (!pinnedItem || pinnedItem.category !== 'bottoms') {
      const bottom = pickBest(wardrobe, 'bottoms', request, profile, selected, attempt)
      if (bottom) addItem(bottom, 'bottom')
    }
  }

  // 3. Outerwear if weather warrants
  const needsOuterwear = ['cold', 'cool', 'rainy'].includes(request.weather)
  if (needsOuterwear && pinnedItem?.category !== 'outerwear') {
    const outer = pickBest(wardrobe, 'outerwear', request, profile, selected, attempt)
    if (outer) addItem(outer, 'outerwear')
  }

  // 4. Shoes
  if (pinnedItem?.category !== 'shoes') {
    const shoes = pickBest(wardrobe, 'shoes', request, profile, selected, attempt)
    if (shoes) addItem(shoes, 'shoes')
  }

  // 5. Accessories (max 1)
  if (pinnedItem?.category !== 'accessories') {
    const accessory = pickBest(wardrobe, 'accessories', request, profile, selected, attempt)
    if (accessory) addItem(accessory, 'accessory')
  }

  // Must have at least one base garment
  const hasBase = resultItems.some((r) => ['top', 'bottom', 'dress'].includes(r.role))
  if (!hasBase) {
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
