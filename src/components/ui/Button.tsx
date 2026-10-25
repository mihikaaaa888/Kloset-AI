import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'xl'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-dark-purple text-butter-yellow hover:bg-deep-purple active:bg-dark-purple shadow-soft',
  secondary:
    'bg-surface text-text-primary hover:bg-soft-butter active:bg-soft-butter border border-text-primary/15',
  ghost:
    'bg-transparent text-text-primary hover:bg-text-primary/5 active:bg-text-primary/10',
  outline:
    'border border-text-primary/30 bg-transparent text-text-primary hover:bg-dark-purple hover:text-butter-yellow hover:border-dark-purple',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-4 py-2 text-xs tracking-wide',
  md: 'px-6 py-3 text-sm tracking-wide',
  lg: 'px-8 py-4 text-sm tracking-widest',
  xl: 'px-10 py-5 text-base tracking-widest',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center gap-2',
          'font-sans font-medium uppercase',
          'rounded-full transition-all duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow focus-visible:ring-offset-2',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
