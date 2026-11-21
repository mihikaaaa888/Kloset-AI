// ─── User & Profile ──────────────────────────────────────────────────────────

// 'under-25' is from the old survey; kept so existing profiles still read correctly.
export type AgeRange = 'under-18' | '18-24' | 'under-25' | '25-34' | '35-44' | '45-54' | '55+'

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
  /** Brands hearted on Shop (profiles.favourite_brands; supabase/favourite_brands.sql). */
  favouriteBrands?: string[]
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
  neckline_closure?: string
  construction?: string
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
  // Legacy: set on items added from the old fixed catalog (Kloset's shopping is live now)
  catalogId?: string
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
  /** Set for pieces not in the wardrobe; itemId is then a shop or board piece id (older outfits may hold a catalog id). */
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
  /** Timestamp set when the outfit enters the recycle bin. */
  trashedAt?: string
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
