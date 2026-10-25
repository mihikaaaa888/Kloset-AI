import { Moon, Sun, Monitor } from 'lucide-react'
import { clsx } from 'clsx'
import { useThemeStore, type ThemePreference } from '@/store/themeStore'
import { useResolvedTheme } from '@/hooks/useTheme'

/** One-tap light/dark switch for the header. Picking one overrides the system setting. */
export function ThemeToggleButton({ className }: { className?: string }) {
  const setTheme = useThemeStore((s) => s.setTheme)
  const resolved = useResolvedTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'

  return (
    <button
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={clsx(
        'w-11 h-11 flex items-center justify-center rounded-full text-text-primary hover:bg-text-primary/5 hover:text-butter-yellow transition-colors',
        className
      )}
    >
      {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

const OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun size={14} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
  { value: 'system', label: 'System', icon: <Monitor size={14} /> },
]

/** Light / Dark / System picker for the Profile page. */
export function ThemePicker() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <div role="radiogroup" aria-label="Appearance" className="inline-flex p-1 rounded-full bg-text-primary/5 ring-1 ring-inset ring-text-primary/10">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => setTheme(o.value)}
          className={clsx(
            'flex items-center gap-1.5 h-9 px-4 rounded-full text-2xs uppercase tracking-widest font-medium transition-colors',
            theme === o.value
              ? 'bg-butter-yellow text-warm-cream shadow-soft'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}
