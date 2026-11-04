import type { ClothingCategory } from '@/types'

export const CATEGORY_LABEL: Record<string, string> = {
  tops: 'Top',
  bottoms: 'Bottom',
  dresses: 'Dress',
  outerwear: 'Woolens',
  shoes: 'Shoes',
  accessories: 'Accessory',
}

// Hairline garment silhouettes drawn on a 48 grid, used as no-photo placeholders.
const PATHS: Record<string, React.ReactNode> = {
  tops: <path d="M17 9 7.5 15.5l4 5.5 3-1.6V39h19V19.4l3 1.6 4-5.5L31 9c-1 3.2-3.7 5-7 5s-6-1.8-7-5Z" />,
  bottoms: <path d="M13 8h22l2 31h-8.5L24 19.5 19.5 39H11L13 8Zm0 5h22" />,
  dresses: <path d="M19 6v6l-3 8 -5 20h26l-5-20-3-8V6m-10 6h10m-11 8h12" />,
  outerwear: <path d="M17 7 7 14l2 25h7v-9m15-23 10 7-2 25h-7v-9M17 7l7 11 7-11M24 18v21m-8-9h16" />,
  shoes: <path d="M7 34V24l7-1 4-9h5l1 4c3 3 9 5 14 6 3 .6 3 3 3 5v5H7Zm0 0h34" />,
  accessories: <path d="M16 20c0-5 3.6-9 8-9s8 4 8 9M10 20h28l-3 19H13l-3-19Z" />,
}

export function CategoryGlyph({
  category,
  size = 48,
  className,
}: {
  category: ClothingCategory | string
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[category] ?? PATHS.tops}
    </svg>
  )
}
