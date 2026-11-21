import type { ClothingCategory, ClothingItem, Occasion, UserProfile } from '@/types'
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
  /** Why this search is suggested ("Goes with your Black Trousers"), for Suggested for you. */
  reason?: string
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

// ─── Suggested for you: live picks for the person's Kloset ────────────────────
// Searches built from what they own and what they need, not just taste:
// pieces that pair with clothes they own (complementary category, a colour
// that goes), categories they're short on, and the occasions they dress for.
// Each search carries a reason that's shown on its cards.

const PAIRS_WITH: Record<ClothingCategory, ClothingCategory[]> = {
  tops: ['bottoms', 'outerwear', 'shoes'],
  bottoms: ['tops', 'outerwear', 'shoes'],
  dresses: ['outerwear', 'shoes', 'accessories'],
  outerwear: ['tops', 'bottoms'],
  shoes: ['bottoms', 'tops'],
  accessories: ['tops', 'dresses'],
}
const NEUTRAL_COLOURS = new Set(['black', 'white', 'cream', 'ivory', 'beige', 'camel', 'tan', 'navy', 'grey', 'gray', 'charcoal', 'brown', 'denim', 'khaki', 'olive'])
const CATEGORY_NOUNS: Record<ClothingCategory, string> = { tops: 'tops', bottoms: 'bottoms', dresses: 'dresses', outerwear: 'layers', shoes: 'shoes', accessories: 'accessories' }
// What each occasion calls for, women's / men's.
const OCCASION_ITEMS: Partial<Record<Occasion, { category: ClothingCategory; women: string; men: string; label: string }>> = {
  work: { category: 'outerwear', women: 'tailored blazer', men: 'tailored blazer', label: 'work' },
  formal: { category: 'dresses', women: 'evening dress', men: 'suit', label: 'formal events' },
  'date-night': { category: 'tops', women: 'satin top', men: 'linen shirt', label: 'date nights' },
  'special-event': { category: 'tops', women: 'festive kurta set', men: 'festive kurta', label: 'special events' },
  travel: { category: 'bottoms', women: 'relaxed trousers', men: 'travel chinos', label: 'travel' },
  gym: { category: 'tops', women: 'workout top', men: 'training t-shirt', label: 'the gym' },
  weekend: { category: 'bottoms', women: 'straight jeans', men: 'straight jeans', label: 'weekends' },
  casual: { category: 'shoes', women: 'white sneakers', men: 'white sneakers', label: 'everyday' },
}

/** A colour that goes with the owned piece: a neutral piece takes a favourite colour or a contrasting neutral; a coloured piece takes a neutral. */
function pairingColour(owned: ClothingItem, favourites: string[], avoid: Set<string>, turn: number): string {
  const ownedColours = lower(owned.colour)
  const ownedNeutral = ownedColours.length === 0 || ownedColours.every((c) => NEUTRAL_COLOURS.has(c))
  if (ownedNeutral) {
    // Every other search uses a favourite colour, so the row isn't all one colour.
    const favourite = favourites.filter((c) => !ownedColours.includes(c) && !avoid.has(c))
    if (favourite.length && turn % 2 === 0) return pick(favourite, turn / 2) ?? 'white'
    // A contrasting neutral they haven't said no to (swipes teach avoided colours too).
    const dark = ownedColours.some((c) => ['black', 'navy', 'charcoal', 'brown'].includes(c))
    const contrast = (dark ? ['white', 'cream', 'beige', 'grey'] : ['black', 'navy', 'brown', 'olive']).filter((c) => !avoid.has(c) && !ownedColours.includes(c))
    return pick(contrast, turn) ?? 'beige'
  }
  return pick(['white', 'black', 'beige', 'denim', 'cream', 'navy'].filter((c) => !avoid.has(c)), turn) ?? 'beige'
}

export function buildKlosetQueries(
  profile: UserProfile | null,
  wardrobe: ClothingItem[],
  taste: TasteProfile,
  page: number,
): DiscoverQuery[] {
  const genders = suggestedGenders(profile?.genderStylePreference)
  const audience: Audience = genders.length === 1 ? genders[0] : 'women'
  const avoid = new Set(lower([...(profile?.avoidColours ?? []), ...taste.avoids.colours]))
  const favourites = lower([...(profile?.favouriteColours ?? []), ...taste.loves.colours]).filter((c) => !avoid.has(c))
  const style = pick(lower((profile?.stylePreferences ?? []).map((s) => STYLE_WORDS[s] ?? s)), page)
  const region = regionWord()
  const say = (category: ClothingCategory, colour: string | undefined, item: string, withStyle: boolean) => {
    const gendered = category !== 'accessories' || BAG_RE.test(item)
    return [gendered ? (audience === 'women' ? "women's" : "men's") : '', colour, item, withStyle ? style : '', region].filter(Boolean).join(' ')
  }
  const itemFor = (category: ClothingCategory, n: number) => {
    const options = ITEMS[category][audience].length ? ITEMS[category][audience] : ITEMS[category].women
    return pick(options, n) ?? category
  }
  // A favourite colour on at most two searches per set; the rest stay neutral.
  let favouriteUses = 0
  const query = (category: ClothingCategory, wanted: string | undefined, item: string, reason: string, n: number): DiscoverQuery => {
    let colour = wanted
    if (colour && favourites.includes(colour) && favouriteUses++ >= 2) colour = pick(['black', 'white', 'beige'].filter((c) => !avoid.has(c)), n + page)
    return {
      text: say(category, colour, item, n % 2 === 0),
      category,
      reason,
      traits: { category, subcategory: item, colours: colour ? [colour] : [], occasions: [] },
    }
  }

  const out: DiscoverQuery[] = []
  // 1. Pairs with what they own: favourites and most-worn first, a different piece each page.
  const anchors = [...wardrobe].sort((a, b) => Number(b.isFavourite) - Number(a.isFavourite) || b.timesWorn - a.timesWorn)
  for (let i = 0; i < Math.min(3, anchors.length); i++) {
    const owned = pick(anchors, page * 3 + i)
    if (!owned) break
    const partners = PAIRS_WITH[owned.category].filter((c) => genders.includes('women') || c !== 'dresses')
    const category = pick(partners, page + i) ?? 'tops'
    out.push(query(category, pairingColour(owned, favourites, avoid, page + i), itemFor(category, page * 3 + i), `Goes with your ${owned.name}`, i))
  }
  // 2. Categories they're short on (one piece or none).
  const counts = new Map<ClothingCategory, number>()
  for (const item of wardrobe) counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
  const gaps = ALL_CATEGORIES.filter((c) => (counts.get(c) ?? 0) <= 1 && (genders.includes('women') || c !== 'dresses'))
  if (wardrobe.length) {
    for (let i = 0; i < Math.min(2, gaps.length); i++) {
      const category = pick(gaps, page * 2 + i)
      if (!category) break
      const colour = (page + i) % 2 === 1 ? pick(favourites, page + i) : undefined
      out.push(query(category, colour ?? pick(['black', 'white', 'beige'].filter((c) => !avoid.has(c)), page + i), itemFor(category, page + i + 1), `You have few ${CATEGORY_NOUNS[category]}`, i + 1))
    }
  }
  // 3. What they dress for.
  const occasions = (profile?.typicalOccasions ?? []).filter((o) => OCCASION_ITEMS[o])
  for (let i = 0; out.length < 6 && i < occasions.length; i++) {
    const need = OCCASION_ITEMS[pick(occasions, page + i) as Occasion]
    if (!need || out.some((q) => q.reason === `For ${need.label}`)) continue
    out.push(query(need.category, (page + i) % 2 === 0 ? pick(favourites, page + i) : undefined, need[audience], `For ${need.label}`, i))
  }
  // 4. Nothing to go on yet (empty Kloset, no occasions): versatile basics.
  const basics: [ClothingCategory, string][] = [['tops', 'white shirt'], ['bottoms', 'straight jeans'], ['outerwear', 'blazer'], ['shoes', 'white sneakers'], ['accessories', audience === 'women' ? 'leather tote bag' : 'leather belt'], ['tops', 'black t-shirt']]
  for (let i = 0; out.length < 6 && i < basics.length; i++) {
    const [category, item] = basics[(page + i) % basics.length]
    if (!out.some((q) => q.traits.subcategory === item)) out.push(query(category, undefined, item, 'A versatile basic', i))
  }
  return out.slice(0, 6)
}


const genderWord = (audience: Audience) => (audience === 'women' ? "women's" : "men's")
const audienceFor = (profile: UserProfile | null, n: number): Audience => {
  const genders = suggestedGenders(profile?.genderStylePreference)
  return genders.length === 1 ? genders[0] : (n % 2 === 0 ? 'women' : 'men')
}

// ─── Shop search and filters ──────────────────────────────────────────────────
// Typing in Shop's search, and the Colour / Style filters, become live search
// words. Several colours or styles are spread across the searches.

export function buildSearchQueries(
  profile: UserProfile | null,
  text: string,
  options: { category: ClothingCategory | 'all'; colours?: string[]; styles?: string[]; avoid?: string[] },
  page: number,
): DiscoverQuery[] {
  const avoided = new Set(lower([...(profile?.avoidColours ?? []), ...(options.avoid ?? [])]))
  const typed = text.trim().replace(/\s+/g, ' ').slice(0, 60)
  const colours = lower(options.colours ?? [])
  const styles = lower((options.styles ?? []).map((s) => STYLE_WORDS[s] ?? s))
  const region = regionWord()
  const categories: ClothingCategory[] = options.category === 'all' ? ALL_CATEGORIES : [options.category]
  // A typed search with no filters still needs variety (and new results on
  // Show more): vary it with their styles and a few everyday colours.
  const variety = typed && !colours.length && !styles.length
    ? ['', ...lower((profile?.stylePreferences ?? []).map((st) => STYLE_WORDS[st] ?? st)), ...['black', 'white', 'beige'].filter((c) => !avoided.has(c)), 'printed', 'oversized', 'relaxed fit']
    : []
  return Array.from({ length: 4 }, (_, i) => {
    const n = page * 4 + i
    const audience = audienceFor(profile, n)
    const category = typed ? (options.category === 'all' ? 'tops' : options.category) : pick(categories, n) ?? 'tops'
    const item = typed || pick(ITEMS[category][audience].length ? ITEMS[category][audience] : ITEMS[category].women, n + page) || category
    const varied = variety.length ? variety[n % variety.length] : undefined
    const colour = pick(colours, n) ?? (varied && ['black', 'white', 'beige'].includes(varied) ? varied : undefined)
    const style = pick(styles, n) ?? (varied && !['black', 'white', 'beige'].includes(varied) ? varied : undefined)
    const gendered = !typed || !/\b(men|women|man|woman|ladies|unisex)\b/i.test(typed)
    return {
      text: [gendered ? genderWord(audience) : '', colour, item, style, region].filter(Boolean).join(' '),
      category,
      traits: { category, subcategory: item, colours: colour ? [colour] : [], occasions: [] },
    }
  }).filter((q, i, all) => all.findIndex((other) => other.text === q.text) === i)
}

// ─── Complete a piece / Complete the look ─────────────────────────────────────
// Pieces that go with one item: its partner categories, in colours that pair.

export function buildPieceQueries(
  profile: UserProfile | null,
  anchor: { name: string; category: ClothingCategory; colours: string[] },
  page: number,
  only?: ClothingCategory[],
  /** Colours learned from swipes as ones they don't like. */
  learnedAvoid: string[] = [],
): DiscoverQuery[] {
  const genders = suggestedGenders(profile?.genderStylePreference)
  const audience: Audience = genders.length === 1 ? genders[0] : 'women'
  const avoid = new Set(lower([...(profile?.avoidColours ?? []), ...learnedAvoid]))
  const favourites = lower(profile?.favouriteColours ?? []).filter((c) => !avoid.has(c))
  const partners = (only ?? PAIRS_WITH[anchor.category]).filter((c) => genders.includes('women') || c !== 'dresses')
  const owned = { colour: anchor.colours } as ClothingItem
  const region = regionWord()
  return Array.from({ length: Math.max(3, Math.min(6, partners.length * 2)) }, (_, i) => {
    const n = page * 6 + i
    const category = pick(partners, i) ?? 'tops'
    const options = ITEMS[category][audience].length ? ITEMS[category][audience] : ITEMS[category].women
    const item = pick(options, n + Math.floor(i / partners.length)) ?? category
    const colour = pairingColour(owned, favourites, avoid, n)
    const gendered = category !== 'accessories' || BAG_RE.test(item)
    return {
      text: [gendered ? genderWord(audience) : '', colour, item, region].filter(Boolean).join(' '),
      category,
      reason: `Goes with ${anchor.name}`,
      traits: { category, subcategory: item, colours: [colour], occasions: [] },
    }
  }).filter((q, i, all) => all.findIndex((other) => other.text === q.text) === i)
}

// ─── Onboarding: "Pick pieces you'd wear" ─────────────────────────────────────

export function buildOnboardingQueries(
  styles: string[],
  audience: 'all' | 'women' | 'men',
  category: ClothingCategory | 'all',
): DiscoverQuery[] {
  const styleWords = lower(styles.map((s) => STYLE_WORDS[s] ?? s))
  const categories: ClothingCategory[] = category === 'all' ? ALL_CATEGORIES : [category]
  const region = regionWord()
  return Array.from({ length: 6 }, (_, n) => {
    const who: Audience = audience === 'all' ? (n % 2 === 0 ? 'women' : 'men') : audience
    const cat = pick(categories.filter((c) => who === 'women' || c !== 'dresses'), n) ?? 'tops'
    const options = ITEMS[cat][who].length ? ITEMS[cat][who] : ITEMS[cat].women
    const item = pick(options, n) ?? cat
    const style = pick(styleWords, n)
    return {
      text: [genderWord(who), item, style, region].filter(Boolean).join(' '),
      category: cat,
      traits: { category: cat, subcategory: item, colours: [], occasions: [] },
    }
  })
}
