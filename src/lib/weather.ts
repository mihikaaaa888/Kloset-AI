import type { WeatherCondition } from '@/lib/stylist'

export interface DailyForecast {
  date: string // YYYY-MM-DD in the location's time zone
  code: number
  high: number
  low: number
  rainChance: number | null
}

export interface LocalWeather {
  temperature: number
  code: number
  condition: WeatherCondition
  // Extra detail for the Home weather card; absent if the provider omits it.
  feelsLike?: number
  humidity?: number
  windKmh?: number
  isDay?: boolean
  rainChance?: number | null
  sunrise?: string // ISO local time, e.g. 2026-11-19T06:41
  sunset?: string
  timeZone?: string
  days?: DailyForecast[]
  /** "Mission District, San Francisco" or "Sonipat, Haryana", when it could be looked up. */
  place?: string
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

const PLACE_KEY = 'kloset-weather-place-v2'

/**
 * The area name for the weather card ("Sonipat, Haryana"). Looked up once per
 * rounded (~1 km) location and remembered, via BigDataCloud's free client-side
 * reverse geocoder (no key; listed in the privacy policy). Never throws: the
 * card simply shows no place if this fails.
 */
async function getPlaceName({ latitude, longitude }: Coordinates): Promise<string | null> {
  const lat = Math.round(latitude * 100) / 100
  const lon = Math.round(longitude * 100) / 100
  const cacheId = `${lat},${lon}`
  try {
    const saved = JSON.parse(localStorage.getItem(PLACE_KEY) ?? 'null') as { id?: string; name?: string } | null
    if (saved?.id === cacheId && saved.name) return saved.name
  } catch { /* storage unavailable: look it up */ }
  try {
    const params = new URLSearchParams({ latitude: String(lat), longitude: String(lon), localityLanguage: 'en' })
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`)
    if (!response.ok) return null
    const data = await response.json() as { locality?: string; city?: string; principalSubdivision?: string; countryName?: string }
    // "Area, City" when the neighbourhood differs from the city; otherwise "City, State".
    const area = data.locality || data.city
    const wider = data.city && data.city !== area ? data.city : (data.principalSubdivision || data.countryName)
    const name = [area, wider && wider !== area ? wider : null].filter(Boolean).join(', ')
    if (!name) return null
    try { localStorage.setItem(PLACE_KEY, JSON.stringify({ id: cacheId, name })) } catch { /* fine */ }
    return name
  } catch {
    return null
  }
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
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max',
      forecast_days: '5',
      timezone: 'auto',
    })
    const [response, place] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${params}`),
      getPlaceName({ latitude, longitude }),
    ])
    if (!response.ok) throw new Error('Weather request failed')
    const data = await response.json() as {
      timezone?: string
      current?: { temperature_2m?: number; apparent_temperature?: number; relative_humidity_2m?: number; wind_speed_10m?: number; weather_code?: number; is_day?: number }
      daily?: { time?: string[]; weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; sunrise?: string[]; sunset?: string[]; precipitation_probability_max?: (number | null)[] }
    }
    const temperature = data.current?.temperature_2m
    const code = data.current?.weather_code
    if (temperature === undefined || code === undefined) throw new Error('Weather data unavailable')
    const rainyCodes = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]
    const condition: WeatherCondition = rainyCodes.includes(code) ? 'rainy' : temperature >= 30 ? 'hot' : temperature >= 23 ? 'warm' : temperature >= 14 ? 'cool' : 'cold'
    const daily = data.daily
    const days: DailyForecast[] = (daily?.time ?? []).map((date, i) => ({
      date,
      code: daily?.weather_code?.[i] ?? code,
      high: daily?.temperature_2m_max?.[i] ?? temperature,
      low: daily?.temperature_2m_min?.[i] ?? temperature,
      rainChance: daily?.precipitation_probability_max?.[i] ?? null,
    }))
    const value: LocalWeather = {
      temperature,
      code,
      condition,
      feelsLike: data.current?.apparent_temperature,
      humidity: data.current?.relative_humidity_2m,
      windKmh: data.current?.wind_speed_10m,
      isDay: data.current?.is_day === undefined ? undefined : data.current.is_day === 1,
      rainChance: days[0]?.rainChance ?? null,
      sunrise: daily?.sunrise?.[0],
      sunset: daily?.sunset?.[0],
      timeZone: data.timezone,
      days,
      place: place ?? undefined,
    }
    cachedWeather = { value, expiresAt: Date.now() + 10 * 60 * 1000 }
    return value
  }).finally(() => { pendingWeather = null })

  return pendingWeather
}
