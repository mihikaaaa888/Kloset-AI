import { apiFetch, apiUrl } from '@/lib/apiUrl'

// Sends a short note to the server log when something fails on this device
// (e.g. the on-device clothing splitter on a phone), so it can be fixed from
// the logs. Once per kind of problem per visit; never photos or personal data.
const sent = new Set<string>()

export function reportIssue(where: string, error: unknown, details: Record<string, string | number | boolean | null> = {}) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '')
  const key = `${where}|${message.slice(0, 80)}`
  if (sent.has(key)) return
  sent.add(key)
  const device = {
    isolated: typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : null,
    cores: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? null : null,
    memoryGb: typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null : null,
    offscreen: typeof OffscreenCanvas !== 'undefined',
  }
  void apiFetch(apiUrl('/api/client-report'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ where, message: message.slice(0, 400), details: { ...device, ...details } }),
  }).catch(() => { /* reporting is best effort */ })
}
