import type { CSSProperties } from 'react'
import { clsx } from 'clsx'

/** A smooth closed blob through `points` radial points, seeded so it's stable between renders. */
function blobPath(seed: number, points = 7) {
  let s = seed
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  const pts = Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2
    const r = 38 + rand() * 12 // between 38 and 50 in a 100x100 box
    return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r]
  })
  // Closed Catmull-Rom spline as cubic beziers.
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % points]
    const p3 = pts[(i + 2) % points]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return `${d}Z`
}

/**
 * A soft paper cut-out blob. It turns slowly on its own (`spin` seconds per
 * turn) and drifts against the cursor by `depth` (uses --px/--py from the
 * section). Only transforms animate, so the shape and shadow paint once.
 */
export function PaperBlob({
  seed,
  color,
  depth = 20,
  spin = 80,
  reverse = false,
  className,
  style,
}: {
  seed: number
  color: string
  depth?: number
  spin?: number
  reverse?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <div aria-hidden="true" className={clsx('parallax pointer-events-none absolute', className)} style={{ ['--depth' as string]: depth, ...style }}>
      <svg
        viewBox="0 0 100 100"
        className="blob-spin h-full w-full overflow-visible drop-shadow-[0_18px_24px_rgba(53,94,59,0.12)]"
        style={{ animationDuration: `${spin}s`, animationDirection: reverse ? 'reverse' : 'normal' }}
      >
        <path d={blobPath(seed)} fill={color} />
      </svg>
    </div>
  )
}
