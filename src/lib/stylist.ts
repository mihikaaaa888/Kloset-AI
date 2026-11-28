/**
 * Kloset Stylist Engine
 *
 * Public interface is designed for an easy drop-in AI API swap:
 *   generateOutfit(request, wardrobe, profile, attempt?) → Promise<StylistEngineResult>
 *
 * Replace the mock implementation below with a fetch() to your LLM endpoint
 * without touching any component code.
 */

import type { ClothingItem, Occasion, Outfit, StylePreference, Season, UserProfile } from '@/types'
import { suggestedGenders } from '@/lib/catalogData'
import { affinityForLearnedTraits } from '@/lib/styleLearning'
import { learnStyleFromWardrobe } from '@/lib/styleLearning'
import { scoreColourSets } from '@/lib/colourHarmony'
import type { ColourHarmonyConfig } from '@/lib/colourHarmony'
import { getColourHarmonyConfig } from '@/lib/colourHarmonyService'
import indianWearGuide from '../../indian-wear-guide.json'
import recommendationWorkbookGuide from '../../recommendation-workbook-guidance.json'
import { dislikedOutfitCombinationTypes, outfitCombinationType, clashesWithPicked, outfitPairVerdicts, pairingFeedbackScore, scoreRecommendationFeedback, traitsFromWardrobe, feedbackFromFavourites } from '@/lib/recommendationFeedback'
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
// A mis-tagged piece (a "Black T shirt" saved as Bottoms) made the engine pair
// two tops with no bottom. When a name clearly says one kind of piece and the
// saved category says another, trust the name. Names that mix kinds ("shirt
// dress") are left as saved.
const NAME_KINDS: [ClothingItem['category'], RegExp][] = [
  ['tops', /\b(t[\s-]?shirts?|tees?|shirts?|tops?|blouses?|kurtis?|kurtas?|sweaters?|sweatshirts?|hoodies?|tanks?|camis?|polos?)\b/i],
  ['bottoms', /\b(pants|trousers|jeans|skirts?|shorts|palazzos?|leggings|joggers|culottes|chinos|salwars?|churidars?)\b/i],
  ['dresses', /\b(dress(es)?|gowns?|jumpsuits?|sarees?|saris?|lehengas?)\b/i],
  ['shoes', /\b(shoes?|sneakers?|heels?|boots?|sandals?|loafers?|flats|sambas?|slides?|juttis?|mules?)\b/i],
]
const CORRECTABLE = new Set<ClothingItem['category']>(['tops', 'bottoms', 'dresses', 'shoes'])
export function categoryFromName(item: ClothingItem): ClothingItem['category'] {
  if (!CORRECTABLE.has(item.category)) return item.category
  const kinds = NAME_KINDS.filter(([, pattern]) => pattern.test(item.name)).map(([kind]) => kind)
  return kinds.length === 1 && kinds[0] !== item.category ? kinds[0] : item.category
}
function withNamedCategory(item: ClothingItem): ClothingItem {
  const category = categoryFromName(item)
  if (category === item.category) return item
  console.log('[stylist] category from name', { name: item.name, saved: item.category, used: category })
  return { ...item, category, subcategory: undefined }
}

// ─── Recently shown ───────────────────────────────────────────────────────────
// Pieces and whole outfits shown recently in this visit, so "Try another"
// brings something new instead of cycling through the same few looks.
const recentPieces: string[] = []
const recentOutfits: string[] = []
const RECENT_PIECES = 24
const RECENT_OUTFITS = 10
const outfitSignature = (items: ClothingItem[]) => items.map((item) => item.id).sort().join('|')
// What's been suggested across visits, kept on the device: pieces shown a lot
// this week step back, and pieces never (or long not) suggested get a lift,
// so the whole Kloset gets its turn instead of the same few favourites.
const SHOWN_KEY = 'kloset:shown:v1'
const DAY_MS = 86_400_000
let shownHistory: Record<string, number[]> | null = null
function loadShownHistory(): Record<string, number[]> {
  if (shownHistory) return shownHistory
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SHOWN_KEY) ?? '{}')
    shownHistory = parsed && typeof parsed === 'object' ? parsed as Record<string, number[]> : {}
  } catch { shownHistory = {} }
  return shownHistory
}
function recordShownHistory(items: ClothingItem[]) {
  const history = loadShownHistory()
  const now = Date.now()
  for (const item of items) {
    const times = (history[item.id] ?? []).filter((time) => now - time < 30 * DAY_MS)
    // The same look re-rendered a few minutes later isn't another showing.
    if (!times.length || now - times[times.length - 1] > 10 * 60_000) times.push(now)
    history[item.id] = times.slice(-10)
  }
  for (const [id, times] of Object.entries(history)) if (!times.some((time) => now - time < 30 * DAY_MS)) delete history[id]
  try { localStorage.setItem(SHOWN_KEY, JSON.stringify(history)) } catch { /* storage full or blocked */ }
}
/** Positive for pieces that haven't had a turn lately, negative for ones shown a lot this week. */
function freshnessScore(itemId: string): number {
  const history = loadShownHistory()
  const times = history[itemId] ?? []
  const now = Date.now()
  const thisWeek = times.filter((time) => now - time < 7 * DAY_MS).length
  if (thisWeek) return -Math.min(6, thisWeek * 1.5)
  // Only once there's some history to compare against (not on someone's first outfit).
  if (Object.keys(history).length < 4) return 0
  return times.length ? 2 : 4
}

/** Not suggested in the last two weeks (or ever), once there's history to tell. */
function isOverlooked(itemId: string): boolean {
  const history = loadShownHistory()
  if (Object.keys(history).length < 4) return false
  const times = history[itemId] ?? []
  return !times.some((time) => Date.now() - time < 14 * DAY_MS)
}

function rememberShown(items: ClothingItem[]) {
  recordShownHistory(items)
  recentPieces.push(...items.map((item) => item.id))
  recentPieces.splice(0, Math.max(0, recentPieces.length - RECENT_PIECES))
  recentOutfits.push(outfitSignature(items))
  recentOutfits.splice(0, Math.max(0, recentOutfits.length - RECENT_OUTFITS))
}
/** How much a piece is held back for having been shown recently (more for more often and more recently). */
function recentPenalty(itemId: string): number {
  let penalty = 0
  recentPieces.forEach((id, index) => { if (id === itemId) penalty += 3 + (index / RECENT_PIECES) * 3 })
  // Capped: rotating shouldn't outweigh fit (heels shown twice still beat sneakers for a date).
  return Math.min(8, penalty)
}

// "Try another" wants a whole new outfit: the pieces it just showed sit out
// while anything else in their category can stand in. Set for one call only.
let sittingOut = new Set<string>()

// Saved outfits feed What to wear: their pieces get a lift, the pairings in
// them count as ones that work, and now and then (every third try) a whole
// saved outfit for the occasion comes back. Set for one call only.
let savedPieces = new Set<string>()
let savedPairs = new Set<string>()
let favoured = new Set<string>()
const pairOf = (a: string, b: string) => (a < b ? `${a}+${b}` : `${b}+${a}`)
const SAME_KIND: Partial<Record<Occasion, Occasion[]>> = {
  casual: ['casual', 'weekend', 'travel'], weekend: ['weekend', 'casual'], travel: ['travel', 'casual'],
  formal: ['formal', 'special-event'], 'special-event': ['special-event', 'formal'],
}

function prepareSavedOutfits(saved: Outfit[], wardrobe: ClothingItem[], request: StyleRequest, attempt: number, avoid: Set<string>) {
  const owned = new Map(wardrobe.map((item) => [item.id, item]))
  const usable = saved
    .filter((outfit) => !outfit.trashedAt)
    .map((outfit) => outfit.items.filter((entry) => !entry.snapshot && owned.has(entry.itemId)).map((entry) => entry.itemId))
    .filter((ids) => ids.length >= 2)
  savedPieces = new Set(usable.flat())
  savedPairs = new Set(usable.flatMap((ids) => ids.flatMap((a, i) => ids.slice(i + 1).map((b) => pairOf(a, b)))))
  favoured = new Set()
  if (attempt % 3 !== 2) return
  // One saved outfit for this kind of occasion that hasn't been on screen lately.
  const kinds = SAME_KIND[request.occasion] ?? [request.occasion]
  const fits = saved.filter((outfit) => !outfit.trashedAt && kinds.includes(outfit.occasion))
    .map((outfit) => outfit.items.filter((entry) => !entry.snapshot && owned.has(entry.itemId)).map((entry) => entry.itemId))
    .filter((ids) => ids.length >= 2
      && ids.every((id) => !avoid.has(id) && !unsuitableFor(owned.get(id) as ClothingItem, request.occasion))
      && !recentOutfits.includes([...ids].sort().join('|')))
  const choice = fits[attempt % Math.max(1, fits.length)]
  if (choice) favoured = new Set(choice)
}

export async function generateOutfit(
  request: StyleRequest,
  wardrobe: ClothingItem[],
  profile: UserProfile | null,
  attempt = 0,
  pinnedItem?: ClothingItem,
  feedback: RecommendationFeedback[] = [],
  /** Pieces to leave out where possible (the outfit "Try another" is replacing). */
  avoidItemIds: string[] = [],
  /** The person's saved outfits, to draw on (see prepareSavedOutfits). */
  savedOutfits: Outfit[] = [],
): Promise<StylistEngineResult> {
  wardrobe = wardrobe.map(withNamedCategory)
  if (pinnedItem) pinnedItem = withNamedCategory(pinnedItem)
  // Simulate network latency for a realistic feel
  await new Promise((r) => setTimeout(r, 900 + Math.random() * 500))

  // ── Future API integration point ──────────────────────────────────────────
  // const AI_API_KEY = import.meta.env.VITE_STYLIST_API_KEY
  // if (AI_API_KEY) {
  //   return callStylistAPI(request, wardrobe, profile)
  // }
  // ──────────────────────────────────────────────────────────────────────────

  const colourConfig = await getColourHarmonyConfig()
  const allFeedback = [...feedback, ...feedbackFromFavourites(wardrobe)]
  const dislikedTypes = dislikedOutfitCombinationTypes(allFeedback)
  let lastResult: StylistEngineResult | null = null
  // A disliked daily outfit teaches Kloset to avoid that garment-type pairing.
  // Try several closet rotations to find a different combination first.
  // Also skip an exact repeat of an outfit shown recently in this visit.
  sittingOut = new Set(avoidItemIds.filter((id) => id !== pinnedItem?.id))
  prepareSavedOutfits(savedOutfits, wardrobe, request, attempt, sittingOut)
  try {
  for (let retry = 0; retry < (dislikedTypes.size ? 16 : 6); retry += 1) {
    const result = mockEngine(request, wardrobe, profile, attempt + retry, pinnedItem, colourConfig, allFeedback)
    lastResult = result
    if (!result.suggestion) continue
    const pieces = result.suggestion.items.map(({ item }) => item)
    const signature = outfitCombinationType(pieces)
    const repeat = recentOutfits.includes(outfitSignature(pieces))
    if (!dislikedTypes.has(signature) && (!repeat || retry === 5)) {
      rememberShown(pieces)
      return result
    }
  }
  } finally {
    sittingOut = new Set()
    savedPieces = new Set()
    savedPairs = new Set()
    favoured = new Set()
  }
  if (lastResult?.suggestion) {
    return { suggestion: null, error: 'I could not find a different outfit pairing from your Kloset yet. Add a few more pieces or adjust your preferences.' }
  }
  return lastResult ?? { suggestion: null, error: 'Unable to create an outfit right now.' }
}

// ─── Colour data ──────────────────────────────────────────────────────────────

const NEUTRALS = new Set([
  'black', 'white', 'off white', 'ivory', 'alabaster', 'snow', 'ultra pure white', 'white orchid', 'plantation white',
  'eggshell', 'cream', 'champagne', 'bone', 'grey', 'gray', 'silver', 'slate', 'charcoal', 'greige',
  'gray cliffs', 'far horizon', 'drift of mist', 'beige', 'warm beige', 'tan', 'sand', 'nude brown', 'pale olive',
  'ivory tusk', 'toasted meringue', 'mushroom', 'fawn', 'taupe', 'chocolate', 'espresso', 'iron ore',
  'virtual taupe', 'sage', 'evergreen', 'slate blue', 'mauve finery', 'cinnamon slate', 'camel', 'brown',
])

function isNeutralColour(colour: string) {
  const normalized = colour.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return [...NEUTRALS].some((neutral) => normalized === neutral || normalized.includes(neutral))
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

function isBusinessMeetingRequest(request: StyleRequest) {
  return request.occasion === 'work' || /business|meeting|office|boardroom|interview|corporate/.test((request.customOccasion ?? '').toLowerCase())
}

function isUnsuitableForBusinessMeeting(item: ClothingItem) {
  const details = `${item.name} ${item.subcategory ?? ''} ${item.fit ?? ''} ${item.neckline_closure ?? ''}`.toLowerCase()
  if (item.category === 'tops' && /off[\s-]?shoulder|bardot/.test(details)) return true
  if (item.category !== 'bottoms') return false
  if (/\bshorts?\b/.test(details)) return true
  const isSkirt = /\bskirt\b/.test(details)
  return isSkirt && /\bmini\b|\bmicro\b|above[\s-]?knee|short skirt/.test(details)
}

function isStandaloneWoolen(item: ClothingItem) {
  return /\b(sweater|knit top|knitted top|turtleneck|roll.?neck|high.?neck|sweatshirt|hoodie|vest|waistcoat)\b/i
    .test(`${item.name} ${item.subcategory ?? ''} ${item.construction ?? ''}`)
}

function canBeCollaredLayer(item: ClothingItem) {
  const details = `${item.name} ${item.subcategory ?? ''} ${item.neckline_closure ?? ''}`
  // Only a proper button-up shirt goes under a pullover sweater (its collar
  // showing). Polos, tees, long-sleeve and crop tops are complete tops.
  if (/\b(t-?shirt|tee|polo|crew.?neck|crop(?:ped)? top|long[ -]?sleeve|twist(?:ed)? shirt|vest|waistcoat|knit)\b/i.test(details)) return false
  return /\b(button[ -]?(up|down)|oxford|dress shirt|formal shirt|collared shirt)\b/i.test(details)
}

/** A warm top worn on its own (a sweater top, knit top, sweatshirt, hoodie): nothing goes under it, only a jacket or coat over it. */
function isWarmTop(item: ClothingItem) {
  return /\b(knit(ted)? top|sweater top|top|sweatshirt|hoodie|turtleneck|roll.?neck|mock.?neck)\b/i.test(`${item.name} ${item.subcategory ?? ''}`)
}

/** A jacket or coat: what goes over a warm top. */
function isJacketOrCoat(item: ClothingItem) {
  const words = `${item.name} ${item.subcategory ?? ''}`.toLowerCase()
  return /jacket|coat|blazer|trench|parka|puffer|shacket|overshirt|bomber|anorak|raincoat/.test(words) && !isStandaloneWoolen(item)
}

function canBeVestCoverage(item: ClothingItem) {
  return /\b(tank|camisole|cami)\b/i.test(`${item.name} ${item.subcategory ?? ''}`)
}

function isPrint(item: ClothingItem) {
  return item.pattern !== 'solid' && item.pattern !== 'other'
}

// ─── Item scoring ─────────────────────────────────────────────────────────────

// ─── Dressing up ──────────────────────────────────────────────────────────────
// Date nights, formal events and special occasions lean dressy: dresses,
// skirts, heels, silk and satin, tailoring and statement pieces rise, and the
// plainest everyday pieces (tees, hoodies, joggers, sneakers) step back.
// Trousers and jeans are fine; they just aren't favoured. Someone whose style
// is sporty or streetwear gets a softer version of this.
const DRESSY_OCCASIONS: Occasion[] = ['date-night', 'formal', 'special-event']
const DRESSY_WORDS = /dress|skirt|heel|pump|stiletto|kitten|slingback|strappy sandal|satin|silk|lace|velvet|sequin|organza|chiffon|crepe|corset|bustier|halter|slip|wrap|peplum|blouse|bodysuit|tailored|blazer|waistcoat|vest|loafer|oxford|derby|ankle boot|clutch|earring|necklace|jewel|saree|lehenga|anarkali|embroider|evening|elegant|formal/
const TOO_SIMPLE = /t-?shirt|\btee\b|hoodie|sweatshirt|jogger|track ?pant|sweat ?pant|\bsweats\b|lounge|cargo|shorts|sneaker|trainer|samba|gazelle|converse|flip.?flop|slides|crocs|legging|gym|sports?\b|running|graphic|basic/

// Pieces that never belong in some looks, whatever their tags say (photo
// tagging sometimes marks jeans or a hoodie as "formal"):
// - formal and special events: shorts, joggers and track pants, leggings,
//   hoodies and sweatshirts, tees, casual knits (a plain turtleneck or fine
//   knit is fine), jeans, cargos, sneakers, flip-flops and slides, gym wear;
// - date night: gym and lounge wear, flip-flops and slides.
const LOUNGE = /jogger|track ?pants?|sweat ?pants?|\bsweats\b|lounge|pyjama|pajama|\bpj\b|night ?wear|sleep ?wear/
const NEVER_DRESSY = /\bshorts?\b|jogger|track ?pants?|sweat ?pants?|\bsweats\b|lounge|pyjama|pajama|\bpj\b|night ?wear|sleep ?wear|legging|hoodie|sweatshirt|gym|athletic|sports?\b|running|flip.?flop|\bslides?\b|crocs/
const SNEAKERS = /sneaker|trainer|samba|gazelle|chuck|converse|air force|jordan|\bdunks?\b|canvas shoe|running shoe|tennis shoe/
const NOT_FORMAL = /t-?shirt|\btee\b|graphic|polo|jeans|denim|cargo|distressed|ripped|quarter.?zip|half.?zip|fleece|crop top/
const CASUAL_KNIT = /sweater|jumper|pullover|cardigan|\bknit/
const FINE_KNIT = /turtleneck|roll.?neck|mock.?neck|cashmere|merino|fine.?knit|fine.?gauge/
function unsuitableFor(item: ClothingItem, occasion: Occasion): boolean {
  const words = `${item.name} ${item.subcategory ?? ''} ${item.material ?? ''} ${item.construction ?? ''}`.toLowerCase()
  if (occasion === 'date-night') {
    if (LOUNGE.test(words) || /gym|athletic|running|flip.?flop|\bslides?\b|crocs/.test(words)) return true
    // Fleece or jersey bottoms are sweats, whatever they're called.
    return item.category === 'bottoms' && /fleece|french terry|jersey/.test(words) && !/skirt|dress/.test(words)
  }
  if (occasion !== 'formal' && occasion !== 'special-event') return false
  if (NEVER_DRESSY.test(words) || SNEAKERS.test(words)) return true
  // Special events allow a crop top; formal doesn't.
  if (NOT_FORMAL.test(occasion === 'special-event' ? words.replace(/crop top/g, '') : words)) return true
  // Leopard, graphics and other loud prints, and chunky everyday knits, aren't formal.
  if (occasion === 'formal' && /leopard|animal|graphic|tie.?dye|camo/.test(`${words} ${item.pattern}`)) return true
  if (CASUAL_KNIT.test(words) && !FINE_KNIT.test(words) && (occasion === 'formal' || item.pattern !== 'solid')) return true
  return false
}

// How much a piece is held back for a casual look. Read from the piece itself,
// not only its tags: photo tagging can call a tailored waistcoat "casual".
// Vests and waistcoats (knit ones too: they're cut like a waistcoat), evening
// fabrics and party pieces step well back; formal-tagged pieces a little.
// Puffer, denim and sweater vests and blazers stay: they're easy to wear casually.
const TAILORED_VEST = /waistcoat|button(ed)?[- ]?(up |down )?vest|tailored vest|suit vest|vest top/
const CASUAL_VEST = /sweater vest|puffer|quilted|padded|denim|fleece|gilet|utility|tank|cami|sports?|running|hoodie/
const EVENING = /satin|sequin|velvet|organza|chiffon|corset|bustier|bodycon|stiletto|heel|pump|slingback|evening|gown|cocktail|clutch|embellish/
function tooDressyFor(item: ClothingItem): number {
  const words = `${item.name} ${item.subcategory ?? ''} ${item.material ?? ''} ${item.construction ?? ''}`.toLowerCase()
  let penalty = 0
  // Any vest reads as tailored (a fitted, buttoned waistcoat shape, knit or not) unless it's clearly a casual one.
  if ((TAILORED_VEST.test(words) || /\bvest\b/.test(words)) && !CASUAL_VEST.test(words)) penalty += 14
  if (EVENING.test(words)) penalty += 7
  if (/formal|black tie|business/.test((item.formality ?? '').toLowerCase())) penalty += 4
  return penalty
}

function dressinessScore(item: ClothingItem, occasion: Occasion, profile: UserProfile | null): number {
  const words = `${item.name} ${item.subcategory ?? ''} ${item.material ?? ''} ${item.formality ?? ''} ${item.construction ?? ''}`.toLowerCase()
  const relaxedStyle = (profile?.stylePreferences ?? []).some((style) => style === 'athleisure' || style === 'streetwear')
  const strength = (relaxedStyle ? 0.5 : 1) * (occasion === 'date-night' ? 1 : 1.3)
  const forWomen = suggestedGenders(profile?.genderStylePreference).includes('women')
  let score = 0
  if (DRESSY_WORDS.test(words)) score += 7
  if (/formal|black tie|business/.test((item.formality ?? '').toLowerCase())) score += 3
  // Bigger than the most a piece loses for being shown recently, so rotating never pulls the plain pieces in.
  if (TOO_SIMPLE.test(words) && !DRESSY_WORDS.test(words)) score -= 16
  if (forWomen && item.category === 'bottoms' && /skirt/.test(words)) score += 3
  if (forWomen && item.category === 'shoes' && /heel|pump|stiletto|mule|strappy|kitten|slingback/.test(words)) score += 4
  if (occasion !== 'date-night' && /jeans|denim/.test(words)) score -= 3
  return score * strength
}

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
  if (isBusinessMeetingRequest(request) && isUnsuitableForBusinessMeeting(item)) return -9999
  // Keep one print as the focal point; only pair it with solid pieces unless
  // the user later supplies their print-mixing guidance.
  if (isPrint(item) && alreadySelected.some(isPrint)) return -9999

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
  const relaxed = /casual|relaxed|cozy|cosy|soft|knit|sweat|sneaker|loose|comfortable/.test(garmentDetails)
  if (['cold', 'cool'].includes(request.weather)) {
    if (item.category === 'outerwear') score += 10
    if (item.category === 'tops' && /turtleneck|roll.?neck|high.?neck|sweater|knit|wool|fleece/.test(garmentDetails)) score += 4
    if (item.category === 'bottoms' && /trouser|pants|jeans|wool|corduroy/.test(garmentDetails)) score += 4
  }
  if (DRESSY_OCCASIONS.includes(request.occasion)) {
    score += dressinessScore(item, request.occasion, profile)
    if (/\b(vest|waistcoat)\b/.test(garmentDetails) && profile?.genderStylePreference === 'feminine') score += 5
  } else if (['casual', 'weekend', 'travel', 'gym'].includes(request.occasion)) {
    if (relaxed) score += 4
    score -= tooDressyFor(item)
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
  // Likes and dislikes steer, but can't pin a piece to the top: unbounded,
  // a few likes made the same pieces win every "Try another".
  score += Math.max(-8, Math.min(5, scoreRecommendationFeedback(traitsFromWardrobe(item), feedback)))
  // A disliked outfit means its pieces don't go together: keep those pairs apart.
  score += pairingFeedbackScore(item, alreadySelected, outfitPairVerdicts(feedback))
  // Pieces from saved outfits, and the pairings saved together.
  if (savedPieces.has(item.id)) score += 3
  if (alreadySelected.some((piece) => savedPairs.has(pairOf(item.id, piece.id)))) score += 2
  // This try brings back a saved outfit: its pieces lead.
  if (favoured.has(item.id)) score += 40

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
  const candidates = items.filter((i) => {
    if (i.category !== category) return false
    if (isBusinessMeetingRequest(request) && isUnsuitableForBusinessMeeting(i)) return false
    if (unsuitableFor(i, request.occasion)) return false
    // A kurta or kurti goes with palazzos, straight pants, jeans or a long skirt, not a mini.
    const isKurta = (piece: ClothingItem) => /kurt[ai]|tunic/.test(`${piece.name} ${piece.subcategory ?? ''}`.toLowerCase())
    const isMini = (piece: ClothingItem) => /\bmini\b|short skirt|skort|shorts?\b/.test(`${piece.name} ${piece.subcategory ?? ''}`.toLowerCase())
    if ((isKurta(i) && selected.some(isMini)) || (isMini(i) && selected.some(isKurta))) return false
    if (isPrint(i) && selected.some(isPrint)) return false
    const details = `${i.name} ${i.subcategory ?? ''} ${i.material ?? ''} ${i.construction ?? ''}`.toLowerCase()
    // Keep linen out of cold-weather outfit recommendations.
    if (['cold', 'cool'].includes(request.weather) && /\blinen\b/.test(details)) return false
    if (request.weather === 'cold' && category === 'bottoms' && /\bshorts?\b/.test(details)) return false
    if (category === 'outerwear') {
      const hasTurtleneck = selected.some((piece) => piece.category === 'tops'
        && /turtleneck|roll.?neck|high.?neck/.test(`${piece.name} ${piece.subcategory ?? ''} ${piece.neckline_closure ?? ''}`.toLowerCase()))
      // A turtleneck is the base top; only a coat or substantial jacket may go over it.
      const substantialJacket = /\bjacket\b/.test(details)
        && (/heavy|padded|puffer|insulated|winter|oversized|thick|quilted/.test(details) || i.seasons.includes('winter'))
      if (hasTurtleneck && !/coat|parka|puffer|overcoat|trench/.test(details) && !substantialJacket) return false
      if (hasTurtleneck && /cardigan|sweater|sweatshirt|hoodie|vest/.test(details)) return false
    }
    return true
  })
  if (candidates.length === 0) return null
  const learnedStyle = learnStyleFromWardrobe(items)

  const scored = candidates.map((item) => ({
    item,
    score: scoreItem(item, request, profile, learnedStyle, selected, colourConfig, feedback) - recentPenalty(item.id) + freshnessScore(item.id),
  }))
  scored.sort((a, b) => b.score - a.score || a.item.timesWorn - b.item.timesWorn || (a.item.lastWorn ?? '').localeCompare(b.item.lastWorn ?? '') || a.item.id.localeCompare(b.item.id))
  if (scored[0].score <= -100) return null

  // Rotate across every close-fit option, rather than a short prefix of the
  // ranked list. Capping this list made pieces later in a large wardrobe
  // effectively invisible to daily recommendations.
  const bestScore = scored[0].score
  // Close-fit options, and always at least the top few suitable pieces, so
  // one strongly liked piece can't leave "Try another" with nothing to rotate to.
  // Pieces rated down together with what's already picked stay out of the
  // rotation, unless nothing else is left.
  const verdicts = outfitPairVerdicts(feedback)
  const pairable = scored.filter((candidate) => !clashesWithPicked(candidate.item.id, selected, verdicts))
  const fresh = pairable.filter((candidate) => !sittingOut.has(candidate.item.id))
  const pool = fresh.length ? fresh : pairable.length ? pairable : scored
  const poolBest = pool[0]?.score ?? bestScore
  // Dressy occasions keep a tighter shortlist: rotate among the dressy pieces,
  // not down to the plain ones.
  const gap = DRESSY_OCCASIONS.includes(request.occasion) ? 6 : 8
  const padGap = DRESSY_OCCASIONS.includes(request.occasion) ? 6 : 12
  const closeFits = pool.filter((candidate) => poolBest - candidate.score <= gap)
  // Padded to four for variety, but never with a piece far behind (sneakers
  // shouldn't make a date-night shortlist just to fill it).
  const shortlist = closeFits.length >= 4
    ? closeFits
    : pool.filter((candidate) => candidate.score > -100 && poolBest - candidate.score <= padGap).slice(0, Math.max(closeFits.length, 4))
  // "Try another" brings forward pieces that haven't had a turn: anything
  // overlooked that still suits the occasion (within a wider reach) goes first.
  const reach = DRESSY_OCCASIONS.includes(request.occasion) ? 8 : 16
  const overlooked = attempt > 0
    ? pool.filter((candidate) => candidate.score > -100 && poolBest - candidate.score <= reach && isOverlooked(candidate.item.id))
    : []
  const contenders = overlooked.length ? overlooked : shortlist
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
  const neutralCount = allColours.filter(isNeutralColour).length
  const accentColours = allColours.filter((c) => !isNeutralColour(c))
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

const pieceWords = (item: ClothingItem) => `${item.name} ${item.subcategory ?? ''} ${item.construction ?? ''} ${item.neckline_closure ?? ''}`.toLowerCase()
// Tops made to sit out or with their own shape (a peplum, a vest, a kurti, a
// crop top) aren't tucked; loose shirts, tees, blouses and knits are.
const NOT_TUCKED = /peplum|vest|waistcoat|kurt[ai]|tunic|crop|bodysuit|corset|bustier|tube|bralette|co.?ord|jumpsuit|kaftan|anarkali/
const TUCKABLE = /shirt|\btee\b|blouse|polo|sweater|knit|jumper|button.?(down|up)/
function canTuck(item: ClothingItem) {
  const words = pieceWords(item)
  return !NOT_TUCKED.test(words) && TUCKABLE.test(words)
}
// Only sleeves you can roll: shirts, blouses, knits; not sleeveless or short-sleeve tops.
function hasRollableSleeves(item: ClothingItem) {
  const words = pieceWords(item)
  return !/sleeveless|strappy|cami|tank|vest|halter|tube|short.?sleeve|\btee\b|\bt[- ]?shirt|crop/.test(words) && /shirt|blouse|sweater|knit|jumper|cardigan|long.?sleeve/.test(words)
}

function generateStylingTips(
  items: ClothingItemResult[],
  request: StyleRequest
): string[] {
  const tips: string[] = []
  const roles = items.map((i) => i.role)
  const garmentDetails = items.map(({ item }) => `${item.name} ${item.subcategory ?? ''} ${item.construction ?? ''}`).join(' ').toLowerCase()

  const top = items.find(({ role }) => role === 'top')?.item
  const bottom = items.find(({ role }) => role === 'bottom')?.item
  if (top && bottom && canTuck(top)) {
    tips.push('Half-tuck the top for an easy waistline.')
  }
  if (roles.includes('outerwear')) {
    tips.push('Wear the outer layer open to show the look underneath.')
  }
  if (/\b(vest|waistcoat)\b/.test(garmentDetails)) {
    tips.push('Style the vest as the main top; add only a fine tank for coverage, or a coat/blazer over it when it is cold.')
  }
  if (roles.includes('accessory')) {
    tips.push('Choose one statement accessory.')
  }
  if (request.occasion === 'work' && top && hasRollableSleeves(top)) {
    tips.push('Roll the sleeves for an easy, polished finish.')
  }
  if (request.occasion === 'date-night') {
    // About the clothes, not grooming ("add a light fragrance" isn't how to wear it).
    tips.push(roles.includes('accessory')
      ? 'Let one piece of jewellery catch the light and keep the rest simple.'
      : 'Add one statement piece, like earrings or a small bag, to dress it up for the evening.')
  }
  if (request.weather === 'cold') {
    const hasTurtleneck = items.some(({ item }) => item.category === 'tops'
      && /turtleneck|roll.?neck|high.?neck/.test(`${item.name} ${item.subcategory ?? ''} ${item.neckline_closure ?? ''}`.toLowerCase()))
    tips.push(hasTurtleneck
      ? 'Wear a coat or roomy jacket over the turtleneck for warmth.'
      : 'Add a warm outer layer on colder days.')
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
  if (role === 'top' && occasion === 'work' && canTuck(_item)) return 'Tuck neatly or half-tuck for different looks'
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
  if (pinnedItem && isBusinessMeetingRequest(request) && isUnsuitableForBusinessMeeting(pinnedItem)) {
    return { suggestion: null, error: 'That piece may not fit a business meeting dress code. Choose another starting piece for this look.' }
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
    const pinnedRole = pinnedItem.category === 'outerwear' && isStandaloneWoolen(pinnedItem)
      ? 'top'
      : roleMap[pinnedItem.category] ?? 'top'
    addItem(pinnedItem, pinnedRole)
  }

  // 1. Try a dress first for certain occasions (skip if pinned item is a dress or top/bottom)
  const hasPinnedBase = pinnedItem && ['tops', 'bottoms', 'dresses'].includes(pinnedItem.category)
  // Dressy occasions start with a dress most of the time for someone who wears
  // them (two tries in three), and now and then for everyone else.
  // A saved outfit coming back decides it: a dress if it has one, top and bottom if not.
  const bringingBack = favoured.size > 0
  const favouredDress = wardrobe.some((item) => favoured.has(item.id) && item.category === 'dresses')
  const preferDress = bringingBack ? favouredDress : DRESSY_OCCASIONS.includes(request.occasion)
  const wearsDresses = suggestedGenders(profile?.genderStylePreference).includes('women')
  const dressTurn = bringingBack ? favouredDress : wearsDresses ? attempt % 3 !== 2 : Math.random() < 0.3
  if (!hasPinnedBase && preferDress && dressTurn) {
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

  // When a sweater becomes the top on a cold day, a jacket or coat (not
  // another knit) can go over it.
  const addJacketOver = (warmTop: ClothingItem) => {
    if (request.weather !== 'cold' && request.weather !== 'cool' && request.weather !== 'rainy') return
    const jackets = wardrobe.filter((item) => item.id !== warmTop.id && item.category === 'outerwear' && isJacketOrCoat(item))
    const jacket = pickBest(jackets, 'outerwear', request, profile, selected, attempt, colourConfig, feedback)
    if (jacket) addItem(jacket, 'outerwear')
  }

  // 3. Outerwear if weather warrants
  const needsOuterwear = ['cold', 'cool', 'rainy'].includes(request.weather)
  if (needsOuterwear && pinnedItem?.category !== 'outerwear') {
    const outer = pickBest(wardrobe, 'outerwear', request, profile, selected, attempt, colourConfig, feedback)
    if (outer) {
      const existingTopIndex = resultItems.findIndex((result) => result.role === 'top')
      const existingTop = existingTopIndex >= 0 ? resultItems[existingTopIndex].item : undefined
      const isVest = /\b(vest|waistcoat)\b/i.test(`${outer.name} ${outer.subcategory ?? ''}`)
      // A warm top (sweater top, knit top) never goes over another top.
      const canLayerTop = existingTop && !isWarmTop(outer) && (isVest ? canBeVestCoverage(existingTop) : canBeCollaredLayer(existingTop))

      if (isStandaloneWoolen(outer) && existingTop && !canLayerTop && pinnedItem) {
        // Keep the user's pinned starting item; don't add an incompatible inner layer.
      } else if (isStandaloneWoolen(outer) && existingTop && !canLayerTop) {
        selected.splice(selected.indexOf(existingTop), 1)
        resultItems.splice(existingTopIndex, 1)
        addItem(outer, 'top')
        addJacketOver(outer)
      } else if (isStandaloneWoolen(outer) && !existingTop) {
        addItem(outer, 'top')
        addJacketOver(outer)
      } else {
        addItem(outer, 'outerwear')
      }
    }
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
      error: request.occasion === 'formal' || request.occasion === 'special-event'
        // Casual pieces are left out of dressy looks, so say what's missing.
        ? `Your Kloset doesn't have enough dressy pieces for ${request.occasion === 'formal' ? 'a formal look' : 'a special event'} yet. Add ${resultItems.some((r) => r.role === 'top') ? 'smart trousers, a skirt or a dress' : resultItems.some((r) => r.role === 'bottom') ? 'a shirt or blouse' : 'a dress, or a shirt with smart trousers'}, and Kloset will style it.`
        : "We couldn't find enough items for this occasion. Try adding more clothes or adjusting the filters.",
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
