import { Capacitor } from '@capacitor/core'

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''

/**
 * Keep browser API calls same-origin (Vite proxy locally, Netlify redirects in
 * production) while allowing the bundled native app to call its deployed API.
 */
export function apiUrl(path: string): string {
  const route = path.startsWith('/') ? path : `/${path}`

  if (Capacitor.isNativePlatform() && !configuredApiBase) {
    throw new Error('Set VITE_API_BASE_URL to Kloset’s deployed API URL before building the mobile app.')
  }

  return `${configuredApiBase}${route}`
}
