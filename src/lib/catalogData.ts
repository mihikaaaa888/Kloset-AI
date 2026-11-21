// Style and audience helpers for Kloset's live shopping. There is no fixed
// product catalog: every product shown comes from a live search (see
// src/lib/liveShop.ts and /api/discover-feed).

/** Which clothing audiences to suggest for a style preference: women's, men's or both. */
export function suggestedGenders(preference: string | null | undefined): Array<'women' | 'men'> {
  const p = String(preference ?? '').toLowerCase()
  if (['feminine', 'female', 'women'].includes(p)) return ['women']
  if (['masculine', 'male', 'men'].includes(p)) return ['men']
  return ['women', 'men']
}

/** Display names for the onboarding style choices. */
export const CATALOG_STYLE_LABELS: Record<string, string> = {
  classic: 'Classic',
  minimalist: 'Minimalist',
  business: 'Business',
  streetwear: 'Streetwear',
  bohemian: 'Bohemian',
  athleisure: 'Athleisure',
  romantic: 'Romantic',
  eclectic: 'Eclectic',
}
