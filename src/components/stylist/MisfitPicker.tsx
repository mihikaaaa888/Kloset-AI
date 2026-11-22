import { clsx } from 'clsx'
import type { ClothingItem } from '@/types'

/**
 * After a thumbs-down on an outfit: "What didn't go?" Naming a piece tells
 * Kloset the rest went well together and only that piece clashed. Nothing
 * named means the whole look didn't work.
 */
export function MisfitPicker({ items, misfitIds, onChange, title = 'What didn’t go with the rest?' }: {
  items: ClothingItem[]
  misfitIds: string[]
  onChange: (misfitIds: string[]) => void
  title?: string
}) {
  const toggle = (id: string) => onChange(misfitIds.includes(id) ? misfitIds.filter((other) => other !== id) : [...misfitIds, id])
  const chip = (selected: boolean) => clsx(
    'max-w-full truncate rounded-full border px-3 py-1.5 text-xs transition',
    selected ? 'border-dark-purple bg-dark-purple text-butter-yellow' : 'border-text-primary/15 text-text-primary hover:border-text-primary/40',
  )
  return (
    <div className="mt-3 border-t border-text-primary/10 pt-3">
      <p className="mb-2 text-xs text-text-muted">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button key={item.id} type="button" aria-pressed={misfitIds.includes(item.id)} onClick={() => toggle(item.id)} className={chip(misfitIds.includes(item.id))}>
            {item.name}
          </button>
        ))}
        <button type="button" aria-pressed={misfitIds.length === 0} onClick={() => onChange([])} className={chip(misfitIds.length === 0)}>
          The whole look
        </button>
      </div>
    </div>
  )
}
