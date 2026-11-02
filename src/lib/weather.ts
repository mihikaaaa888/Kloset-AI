import type { WeatherCondition } from '@/lib/stylist'

export interface LocalWeather {
  temperature: number
  code: number
  condition: WeatherCondition
}

let cachedWeather: { value: LocalWeather; expiresAt: number } | null = null
let pendingWeather: Promise<LocalWeather> | null = null

/** Reuse the site's location-based weather reading across Home and Stylist. */
export function getLocalWeather(): Promise<LocalWeather> {
  if (cachedWeather && cachedWeather.expiresAt > Date.now()) return Promise.resolve(cachedWeather.value)
  if (pendingWeather) return pendingWeather

  pendingWeather = new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is unavailable')); return }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000, maximumAge: 30 * 60 * 1000 })
  }).then(async ({ coords }) => {
    const params = new URLSearchParams({
      latitude: String(coords.latitude),
      longitude: String(coords.longitude),
      current: 'temperature_2m,weather_code',
      timezone: 'auto',
    })
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
    if (!response.ok) throw new Error('Weather request failed')
    const data = await response.json() as { current?: { temperature_2m?: number; weather_code?: number } }
    const temperature = data.current?.temperature_2m
    const code = data.current?.weather_code
    if (temperature === undefined || code === undefined) throw new Error('Weather data unavailable')
    const rainyCodes = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]
    const condition: WeatherCondition = rainyCodes.includes(code) ? 'rainy' : temperature >= 30 ? 'hot' : temperature >= 23 ? 'warm' : temperature >= 14 ? 'cool' : 'cold'
    const value = { temperature, code, condition }
    cachedWeather = { value, expiresAt: Date.now() + 10 * 60 * 1000 }
    return value
  }).finally(() => { pendingWeather = null })

  return pendingWeather
}
