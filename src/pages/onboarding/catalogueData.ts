import type { ClothingCategory } from '@/types'

// Category tabs for onboarding's "Pick pieces you'd wear". The pieces
// themselves are live (buildOnboardingQueries in src/lib/discoverFeed.ts).
export const CATALOGUE_CATEGORIES: { value: ClothingCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'outerwear', label: 'Woolens' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
]
