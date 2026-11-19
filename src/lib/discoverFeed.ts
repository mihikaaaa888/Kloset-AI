import type { ClothingCategory, UserProfile } from '@/types'
import type { RecommendationTraits, TasteProfile } from '@/lib/recommendationFeedback'
import { suggestedGenders } from '@/lib/catalogData'

// Builds the live "From around the web" searches on Shop from what Kloset
// knows about the user: style preference (women's / men's / both), favourite
// and learned colours, fabrics, prints and styles. Each "page" picks a
// different mix, so Show more keeps finding new things.

export interface WebProduct {
  id: string
  url: string
  title: string
  retailer: string
  domain: string
  imageUrl: string
  price: string | null
  query: string
  /** Which Shop category the search was for; set in the browser. */
  category?: ClothingCategory
}

export interface DiscoverQuery {
  text: string
  category: ClothingCategory
  traits: RecommendationTraits
}

type Audience = 'women' | 'men'

const ITEMS: Record<ClothingCategory, Record<Audience, string[]>> = {
  tops: { women: ['shirt', 'blouse', 'knit top', 't-shirt', 'tank top', 'kurta'], men: ['shirt', 'polo shirt', 'knit sweater', 't-shirt', 'overshirt', 'kurta'] },
  bottoms: { women: ['trousers', 'jeans', 'midi skirt', 'wide-leg pants', 'palazzo'], men: ['chinos', 'jeans', 'trousers', 'cargo pants', 'shorts'] },
  dresses: { women: ['midi dress', 'maxi dress', 'slip dress', 'shirt dress', 'co-ord set'], men: [] },
  outerwear: { women: ['blazer', 'cropped jacket', 'trench coat', 'cardigan', 'shacket'], men: ['jacket', 'blazer', 'bomber jacket', 'overshirt jacket', 'cardigan'] },
  shoes: { women: ['sneakers', 'loafers', 'block heels', 'sandals', 'ballet flats', 'mules'], men: ['sneakers', 'loafers', 'boots', 'sandals', 'derby shoes'] },
  accessories: { women: ['tote bag', 'crossbody bag', 'shoulder bag', 'sunglasses', 'earrings', 'belt'], men: ['backpack', 'crossbody bag', 'sunglasses', 'belt', 'watch', 'wallet'] },
}
const BAG_RE = /\b(bag|backpack|tote|crossbody|clutch)\b/

const ALL_CATEGORIES: ClothingCategory[] = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories']
const STYLE_WORDS: Record<string, string> = {
  classic: 'classic', minimalist: 'minimal', streetwear: 'streetwear', bohemian: 'boho', business: 'tailored',
  athleisure: 'sporty', romantic: 'romantic', eclectic: 'statement',
}
const PATTERN_WORDS: Record<string, string> = {
  striped: 'striped', checked: 'checked', floral: 'floral', abstract: 'printed', 'animal-print': 'leopard print', geometric: 'geometric print',
}

/** Indian shoppers get Indian stores and rupee prices. */
function regionWord(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
    return /Kolkata|Calcutta/.test(zone) ? 'India' : ''
  } catch { return '' }
}

const lower = (values: string[]) => [...new Set(values.map((v) => v.toLowerCase().trim()).filter(Boolean))]
const pick = <T,>(list: T[], index: number): T | undefined => (list.length ? list[((index % list.length) + list.length) % list.length] : undefined)

export function buildDiscoverQueries(
  profile: UserProfile | null,
  taste: TasteProfile,
  category: ClothingCategory | 'all',
  page: number,
): DiscoverQuery[] {
  const genders = suggestedGenders(profile?.genderStylePreference)
  const avoid = new Set(lower([...(profile?.avoidColours ?? []), ...taste.avoids.colours]))
  const colours = lower([...taste.loves.colours, ...(profile?.favouriteColours ?? [])]).filter((c) => !avoid.has(c))
  const textures = lower([
    ...taste.loves.materials,
    ...taste.loves.patterns.map((p) => PATTERN_WORDS[p] ?? p),
    ...(taste.patternLean === 'prints' ? ['printed'] : []),
  ])
  const styles = lower([...taste.loves.styles, ...(profile?.stylePreferences ?? [])].map((s) => STYLE_WORDS[s] ?? s))
  const region = regionWord()

  const slots: ClothingCategory[] = category === 'all'
    ? ALL_CATEGORIES.filter((c) => genders.includes('women') || c !== 'dresses')
    : Array.from({ length: 6 }, () => category)

  // Counts across pages so every colour gets its turn, not just the first two.
  let colourTurn = page * 4
  const CLOTHING = new Set<ClothingCategory>(['tops', 'bottoms', 'dresses', 'outerwear'])
  return slots.slice(0, 6).map((slotCategory, i) => {
    const n = page * 6 + i
    const audience: Audience = genders.length === 1 ? genders[0] : (n % 2 === 0 ? 'women' : 'men')
    const options = ITEMS[slotCategory][audience].length ? ITEMS[slotCategory][audience] : ITEMS[slotCategory].women
    const item = pick(options, n * 7 + page) ?? slotCategory
    // Not every search carries every preference, so the feed stays varied:
    // colour on two of three, fabric/print on every other, style on every third.
    const colour = n % 3 !== 2 ? pick(colours, colourTurn++) : undefined
    // Fabric and print only describe clothes ("striped watch", "linen sneakers" don't make sense).
    const texture = CLOTHING.has(slotCategory) && n % 2 === 0 ? pick(textures, n + page) : undefined
    const style = n % 3 === 0 ? pick(styles, n + page) : undefined
    const gendered = slotCategory !== 'accessories' || BAG_RE.test(item)
    const words = [gendered ? (audience === 'women' ? "women's" : "men's") : '', colour, texture, item, style, region]
    return {
      text: words.filter(Boolean).join(' '),
      category: slotCategory,
      traits: {
        category: slotCategory,
        subcategory: item,
        colours: colour ? [colour] : [],
        material: texture && !Object.values(PATTERN_WORDS).includes(texture) && texture !== 'printed' ? texture : undefined,
        pattern: texture && (Object.values(PATTERN_WORDS).includes(texture) || texture === 'printed') ? Object.keys(PATTERN_WORDS).find((k) => PATTERN_WORDS[k] === texture) ?? 'abstract' : undefined,
        occasions: [],
        aesthetics: style ? (Object.keys(STYLE_WORDS).filter((k) => STYLE_WORDS[k] === style) as RecommendationTraits['aesthetics']) : undefined,
      },
    }
  })
}

/** Drop results the user wouldn't want: avoided colours, the other gender's clothes. */
export function filterForUser<T extends WebProduct>(items: T[], profile: UserProfile | null, taste: TasteProfile, hiddenIds: Set<string>): T[] {
  const avoid = lower([...(profile?.avoidColours ?? []), ...taste.avoids.colours])
  const genders = suggestedGenders(profile?.genderStylePreference)
  return items.filter((item) => {
    if (hiddenIds.has(item.id)) return false
    const title = ` ${item.title.toLowerCase()} `
    if (avoid.some((colour) => title.includes(` ${colour} `))) return false
    // Accessories other than bags are suggested from both, whatever the preference.
    if (item.category === 'accessories' && !BAG_RE.test(title)) return true
    if (genders.length === 1 && genders[0] === 'women' && /\b(men'?s|for men|male)\b/.test(title) && !/\bwomen/.test(title)) return false
    if (genders.length === 1 && genders[0] === 'men' && /\b(women'?s|for women|ladies)\b/.test(title)) return false
    return true
  })
}
