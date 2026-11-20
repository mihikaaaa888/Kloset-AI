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
