import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Drives a scroll-scrubbed, chroma-keyed hero video rendered through WebGL.
 *
 * - The tall `containerRef` element defines the scroll "runway"; scroll progress
 *   through it (0-1) maps directly to `video.currentTime` and to a camera zoom
 *   applied to the canvas, so scrolling reverses the animation exactly.
 * - Chroma keying happens per-frame in a GPU fragment shader (green -> alpha 0),
 *   not on a fixed frame, so it holds up while scrubbing.
 * - The key color itself is detected from the actual video (sampling the frame
 *   where the door is most open) instead of being hard-coded, since the exact
 *   green shade varies between green-screen sources.
 * - A DOM scene sits beneath the keyed video. It is clipped to the doorway and
 *   expands with the camera zoom, keeping the rack interactive as it appears.
 * - Everything after the initial setup is ref-driven inside a rAF loop; no React
 *   state is touched per scroll/frame, so this never triggers re-renders.
 */

interface UseCinematicChromaHeroOptions {
  containerRef: RefObject<HTMLElement>
  videoRef: RefObject<HTMLVideoElement>
  /**
   * The closet video URL. Downloaded in full before the hero starts, so
   * scroll-scrubbing seeks within memory instead of waiting on the network
   * for every frame (which is what left Safari stuck on the spinner).
   */
  src: string
  canvasRef: RefObject<HTMLCanvasElement>
  /** Optional hero copy layer — fades/scales in with the door opening. */
  contentRef?: RefObject<HTMLElement>
  /** DOM scene revealed through the keyed doorway while the rack remains interactive. */
  rackSceneRef?: RefObject<HTMLElement>
  /**
   * The doorway in the closet video's frame, as [left, top, right, bottom]
   * fractions (0-1, top-left origin). Pass a stable (module-level) array —
   * a new one each render restarts the WebGL pipeline.
   */
  innerRect?: [number, number, number, number]
  /** Scale applied to the canvas once the door/zoom stage completes. */
  zoomTo?: number
  /**
   * Extra zoom (as a multiple of zoomTo) layered on during the fade-out stage,
   * so the closet rushes past the camera and off-screen instead of just
   * dissolving in place. 0 = fade only.
   */
  exitZoom?: number
  /**
   * Fraction of the scroll runway spent opening the door and zooming in
   * (0-1). The remaining fraction is spent fading the closet out entirely —
   * a one-way intro, not a persistent portal.
   */
  openFraction?: number
  /** Disables the whole rAF/WebGL pipeline (reduced motion, mobile fallback, etc). */
  enabled?: boolean
  /** Called once each time the door finishes opening (true) or starts closing again (false) — not per frame. */
  onOpenChange?: (open: boolean) => void
  /** Called once when the door first starts to open (true) or is back fully shut (false) — not per frame. */
  onOpeningChange?: (opening: boolean) => void
}

interface CinematicChromaHeroState {
  isReady: boolean
  hasError: boolean
  /** Download progress of the closet video, 0-1 (0 until the size is known). */
  progress: number
}

// Past this, the hero gives up and the page falls back to the static hero
// rather than leaving a spinner up forever.
const LOAD_TIMEOUT_MS = 25_000
// A single seek should be near-instant once the video is in memory.
const SEEK_TIMEOUT_MS = 3_000

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 v_uv;
  uniform sampler2D u_texture;
  uniform vec2 u_uvScale;
  uniform float u_similarity;
  uniform float u_smoothness;
  uniform float u_spill;

  void main() {
    vec2 uv = (v_uv - 0.5) * u_uvScale + 0.5;
    vec4 color = texture2D(u_texture, uv);

    // "Excess green" keying: a green screen is defined by G dominating both
    // R and B, regardless of how bright or saturated that green is — unlike
    // a fixed-color chroma distance, this doesn't get confused by warm
    // cream/wood tones (R-dominant) sitting unexpectedly close to a dark,
    // desaturated key green in other color spaces.
    float greenness = color.g - max(color.r, color.b);
    float alpha = 1.0 - smoothstep(u_similarity, u_similarity + u_smoothness, greenness);

    // Spill suppression: pull the green channel down toward max(r,b) near
    // the threshold, instead of leaving keyed edges rimmed in green.
    float spillAmount = clamp(greenness / (u_similarity + u_smoothness + 0.001), 0.0, 1.0) * u_spill;
    vec3 despilled = vec3(color.r, mix(color.g, max(color.r, color.b), spillAmount), color.b);

    gl_FragColor = vec4(despilled, alpha);
  }
`

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  if (!vertexShader || !fragmentShader) return null

  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return null
  }
  return program
}

/** Waits for the video to seek to `time` and resolves once that frame is decoded. */
/** Seeks and waits for the frame. Never hangs: resolves after SEEK_TIMEOUT_MS regardless (Safari can skip `seeked`). */
function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      video.removeEventListener('seeked', done)
      resolve()
    }
    const timer = setTimeout(() => {
      console.warn('[cinematic-hero] seek timed out', { time })
      done()
    }, SEEK_TIMEOUT_MS)
    video.addEventListener('seeked', done)
    video.currentTime = time
  })
}

/** Downloads the whole video, reporting progress, and returns an object URL for it. */
async function loadVideoBlob(src: string, signal: AbortSignal, onProgress: (p: number) => void): Promise<string> {
  const res = await fetch(src, { signal })
  if (!res.ok) throw new Error(`video fetch failed: ${res.status}`)
  const total = Number(res.headers.get('content-length')) || 0
  if (!res.body || !total) return URL.createObjectURL(await res.blob())

  const reader = res.body.getReader()
  const chunks: BlobPart[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    onProgress(Math.min(received / total, 1))
  }
  return URL.createObjectURL(new Blob(chunks, { type: res.headers.get('content-type') || 'video/mp4' }))
}

/**
 * Samples a handful of candidate frames (biased toward the door being open)
 * and picks the dominant green-ish color among them as the chroma key color.
 * Falls back to a standard chroma-green if nothing green-dominant is found.
 */
async function detectChromaKeyColor(video: HTMLVideoElement): Promise<[number, number, number]> {
  const FALLBACK: [number, number, number] = [0.0, 1.0, 0.25]
  const duration = video.duration
  if (!duration || !isFinite(duration)) return FALLBACK

  const sampleCanvas = document.createElement('canvas')
  sampleCanvas.width = 160
  sampleCanvas.height = 90
  const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return FALLBACK

  const candidateFractions = [0.6, 0.75, 0.85, 0.95]
  let best = { count: 0, r: 0, g: 0, b: 0 }

  for (const fraction of candidateFractions) {
    await seekTo(video, duration * fraction)
    ctx.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height)
    const { data } = ctx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height)

    let count = 0
    let r = 0
    let g = 0
    let b = 0
    for (let i = 0; i < data.length; i += 4) {
      const px = data[i]
      const py = data[i + 1]
      const pz = data[i + 2]
      if (py > 60 && py > px * 1.15 && py > pz * 1.15) {
        count++
        r += px
        g += py
        b += pz
      }
    }

    if (count > best.count) {
      best = { count, r, g, b }
    }
  }

  const totalSamples = sampleCanvas.width * sampleCanvas.height
  if (best.count < totalSamples * 0.02) return FALLBACK

  return [best.r / best.count / 255, best.g / best.count / 255, best.b / best.count / 255]
}

export function useCinematicChromaHero({
  containerRef,
  videoRef,
  src,
  canvasRef,
  contentRef,
  rackSceneRef,
  innerRect,
  zoomTo = 2.6,
  exitZoom = 1,
  openFraction = 0.6,
  enabled = true,
  onOpenChange,
  onOpeningChange,
}: UseCinematicChromaHeroOptions): CinematicChromaHeroState {
  const [state, setState] = useState<CinematicChromaHeroState>({ isReady: false, hasError: false, progress: 0 })
  // Kept in a ref so a new callback identity doesn't tear down the whole WebGL effect.
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange
  const onOpeningChangeRef = useRef(onOpeningChange)
  onOpeningChangeRef.current = onOpeningChange

  useEffect(() => {
    if (!enabled) return

    const container = containerRef.current
    const video = videoRef.current
    const canvas = canvasRef.current
    const content = contentRef?.current ?? null
    const rackScene = rackSceneRef?.current ?? null
    if (!container || !video || !canvas) return

    let cancelled = false
    const abort = new AbortController()
    let objectUrl: string | null = null
    let rafId = 0
    let running = false
    let currentScale = 1
    let lastTickTime = 0
    // Local flag, not the React state — tick() runs every frame inside a
    // closure this effect only creates once, so reading the `state` from
    // useState here would read the stale value captured at effect-setup
    // time forever (setState reruns the component, not this effect).
    let isReadyFlag = false
    // Eased (lerped) versions of the stage progresses — smooths out the
    // door/zoom motion and the closet fade-out, instead of snapping 1:1 to
    // raw scroll pixels every frame. Low factors = slower, heavier, more
    // fluid motion. The hero copy reuses smoothedOpen directly (not its own
    // curve) so it reveals in lockstep with the door/zoom, not ahead of it.
    let smoothedOpen = 0
    let smoothedFade = 0
    // Ramps the canvas in once it's actually ready to draw, independent of
    // scroll position (so it doesn't just pop in).
    let introOpacity = 0
    // Last open/closed state reported via onOpenChange, so it only fires on crossings.
    let reportedOpen = false
    let reportedOpening = false

    canvas.style.opacity = '0'
    if (content) content.style.opacity = '0'

    const gl = (canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true }) ||
      canvas.getContext('experimental-webgl', {
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
      })) as WebGLRenderingContext | null

    if (!gl) {
      setState({ isReady: false, hasError: true, progress: 0 })
      return
    }

    const program = createProgram(gl)
    if (!program) {
      setState({ isReady: false, hasError: true, progress: 0 })
      return
    }

    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    )

    const positionLoc = gl.getAttribLocation(program, 'a_position')
    const textureLoc = gl.getUniformLocation(program, 'u_texture')
    const uvScaleLoc = gl.getUniformLocation(program, 'u_uvScale')
    const similarityLoc = gl.getUniformLocation(program, 'u_similarity')
    const smoothnessLoc = gl.getUniformLocation(program, 'u_smoothness')
    const spillLoc = gl.getUniformLocation(program, 'u_spill')

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

    gl.clearColor(0, 0, 0, 0)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)

    // Declared as const arrow functions (not hoisted function declarations)
    // so TypeScript retains the non-null narrowing of `video`/`canvas`/`gl`
    // established above across these closures.
    const updateCoverScale = () => {
      if (!video.videoWidth || !video.videoHeight) return
      const canvasAspect = canvas.width / canvas.height
      const videoAspect = video.videoWidth / video.videoHeight
      let uvScaleX = 1
      let uvScaleY = 1
      if (canvasAspect > videoAspect) {
        uvScaleY = videoAspect / canvasAspect
      } else {
        uvScaleX = canvasAspect / videoAspect
      }
      gl.useProgram(program)
      gl.uniform2f(uvScaleLoc, uvScaleX, uvScaleY)
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.round(container.clientWidth * dpr)
      const height = Math.round(window.innerHeight * dpr)
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
      updateCoverScale()
    }

    const getScrollProgress = () => {
      const rect = container.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      if (scrollable <= 0) return 0
      const raw = -rect.top / scrollable
      return Math.min(1, Math.max(0, raw))
    }

    const drawFrame = () => {
      if (video.readyState < 2) return
      gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.enableVertexAttribArray(positionLoc)
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      gl.uniform1i(textureLoc, 0)

      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    const tick = () => {
      if (cancelled) return
      const now = performance.now()
      const deltaSeconds = lastTickTime ? Math.min((now - lastTickTime) / 1000, 0.08) : 1 / 60
      lastTickTime = now
      const rawProgress = getScrollProgress()
      const duration = video.duration

      // Stage 1 (0 → openFraction of the runway): door opens, camera zooms
      // in. Stage 2 (openFraction → 1): the closet fades out completely,
      // revealing the page underneath — a one-way intro, not a persistent portal.
      const openProgress = Math.min(1, rawProgress / openFraction)
      // Ease the scroll input at both ends so the doors start and settle
      // gently instead of matching the wheel's acceleration one-to-one.
      const openTarget = openProgress * openProgress * (3 - 2 * openProgress)
      const fadeTarget = Math.max(0, (rawProgress - openFraction) / (1 - openFraction))

      // Lerp every target toward its scroll-derived value each frame instead
      // of snapping straight to it — this is what makes the door motion read
      // as smooth, weighted camera work rather than a raw scrollbar hooked
      // to a video, while still settling back to an exact match (and
      // therefore staying fully reversible) whenever scrolling slows or stops.
      // Small factors = slow, heavy, fluid motion.
      // Time-based easing stays consistent across 30/60/120 Hz displays and
      // responds quickly enough that the door feels attached to the scroll.
      smoothedOpen += (openTarget - smoothedOpen) * (1 - Math.exp(-deltaSeconds / 0.12))
      smoothedFade += (fadeTarget - smoothedFade) * (1 - Math.exp(-deltaSeconds / 0.14))
      introOpacity += ((isReadyFlag ? 1 : 0) - introOpacity) * (1 - Math.exp(-deltaSeconds / 0.1))

      if (duration && isFinite(duration)) {
        const targetTime = smoothedOpen * duration
        // Skip while a seek is still decoding — piling new seeks on top of
        // an unfinished one is what made the door stutter and stall.
        if (!video.seeking && Math.abs(video.currentTime - targetTime) > 0.01) {
          video.currentTime = targetTime
        }
      }

      const targetScale = (1 + smoothedOpen * (zoomTo - 1)) * (1 + smoothedFade * exitZoom)
      currentScale += (targetScale - currentScale) * (1 - Math.exp(-deltaSeconds / 0.13))
      if (rackScene && innerRect) {
        const [left, top, right, bottom] = innerRect
        const zoomedLeft = 0.5 + (left - 0.5) * currentScale
        const zoomedTop = 0.5 + (top - 0.5) * currentScale
        const zoomedRight = 0.5 + (right - 0.5) * currentScale
        const zoomedBottom = 0.5 + (bottom - 0.5) * currentScale
        // Start with the rack fully hidden so keyed pixels in a closed door
        // can never reveal the scene behind it. Grow the visible aperture as
        // the doors open, from the centre of the frame.
        const apertureProgress = Math.max(0, Math.min(1, smoothedOpen / 0.14))
        const apertureReveal = apertureProgress * apertureProgress * (3 - 2 * apertureProgress)
        const doorLeft = 0.5 + (zoomedLeft - 0.5) * apertureReveal
        const doorTop = 0.5 + (zoomedTop - 0.5) * apertureReveal
        const doorRight = 0.5 + (zoomedRight - 0.5) * apertureReveal
        const doorBottom = 0.5 + (zoomedBottom - 0.5) * apertureReveal
        // Ease the doorway-shaped crop into a full-screen rack. Blending the
        // edges avoids the visible snap that used to happen near the last frame.
        const reveal = Math.max(0, Math.min(1, (smoothedOpen - 0.78) / 0.22))
        const fullReveal = reveal * reveal * (3 - 2 * reveal)
        const clipLeft = doorLeft * (1 - fullReveal)
        const clipTop = doorTop * (1 - fullReveal)
        const clipRight = 1 - (1 - doorRight) * (1 - fullReveal)
        const clipBottom = 1 - (1 - doorBottom) * (1 - fullReveal)
        rackScene.style.clipPath = `inset(${clipTop * 100}% ${(1 - clipRight) * 100}% ${(1 - clipBottom) * 100}% ${clipLeft * 100}%)`
      }
      canvas.style.transform = `scale(${currentScale})`
      canvas.style.opacity = String(introOpacity * (1 - smoothedFade))

      // The copy reuses smoothedOpen directly (the same eased value driving
      // the door/zoom) so it reveals exactly in step with the door opening,
      // not on its own separate timeline. Centred: a pure scale+fade with no
      // horizontal/vertical translation, so it grows in place rather than
      // sliding to a side.
      if (content) {
        content.style.opacity = String(smoothedOpen)
        content.style.transform = `scale(${0.94 + smoothedOpen * 0.06})`
      }

      // Keep branding/menu hidden until the video has reached its final open pose.
      // Hysteresis stops the state flickering if the user scrolls at the threshold.
      const isOpen = reportedOpen ? smoothedOpen > 0.95 : smoothedOpen > 0.995
      if (isOpen !== reportedOpen) {
        reportedOpen = isOpen
        console.log('[cinematic-hero] door', isOpen ? 'opened' : 'closing')
        onOpenChangeRef.current?.(isOpen)
      }

      // Same idea for the very start of the door moving (opens past 2%,
      // counts as shut again below 0.5%).
      const isOpening = reportedOpening ? smoothedOpen > 0.005 : smoothedOpen > 0.02
      if (isOpening !== reportedOpening) {
        reportedOpening = isOpening
        console.log('[cinematic-hero] door', isOpening ? 'started opening' : 'shut')
        onOpeningChangeRef.current?.(isOpening)
      }

      drawFrame()

      if (running) rafId = requestAnimationFrame(tick)
    }

    const startLoop = () => {
      if (running) return
      running = true
      rafId = requestAnimationFrame(tick)
    }

    const stopLoop = () => {
      running = false
      cancelAnimationFrame(rafId)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) startLoop()
          else stopLoop()
        }
      },
      { rootMargin: '20% 0px 20% 0px' }
    )
    observer.observe(container)

    const handleResize = () => resize()
    window.addEventListener('resize', handleResize)

    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    const loadStart = performance.now()

    let removeListeners = () => {}

    const onLoadedMetadata = () => {
      resize()
    }

    const onCanPlay = () => {
      // Not autoplaying — this just confirms enough of the video is decoded
      // to seek and sample from safely.
    }

    const onError = () => {
      if (cancelled || !objectUrl) return
      console.error('[cinematic-hero] video failed to decode')
      setState({ isReady: false, hasError: true, progress: 0 })
    }

    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('error', onError)

    removeListeners = () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('error', onError)
    }

    const init = async () => {
      let lastReported = 0
      objectUrl = await loadVideoBlob(src, abort.signal, (progress) => {
        // Throttled to whole percents so this doesn't re-render per chunk.
        if (cancelled || progress - lastReported < 0.01) return
        lastReported = progress
        setState((s) => ({ ...s, progress }))
      })
      if (cancelled) return
      console.log('[cinematic-hero] video downloaded', { ms: Math.round(performance.now() - loadStart) })
      video.src = objectUrl
      video.load()

      if (video.readyState < 1) {
        await new Promise<void>((resolve) => {
          const onMeta = () => {
            video.removeEventListener('loadedmetadata', onMeta)
            resolve()
          }
          video.addEventListener('loadedmetadata', onMeta)
        })
      }
      if (cancelled) return
      resize()

      const keyColor = await detectChromaKeyColor(video)
      if (cancelled) return

      // Derive the keying thresholds from how "green" the detected screen
      // actually is, rather than a fixed constant — a bright neon screen and
      // a dark, muted olive screen both need very different cutoffs on the
      // same 0-1 excess-green scale.
      const keyGreenness = Math.max(keyColor[1] - Math.max(keyColor[0], keyColor[2]), 0.08)
      const similarity = keyGreenness * 0.4
      const smoothness = Math.max(keyGreenness * 0.35, 0.03)

      gl.useProgram(program)
      gl.uniform1f(similarityLoc, similarity)
      gl.uniform1f(smoothnessLoc, smoothness)
      gl.uniform1f(spillLoc, 0.8)

      video.currentTime = 0
      await seekTo(video, 0)
      if (cancelled) return

      drawFrame()
      isReadyFlag = true
      clearTimeout(loadTimer)
      console.log('[cinematic-hero] ready', { ms: Math.round(performance.now() - loadStart) })
      setState({ isReady: true, hasError: false, progress: 1 })
      startLoop()
    }

    const fail = (reason: unknown) => {
      if (cancelled) return
      cancelled = true
      abort.abort()
      console.error('[cinematic-hero] falling back to static hero', reason)
      setState({ isReady: false, hasError: true, progress: 0 })
    }

    const loadTimer = setTimeout(() => fail(`not ready after ${LOAD_TIMEOUT_MS}ms`), LOAD_TIMEOUT_MS)
    init().catch(fail)

    return () => {
      cancelled = true
      clearTimeout(loadTimer)
      abort.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      stopLoop()
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
      removeListeners()
      gl.deleteProgram(program)
      gl.deleteBuffer(positionBuffer)
      gl.deleteTexture(texture)
    }
  }, [containerRef, videoRef, src, canvasRef, contentRef, rackSceneRef, innerRect, zoomTo, exitZoom, openFraction, enabled])

  return state
}
