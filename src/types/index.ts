// ─── User & Profile ──────────────────────────────────────────────────────────

export type AgeRange = 'under-25' | '25-34' | '35-44' | '45-54' | '55+'

export type StylePreference =
  | 'classic'
  | 'minimalist'
  | 'streetwear'
  | 'bohemian'
  | 'business'
  | 'athleisure'
  | 'romantic'
  | 'eclectic'

export type Occasion =
  | 'work'
  | 'casual'
  | 'formal'
  | 'date-night'
  | 'weekend'
  | 'travel'
  | 'gym'
  | 'special-event'

export type RecommendationFrequency = 'daily' | 'a-few-times-a-week' | 'weekly' | 'on-demand'

export interface UserProfile {
  id: string
  name: string
  ageRange: AgeRange
  occupation: string
  lifestyle: string
  stylePreferences: StylePreference[]
  typicalOccasions: Occasion[]
  favouriteColours: string[]
  avoidColours: string[]
  genderStylePreference?: 'feminine' | 'masculine' | 'androgynous' | 'no-preference'
  recommendationFrequency: RecommendationFrequency
  onboardingComplete: boolean
  styleItemSelections?: string[]
  createdAt: string
  updatedAt: string
}

// ─── Wardrobe ─────────────────────────────────────────────────────────────────

export type ClothingCategory =
  | 'tops'
  | 'bottoms'
  | 'dresses'
  | 'outerwear'
  | 'shoes'
  | 'accessories'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'all-season'

export type Pattern =
  | 'solid'
  | 'striped'
  | 'checked'
  | 'floral'
  | 'abstract'
  | 'animal-print'
  | 'geometric'
  | 'other'

export interface ClothingItem {
  id: string
  name: string
  category: ClothingCategory
  subcategory?: string
  // imageId: IndexedDB key for the stored Blob (new path, survives refresh)
  imageId?: string
  // imageStoragePath: copy of the imageId photo in Supabase Storage, so other devices can show it
  imageStoragePath?: string
  // imageUrl: legacy base64 data URL or remote URL; kept for backwards compatibility
  imageUrl: string | null
  imageSource: 'local' | 'remote' | 'none'
  colour: string[]
  material?: string
  pattern: Pattern
  fit?: string
  formality?: string
  seasons: Season[]
  occasions: Occasion[]
  brand?: string
  notes?: string
  isFavourite: boolean
  timesWorn: number
  lastWorn?: string
  createdAt: string
  updatedAt: string
  // Set when the item was added from the catalog
  catalogId?: string
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export interface CatalogItem {
  id: string
  name: string
  /** Which section of the shop the piece belongs to. Defaults to women's. */
  gender?: 'women' | 'men'
  /** Retailer the reference photo and product link come from, e.g. "Zara". */
  brand?: string
  category: ClothingCategory
  subcategory?: string
  colours: string[]
  material: string
  pattern: Pattern
  seasons: Season[]
  occasions: Occasion[]
  styleAesthetics: StylePreference[]
  description: string
  priceRange: 'budget' | 'mid' | 'premium' | 'luxury'
  fit?: string
  formality?: string
  /** Reference photo — for browsing/inspiration, not the user's own item photo. */
  imageUrl: string
  /** Approximate buy price in INR (rupees), derived from priceRange. */
  estimatedPrice: number
  /** Approximate weekly rental price in INR (rupees). */
  rentPricePerWeek: number
  /** Opens a live shopping search for this piece (not a specific listing we can't verify). */
  shopUrl: string
  /** Opens a live rental-marketplace search for this piece. */
  rentUrl: string
}

// ─── Web shopping search (Exa) ─────────────────────────────────────────────────

/** A real, live product/page result from a retailer's site, via Exa search. */
export interface WebShopResult {
  id: string
  title: string
  url: string
  domain: string
  retailer: string
  snippet: string
  imageUrl: string | null
}

// ─── Outfits ──────────────────────────────────────────────────────────────────

/** What we keep of a piece that isn't in the wardrobe (a shop find or an inspiration photo). */
export interface PieceSnapshot {
  source: 'shop' | 'inspiration'
  name: string
  category: ClothingCategory
  imageUrl: string | null
  colour: string[]
  catalogId?: string
}

export interface OutfitItem {
  itemId: string
  role: 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory'
  /** Set for pieces not in the wardrobe; itemId is then the catalog id or a board piece id. */
  snapshot?: PieceSnapshot
}

export interface Outfit {
  id: string
  name: string
  items: OutfitItem[]
  occasion: Occasion
  weather?: string
  mood?: string
  stylingNotes: string
  whyItWorks: string
  generatedAt: string
  savedAt?: string
  isSaved: boolean
  source: 'ai-mock' | 'ai-api' | 'manual'
}

// ─── Stylist Request ──────────────────────────────────────────────────────────

export interface OutfitRequest {
  occasion: Occasion
  weather: string
  mood: string
  stylePreference?: StylePreference
  additionalNotes?: string
}

export interface OutfitGenerationResult {
  outfit: Outfit
  alternativeItems?: ClothingItem[]
}

// ─── Friends & sharing ────────────────────────────────────────────────────────

export type FriendStatus = 'pending' | 'accepted' | 'declined'

/** A friend request or friendship, seen from the signed-in user's side. */
export interface Connection {
  id: string
  status: FriendStatus
  direction: 'incoming' | 'outgoing'
  otherId: string
  otherName: string
  otherEmail: string
  createdAt: string
  respondedAt: string | null
}

/** Snapshot of a piece as it looked when it was sent. */
export interface SharedPiece {
  name: string
  category: ClothingCategory
  colour: string[]
  material?: string
  pattern?: Pattern
  brand?: string
  notes?: string
  role?: OutfitItem['role']
  // Supabase Storage path in the shared-images bucket, or a remote URL
  imagePath?: string
  imageUrl?: string
}

export interface SharePayload {
  title: string
  occasion?: Occasion
  pieces: SharedPiece[]
}

export interface Share {
  id: string
  kind: 'item' | 'outfit'
  payload: SharePayload
  message: string | null
  createdAt: string
  seenAt: string | null
  direction: 'sent' | 'received'
  otherId: string
  otherName: string
}
