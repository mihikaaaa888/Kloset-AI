import { apiFetch, apiUrl } from '@/lib/apiUrl'
import { suggestedGenders } from '@/lib/catalogData'
import type { ClothingCategory, ClothingItem, Occasion, Season, StylePreference, UserProfile } from '@/types'

// The sample Kloset: a handful of very basic pieces so a new person can try
// outfits before adding their own. What's in it follows how they dress
// (women's / men's) and the styles they picked in onboarding. Every piece is
// marked as a sample (brand "Kloset sample") so it can be removed in one go
// from Profile.

export const SAMPLE_BRAND = 'Kloset sample'

// Stock photos (Pexels, free to hotlink) for pieces that have one. Pieces
// without one look up a stock photo when the sample Kloset is loaded.
const pexels = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800`

export const SAMPLE_PHOTOS: Record<string, string> = {
  'White Button-Down Shirt': pexels(31231440),
  'Navy Blazer': pexels(19109151),
  'Black Tailored Trousers': pexels(40337590),
  'Camel Wool Coat': pexels(3152742),
  'Dark Wash Jeans': pexels(2343661),
  'Cream Silk Blouse': pexels(15764811),
  'Black Midi Dress': pexels(39000400),
  'White Leather Trainers': pexels(17430802),
  'Grey Cashmere Sweater': pexels(27641326),
  'Gold Hoop Earrings': pexels(18075559),
}

/** A sample piece: marked with the sample brand, or one of the stock pieces the old sample wardrobe added. */
export function isSamplePiece(item: ClothingItem): boolean {
  return item.brand === SAMPLE_BRAND || (!!SAMPLE_PHOTOS[item.name] && item.imageUrl === SAMPLE_PHOTOS[item.name])
}

interface SampleSpec {
  name: string
  category: ClothingCategory
  subcategory: string
  colour: string[]
  material?: string
  formality: string
  occasions: Occasion[]
  seasons?: Season[]
  /** Stock-photo search words, for pieces without a photo above. */
  photo?: string
}

const ALL_YEAR: Season[] = ['spring', 'summer', 'autumn', 'winter']

// Basics everyone gets.
const BASICS: SampleSpec[] = [
  { name: 'White Cotton T-Shirt', category: 'tops', subcategory: 't-shirt', colour: ['White'], material: 'Cotton', formality: 'Casual', occasions: ['casual', 'weekend', 'travel'], photo: 'plain white t-shirt' },
  { name: 'White Button-Down Shirt', category: 'tops', subcategory: 'shirt', colour: ['White'], material: 'Cotton', formality: 'Smart Casual', occasions: ['work', 'casual', 'formal'] },
  { name: 'Dark Wash Jeans', category: 'bottoms', subcategory: 'jeans', colour: ['Navy'], material: 'Denim', formality: 'Casual', occasions: ['casual', 'weekend', 'travel', 'date-night'] },
  { name: 'Black Tailored Trousers', category: 'bottoms', subcategory: 'trousers', colour: ['Black'], formality: 'Business', occasions: ['work', 'formal', 'date-night'] },
  { name: 'White Leather Trainers', category: 'shoes', subcategory: 'sneakers', colour: ['White'], material: 'Leather', formality: 'Casual', occasions: ['casual', 'weekend', 'travel'] },
]
const WOMEN_BASICS: SampleSpec[] = [
  { name: 'Black Midi Dress', category: 'dresses', subcategory: 'midi dress', colour: ['Black'], formality: 'Smart Casual', occasions: ['date-night', 'formal', 'special-event'] },
  { name: 'Black Ballet Flats', category: 'shoes', subcategory: 'ballet flats', colour: ['Black'], material: 'Leather', formality: 'Smart Casual', occasions: ['work', 'casual', 'date-night'], photo: 'black ballet flats shoes' },
  { name: 'Tan Tote Bag', category: 'accessories', subcategory: 'tote bag', colour: ['Tan'], material: 'Leather', formality: 'Smart Casual', occasions: ['work', 'casual', 'travel'], photo: 'tan leather tote bag' },
]
const MEN_BASICS: SampleSpec[] = [
  { name: 'Beige Chinos', category: 'bottoms', subcategory: 'chinos', colour: ['Beige'], material: 'Cotton', formality: 'Smart Casual', occasions: ['work', 'casual', 'date-night'], photo: 'beige chino trousers' },
  { name: 'Brown Leather Loafers', category: 'shoes', subcategory: 'loafers', colour: ['Brown'], material: 'Leather', formality: 'Smart Casual', occasions: ['work', 'date-night', 'formal'], photo: 'brown leather loafers' },
  { name: 'Brown Leather Belt', category: 'accessories', subcategory: 'belt', colour: ['Brown'], material: 'Leather', formality: 'Smart Casual', occasions: ['work', 'casual', 'formal'], photo: 'brown leather belt' },
]
// One extra piece per style they picked (up to two styles).
const STYLE_PIECES: Record<StylePreference, { women: SampleSpec; men: SampleSpec }> = {
  classic: {
    women: { name: 'Navy Blazer', category: 'outerwear', subcategory: 'blazer', colour: ['Navy'], formality: 'Business', occasions: ['work', 'formal'] },
    men: { name: 'Navy Blazer', category: 'outerwear', subcategory: 'blazer', colour: ['Navy'], formality: 'Business', occasions: ['work', 'formal'] },
  },
  minimalist: {
    women: { name: 'Grey Cashmere Sweater', category: 'outerwear', subcategory: 'sweater', colour: ['Grey'], material: 'Cashmere', formality: 'Smart Casual', occasions: ['work', 'casual'], seasons: ['autumn', 'winter'] },
    men: { name: 'Grey Cashmere Sweater', category: 'outerwear', subcategory: 'sweater', colour: ['Grey'], material: 'Cashmere', formality: 'Smart Casual', occasions: ['work', 'casual'], seasons: ['autumn', 'winter'] },
  },
  streetwear: {
    women: { name: 'Grey Hoodie', category: 'outerwear', subcategory: 'hoodie', colour: ['Grey'], material: 'Cotton', formality: 'Casual', occasions: ['casual', 'weekend'], photo: 'grey hoodie' },
    men: { name: 'Black Cargo Pants', category: 'bottoms', subcategory: 'cargo pants', colour: ['Black'], material: 'Cotton', formality: 'Casual', occasions: ['casual', 'weekend'], photo: 'black cargo pants' },
  },
  bohemian: {
    women: { name: 'Floral Midi Skirt', category: 'bottoms', subcategory: 'midi skirt', colour: ['Terracotta'], formality: 'Casual', occasions: ['casual', 'weekend', 'date-night'], photo: 'floral midi skirt' },
    men: { name: 'White Linen Kurta', category: 'tops', subcategory: 'kurta', colour: ['White'], material: 'Linen', formality: 'Smart Casual', occasions: ['casual', 'special-event'], photo: 'white linen kurta' },
  },
  business: {
    women: { name: 'Cream Silk Blouse', category: 'tops', subcategory: 'blouse', colour: ['Cream'], material: 'Silk', formality: 'Business', occasions: ['work', 'formal', 'date-night'] },
    men: { name: 'Light Blue Oxford Shirt', category: 'tops', subcategory: 'shirt', colour: ['Sky Blue'], material: 'Cotton', formality: 'Business', occasions: ['work', 'formal'], photo: 'light blue oxford shirt' },
  },
  athleisure: {
    women: { name: 'Black Leggings', category: 'bottoms', subcategory: 'leggings', colour: ['Black'], formality: 'Casual', occasions: ['gym', 'casual', 'travel'], photo: 'black leggings' },
    men: { name: 'Black Joggers', category: 'bottoms', subcategory: 'joggers', colour: ['Black'], material: 'Cotton', formality: 'Casual', occasions: ['gym', 'casual', 'travel'], photo: 'black joggers' },
  },
  romantic: {
    women: { name: 'Blush Blouse', category: 'tops', subcategory: 'blouse', colour: ['Blush'], formality: 'Smart Casual', occasions: ['date-night', 'casual'], photo: 'blush pink blouse' },
    men: { name: 'Cream Knit Polo', category: 'tops', subcategory: 'polo shirt', colour: ['Cream'], formality: 'Smart Casual', occasions: ['date-night', 'casual'], photo: 'cream knit polo shirt' },
  },
  eclectic: {
    women: { name: 'Printed Shirt', category: 'tops', subcategory: 'shirt', colour: ['Cobalt'], formality: 'Casual', occasions: ['casual', 'weekend'], photo: 'printed shirt' },
    men: { name: 'Printed Shirt', category: 'tops', subcategory: 'shirt', colour: ['Cobalt'], formality: 'Casual', occasions: ['casual', 'weekend'], photo: 'printed shirt' },
  },
}

function samplePieces(profile: UserProfile | null): SampleSpec[] {
  const genders = suggestedGenders(profile?.genderStylePreference)
  const women = genders.includes('women')
  const men = genders.includes('men')
  const audience = men && !women ? 'men' : 'women'
  const pieces = [
    ...BASICS,
    ...(women ? WOMEN_BASICS : []),
    ...(men ? MEN_BASICS.filter((piece) => !women || piece.category !== 'shoes') : []),
    ...(profile?.stylePreferences ?? []).slice(0, 2).map((style) => STYLE_PIECES[style]?.[audience]).filter((piece): piece is SampleSpec => !!piece),
  ]
  return pieces.filter((piece, i) => pieces.findIndex((other) => other.name === piece.name) === i)
}

/** The sample Kloset for this person, leaving out pieces they already have (by name). */
export function buildSampleKloset(profile: UserProfile | null, existing: ClothingItem[] = []): ClothingItem[] {
  const have = new Set(existing.map((item) => item.name.toLowerCase()))
  const now = new Date().toISOString()
  return samplePieces(profile).filter((piece) => !have.has(piece.name.toLowerCase())).map((piece) => ({
    id: crypto.randomUUID(),
    name: piece.name,
    category: piece.category,
    subcategory: piece.subcategory,
    imageUrl: SAMPLE_PHOTOS[piece.name] ?? null,
    imageSource: SAMPLE_PHOTOS[piece.name] ? 'remote' : 'none',
    colour: piece.colour,
    material: piece.material,
    pattern: /printed|floral/i.test(piece.name) ? (/floral/i.test(piece.name) ? 'floral' : 'abstract') : 'solid',
    formality: piece.formality,
    seasons: piece.seasons ?? ALL_YEAR,
    occasions: piece.occasions,
    brand: SAMPLE_BRAND,
    notes: '',
    isFavourite: false,
    timesWorn: 0,
    createdAt: now,
    updatedAt: now,
  }))
}

/** A stock photo for a sample piece without one; null when none is found (it keeps its colour tile). */
export async function findSamplePhoto(item: ClothingItem): Promise<string | null> {
  const words = samplePieces(null).concat(Object.values(STYLE_PIECES).flatMap((p) => [p.women, p.men]), MEN_BASICS)
    .find((piece) => piece.name === item.name)?.photo ?? item.name
  try {
    const res = await apiFetch(apiUrl(`/api/search-images?q=${encodeURIComponent(words)}`))
    if (!res.ok) return null
    const data = await res.json() as { photos?: { url?: string }[] }
    return data.photos?.find((photo) => photo.url)?.url ?? null
  } catch (error) {
    console.warn('[sample] photo search failed', item.name, error)
    return null
  }
}
