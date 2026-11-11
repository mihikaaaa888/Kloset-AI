import { supabase } from '@/lib/supabase'
import type { ColourHarmonyConfig } from '@/lib/colourHarmony'
import spec from '../../colour-harmony-spec.json'

const FALLBACK_CONFIG = spec.engineConfig as ColourHarmonyConfig
let cachedConfig: Promise<ColourHarmonyConfig> | null = null

/** Read the active colour-harmony config from Supabase, falling back to the
 * checked-in workbook import when the table is not yet available. */
export function getColourHarmonyConfig(): Promise<ColourHarmonyConfig> {
  if (!cachedConfig) {
    const readConfig = Promise.resolve(supabase
      .from('recommendation_knowledge')
      .select('payload')
      .eq('key', 'colour_harmony')
      .maybeSingle()
      .then(({ data, error }) => {
        const payload = data?.payload as { engineConfig?: ColourHarmonyConfig } | null
        if (!error && payload?.engineConfig?.pairwiseWeights && payload.engineConfig?.huePriors?.length) {
          return payload.engineConfig
        }
        if (error) console.info('[colour-harmony] using bundled config; Supabase config is unavailable')
        return FALLBACK_CONFIG
      })
    ).catch(() => FALLBACK_CONFIG)
    const timeout = new Promise<ColourHarmonyConfig>((resolve) => {
      globalThis.setTimeout(() => resolve(FALLBACK_CONFIG), 1200)
    })
    cachedConfig = Promise.race([readConfig, timeout])
  }
  return cachedConfig
}
