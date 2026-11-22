import type { ClothingAnalysis } from '@/lib/analyzeImage'
import { COLOUR_PALETTE } from '@/lib/colourUtils'
import type { ClothingCategory, ClothingItem, Occasion, Pattern, Season } from '@/types'

// Turns a photo-tagging result into a Kloset item, with the same rules the
// add-item window uses (src/components/wardrobe/AddItemModal.tsx applyAnalysis).
// Used by the wardrobe scanner, which saves many pieces at once.

const VALID_COLOURS = new Set(COLOUR_PALETTE.map((c) => c.name))
export const SCAN_CATEGORIES: { value: ClothingCategory; label: string }[] = [
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'outerwear', label: 'Woolens' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
]
const VALID_CATEGORIES = new Set(SCAN_CATEGORIES.map((c) => c.value))
const VALID_PATTERNS = new Set(['solid', 'striped', 'checked', 'floral', 'abstract', 'animal-print', 'geometric', 'other'])
const VALID_SEASONS = new Set(['spring', 'summer', 'autumn', 'winter', 'all-season'])
const VALID_OCCASIONS = new Set(['work', 'casual', 'formal', 'date-night', 'weekend', 'travel', 'gym', 'special-event'])
const FIT_MAP: Record<string, string> = { slim: 'Slim', regular: 'Regular', relaxed: 'Relaxed', oversized: 'Oversized', fitted: 'Fitted' }
const FORMALITY_MAP: Record<string, string> = { casual: 'Casual', 'smart casual': 'Smart Casual', business: 'Business', formal: 'Formal', 'black tie': 'Black Tie' }
const WOOLENS = new Set(['sweater', 'knit top', 'knitted top', 'turtleneck', 'pullover', 'sweatshirt', 'hoodie', 'cardigan', 'coat', 'jacket', 'blazer', 'raincoat', 'puffer', 'parka', 'trench coat'])

/** The category to show for a tagged piece (knits and jackets go under Woolens, as in the add-item window). */
export function categoryFromAnalysis(analysis: ClothingAnalysis): ClothingCategory | null {
  const sub = analysis.subcategory?.toLowerCase()
  if (sub && WOOLENS.has(sub)) return 'outerwear'
  return analysis.category && VALID_CATEGORIES.has(analysis.category as ClothingCategory) ? analysis.category as ClothingCategory : null
}

/** A new Kloset item from a scanned photo (already saved, `imageId`) and what tagging found. */
export function itemFromScan(input: {
  imageId: string
  name: string
  category: ClothingCategory
  analysis: ClothingAnalysis | null
}): ClothingItem {
  const { analysis } = input
  const now = new Date().toISOString()
  const colours = analysis
    ? [analysis.primaryColor, ...(analysis.secondaryColors ?? [])].filter((c): c is string => !!c && VALID_COLOURS.has(c)).slice(0, 4)
    : []
  return {
    id: crypto.randomUUID(),
    name: input.name.trim() || 'New piece',
    category: input.category,
    subcategory: analysis?.subcategory || undefined,
    neckline_closure: analysis?.neckline_closure || undefined,
    construction: analysis?.construction || undefined,
    imageId: input.imageId,
    imageUrl: null,
    imageSource: 'local',
    colour: colours,
    material: analysis?.material || undefined,
    pattern: (analysis?.pattern && VALID_PATTERNS.has(analysis.pattern) ? analysis.pattern : 'solid') as Pattern,
    fit: analysis?.fit ? FIT_MAP[analysis.fit.toLowerCase()] : undefined,
    formality: analysis?.formality ? FORMALITY_MAP[analysis.formality.toLowerCase()] : undefined,
    seasons: (analysis?.seasons ?? []).filter((s) => VALID_SEASONS.has(s)) as Season[],
    occasions: (analysis?.occasions ?? []).filter((o) => VALID_OCCASIONS.has(o)) as Occasion[],
    isFavourite: false,
    timesWorn: 0,
    createdAt: now,
    updatedAt: now,
  }
}
