import { useEffect, useState } from 'react'
import {
  Cloud, CloudDrizzle, CloudLightning, CloudOff, CloudRain, CloudSnow, CloudSun, Droplets, MapPin, Moon,
  Sun, Sunrise, Sunset, Umbrella, Wind, type LucideIcon,
} from 'lucide-react'
import type { LocalWeather } from '@/lib/weather'
import type { WeatherCondition } from '@/lib/stylist'

export function weatherDescription(code: number): string {
  if (code === 0) return 'Clear sky'
  if (code === 1) return 'Mostly clear'
  if (code === 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code === 45 || code === 48) return 'Foggy'
  if (code >= 51 && code <= 57) return 'Drizzle'
  if (code >= 61 && code <= 67) return 'Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Rain showers'
  if (code === 85 || code === 86) return 'Snow showers'
  if (code >= 95) return 'Thunderstorm'
  return 'Current conditions'
}

export function weatherIcon(code: number, isDay = true): LucideIcon {
  if (code <= 1) return isDay ? Sun : Moon
  if (code === 2) return CloudSun
  if (code === 3 || code === 45 || code === 48) return Cloud
  if (code >= 51 && code <= 57) return CloudDrizzle
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow
  if (code >= 95) return CloudLightning
  return CloudSun
}

// What today's weather means for getting dressed.
export const WEAR_HINT: Record<WeatherCondition, string> = {
  hot: 'Breathable pieces today',
  warm: 'Light layers today',
  cool: 'Bring a layer',
  cold: 'Wrap up warm',
  rainy: 'Dress for the rain',
}

type Sky = 'clear-day' | 'clear-night' | 'cloudy-day' | 'cloudy-night' | 'rain' | 'storm' | 'snow' | 'fog'

function skyFor(code: number, isDay = true): Sky {
  if (code >= 95) return 'storm'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 51) return 'rain'
  if (code === 45 || code === 48) return 'fog'
  if (code <= 1) return isDay ? 'clear-day' : 'clear-night'
  return isDay ? 'cloudy-day' : 'cloudy-night'
}

// Fixed pseudo-random spread so the scene looks scattered but doesn't jump between renders.
const spread = (i: number, seed: number) => ((Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453) % 1 + 1) % 1

/** An animated sky behind the weather strip, like Apple Weather's. Purely decorative. */
function WeatherScene({ code, isDay }: { code: number; isDay?: boolean }) {
  const sky = skyFor(code, isDay)
  const clouds = sky === 'cloudy-day' || sky === 'cloudy-night' || sky === 'rain' || sky === 'storm' || (sky === 'clear-day' && code === 1)
  const cloudCount = sky === 'clear-day' ? 2 : sky === 'cloudy-day' || sky === 'cloudy-night' ? (code === 2 ? 3 : 5) : 4
  return (
    <div className={`wx-scene wx-sky-${sky}`} aria-hidden="true">
      {sky === 'clear-day' && <div className="wx-sun" />}
      {(sky === 'clear-night' || sky === 'cloudy-night') && <>
        <div className="wx-moon" />
        {Array.from({ length: sky === 'clear-night' ? 36 : 14 }).map((_, i) => (
          <span key={i} className="wx-star" style={{ left: `${spread(i, 1) * 100}%`, top: `${spread(i, 2) * 100}%`, animationDelay: `${spread(i, 3) * 3.5}s`, opacity: 0.4 }} />
        ))}
      </>}
      {clouds && Array.from({ length: cloudCount }).map((_, i) => (
        <span key={i} className="wx-cloud" style={{
          top: `${-10 + spread(i, 4) * 70}%`,
          width: `${140 + spread(i, 5) * 160}px`,
          height: `${40 + spread(i, 6) * 40}px`,
          opacity: sky === 'rain' || sky === 'storm' ? 0.35 : sky === 'cloudy-night' ? 0.25 : 0.6,
          animationDuration: `${45 + spread(i, 7) * 40}s`,
          animationDelay: `${-spread(i, 8) * 80}s`,
        }} />
      ))}
      {(sky === 'rain' || sky === 'storm') && Array.from({ length: code >= 63 || sky === 'storm' ? 70 : 35 }).map((_, i) => (
        <span key={i} className="wx-drop" style={{ left: `${spread(i, 9) * 105}%`, animationDuration: `${0.55 + spread(i, 10) * 0.4}s`, animationDelay: `${-spread(i, 11) * 2}s` }} />
      ))}
      {sky === 'storm' && <div className="wx-flash" />}
      {sky === 'snow' && Array.from({ length: 40 }).map((_, i) => {
        const size = 2 + spread(i, 12) * 3
        return <span key={i} className="wx-flake" style={{ left: `${spread(i, 13) * 100}%`, width: size, height: size, animationDuration: `${5 + spread(i, 14) * 5}s`, animationDelay: `${-spread(i, 15) * 10}s` }} />
      })}
      {sky === 'fog' && [0, 1, 2].map((i) => (
        <span key={i} className="wx-mist" style={{ top: `${i * 32 - 5}%`, animationDuration: `${9 + i * 4}s` }} />
      ))}
      {/* Keeps white text readable on the brighter skies. */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-black/5 to-black/20" />
    </div>
  )
}

const timeOf = (iso?: string) => iso?.slice(11, 16) ?? '—'
const round = (value?: number) => (value === undefined ? '—' : Math.round(value))

/**
 * Today's weather as a wide, short strip under the date on Home: place and
 * local time on top, then today's conditions, sunrise/sunset, rain, humidity,
 * wind and the next few days side by side (stacked on phones).
 */
export function WeatherCard({ weather, error }: { weather: LocalWeather | null; error: boolean }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const shell = 'relative w-full overflow-hidden rounded-2xl px-4 py-3 shadow-sm sm:px-5'

  if (!weather) {
    return (
      <div className={`${shell} border border-text-primary/10 bg-surface/80`} aria-live="polite">
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <CloudOff size={16} className="shrink-0" aria-hidden="true" />
          {error ? 'Weather unavailable. Allow location access to see local conditions.' : 'Checking today’s weather…'}
        </p>
      </div>
    )
  }

  const Icon = weatherIcon(weather.code, weather.isDay)
  const localTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZone: weather.timeZone }).format(now)
  const today = weather.days?.[0]
  const stats: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Sunrise, label: 'Sunrise', value: timeOf(weather.sunrise) },
    { icon: Sunset, label: 'Sunset', value: timeOf(weather.sunset) },
    { icon: Umbrella, label: 'Rain', value: weather.rainChance == null ? '—' : `${weather.rainChance}%` },
    { icon: Droplets, label: 'Humidity', value: weather.humidity === undefined ? '—' : `${Math.round(weather.humidity)}%` },
    { icon: Wind, label: 'Wind', value: weather.windKmh === undefined ? '—' : `${Math.round(weather.windKmh)} km/h` },
  ]

  return (
    <section className={`${shell} [text-shadow:0_1px_2px_rgba(0,0,0,0.25)]`} aria-label="Today's weather" aria-live="polite">
      <WeatherScene code={weather.code} isDay={weather.isDay} />

      {/* Place and local time */}
      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <p className="flex min-w-0 items-center gap-1.5 font-medium text-white">
          <MapPin size={13} strokeWidth={1.75} className="shrink-0 text-white/70" aria-hidden="true" />
          <span className="truncate">{weather.place ?? 'Your location'}</span>
        </p>
        <span className="text-white/70" aria-hidden="true">·</span>
        <p className="text-white/70"><span className="tabular-nums text-white">{localTime}</span> local time</p>
        <p className="ml-auto hidden font-display text-sm italic text-amber-200 sm:block">{WEAR_HINT[weather.condition]}</p>
      </div>

      <div className="relative mt-2.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-0">
        {/* Now */}
        <div className="flex shrink-0 items-center gap-3 lg:pr-6">
          <Icon size={30} strokeWidth={1.25} className="shrink-0 text-amber-200" aria-hidden="true" />
          <p className="font-display text-4xl font-semibold leading-none tabular-nums text-white">{Math.round(weather.temperature)}°</p>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{weatherDescription(weather.code)}</p>
            <p className="truncate text-[11px] text-white/70">
              Feels {round(weather.feelsLike)}°{today ? ` · H ${Math.round(today.high)}° L ${Math.round(today.low)}°` : ''}
            </p>
          </div>
          <p className="ml-auto font-display text-sm italic text-amber-200 sm:hidden">{WEAR_HINT[weather.condition]}</p>
        </div>

        {/* Details */}
        <dl className="grid grid-cols-5 gap-2 border-t border-white/15 pt-3 lg:flex-1 lg:border-l lg:border-t-0 lg:px-6 lg:pt-0">
          {stats.map(({ icon: StatIcon, label, value }) => (
            <div key={label} className="flex min-w-0 flex-col items-center text-center">
              <StatIcon size={13} strokeWidth={1.5} className="text-white/70" aria-hidden="true" />
              <dt className="order-last max-w-full truncate text-[9px] uppercase tracking-wider text-white/70">{label}</dt>
              <dd className="mt-0.5 max-w-full truncate text-[11px] font-medium tabular-nums text-white">{value}</dd>
            </div>
          ))}
        </dl>

        {/* Next few days */}
        {weather.days && weather.days.length > 1 && (
          <ol className="grid grid-cols-5 gap-2 border-t border-white/15 pt-3 lg:flex-1 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" aria-label="Next few days">
            {weather.days.slice(0, 5).map((day, i) => {
              const DayIcon = weatherIcon(day.code)
              const name = i === 0 ? 'Today' : new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`))
              return (
                <li key={day.date} className="text-center">
                  <p className="text-[10px] text-white/70">{name}</p>
                  <DayIcon size={14} strokeWidth={1.5} className="mx-auto my-0.5 text-white" aria-hidden="true" />
                  <p className="text-[11px] tabular-nums text-white">
                    {Math.round(day.high)}°<span className="text-white/70"> {Math.round(day.low)}°</span>
                  </p>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
