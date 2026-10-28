import { forwardRef, type InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-charcoal-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'w-full rounded-2xl border bg-surface px-5 py-4',
            'text-charcoal-900 text-base placeholder:text-charcoal-400',
            'transition-all duration-200 outline-none',
            'focus:ring-2 focus:ring-charcoal-900 focus:border-charcoal-900',
            error
              ? 'border-red-400 focus:ring-red-400'
              : 'border-cream-300 hover:border-charcoal-300',
            className
          )}
          {...props}
        />
        {hint && !error && <p className="text-xs text-charcoal-400">{hint}</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)

TextInput.displayName = 'TextInput'
