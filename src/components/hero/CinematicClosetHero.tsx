import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useCinematicChromaHero } from '@/hooks/useCinematicChromaHero'

// Versioned names: these are served with a year-long immutable cache, so a
// re-encode must ship under a new filename. Both are 720p; the closet video has a
// keyframe every 4 frames so scroll-scrubbing can land on any frame quickly.
const VIDEO_SRC = '/videos/closet-hero-v2.mp4'
const BACKGROUND_VIDEO_SRC = '/videos/kloset-hero-bg-v2.mp4' // full-bleed background the closet door opens onto
const BACKGROUND_POSTER_SRC = '/videos/kloset-hero-bg-poster.jpg' // its first frame, shown before the video loads
const HERO_SCROLL_VH = 600 // scroll runway for the pinned closet animation — more room to breathe
// The cabinet's inner opening in the closet video, as
// [left, top, right, bottom] fractions of the frame — measured from the
// fully-open frame. The background video shows through this area only.
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

/**
 * Full-bleed looping background video (Zara-style), faded in once `visible`.
 * Playback is separate from visibility: the desktop hero plays it unseen so
 * it can show through the doorway before it's revealed full-bleed. Restarts
 * from the first frame each time `playing` turns on.
 */
function BackgroundVideo({
  visible,
  playing = visible,
  preload = 'auto',
  videoRef,
}: {
  visible: boolean
  playing?: boolean
  /** 'none' holds off the download, so it doesn't compete with the closet video. */
  preload?: 'auto' | 'none'
  videoRef?: RefObject<HTMLVideoElement>
}) {
  const ownRef = useRef<HTMLVideoElement>(null)
  const ref = videoRef ?? ownRef

  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (playing) {
      video.currentTime = 0
      video.play()
        .then(() => { console.log('[hero-bg-video] playing') })
        .catch((err) => console.error('[hero-bg-video] play failed', err))
    } else {
      video.pause()
      console.log('[hero-bg-video] paused')
    }
  }, [playing, ref])

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      aria-hidden="true"
    >
      <video
        ref={ref}
        className="absolute inset-0 w-full h-full object-cover"
        src={BACKGROUND_VIDEO_SRC}
        poster={BACKGROUND_POSTER_SRC}
        muted
        loop
        playsInline
        preload={preload}
        tabIndex={-1}
        onError={() => console.error('[hero-bg-video] failed to load', BACKGROUND_VIDEO_SRC)}
      />
    </div>
  )
}

/** Static hero — reduced motion, WebGL unavailable, or video failed to load. Shows the video's still first frame, no motion. */
function StaticHero({ onDoorOpenChange }: CinematicClosetHeroProps) {
  // No door animation here, so the page counts as 'opened' straight away.
  useEffect(() => { onDoorOpenChange?.(true) }, [onDoorOpenChange])

  return (
    <section className="relative min-h-screen overflow-hidden">
      <HeroBackdrop />
      <BackgroundVideo visible playing={false} />
    </section>
  )
}

/**
 * Lightweight mobile hero — the looping background video at its own 16:9
 * shape, no chroma key / scroll scrub. Cropping it to fill a tall phone
 * screen cut the board down to one garment, so instead it's scaled up just
 * enough to trim the video's own cream margin and the board fills the width.
 * The top padding clears the fixed logo/menu bar.
 */
function MobileVideoHero({ onDoorOpenChange }: CinematicClosetHeroProps) {
  // No door animation here, so the page counts as 'opened' straight away.
  useEffect(() => { onDoorOpenChange?.(true) }, [onDoorOpenChange])

  return (
    <section className="relative overflow-hidden bg-[#FBF5EC] pt-16">
      <div className="relative w-[136%] -ml-[18%] aspect-video">
        <BackgroundVideo visible />
      </div>
    </section>
  )
}

/**
 * Desktop cinematic hero — scroll-scrubbed, chroma-keyed closet on the cream
 * backdrop. The background video starts the moment the door begins to open,
 * visible only through the doorway — a window that widens with the doors and
 * the zoom. Once the door is fully open the same video is revealed
 * full-bleed underneath, and the rest of the scroll zooms the closet past the
 * camera and fades it off-screen, leaving just the video.
 */
function CinematicHeroDesktop({ onDoorOpenChange }: CinematicClosetHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backgroundVideoRef = useRef<HTMLVideoElement>(null)
  // True from the moment the door starts to move — starts the background video (seen through the doorway).
  const [doorOpening, setDoorOpening] = useState(false)
  // True once the door has fully opened — until then the backdrop, not the video, sits behind the closet.
  const [doorOpen, setDoorOpen] = useState(false)
  const handleOpenChange = useCallback((open: boolean) => {
    setDoorOpen(open)
    onDoorOpenChange?.(open)
  }, [onDoorOpenChange])

  const { isReady, hasError, progress } = useCinematicChromaHero({
    containerRef,
    videoRef,
    src: VIDEO_SRC,
    canvasRef,
    innerVideoRef: backgroundVideoRef,
    innerRect: DOORWAY_RECT,
    zoomTo: 2.6,
    // Closet keeps zooming (to ~2x its open size) while it fades, so it
    // exits past the camera once the door has finished opening.
    exitZoom: 1,
    // Most of the runway is the door opening; the last 25% is the exit.
    openFraction: 0.75,
    enabled: true,
    onOpenChange: handleOpenChange,
    onOpeningChange: setDoorOpening,
  })

  if (hasError) {
    return <StaticHero onDoorOpenChange={onDoorOpenChange} />
  }

  return (
    <section id="cinematic-hero" ref={containerRef} className="relative" style={{ height: `${HERO_SCROLL_VH}vh` }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <HeroBackdrop />

        {/* Background video — the room behind the door. Starts playing as
            the door starts to open, but stays hidden here: until the door is
            fully open it's drawn only inside the doorway, by the canvas
            (same element, so both show the same frame), with the cream
            backdrop around the closet. Revealed full-bleed once fully open. */}
        <BackgroundVideo
          videoRef={backgroundVideoRef}
          visible={isReady && doorOpen}
          playing={isReady && doorOpening}
          preload={isReady ? 'auto' : 'none'}
        />

        {/* Closet video layer — chroma-keyed transparent portal, zooms toward
            centre while opening, then fades out completely. */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
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
  const isMobile = useMediaQuery('(max-width: 767px)')
  const supportsWebGL = useRef<boolean>(true)

  if (typeof window !== 'undefined' && supportsWebGL.current) {
    try {
      const testCanvas = document.createElement('canvas')
      supportsWebGL.current = !!(testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl'))
    } catch {
      supportsWebGL.current = false
    }
  }

  if (prefersReducedMotion) return <StaticHero {...props} />
  if (isMobile) return <MobileVideoHero {...props} />
  if (!supportsWebGL.current) return <StaticHero {...props} />
  return <CinematicHeroDesktop {...props} />
}
