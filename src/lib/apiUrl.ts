import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'

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

/** fetch() for our API: adds the signed-in user's token, which the server requires on costly routes. */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch(url, { ...init, headers })
}
