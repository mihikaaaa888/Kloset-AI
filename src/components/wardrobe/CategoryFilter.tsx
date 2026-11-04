import { clsx } from 'clsx'
import type { ClothingCategory } from '@/types'

interface FilterOption {
  value: ClothingCategory | 'all'
  label: string
}

const FILTERS: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'outerwear', label: 'Woolens' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
]

interface CategoryFilterProps {
  active: ClothingCategory | 'all'
  counts: Record<string, number>
  onChange: (category: ClothingCategory | 'all') => void
}

export function CategoryFilter({ active, counts, onChange }: CategoryFilterProps) {
  return (
    <div className="flex gap-6 overflow-x-auto no-scrollbar py-1">
      {FILTERS.map((filter) => {
        const count = filter.value === 'all'
          ? Object.values(counts).reduce((a, b) => a + b, 0)
          : (counts[filter.value] ?? 0)
        const isActive = active === filter.value

        return (
          <button
            key={filter.value}
            onClick={() => onChange(filter.value)}
            className={clsx('text-tab flex-shrink-0 items-start', isActive && 'text-tab-active')}
          >
            {filter.label}
            <sup className="text-2xs tabular-nums font-normal opacity-60 -ml-0.5">{count}</sup>
          </button>
        )
      })}
    </div>
  )
}
