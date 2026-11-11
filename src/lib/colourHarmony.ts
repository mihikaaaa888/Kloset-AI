import { COLOUR_MAP } from '@/lib/colourUtils'

export interface ColourHarmonyConfig {
  algorithmVersion: string
  scoringConfigVersion: string
  pairwiseWeights: { hue: number; contrast: number; chroma: number; temperature: number; neutralAnchor: number }
  huePriors: { angle: number; score: number; width: number }[]
  fallbackProfileConfidence: number
  neutralChromaThreshold: number
}

export interface ColourPairScore {
  score: number | null
  confidence: number
  componentScores: { hue: number | null; contrast: number; chroma: number; temperature: number | null; neutralAnchor: number }
  activeWeights: Record<string, number>
  explanation: string
  algorithmVersion: string
  scoringConfigVersion: string
}

interface ColourFeature {
  lightness: number
  a: number
  b: number
  chroma: number
  hue: number | null
  temperature: number
}

const MAX_SCORE = 100

function clamp(value: number, min = 0, max = MAX_SCORE): number {
  return Math.min(max, Math.max(min, value))
}

function hexForName(name: string): string | null {
  const normalized = name.trim().toLowerCase()
  const entry = Object.entries(COLOUR_MAP).find(([label]) => label.toLowerCase() === normalized)
  return entry?.[1] ?? null
}

function srgbToLinear(value: number): number {
  const channel = value / 255
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function featureFromHex(hex: string, confidence: number, neutralThreshold: number): ColourFeature {
  const r = srgbToLinear(parseInt(hex.slice(1, 3), 16))
  const g = srgbToLinear(parseInt(hex.slice(3, 5), 16))
  const b = srgbToLinear(parseInt(hex.slice(5, 7), 16))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bAxis = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const chroma = Math.hypot(a, bAxis)
  const neutral = chroma < neutralThreshold || confidence < 0.25
  const hue = neutral ? null : (Math.atan2(bAxis, a) * 180 / Math.PI + 360) % 360
  // A continuous warm/cool estimate from perceptual red-green and yellow-blue
  // axes; kept as a gentle signal because undertones are uncertain in photos.
  const temperature = Math.tanh((0.7 * a + bAxis) * 3)
  return { lightness, a, b: bAxis, chroma, hue, temperature }
}

function circularDistance(first: number, second: number): number {
  const raw = Math.abs(first - second) % 360
  return Math.min(raw, 360 - raw)
}

function hueRelationshipScore(first: ColourFeature, second: ColourFeature, config: ColourHarmonyConfig): number | null {
  if (first.hue == null || second.hue == null) return null
  const distance = circularDistance(first.hue, second.hue)
  let score = Math.max(...config.huePriors.map((prior) =>
    prior.score - 15 * (circularDistance(distance, prior.angle) / prior.width) ** 2,
  ))

  if (distance < 18) {
    // Same-hue looks need tonal separation or texture to avoid looking flat.
    score += clamp(Math.abs(first.lightness - second.lightness) * 30, 0, 12) - 5
  }
  if (distance > 155 && first.chroma > 0.16 && second.chroma > 0.16) score -= 12
  return clamp(score)
}

function weightedAverage(components: Record<string, number | null>, weights: Record<string, number>): { score: number | null; activeWeights: Record<string, number> } {
  const active = Object.entries(components).filter(([key, value]) => value != null && weights[key] > 0)
  const totalWeight = active.reduce((sum, [key]) => sum + weights[key], 0)
  if (!totalWeight) return { score: null, activeWeights: {} }
  const activeWeights = Object.fromEntries(active.map(([key]) => [key, weights[key] / totalWeight]))
  const score = active.reduce((sum, [key, value]) => sum + value! * activeWeights[key], 0)
  return { score: clamp(score), activeWeights }
}

function scoreFeaturePair(first: ColourFeature, second: ColourFeature, config: ColourHarmonyConfig, confidence: number): Omit<ColourPairScore, 'algorithmVersion' | 'scoringConfigVersion'> {
  const hue = hueRelationshipScore(first, second, config)
  const lightnessGap = Math.abs(first.lightness - second.lightness)
  // The peak favours readable tonal separation, without rewarding maximum contrast automatically.
  const contrast = clamp(100 * Math.exp(-0.5 * ((lightnessGap - 0.24) / 0.32) ** 2))
  const chromaGap = Math.abs(first.chroma - second.chroma)
  let chroma = clamp(100 - chromaGap * 105)
  if (Math.min(first.chroma, second.chroma) < 0.08 && Math.max(first.chroma, second.chroma) > 0.18) chroma = Math.max(chroma, 78)
  const temperature = first.hue == null || second.hue == null
    ? null
    : clamp(82 - Math.abs(first.temperature - second.temperature) * 10)
  const firstNeutral = first.hue == null
  const secondNeutral = second.hue == null
  const neutralAnchor = firstNeutral && secondNeutral ? 82 : firstNeutral || secondNeutral ? 90 : 67
  const componentScores = { hue, contrast, chroma, temperature, neutralAnchor }
  const aggregate = weightedAverage(componentScores, config.pairwiseWeights)
  const relationship = hue == null
    ? 'near-neutral colours, where hue is not reliable'
    : circularDistance(first.hue!, second.hue!) < 45
      ? 'related hues'
      : circularDistance(first.hue!, second.hue!) > 150
        ? 'a complementary contrast'
        : 'a balanced hue contrast'
  const explanation = `${relationship}; lightness separation is ${lightnessGap >= 0.2 ? 'clear' : 'subtle'}${chromaGap >= 0.12 ? ', with a useful difference in colour intensity' : ''}.`
  return { score: aggregate.score, confidence, componentScores, activeWeights: aggregate.activeWeights, explanation }
}

/** Deterministic, confidence-aware pair score using OKLab-derived colour features. */
export function scoreColourPair(firstName: string, secondName: string, config: ColourHarmonyConfig): ColourPairScore | null {
  const firstHex = hexForName(firstName)
  const secondHex = hexForName(secondName)
  if (!firstHex || !secondHex) return null
  const confidence = config.fallbackProfileConfidence
  const first = featureFromHex(firstHex, confidence, config.neutralChromaThreshold)
  const second = featureFromHex(secondHex, confidence, config.neutralChromaThreshold)
  return {
    ...scoreFeaturePair(first, second, config, confidence),
    algorithmVersion: config.algorithmVersion,
    scoringConfigVersion: config.scoringConfigVersion,
  }
}

/** Score all named colour pairs, treating the first colour as the main cluster. */
export function scoreColourSets(firstColours: string[], secondColours: string[], config: ColourHarmonyConfig): ColourPairScore | null {
  if (!firstColours.length || !secondColours.length) return null
  const pairScores = firstColours.flatMap((first, firstIndex) => secondColours.flatMap((second, secondIndex) => {
    const result = scoreColourPair(first, second, config)
    if (result?.score == null) return []
    const importance = firstIndex === 0 && secondIndex === 0 ? 1 : firstIndex === 0 || secondIndex === 0 ? 0.6 : 0.3
    return [{ result, importance }]
  }))
  if (!pairScores.length) return null
  const total = pairScores.reduce((sum, pair) => sum + pair.importance, 0)
  const score = pairScores.reduce((sum, pair) => sum + pair.result.score! * pair.importance, 0) / total
  const confidence = pairScores.reduce((sum, pair) => sum + pair.result.confidence * pair.importance, 0) / total
  const main = pairScores[0].result
  return { ...main, score, confidence }
}
