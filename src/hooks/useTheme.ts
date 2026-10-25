import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** The theme actually on screen: the user's choice, or the OS setting for 'system'. */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useThemeStore((s) => s.theme)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.(DARK_QUERY).matches ?? false)

  useEffect(() => {
    const mq = window.matchMedia?.(DARK_QUERY)
    if (!mq) return
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
}

/**
 * Puts the .dark class on <html> to match the resolved theme. The landing page
 * always stays light — its hero video is keyed onto a cream backdrop.
 */
export function useApplyTheme() {
  const resolved = useResolvedTheme()
  const { pathname } = useLocation()
  const dark = resolved === 'dark' && pathname !== '/'

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0E1811' : '#FCFAF4')
    console.log('[theme] applied', dark ? 'dark' : 'light', { resolved, pathname })
  }, [dark, resolved, pathname])
}
