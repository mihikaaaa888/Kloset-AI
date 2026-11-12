import { readFileSync } from 'node:fs'

const workbook = JSON.parse(readFileSync(new URL('../colour-harmony-spec.json', import.meta.url), 'utf8'))
const fallbackConfig = workbook.engineConfig
let cachedConfig = null
let cachedAt = 0

/** Load the published colour-harmony settings from Supabase. The checked-in
 * workbook import remains a safe fallback when the database is unavailable. */
export async function getColourHarmonyConfig() {
  if (cachedConfig && Date.now() - cachedAt < 60_000) return cachedConfig

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (supabaseUrl && anonKey) {
    try {
      const url = new URL(`${supabaseUrl}/rest/v1/recommendation_knowledge`)
      url.searchParams.set('select', 'payload')
      url.searchParams.set('key', 'eq.colour_harmony')
      url.searchParams.set('limit', '1')
      const response = await fetch(url, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(1200),
      })
      if (response.ok) {
        const [row] = await response.json()
        if (row?.payload?.engineConfig?.pairwiseWeights) {
          cachedConfig = row.payload.engineConfig
          cachedAt = Date.now()
          return cachedConfig
        }
      }
    } catch {
      // Use the bundled config without logging request details or credentials.
    }
  }

  cachedConfig = fallbackConfig
  cachedAt = Date.now()
  return cachedConfig
}

export function getColourHarmonyPromptNotes(config = fallbackConfig) {
  return [
    'Use perceptual OKLab/OKLCH colour relationships rather than raw RGB distances or colour-name lookup tables.',
    'Treat hue relationships, temperature, and contrast as soft signals; never make them pass/fail rules.',
    'Near-neutral colours have unreliable hue: omit hue from that pair and renormalise the active weights.',
    'For printed garments, consider meaningful secondary colours and print complexity, not only the dominant colour.',
    'User preferences, garment roles, occasion, and context remain separate signals and can outweigh a generic colour prior.',
    'Do not invent numeric compatibility scores. Only explain a score when deterministic component scores are supplied.',
    `Active algorithm version: ${config.algorithmVersion}; scoring config: ${config.scoringConfigVersion}.`,
  ].join('\n- ')
}
