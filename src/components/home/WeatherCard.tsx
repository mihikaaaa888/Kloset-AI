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

// A soft wash of colour behind the card that follows the sky.
function skyGlow(weather: LocalWeather): string {
  const { code, isDay = true } = weather
  if (code >= 51 && code !== 71 && code !== 73 && code !== 75 && code !== 77 && code !== 85 && code !== 86) return 'bg-sky-500/25'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'bg-cyan-200/30'
  if (!isDay) return 'bg-indigo-500/25'
  if (code <= 1) return 'bg-amber-400/30'
  return 'bg-slate-400/25'
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

  const shell = 'relative w-full overflow-hidden rounded-2xl border border-text-primary/10 bg-surface/80 px-4 py-3 shadow-sm backdrop-blur-md sm:px-5'

  if (!weather) {
    return (
      <div className={shell} aria-live="polite">
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
    <section className={shell} aria-label="Today's weather" aria-live="polite">
      <div className={`pointer-events-none absolute -left-10 -top-20 h-40 w-64 rounded-full blur-3xl ${skyGlow(weather)}`} aria-hidden="true" />

      {/* Place and local time */}
      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <p className="flex min-w-0 items-center gap-1.5 font-medium text-text-primary">
          <MapPin size={13} strokeWidth={1.75} className="shrink-0 text-text-muted" aria-hidden="true" />
          <span className="truncate">{weather.place ?? 'Your location'}</span>
        </p>
        <span className="text-text-muted" aria-hidden="true">·</span>
        <p className="text-text-muted"><span className="tabular-nums text-text-primary">{localTime}</span> local time</p>
        <p className="ml-auto hidden font-display text-sm italic text-butter-yellow sm:block">{WEAR_HINT[weather.condition]}</p>
      </div>

      <div className="relative mt-2.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-0">
        {/* Now */}
        <div className="flex shrink-0 items-center gap-3 lg:pr-6">
          <Icon size={30} strokeWidth={1.25} className="shrink-0 text-butter-yellow" aria-hidden="true" />
          <p className="font-display text-4xl font-semibold leading-none tabular-nums text-text-primary">{Math.round(weather.temperature)}°</p>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">{weatherDescription(weather.code)}</p>
            <p className="truncate text-[11px] text-text-muted">
              Feels {round(weather.feelsLike)}°{today ? ` · H ${Math.round(today.high)}° L ${Math.round(today.low)}°` : ''}
            </p>
          </div>
          <p className="ml-auto font-display text-sm italic text-butter-yellow sm:hidden">{WEAR_HINT[weather.condition]}</p>
        </div>

        {/* Details */}
        <dl className="grid grid-cols-5 gap-2 border-t border-text-primary/10 pt-3 lg:flex-1 lg:border-l lg:border-t-0 lg:px-6 lg:pt-0">
          {stats.map(({ icon: StatIcon, label, value }) => (
            <div key={label} className="flex min-w-0 flex-col items-center text-center">
              <StatIcon size={13} strokeWidth={1.5} className="text-text-muted" aria-hidden="true" />
              <dt className="order-last max-w-full truncate text-[9px] uppercase tracking-wider text-text-muted">{label}</dt>
              <dd className="mt-0.5 max-w-full truncate text-[11px] font-medium tabular-nums text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>

        {/* Next few days */}
        {weather.days && weather.days.length > 1 && (
          <ol className="grid grid-cols-5 gap-2 border-t border-text-primary/10 pt-3 lg:flex-1 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" aria-label="Next few days">
            {weather.days.slice(0, 5).map((day, i) => {
              const DayIcon = weatherIcon(day.code)
              const name = i === 0 ? 'Today' : new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`))
              return (
                <li key={day.date} className="text-center">
                  <p className="text-[10px] text-text-muted">{name}</p>
                  <DayIcon size={14} strokeWidth={1.5} className="mx-auto my-0.5 text-text-primary" aria-hidden="true" />
                  <p className="text-[11px] tabular-nums text-text-primary">
                    {Math.round(day.high)}°<span className="text-text-muted"> {Math.round(day.low)}°</span>
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
