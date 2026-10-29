import { useCallback, useEffect, useRef, useState } from 'react'
import { useCinematicChromaHero } from '@/hooks/useCinematicChromaHero'
import { InteractiveRackHero } from '@/components/hero/InteractiveRackHero'

// Versioned names: these are served with a year-long immutable cache, so a
// re-encode must ship under a new filename. Both are 720p; the closet video has a
// keyframe every 4 frames so scroll-scrubbing can land on any frame quickly.
const VIDEO_SRC = '/videos/closet-hero-v2.mp4'
const HERO_SCROLL_VH = 300 // shorter runway lets the next section appear sooner after the closet opens
// The cabinet's inner opening in the closet video, as
// [left, top, right, bottom] fractions of the frame — measured from the
// fully-open frame. The interactive rack is revealed through this area.
const DOORWAY_RECT: [number, number, number, number] = [0.391, 0.153, 0.608, 0.732]

interface CinematicClosetHeroProps {
  /** Fires true once the closet door has fully opened (immediately, for heroes without a door animation). */
  onDoorOpenChange?: (open: boolean) => void
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))
  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = () => setMatches(mql.matches)
    handler()
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}

/** Backdrop shared by every hero variant: a flat cream-yellow fill, no texture. */
function HeroBackdrop() {
  return <div className="absolute inset-0 bg-dark-purple" />
}

/** Mobile, reduced-motion and WebGL fallback: show the rack without a room video. */
function StaticRackHero({ onDoorOpenChange }: CinematicClosetHeroProps) {
  useEffect(() => { onDoorOpenChange?.(true) }, [onDoorOpenChange])
  return <InteractiveRackHero />
}

/** The original closet door animation opens onto the interactive rack. */
function CinematicHeroDesktop({ onDoorOpenChange }: CinematicClosetHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rackSceneRef = useRef<HTMLDivElement>(null)
  const [doorOpened, setDoorOpened] = useState(false)
  const handleOpenChange = useCallback((open: boolean) => {
    setDoorOpened(open)
    onDoorOpenChange?.(open)
  }, [onDoorOpenChange])

  const { isReady, hasError, progress } = useCinematicChromaHero({
    containerRef,
    videoRef,
    src: VIDEO_SRC,
    canvasRef,
    rackSceneRef,
    innerRect: DOORWAY_RECT,
    zoomTo: 2.6,
    // Closet keeps zooming (to ~2x its open size) while it fades, so it
    // exits past the camera once the door has finished opening.
    exitZoom: 1,
    // Most of the runway is the door opening; the last 25% is the exit.
    openFraction: 0.75,
    enabled: true,
    onOpenChange: handleOpenChange,
  })

  if (hasError) {
    return <StaticRackHero onDoorOpenChange={onDoorOpenChange} />
  }

  return (
    <section
      id="cinematic-hero"
      ref={containerRef}
      // The closed closet sits on the same yellow as the pinned backdrop, so the strip below it is not a different colour.
      className={`relative transition-colors duration-500 ${doorOpened ? '' : 'bg-dark-purple'}`}
      style={{ height: `${HERO_SCROLL_VH}vh`, backgroundColor: doorOpened ? '#355f43' : undefined }}
    >
      <div className="sticky top-0 isolate h-[100svh] w-full overflow-hidden">
        <HeroBackdrop />

        {/* The rack sits under the keyed doors and is clipped to the doorway
            until the closet opens. */}
        <InteractiveRackHero immersed sceneRef={rackSceneRef} />

        {/* Closet video layer — chroma-keyed transparent portal, zooms toward
            centre while opening, then fades out completely. */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-20 h-full w-full pointer-events-none"
          style={{ transformOrigin: '50% 50%', opacity: 0 }}
          aria-hidden="true"
        />

        {/* Not `display:none` (Tailwind's `hidden`) — browsers deprioritize or
            skip decoding frames for display:none video, which is why the
            closet would sometimes render and sometimes just silently never
            show up. Laid out off-screen instead, so decoding stays reliable. */}
        <video
          ref={videoRef}
          aria-hidden="true"
          tabIndex={-1}
          style={{ position: 'absolute', width: 1, height: 1, left: -9999, top: -9999, opacity: 0, pointerEvents: 'none' }}
        />

        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-40 h-0.5 rounded-full bg-butter-yellow/20 overflow-hidden"
              role="progressbar"
              aria-label="Loading"
              aria-valuenow={Math.round(progress * 100)}
            >
              <div className="h-full bg-butter-yellow transition-[width] duration-200" style={{ width: `${Math.max(progress, 0.03) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export function CinematicClosetHero(props: CinematicClosetHeroProps) {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const supportsWebGL = useRef<boolean>(true)

  if (typeof window !== 'undefined' && supportsWebGL.current) {
    try {
      const testCanvas = document.createElement('canvas')
      supportsWebGL.current = !!(testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl'))
    } catch {
      supportsWebGL.current = false
    }
  }

  if (prefersReducedMotion) return <StaticRackHero {...props} />
  if (!supportsWebGL.current) return <StaticRackHero {...props} />
  return <CinematicHeroDesktop {...props} />
}
