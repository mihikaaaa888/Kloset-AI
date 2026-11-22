import brandDirectory from '../../brand-directory.json'
import type { ClothingItem, UserProfile } from '@/types'

/** Every brand in Shop's directory, A to Z. Any other brand can still be searched by name. */
export const ALL_BRANDS: string[] = brandDirectory.brands.map((brand) => brand.name).sort((a, b) => a.localeCompare(b))

// Shown when someone hasn't liked or added any brands yet.
const STARTER_BRANDS = ['H&M', 'Zara', 'Mango', 'Diesel', 'Coach', 'Zudio', 'Westside']

export const brandKey = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')

const byKey = new Map<string, string>()
for (const brand of brandDirectory.brands) {
  for (const name of [brand.name, ...(brand.aliases ?? [])]) byKey.set(brandKey(name), brand.name)
}

/** The directory's spelling of a brand ("levis" → "Levi's"), or the name as typed. */
export function canonicalBrand(name: string): string {
  return byKey.get(brandKey(name)) ?? name.trim()
}

/** Directory brands matching a search, best first: name starts with it, then contains it. */
export function searchBrands(query: string): string[] {
  const q = brandKey(query)
  if (!q) return ALL_BRANDS
  const starts = ALL_BRANDS.filter((name) => brandKey(name).startsWith(q))
  const contains = ALL_BRANDS.filter((name) => !starts.includes(name) && brandKey(name).includes(q))
  const aliasHits = [...byKey.entries()].filter(([key]) => key.startsWith(q)).map(([, name]) => name)
  return [...new Set([...starts, ...contains, ...aliasHits])]
}

/**
 * Brands to offer as bubbles: the person's hearted brands, then brands they
 * own most in their Kloset, then a few popular ones so the row is never empty.
 */
export function likedBrands(profile: UserProfile | null, wardrobe: ClothingItem[], limit = 10): { name: string; favourite: boolean }[] {
  const favourites = (profile?.favouriteBrands ?? []).map(canonicalBrand)
  const owned = new Map<string, number>()
  for (const item of wardrobe) {
    if (!item.brand?.trim()) continue
    const name = canonicalBrand(item.brand)
    owned.set(name, (owned.get(name) ?? 0) + 1)
  }
  const fromKloset = [...owned.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  const seen = new Set<string>()
  const result: { name: string; favourite: boolean }[] = []
  for (const name of [...favourites, ...fromKloset, ...STARTER_BRANDS]) {
    const key = brandKey(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push({ name, favourite: favourites.some((fav) => brandKey(fav) === key) })
  }
  // Hearted brands always show; the rest fill up to the limit.
  return result.slice(0, Math.max(limit, favourites.length))
}

// ─── Brands to suggest in onboarding ──────────────────────────────────────────
// A starting point that leans on age and who they shop for. Not a rule: any
// brand can be searched and picked.
const BRANDS_BY_AGE: Record<'young' | 'adult' | 'mature', { women: string[]; men: string[] }> = {
  young: {
    women: ['Zara', 'H&M', 'Urbanic', 'NewMe', 'Bershka', 'Bonkers Corner', 'Pull&Bear', 'Zudio', 'Bewakoof', 'The Souled Store', 'Nike', 'Adidas', "Levi's", 'Uniqlo', 'Forever 21', 'Max Fashion'],
    men: ['Snitch', 'Bewakoof', 'The Souled Store', 'H&M', 'Zara', 'Jack & Jones', 'Pull&Bear', 'Bershka', 'Zudio', 'Nike', 'Adidas', 'Puma', "Levi's", 'Uniqlo', 'Rare Rabbit', 'Max Fashion'],
  },
  adult: {
    women: ['Zara', 'Mango', 'COS', 'Uniqlo', 'H&M', '& Other Stories', 'Massimo Dutti', 'AND', 'Westside', 'Nicobar', 'Fabindia', 'Jaypore', 'Charles & Keith', "Levi's", 'Nike', 'Marks & Spencer'],
    men: ['Zara', 'Uniqlo', 'COS', 'Massimo Dutti', 'H&M', 'Rare Rabbit', 'Jack & Jones', "Levi's", 'Allen Solly', 'Louis Philippe', 'Westside', 'Fabindia', 'Nike', 'Adidas', 'Marks & Spencer', 'Manyavar'],
  },
  mature: {
    women: ['Fabindia', 'W', 'Biba', 'Marks & Spencer', 'Mango', 'Massimo Dutti', 'Westside', 'Ritu Kumar', 'Anita Dongre', 'Good Earth', 'Jaypore', 'Uniqlo', 'Ralph Lauren', 'Hidesign', 'Clarks', 'Raymond'],
    men: ['Raymond', 'Louis Philippe', 'Van Heusen', 'Allen Solly', 'Peter England', 'Marks & Spencer', 'Fabindia', 'Manyavar', 'Ralph Lauren', 'Tommy Hilfiger', 'Massimo Dutti', 'Uniqlo', 'Hidesign', 'Clarks', 'Lacoste', 'Westside'],
  },
}

export function suggestedBrandsFor(ageRange: string | undefined, audience: 'all' | 'women' | 'men'): string[] {
  const band = ['under-18', '18-24', 'under-25'].includes(ageRange ?? '') ? 'young'
    : ['35-44', '45-54', '55+'].includes(ageRange ?? '') ? 'mature' : 'adult'
  const lists = BRANDS_BY_AGE[band]
  const picked = audience === 'men' ? lists.men : audience === 'women' ? lists.women
    // Both: interleave so each shows up early.
    : lists.women.flatMap((name, i) => [name, lists.men[i]]).filter((name): name is string => !!name)
  return [...new Set(picked.map(canonicalBrand))]
}

// ─── Similar brands ───────────────────────────────────────────────────────────
// Brands that sit together (same kind of clothes and price), so tapping one in
// onboarding can bring in its neighbours, like picking an artist on Spotify.
const BRAND_CIRCLES: string[][] = [
  ['Zara', 'H&M', 'Mango', 'Bershka', 'Pull&Bear', 'Forever 21', 'Urbanic', 'NewMe', 'Zudio', 'Max Fashion', 'Stradivarius'],
  ['Bonkers Corner', 'Bewakoof', 'The Souled Store', 'Snitch', 'Jack & Jones', 'Urbanic'],
  ['Nike', 'Adidas', 'Puma', 'Reebok', 'Skechers', 'New Balance', 'Decathlon'],
  ['COS', 'Uniqlo', 'Massimo Dutti', '& Other Stories', 'Arket', 'Marks & Spencer', 'Mango'],
  ['Fabindia', 'Nicobar', 'Jaypore', 'Good Earth', 'Biba', 'W', 'AND', 'Global Desi', 'Westside'],
  ['Ritu Kumar', 'Anita Dongre', 'Manyavar', 'Good Earth', 'Nicobar', 'Biba'],
  ['Raymond', 'Louis Philippe', 'Van Heusen', 'Allen Solly', 'Peter England', 'Arrow'],
  ['Ralph Lauren', 'Tommy Hilfiger', 'Lacoste', 'Rare Rabbit', 'Massimo Dutti', "Levi's"],
  ['Charles & Keith', 'Hidesign', 'Clarks', 'Aldo', 'Steve Madden', 'Bata'],
  ["Levi's", 'Wrangler', 'Lee', 'Jack & Jones', 'Pepe Jeans', 'Uniqlo'],
]
const WOMEN_ONLY = new Set(['Urbanic', 'NewMe', 'Forever 21', 'Stradivarius', '& Other Stories', 'Biba', 'W', 'AND', 'Global Desi', 'Ritu Kumar', 'Anita Dongre', 'Charles & Keith', 'Steve Madden'].map(brandKey))
const MEN_ONLY = new Set(['Snitch', 'Raymond', 'Louis Philippe', 'Van Heusen', 'Peter England', 'Arrow', 'Manyavar'].map(brandKey))

/** Brands like `name` for this audience, most alike first (they share more circles). */
export function relatedBrands(name: string, audience: 'all' | 'women' | 'men', exclude: string[] = [], limit = 3): string[] {
  const key = brandKey(name)
  const skip = new Set([key, ...exclude.map(brandKey)])
  const counts = new Map<string, number>()
  for (const circle of BRAND_CIRCLES) {
    if (!circle.some((brand) => brandKey(brand) === key)) continue
    circle.forEach((brand, i) => counts.set(brand, (counts.get(brand) ?? 0) + 1 + (circle.length - i) / 100))
  }
  return [...counts.entries()]
    .filter(([brand]) => !skip.has(brandKey(brand)))
    .filter(([brand]) => audience === 'all' || (audience === 'women' ? !MEN_ONLY.has(brandKey(brand)) : !WOMEN_ONLY.has(brandKey(brand))))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([brand]) => canonicalBrand(brand))
}
