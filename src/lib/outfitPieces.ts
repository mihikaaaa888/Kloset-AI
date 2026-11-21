import type { ClothingCategory, ClothingItem, Outfit, OutfitItem, PieceSnapshot } from '@/types'

// Outfits can mix wardrobe pieces with shop finds and inspiration photos. Those
// aren't in the wardrobe, so the outfit carries a snapshot of each one and it's
// turned back into a ClothingItem for display.

export const ROLE_FOR_CATEGORY: Record<ClothingCategory, OutfitItem['role']> = {
  tops: 'top',
  bottoms: 'bottom',
  dresses: 'dress',
  outerwear: 'outerwear',
  shoes: 'shoes',
  accessories: 'accessory',
}

function snapshotToItem(id: string, s: PieceSnapshot): ClothingItem {
  return {
    id,
    name: s.name,
    category: s.category,
    imageUrl: s.imageUrl,
    imageSource: s.imageUrl ? 'remote' : 'none',
    colour: s.colour,
    pattern: 'solid',
    seasons: [],
    occasions: [],
    isFavourite: false,
    timesWorn: 0,
    createdAt: '',
    updatedAt: '',
    catalogId: s.catalogId,
  }
}

export interface ResolvedOutfitItem {
  itemId: string
  role: OutfitItem['role']
  item: ClothingItem | null
  source: 'kloset' | PieceSnapshot['source']
}

/** Each outfit piece as a displayable item: from the wardrobe, else from its snapshot. */
export function resolveOutfitItems(outfit: Outfit, wardrobe: ClothingItem[]): ResolvedOutfitItem[] {
  return outfit.items.map((oi) => {
    const owned = wardrobe.find((w) => w.id === oi.itemId)
    if (owned) return { itemId: oi.itemId, role: oi.role, item: owned, source: 'kloset' }
    if (oi.snapshot) return { itemId: oi.itemId, role: oi.role, item: snapshotToItem(oi.itemId, oi.snapshot), source: oi.snapshot.source }
    return { itemId: oi.itemId, role: oi.role, item: null, source: 'kloset' }
  })
}
