import { clsx } from 'clsx'

interface SelectChipProps {
  label: string
  selected: boolean
  onClick: () => void
  disabled?: boolean
}

export function SelectChip({ label, selected, onClick, disabled }: SelectChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center px-5 py-3 rounded-full text-sm font-medium',
        'border transition-all duration-200 select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow focus-visible:ring-offset-2',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        selected
          ? 'bg-dark-purple text-butter-yellow border-dark-purple shadow-soft'
          : 'bg-surface text-text-primary border-text-primary/15 hover:border-text-primary/40 hover:text-text-primary'
      )}
    >
      {label}
    </button>
  )
}
