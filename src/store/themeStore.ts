import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeStore {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
}

// Read by the inline script in index.html before React loads (so a dark-mode
// user never sees a flash of cream) — keep the storage key in sync with it.
export const THEME_STORAGE_KEY = 'kloset-theme'

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        console.log('[theme] preference set to', theme)
        set({ theme })
      },
    }),
    { name: THEME_STORAGE_KEY }
  )
)
