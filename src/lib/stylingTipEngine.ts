import tipData from '../../styling-tips-workbook.json'
import recommendationGuide from '../../recommendation-workbook-guidance.json'
import type { ClothingItem, UserProfile } from '@/types'
import type { WeatherCondition } from '@/lib/stylist'

export type StylingTipAction = 'shown' | 'helpful' | 'not-helpful' | 'applied' | 'known'
export interface StylingTip { id: string; text: string; category: string; format: string; appliesTo: string; occasion: string; season: string; priority: number; cooldownDays: number; trigger: string; level: string; rotation: number }
interface TipLogEntry { tipId: string; action: StylingTipAction; createdAt: string; category: string; format: string; contextKey?: string }

const tips = tipData.tips as StylingTip[]
const neutralColours = new Set([
  'black', 'white', 'off white', 'ivory', 'alabaster', 'snow', 'ultra pure white', 'white orchid', 'plantation white',
  'eggshell', 'cream', 'champagne', 'bone', 'grey', 'gray', 'silver', 'slate', 'charcoal', 'greige', 'gray cliffs',
  'far horizon', 'drift of mist', 'beige', 'warm beige', 'tan', 'sand', 'nude brown', 'pale olive', 'ivory tusk',
  'toasted meringue', 'mushroom', 'fawn', 'taupe', 'chocolate', 'espresso', 'iron ore', 'virtual taupe', 'sage',
  'evergreen', 'slate blue', 'mauve finery', 'cinnamon slate', 'camel', 'brown',
])
const boldHints = recommendationGuide.outfitRules.boldColourHints.map((value) => value.toLowerCase())

function logKey(userId: string) { return `kloset:styling-tip-log:v1:${userId}` }
function readLog(userId: string): TipLogEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem(logKey(userId)) ?? '[]')
    return Array.isArray(value) ? value.filter((entry) => entry && typeof entry.tipId === 'string' && typeof entry.createdAt === 'string') : []
  } catch { return [] }
}
function writeLog(userId: string, log: TipLogEntry[]) {
  try { localStorage.setItem(logKey(userId), JSON.stringify(log.slice(-1500))) } catch { /* use the bundled rotation when storage is unavailable */ }
}
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function matchingTags(value: string, tags: string[]) {
  if (!value || normalize(value) === 'any') return true
  return value.split(/[\/,&]/).map(normalize).filter(Boolean).some((tag) => tags.some((candidate) => normalize(candidate).includes(tag) || tag.includes(normalize(candidate))))
}
function tipItemsMatch(tip: StylingTip, outfit: ClothingItem[]) {
  if (normalize(tip.appliesTo) === 'any') return true
  const tags = outfit.flatMap((item) => [item.name, item.category, item.subcategory ?? ''])
  return matchingTags(tip.appliesTo, tags)
}
function isOutfitSpecificTip(tip: StylingTip) {
  if (tip.trigger.startsWith('T_OUTFIT_')) return true
  return tip.trigger === 'T_GARMENT' && normalize(tip.appliesTo) !== 'any'
}
function isNeutral(colour: string) {
  const normalized = normalize(colour)
  return [...neutralColours].some((neutral) => normalized === neutral || normalized.includes(neutral))
}
function isBold(item: ClothingItem) { return item.colour.some((colour) => !isNeutral(colour) && boldHints.some((hint) => colour.toLowerCase().includes(hint))) }
function isPatterned(item: ClothingItem) { return item.pattern !== 'solid' && item.pattern !== 'other' }

function triggerMatches(tip: StylingTip, outfit: ClothingItem[], wardrobe: ClothingItem[], weather: WeatherCondition | null, occasions: string[], createdAt?: string): boolean {
  const trigger = tip.trigger
  if (trigger === 'EVERGREEN') return true
  if (trigger === 'T_OCCASION') return matchingTags(tip.occasion, occasions)
  if (trigger === 'T_GARMENT') return tipItemsMatch(tip, outfit)
  if (trigger === 'T_SEASON') {
    const seasons: Record<string, string[]> = { hot: ['summer'], warm: ['summer', 'spring'], cool: ['autumn', 'spring'], cold: ['winter'], rainy: ['monsoon', 'autumn'] }
    return normalize(tip.season) === 'any' || matchingTags(tip.season, seasons[weather ?? 'warm'] ?? [])
  }
  if (trigger === 'T_WEATHER_HOT') return weather === 'hot'
  if (trigger === 'T_WEATHER_RAIN') return weather === 'rainy'
  if (trigger === 'T_WEATHER_COLD') return weather === 'cold' || weather === 'cool'
  if (trigger === 'T_OUTFIT_TWO_BOLD') return outfit.filter(isBold).length >= 2
  if (trigger === 'T_OUTFIT_TWO_PATTERNS') return outfit.filter(isPatterned).length >= 2
  if (trigger === 'T_OUTFIT_ALL_NEUTRAL') return outfit.length > 0 && outfit.every((item) => item.colour.every(isNeutral))
  if (trigger === 'T_ITEM_UNWORN') return outfit.some((item) => item.timesWorn === 0)
  if (trigger === 'T_WARDROBE_NO_FORMAL') return !wardrobe.some((item) => /formal|3 formal/i.test(item.formality ?? ''))
  if (trigger === 'T_SHOPPING') return ['bottoms', 'shoes', 'accessories'].some((category) => wardrobe.filter((item) => item.category === category).length <= 1)
  if (trigger === 'T_WARDROBE_FEW_BOTTOMS') return wardrobe.filter((item) => item.category === 'bottoms').length < Math.max(2, wardrobe.filter((item) => item.category === 'tops').length / 3)
  if (trigger === 'T_WARDROBE_FEW_NEUTRALS') return wardrobe.length > 0 && wardrobe.filter((item) => item.colour.every(isNeutral)).length / wardrobe.length < 0.35
  if (trigger === 'T_WARDROBE_SMALL') return wardrobe.length < 8
  if (trigger === 'T_NO_ACCESSORY') return !wardrobe.some((item) => item.category === 'accessories')
  if (trigger === 'T_FIRST_WEEK') return !!createdAt && (Date.now() - new Date(createdAt).getTime()) / 86_400_000 <= 7
  // Event-only triggers are not eligible for the daily home box without that event.
  return false
}

function tipLevelAllowed(tip: StylingTip, profile: UserProfile | null, log: TipLogEntry[]) {
  const ageDays = profile?.createdAt ? Math.max(0, (Date.now() - new Date(profile.createdAt).getTime()) / 86_400_000) : 0
  if (ageDays < 7) return tip.level === 'Basic'
  const applied = log.filter((entry) => entry.action === 'applied').length
  if (ageDays >= 30 || applied >= 5) return true
  return tip.level === 'Basic' || tip.level === 'Intermediate'
}

export function getDailyStylingTip(userId: string, outfit: ClothingItem[], wardrobe: ClothingItem[], weather: WeatherCondition | null, profile: UserProfile | null, date = new Date(), contextKey = 'daily', contextOccasions: string[] = []): StylingTip | null {
  if (!outfit.length) return null
  const log = readLog(userId)
  const dayKey = date.toISOString().slice(0, 10)
  const todaysShown = [...log].reverse().find((entry) => entry.action === 'shown' && entry.contextKey === contextKey && entry.createdAt.slice(0, 10) === dayKey)
  const todaysTip = todaysShown ? tips.find((tip) => tip.id === todaysShown.tipId) : null
  if (todaysTip && isOutfitSpecificTip(todaysTip)) return todaysTip

  const occasions = [...new Set([...contextOccasions, 'casual', ...(profile?.typicalOccasions ?? []), ...outfit.flatMap((item) => item.occasions)])]
  // The daily outfit card is for styling the current look. Keep wardrobe
  // maintenance nudges (such as unworn-item reminders) out of this tip slot.
  const eligible = tips.filter((tip) => isOutfitSpecificTip(tip)
    && tipLevelAllowed(tip, profile, log)
    && matchingTags(tip.occasion, occasions)
    && tipItemsMatch(tip, outfit)
    && triggerMatches(tip, outfit, wardrobe, weather, occasions, profile?.createdAt))
  let pool = eligible
  const helpfulCategories = new Set(log.filter((entry) => entry.action === 'helpful' || entry.action === 'applied').map((entry) => entry.category))
  const recent = log.filter((entry) => entry.action === 'shown').slice(-2).reverse()
  const now = date.getTime()
  const cooldownFiltered = pool.filter((tip) => {
    const previous = [...log].reverse().find((entry) => entry.tipId === tip.id && ['shown', 'not-helpful'].includes(entry.action))
    if (log.some((entry) => entry.tipId === tip.id && entry.action === 'known')) return false
    if (previous && (now - new Date(previous.createdAt).getTime()) / 86_400_000 < (previous.action === 'not-helpful' ? 90 : tip.cooldownDays)) return false
    return true
  })
  if (cooldownFiltered.length) pool = cooldownFiltered
  if (!pool.length) return createOutfitSpecificFallback(userId, outfit, date, contextKey)
  const varietyPool = pool.filter((tip) => !recent.some((entry) => entry.category === tip.category))
  if (varietyPool.length) pool = varietyPool
  const formatPool = pool.filter((tip) => !(recent.length >= 2 && recent[0].format === recent[1].format && recent[0].format === tip.format))
  if (formatPool.length) pool = formatPool

  const scored = pool.map((tip) => {
    const previous = [...log].reverse().find((entry) => entry.tipId === tip.id && entry.action === 'shown')
    const daysSince = previous ? (now - new Date(previous.createdAt).getTime()) / 86_400_000 : 90
    const freshness = Math.min(3, daysSince / Math.max(1, tip.cooldownDays))
    const score = tip.priority * freshness * (tip.trigger === 'EVERGREEN' ? 1 : 2) * (helpfulCategories.has(tip.category) ? 1.2 : 1)
    return { tip, score }
  }).sort((a, b) => b.score - a.score || a.tip.rotation - b.tip.rotation).slice(0, 3)
  const choice = scored[Number.parseInt(dayKey.replace(/-/g, ''), 10) % Math.max(1, scored.length)]?.tip ?? pool[0]
  writeLog(userId, [...log, { tipId: choice.id, action: 'shown', createdAt: date.toISOString(), category: choice.category, format: choice.format, contextKey }])
  return choice
}

function createOutfitSpecificFallback(userId: string, outfit: ClothingItem[], date: Date, contextKey: string): StylingTip {
  const top = outfit.find((item) => ['tops', 'woolens'].includes(normalize(item.category)))
  const bottom = outfit.find((item) => normalize(item.category) === 'bottoms')
  const shoes = outfit.find((item) => normalize(item.category) === 'shoes')
  const layer = outfit.find((item) => ['outerwear', 'woolens'].includes(normalize(item.category)) && item.id !== top?.id)
  const text = layer && top
    ? `Layer ${layer.name} over ${top.name} for extra warmth.`
    : top && bottom && shoes
      ? `Pair ${top.name} with ${bottom.name}, then let ${shoes.name} finish the look.`
      : top && bottom
        ? `Pair ${top.name} with ${bottom.name} to keep this outfit balanced.`
        : `Let ${outfit[0].name} lead the look and keep the other pieces simple.`
  const tip: StylingTip = {
    id: `daily-outfit:${outfit.map((item) => item.id).join(':')}`,
    text,
    category: 'Outfit pairing',
    format: 'Try',
    appliesTo: outfit.map((item) => item.name).join(', '),
    occasion: 'any',
    season: 'any',
    priority: 1,
    cooldownDays: 0,
    trigger: 'T_OUTFIT_PAIRING',
    level: 'Basic',
    rotation: 0,
  }
  writeLog(userId, [...readLog(userId), { tipId: tip.id, action: 'shown', createdAt: date.toISOString(), category: tip.category, format: tip.format, contextKey }])
  return tip
}

export function rateStylingTip(userId: string, tip: StylingTip, action: Exclude<StylingTipAction, 'shown'>) {
  const log = readLog(userId)
  writeLog(userId, [...log, { tipId: tip.id, action, createdAt: new Date().toISOString(), category: tip.category, format: tip.format }])
}
