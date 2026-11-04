import type { WeatherCondition } from '@/lib/stylist'

export interface LocalWeather {
  temperature: number
  code: number
  condition: WeatherCondition
}

let cachedWeather: { value: LocalWeather; expiresAt: number } | null = null
let pendingWeather: Promise<LocalWeather> | null = null
const SAVED_LOCATION_KEY = 'kloset-weather-location-v1'

type Coordinates = { latitude: number; longitude: number }

function getSavedLocation(): Coordinates | null {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_LOCATION_KEY) ?? 'null') as Partial<Coordinates> | null
    if (typeof value?.latitude === 'number' && typeof value.longitude === 'number') return value as Coordinates
  } catch {
    // Storage can be disabled; fall back to the browser's location permission.
  }
  return null
}

function saveLocation({ latitude, longitude }: Coordinates) {
  try {
    // Weather needs only approximate location; persist a coarse position so a
    // granted browser permission is not requested again on each visit.
    localStorage.setItem(SAVED_LOCATION_KEY, JSON.stringify({
      latitude: Math.round(latitude * 100) / 100,
      longitude: Math.round(longitude * 100) / 100,
    }))
  } catch {
    // Weather still works for this session if storage is unavailable.
  }
}

function requestLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is unavailable')); return }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = { latitude: coords.latitude, longitude: coords.longitude }
        saveLocation(location)
        resolve(location)
      },
      reject,
      { timeout: 12000, maximumAge: 30 * 60 * 1000 },
    )
  })
}

/** Reuse the site's location-based weather reading across Home and Stylist. */
export function getLocalWeather(): Promise<LocalWeather> {
  if (cachedWeather && cachedWeather.expiresAt > Date.now()) return Promise.resolve(cachedWeather.value)
  if (pendingWeather) return pendingWeather

  const location = getSavedLocation() ? Promise.resolve(getSavedLocation()!) : requestLocation()
  pendingWeather = location.then(async ({ latitude, longitude }) => {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
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
