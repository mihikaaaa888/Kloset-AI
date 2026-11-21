import type { ClothingCategory } from '@/types'

// ─── Budget ───────────────────────────────────────────────────────────────────
// Budget bands for Shop's filter and Complete a piece. Live products are
// filtered by the price their store shows (see parsePrice in liveShop.ts);
// rent ranges are kept for when rentals arrive.

export type BudgetId = 'any' | 'under1000' | '1000to2500' | '2500to4000' | '4000to6500' | 'custom'

interface BudgetBand {
  id: BudgetId
  buyLabel: string
  rentLabel: string
  buy: [number, number]
  rent: [number, number]
}

export const BUDGET_BANDS: BudgetBand[] = [
  { id: 'any',  buyLabel: 'None',               rentLabel: 'None',                  buy: [0, Infinity],      rent: [0, Infinity] },
  { id: 'under1000', buyLabel: 'Under ₹1,000', rentLabel: 'Under ₹1,000 / wk', buy: [0, 999], rent: [0, 999] },
  { id: '1000to2500', buyLabel: '₹1,000 – ₹2,500', rentLabel: '₹1,000 – ₹2,500 / wk', buy: [1000, 2499], rent: [1000, 2499] },
  { id: '2500to4000', buyLabel: '₹2,500 – ₹4,000', rentLabel: '₹2,500 – ₹4,000 / wk', buy: [2500, 3999], rent: [2500, 3999] },
  { id: '4000to6500', buyLabel: '₹4,000 – ₹6,500', rentLabel: '₹4,000 – ₹6,500 / wk', buy: [4000, 6500], rent: [4000, 6500] },
  { id: 'custom', buyLabel: 'Custom', rentLabel: 'Custom', buy: [0, Infinity], rent: [0, Infinity] },
]

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

/** ₹2,499 — Indian digit grouping, no paise. */
export function formatINR(amount: number): string {
  return INR.format(amount)
}

/** A piece to build around in Complete a piece: from the closet, a photo, or a link from elsewhere. */
export interface PieceAnchor {
  name: string
  category: ClothingCategory
  colours: string[]
  occasions: string[]
  formality?: string | null
  imageUrl?: string | null
}
