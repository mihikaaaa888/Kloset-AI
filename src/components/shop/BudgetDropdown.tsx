import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { BUDGET_BANDS, type BudgetId } from '@/lib/shopping'

interface BudgetDropdownProps {
  value: BudgetId
  onChange: (value: BudgetId) => void
  customAmount?: number
  onCustomAmountChange?: (amount: number) => void
  /** Rent mode shows weekly rental ranges instead of purchase prices. */
  mode: 'buy' | 'rent'
}

/** H&M-style text dropdown — "BUDGET: ANY ▾" that opens a plain list, no boxes. */
export function BudgetDropdown({ value, onChange, mode, customAmount, onCustomAmountChange }: BudgetDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const labelFor = (id: BudgetId) => {
    const b = BUDGET_BANDS.find((x) => x.id === id) ?? BUDGET_BANDS[0]
    return mode === 'rent' ? b.rentLabel : b.buyLabel
  }

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={clsx('text-tab', value !== 'any' && 'text-tab-active')}
      >
        <span className="text-text-muted font-medium">Budget:</span>
        {labelFor(value)}
        <ChevronDown size={14} className={clsx('transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Budget"
          className="absolute right-0 top-full mt-3 z-30 min-w-[13rem] bg-warm-cream border border-text-primary/10 shadow-lifted py-2 animate-fade-up"
        >
          {BUDGET_BANDS.map((b) => {
            const selected = b.id === value
            return (
              <li key={b.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    console.log('[shop] budget changed', { budget: b.id, mode })
                    onChange(b.id)
                    setOpen(false)
                  }}
                  className={clsx(
                    'w-full flex items-center justify-between gap-4 px-5 py-2.5 text-left text-xs uppercase tracking-widest transition-colors',
                    selected ? 'text-butter-yellow font-semibold' : 'text-text-muted hover:text-text-primary'
                  )}
                >
                  {mode === 'rent' ? b.rentLabel : b.buyLabel}
                  {selected && <Check size={13} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {value === 'custom' && onCustomAmountChange && <label className="mt-2 flex items-center gap-2 text-xs text-text-muted">
        <span>Maximum {mode === 'rent' ? 'weekly' : 'item'} budget</span>
        <span>₹</span><input type="number" min="1" value={customAmount ?? ''} onChange={(event) => onCustomAmountChange(Number(event.target.value))} className="w-24 border-b border-text-primary/20 bg-transparent px-1 py-1 text-text-primary focus:outline-none" />
      </label>}
    </div>
  )
}
