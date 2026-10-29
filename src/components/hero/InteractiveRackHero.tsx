import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, RefObject } from 'react'
import { createPortal } from 'react-dom'

type RackPiece = {
  id: string
  name?: string
  image?: string
  imageAlt?: string
  detailImage?: string
  detailAlt?: string
  details?: string[]
  pairId?: string
  outerwear?: boolean
  warmWeather?: boolean
}

// Layout is measured in the scene's own units (`cqw`, 1% of its width, or % of its
// width) so the rack keeps its proportions at every size. Narrow screens show
// fewer, larger pieces in a taller scene: eight hangers across a phone would be a few pixels wide.
const RACK_LAYOUTS = {
  wide: { slots: 6, size: 1, rodY: 24, reach: 46, aspect: '4 / 3', width: 'min(94vw, 115svh)' },
  compact: { slots: 5, size: 1.2, rodY: 30, reach: 58, aspect: '4 / 5', width: 'min(96vw, 69svh)' },
}
// size: multiplier on every piece. rodY: rail height in cqw. reach: how far the longest garment hangs below it.

type GarmentKind = 'top' | 'outerwear' | 'bottom' | 'full'
const TOPS = new Set(['burgundy-rib-knit-top', 'olive-eyelet-crop-top', 'chartreuse-buckle-wrap-top', 'burgundy-button-up-shirt'])
const BOTTOMS = new Set(['red-asymmetric-overlay-skirt', 'pale-blue-wrap-skirt', 'olive-gathered-contrast-hem-skirt', 'charcoal-pinstripe-trousers', 'blue-layered-chiffon-skirt', 'white-trousers-burgundy-look'])
const kindOf = (piece: RackPiece): GarmentKind => (piece.outerwear ? 'outerwear' : TOPS.has(piece.id) ? 'top' : BOTTOMS.has(piece.id) ? 'bottom' : 'full') // everything else is a dress or a head-to-toe look on one hanger

// Garments of one kind share one size, so every top matches every other top regardless of how its
// photo was framed. A piece is sized by the square root of its garment's width x height (in cqw);
// that stays steady across wide-sleeved and long, narrow cuts. Full looks run larger: they are
// a top and a bottom on one hanger.
const RACK_SIZE: Record<GarmentKind, number> = { top: 17, outerwear: 19, bottom: 17, full: 22 }

function getRackLayout() {
  const compact = window.matchMedia('(max-width: 640px)').matches
  const layout = RACK_LAYOUTS[compact ? 'compact' : 'wide']
  const spacing = 75 / (layout.slots - 1) // % of scene width between hangers
  return { ...layout, spacing, positions: Array.from({ length: layout.slots }, (_, index) => 12.5 + index * spacing) }
}

type RackLayout = ReturnType<typeof getRackLayout>

const ROD_VIEWBOX = { width: 2172, height: 120, railY: 58 } // landing-antique-gold-rod.svg
const ROD_WIDTH = 104 // % of scene width; the finials sit just outside the end hangers
const OUTFITS: RackPiece[] = [
  {
    id: 'butter-satin-look',
    name: 'White Tee & Butter Satin Skirt',
    image: '/images/white-tee-butter-skirt-on-hanger.png',
    imageAlt: 'White fitted tee tucked into a butter-yellow satin maxi skirt on one wooden hanger',
    warmWeather: true,
    detailImage: '/images/white-tee-butter-skirt-reference.jpg',
    detailAlt: 'White fitted tee and pale yellow satin maxi skirt styled with a gold sun pendant and white sandals',
    details: ['White fitted crew-neck tee', 'Butter-yellow satin maxi skirt', 'Gold sun pendant necklace', 'White flat sandals'],
  },
  {
    id: 'burgundy-rib-knit-top',
    name: 'Burgundy Rib-Knit Top',
    image: '/images/burgundy-rib-knit-top-on-hanger.png',
    imageAlt: 'Deep burgundy short-sleeve rib-knit top hanging on a wooden hanger',
    detailImage: '/images/burgundy-rib-knit-top-reference.png',
    detailAlt: 'Deep burgundy short-sleeve knit top with ribbed collar and waistband',
    details: ['Burgundy short-sleeve knit top', 'Ribbed high neckline', 'Ribbed fitted waistband'],
  },
  {
    id: 'red-asymmetric-overlay-skirt',
    name: 'Red Asymmetric Skirt Look',
    image: '/images/red-asymmetric-skirt-on-hanger.png',
    imageAlt: 'Red asymmetric overlay skirt with a blue striped inset hanging from a wooden clip hanger',
    warmWeather: true,
    detailImage: '/images/red-asymmetric-skirt-look-reference.jpg',
    detailAlt: 'Complete outfit with pale blue wrap blouse, red asymmetric skirt, gold earrings, watch, burgundy handbag, and burgundy heels',
    details: ['Pale blue long-sleeve wrap blouse', 'Red asymmetric overlay skirt with blue striped inset', 'Gold drop earrings', 'Gold-tone watch with a brown strap', 'Burgundy handbag', 'Burgundy slingback heels'],
  },
  {
    id: 'pale-blue-wrap-skirt',
    name: 'Pale Blue Draped Wrap Skirt',
    image: '/images/pale-blue-wrap-skirt-on-hanger.png',
    imageAlt: 'Pale blue flowing wrap skirt with a draped waist tie hanging from a wooden clip hanger',
    warmWeather: true,
    detailImage: '/images/pale-blue-wrap-skirt-reference.png',
    detailAlt: 'Pale blue flowing wrap skirt with a gathered waistband and long draped sash',
    details: ['Pale blue flowing midi skirt', 'Draped wrap waistband', 'Long side sash'],
  },
  {
    id: 'olive-eyelet-crop-top',
    name: 'Olive Eyelet Cutout Top',
    image: '/images/olive-eyelet-crop-top-on-hanger.png',
    imageAlt: 'Olive green collared crop top with an eyelet-trimmed chest cutout hanging on a wooden hanger',
    warmWeather: true,
    detailImage: '/images/olive-eyelet-crop-top-reference.png',
    detailAlt: 'Olive cropped collared top with an eyelet-trimmed cutout and shaped seams',
    details: ['Olive short-sleeve cropped top', 'Collared neckline', 'Eyelet-trimmed chest cutout'],
  },
  {
    id: 'chartreuse-buckle-wrap-top',
    name: 'Chartreuse Buckle-Wrap Top',
    image: '/images/chartreuse-wrap-top-on-hanger.png',
    imageAlt: 'Bright chartreuse sleeveless wrap top with a silver buckle hanging on a wooden hanger',
    warmWeather: true,
    detailImage: '/images/chartreuse-top-olive-skirt-look-reference.jpg',
    detailAlt: 'Chartreuse buckle-wrap top and olive gathered skirt with matching sunglasses, gold earrings, olive handbag, and green heels',
    details: ['Chartreuse sleeveless buckle-wrap top', 'Olive gathered midi skirt with golden hem', 'Brown-tinted sunglasses', 'Gold hoop earrings', 'Olive shoulder bag', 'Olive slingback heels'],
  },
  {
    id: 'olive-gathered-contrast-hem-skirt',
    name: 'Olive Gathered Skirt with Gold Hem',
    image: '/images/olive-gathered-skirt-on-hanger.png',
    imageAlt: 'Olive gathered midi skirt with an asymmetric golden chartreuse hem hanging on a wooden clip hanger',
    warmWeather: true,
    detailImage: '/images/chartreuse-top-olive-skirt-look-reference.jpg',
    detailAlt: 'Olive gathered skirt with golden hem paired with a chartreuse buckle-wrap top, sunglasses, gold earrings, olive handbag, and green heels',
    details: ['Olive gathered midi skirt with golden hem', 'Chartreuse sleeveless buckle-wrap top', 'Brown-tinted sunglasses', 'Gold hoop earrings', 'Olive shoulder bag', 'Olive slingback heels'],
  },
  {
    id: 'ivory-floral-midi-dress',
    name: 'Ivory Floral Bustier Midi Dress',
    image: '/images/floral-midi-dress-on-hanger.png',
    imageAlt: 'Ivory floral-print midi dress hanging from a wooden hanger',
    warmWeather: true,
    detailImage: '/images/floral-midi-dress-reference.jpg',
    detailAlt: 'Ivory floral-print bustier midi dress with delicate straps',
    details: ['Ivory floral bustier midi dress'],
  },
  {
    id: 'navy-denim-look',
    name: 'Navy Layers & Wide-Leg Denim',
    image: '/images/navy-denim-clothing-on-hanger.png',
    imageAlt: 'Navy overshirt, white top, and light-wash jeans on a wooden hanger',
    warmWeather: true,
    detailImage: '/images/navy-layered-look-cutout.png',
    detailAlt: 'Complete navy, white, and light-wash denim outfit with a cream bag, pendant, and white sneakers',
    details: ['Navy overshirt', 'White fitted top', 'Light-wash wide-leg jeans', 'Cream shoulder bag', 'Pendant necklace', 'White sneakers'],
  },
  {
    id: 'chocolate-ivory-look',
    name: 'Chocolate Cape & Ivory Trousers',
    image: '/images/chocolate-ivory-clothing-on-hanger.png',
    imageAlt: 'Chocolate-brown cape top and ivory wide-leg trousers on a wooden hanger',
    detailImage: '/images/faym-full-look.jpg',
    detailAlt: 'Chocolate cape top and ivory trousers styled with a dark-brown shoulder bag',
    details: ['Chocolate-brown cape top', 'Ivory wide-leg trousers', 'Dark-brown shoulder bag with gold chain'],
  },
  {
    id: 'charcoal-pinstripe-trousers',
    name: 'Charcoal Pinstripe Wrap Trousers',
    image: '/images/charcoal-pinstripe-wrap-trousers-on-hanger.png',
    imageAlt: 'Charcoal pinstripe wrap trousers hanging from a wooden clip hanger',
    detailImage: '/images/charcoal-pinstripe-wrap-trousers-reference.png',
    detailAlt: 'Charcoal gray wide-leg trousers with fine pinstripes and a wrap tie waist',
    details: ['Charcoal gray wide-leg trousers', 'Fine white pinstripes', 'Wrap waist with side tie'],
  },
  {
    id: 'navy-pinstripe-matching-set',
    name: 'Navy Pinstripe Wrap Set',
    image: '/images/navy-pinstripe-set-on-hanger.png',
    imageAlt: 'Navy pinstripe wrap top and matching wide-leg trousers together on one wooden hanger',
    detailImage: '/images/navy-pinstripe-set-reference.png',
    detailAlt: 'Sleeveless navy pinstripe wrap top and matching wide-leg trousers',
    details: ['Sleeveless asymmetric wrap top', 'Matching navy pinstripe wide-leg trousers'],
  },
  {
    id: 'blue-layered-chiffon-skirt',
    name: 'Blue Layered Chiffon Maxi Skirt',
    image: '/images/blue-layered-skirt-on-hanger.png',
    imageAlt: 'Blue layered chiffon maxi skirt with pearl and starfish details hanging on a wooden clip hanger',
    warmWeather: true,
    detailImage: '/images/blue-layered-skirt-reference.png',
    detailAlt: 'Blue sheer layered chiffon maxi skirt with pearl and starfish decorations',
    details: ['Sky-blue layered chiffon maxi skirt', 'Asymmetric sheer ruffle tiers', 'Pearl and starfish waist charm'],
  },
  {
    id: 'navy-quarter-zip-ivory-jeans',
    name: 'Navy Quarter-Zip & Ivory Jeans',
    image: '/images/navy-quarter-zip-ivory-jeans-on-hanger.png',
    imageAlt: 'Navy quarter-zip sweatshirt layered over a white tee with ivory jeans on one wooden hanger',
    detailImage: '/images/navy-quarter-zip-look-reference.png',
    detailAlt: 'Navy quarter-zip sweatshirt, white tee, ivory jeans, silver watch, and white sneakers',
    details: ['Navy quarter-zip sweatshirt', 'White crew-neck tee', 'Ivory straight-leg jeans', 'Silver wristwatch', 'White low-top sneakers'],
  },
  {
    id: 'olive-linen-cream-trousers',
    name: 'Olive Linen & Cream Trousers',
    image: '/images/olive-linen-cream-trousers-on-hanger.png',
    imageAlt: 'Olive linen button-up shirt with cream trousers on one wooden hanger',
    warmWeather: true,
    detailImage: '/images/olive-linen-look-reference.jpg',
    detailAlt: 'Olive linen shirt, cream trousers, beige cap, sunglasses, watches, and taupe clogs',
    details: ['Olive linen button-up shirt', 'Cream drawstring trousers', 'Beige baseball cap', 'Gold-frame sunglasses', 'Brown leather-strap watch', 'Taupe clogs'],
  },
  {
    id: 'burgundy-button-up-shirt',
    pairId: 'burgundy-shirt-white-trousers',
    name: 'Burgundy Button-Up Shirt',
    image: '/images/burgundy-button-up-shirt-on-hanger.png',
    imageAlt: 'Burgundy button-up shirt hanging on its own wooden hanger',
    detailImage: '/images/burgundy-shirt-look-reference.png',
    detailAlt: 'Burgundy button-up shirt styled with white trousers',
    details: ['Burgundy button-up shirt', 'White trousers'],
  },
  {
    id: 'white-trousers-burgundy-look',
    pairId: 'burgundy-shirt-white-trousers',
    name: 'White Trousers',
    image: '/images/white-trousers-on-hanger.png',
    imageAlt: 'White trousers hanging on their own wooden clip hanger',
    detailImage: '/images/burgundy-shirt-look-reference.png',
    detailAlt: 'Burgundy button-up shirt styled with white trousers',
    details: ['Burgundy button-up shirt', 'White trousers'],
  },
  {
    id: 'chocolate-suede-belted-jacket',
    name: 'Chocolate Suede Belted Jacket',
    image: '/images/chocolate-suede-belted-jacket-on-hanger.png',
    imageAlt: 'Dark chocolate suede belted jacket on a wooden hanger',
    outerwear: true,
    detailImage: '/images/chocolate-suede-jacket-reference.png',
    detailAlt: 'Dark chocolate brown suede cropped jacket with lapels, belt, and buttoned cuffs',
    details: ['Chocolate-brown suede jacket', 'Double-breasted lapels', 'Waist belt', 'Buttoned cuffs'],
  },
  {
    id: 'burgundy-leather-zip-jacket',
    name: 'Burgundy Leather Zip Jacket',
    image: '/images/burgundy-leather-zip-jacket-on-hanger.png',
    imageAlt: 'Cropped burgundy leather zip jacket on a wooden hanger',
    outerwear: true,
    detailImage: '/images/burgundy-leather-jacket-reference.png',
    detailAlt: 'Cropped burgundy leather jacket with a pointed collar and front zipper',
    details: ['Burgundy leather jacket', 'Pointed collar', 'Front zip fastening', 'Relaxed sleeves'],
  },
  {
    id: 'chocolate-leather-trench',
    name: 'Chocolate Leather Trench Coat',
    image: '/images/chocolate-leather-trench-on-hanger.png',
    imageAlt: 'Dark chocolate leather trench coat with belt on a wooden hanger',
    outerwear: true,
    detailImage: '/images/chocolate-trench-reference.png',
    detailAlt: 'Dark brown belted leather trench coat with broad lapels',
    details: ['Dark chocolate leather trench', 'Broad lapels', 'Matching waist belt', 'Long sleeves'],
  },
  {
    id: 'cream-faux-fur-coat',
    name: 'Cream Faux-Fur Coat',
    image: '/images/cream-faux-fur-coat-on-hanger.png',
    imageAlt: 'Plush cream faux-fur coat on a wooden hanger',
    outerwear: true,
    detailImage: '/images/cream-faux-fur-reference.png',
    detailAlt: 'Short cream faux-fur coat with a wide plush collar',
    details: ['Cream faux-fur coat', 'Wide plush collar', 'Long sleeves', 'Soft cropped silhouette'],
  },
  {
    id: 'brown-spotted-fur-jacket',
    name: 'Brown Jacket with Spotted Fur Trim',
    image: '/images/brown-faux-fur-collar-jacket-on-hanger.png',
    imageAlt: 'Dark brown jacket with spotted faux-fur collar and cuffs on a wooden hanger',
    outerwear: true,
    detailImage: '/images/brown-spotted-fur-jacket-reference.png',
    detailAlt: 'Dark brown button-front jacket with brown-and-cream spotted faux-fur collar and cuffs',
    details: ['Dark brown wool jacket', 'Spotted faux-fur collar', 'Matching faux-fur cuffs', 'Button front'],
  },
]

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

type HangerAnchor = {
  width: number
  height: number
  /** Where the hook's arch sits horizontally, in source pixels. */
  hookX: number
  /** Distance from the top of the picture down to the point that rests on the rod. */
  restY: number
  /** √(garment width × height) in source pixels: how big the piece is in its own photo. */
  size: number
}

/** Find the hook's arch in a hanger photo so it can be placed exactly on the rod. */
function measureHanger(image: HTMLImageElement): HangerAnchor | null {
  const { naturalWidth: width, naturalHeight: height } = image
  if (!width || !height) return null

  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(image, 0, 0)
    const { data } = context.getImageData(0, 0, width, height)
    const rowSpan = (y: number) => {
      let left = width
      let right = -1
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] <= 20) continue
        left = Math.min(left, x)
        right = x
      }
      return right < 0 ? null : { left, right }
    }

    let apex = 0
    while (apex < height && !rowSpan(apex)) apex += 1
    if (apex >= height) return null

    // The hook ends where the hanger's shoulders begin (the row turns wide).
    let hookEnd = apex
    while (hookEnd < height * 0.2) {
      const span = rowSpan(hookEnd)
      if (span && span.right - span.left > width * 0.12) break
      hookEnd += 1
    }

    let boxLeft = width
    let boxRight = 0
    let boxBottom = apex
    for (let y = apex; y < height; y += 1) {
      const span = rowSpan(y)
      if (!span) continue
      boxLeft = Math.min(boxLeft, span.left)
      boxRight = Math.max(boxRight, span.right)
      boxBottom = y
    }

    let left = width
    let right = 0
    const archRows = Math.max(3, Math.floor((hookEnd - apex) / 2))
    for (let y = apex; y < apex + archRows; y += 1) {
      const span = rowSpan(y)
      if (!span) continue
      left = Math.min(left, span.left)
      right = Math.max(right, span.right)
    }
    // The rod rests just under the top of the arch, about a third of its width down.
    return { width, height, hookX: (left + right) / 2, restY: apex + (right - left) * 0.32, size: Math.sqrt((boxRight - boxLeft + 1) * (boxBottom - apex + 1)) }
  } catch {
    // Unreadable canvas: the piece simply stays hidden rather than hanging in the wrong place.
    return null
  }
}

function getSeason(): 'cold' | 'warm' | 'transition' {
  const month = new Date().getMonth()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const southernHemisphere = /^(Australia|Pacific\/(Auckland|Fiji|Noumea|Port_Moresby)|America\/(Argentina|Santiago|Montevideo|Sao_Paulo|Asuncion|La_Paz|Lima|Bogota|Caracas)|Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone))/.test(timezone)
  const coldMonths = southernHemisphere ? [3, 4, 5, 6, 7, 8] : [8, 9, 10, 11, 0, 1]
  const warmMonths = southernHemisphere ? [9, 10, 11, 0, 1, 2] : [2, 3, 4, 5, 6, 7]
  if (coldMonths.includes(month)) return 'cold'
  if (warmMonths.includes(month)) return 'warm'
  return 'transition'
}

/** A fresh draw from the whole wardrobe on every load. The season only tilts the odds; it never fixes the set. */
function createInitialPieces({ positions }: RackLayout): RackPiece[] {
  const season = getSeason()
  const lean = (outfit: RackPiece) => {
    if (season === 'cold') return outfit.outerwear ? 0.4 : 0
    if (season === 'warm') return (outfit.warmWeather ? 0.4 : 0) - (outfit.outerwear ? 0.4 : 0)
    return 0
  }
  const ranked = OUTFITS.map((outfit) => ({ outfit, score: Math.random() + lean(outfit) }))
    .sort((a, b) => b.score - a.score)
    .map(({ outfit }) => outfit)

  const chosen = ranked.slice(0, positions.length)
  // Pieces from one look (a shirt and its trousers) hang together: if only one was drawn, bring its partner in.
  for (const piece of [...chosen]) {
    if (!piece.pairId) continue
    const partner = ranked.find((other) => other.pairId === piece.pairId && other.id !== piece.id)
    if (!partner || chosen.includes(partner)) continue
    const swapOut = [...chosen].reverse().find((other) => !other.pairId)
    if (swapOut) chosen[chosen.indexOf(swapOut)] = partner
  }
  return shuffle(chosen)
}

interface InteractiveRackHeroProps {
  onRackInteract?: () => void
  immersed?: boolean
  sceneRef?: RefObject<HTMLDivElement>
}

/** A hanger being carried along the rail. */
type Carried = {
  id: string
  /** Horizontal position as % of scene width, following the pointer. */
  x: number
  /** How far it has been lifted off the rail, in cqw. */
  lift: number
  /** Sway in degrees, from how fast it is being moved. */
  tilt: number
}

const DRAG_THRESHOLD_PX = 6
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** A lightweight, interactive landing hero built around the user's real rack. */
export function InteractiveRackHero({ onRackInteract, immersed = false, sceneRef }: InteractiveRackHeroProps) {
  const [layout] = useState(getRackLayout)
  // `pieces` never reorders: moving a DOM node mid-drag makes Safari drop the pointer capture.
  // Only `order` (the slot each piece hangs in) changes.
  const [pieces] = useState(() => createInitialPieces(layout))
  const [order, setOrder] = useState(() => pieces.map((piece) => piece.id))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [carried, setCarried] = useState<Carried | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [anchors, setAnchors] = useState<Record<string, HangerAnchor>>({})
  const selectedPiece = pieces.find((piece) => piece.id === selectedId && piece.image)

  const trackRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ id: string; pointerId: number; startX: number; startY: number; lastX: number; grab: number; moved: boolean } | null>(null)
  const carriedRef = useRef<Carried | null>(null)
  const settleTilt = useRef<number>()
  const suppressClick = useRef(false)
  useEffect(() => () => window.clearTimeout(settleTilt.current), [])

  const registerAnchor = (id: string, image: HTMLImageElement) => {
    const anchor = measureHanger(image)
    if (anchor) setAnchors((current) => (current[id] ? current : { ...current, [id]: anchor }))
  }

  const slotAt = (x: number) => clamp(Math.round((x - layout.positions[0]) / layout.spacing), 0, order.length - 1)
  const sceneX = (clientX: number) => {
    const bounds = trackRef.current!.getBoundingClientRect()
    return ((clientX - bounds.left) / bounds.width) * 100
  }

  // While a hanger is carried, the others keep their order and slide aside to leave a gap where it would land.
  const displayed = (() => {
    if (!carried || !order.includes(carried.id)) return order
    const rest = order.filter((id) => id !== carried.id)
    rest.splice(slotAt(carried.x), 0, carried.id)
    return rest
  })()
  const slotOf = new Map(displayed.map((id, index) => [id, index]))

  const trackPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || gesture.current?.moved) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = ((event.clientY - bounds.top) / bounds.width) * 100
    if (y < layout.rodY - 5 || y > layout.rodY + layout.reach) {
      setHoveredId(null)
      return
    }
    const nearest = slotAt(x)
    setHoveredId(Math.abs(layout.positions[nearest] - x) < layout.spacing * 0.6 ? displayed[nearest] : null)
  }

  const selectPiece = (id: string) => {
    setSelectedId(id)
    onRackInteract?.()
  }

  const moveBy = (id: string, step: number) => {
    setOrder((current) => {
      const from = current.indexOf(id)
      const to = clamp(from + step, 0, current.length - 1)
      if (from < 0 || from === to) return current
      const next = [...current]
      next.splice(from, 1)
      next.splice(to, 0, id)
      return next
    })
    onRackInteract?.()
  }

  const startGesture = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const index = order.indexOf(id)
    gesture.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      grab: sceneX(event.clientX) - layout.positions[index],
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveGesture = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    const active = gesture.current
    if (!active || active.id !== id || active.pointerId !== event.pointerId) return
    if (!active.moved && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) < DRAG_THRESHOLD_PX) return
    if (!active.moved) {
      active.moved = true
      setHoveredId(null)
      onRackInteract?.()
    }
    const bounds = trackRef.current!.getBoundingClientRect()
    const first = layout.positions[0]
    const last = layout.positions[layout.positions.length - 1]
    const next: Carried = {
      id,
      x: clamp(sceneX(event.clientX) - active.grab, first - layout.spacing * 0.5, last + layout.spacing * 0.5),
      lift: clamp(((event.clientY - active.startY) / bounds.width) * 100 * 0.3, -1.5, 5),
      tilt: clamp((event.clientX - active.lastX) * 0.9, -9, 9),
    }
    active.lastX = event.clientX
    carriedRef.current = next
    setCarried(next)
    // The sway eases back to upright once the pointer stops.
    window.clearTimeout(settleTilt.current)
    settleTilt.current = window.setTimeout(() => {
      if (carriedRef.current) setCarried((current) => (current ? { ...current, tilt: 0 } : current))
    }, 90)
  }

  const endGesture = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    const active = gesture.current
    if (!active || active.id !== id || active.pointerId !== event.pointerId) return
    gesture.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (!active.moved) return // a plain click: onClick opens the piece

    window.clearTimeout(settleTilt.current)
    suppressClick.current = true
    window.setTimeout(() => { suppressClick.current = false }, 0)
    const drop = carriedRef.current ? slotAt(carriedRef.current.x) : null
    carriedRef.current = null
    if (drop !== null) {
      setOrder((current) => {
        const rest = current.filter((entry) => entry !== id)
        rest.splice(drop, 0, id)
        return rest
      })
    }
    setCarried(null) // the hanger now glides from where it was let go into its slot
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (!event.shiftKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
    event.preventDefault()
    moveBy(id, event.key === 'ArrowLeft' ? -1 : 1)
  }

  return (
    <section
      ref={sceneRef}
      style={{
        ...(immersed ? { clipPath: 'inset(50%)' } : {}),
        backgroundImage: 'linear-gradient(180deg, rgba(250,248,241,.34) 0%, rgba(244,240,231,.42) 76%, rgba(233,226,213,.48) 100%), url(/images/landing-striped-linen-background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      className={immersed
        ? 'absolute inset-0 z-10 overflow-hidden bg-warm-cream'
        : 'relative min-h-[88svh] overflow-hidden bg-warm-cream px-3 pt-20 pb-8 md:min-h-screen md:px-8 md:pt-8'}
    >
      {!immersed && <>
        <div className="pointer-events-none absolute -left-36 top-1/4 h-96 w-96 rounded-full bg-butter-yellow/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-butter-yellow/10 blur-3xl" />
      </>}

      <div className={`relative z-10 mx-auto flex w-full items-center justify-center ${immersed ? 'h-full px-2 sm:px-4' : 'min-h-[80svh] md:min-h-[90svh]'}`}>
        <div
          className="relative"
          style={{
            aspectRatio: layout.aspect,
            width: layout.width,
            containerType: 'inline-size',
            transform: 'translateY(clamp(14px, 2.5svh, 32px))',
          }}
        >
          {/* Keep the rack behind the hanger and outfit; the transparent hanger hook wraps over the rod. */}
          <div ref={trackRef} className="absolute inset-0" onPointerMove={trackPointer} onPointerLeave={() => setHoveredId(null)}>
            {pieces.map((piece) => {
              const index = slotOf.get(piece.id) ?? 0
              const held = carried?.id === piece.id
              const facing = held || hoveredId === piece.id
              const anchor = anchors[piece.id]
              const scale = anchor ? (RACK_SIZE[kindOf(piece)] * layout.size) / anchor.size : 0
              return (
                <button
                  key={piece.id}
                  type="button"
                  aria-label={piece.name ? `Select ${piece.name}. Shift and arrow keys move it along the rail.` : 'Empty wooden hanger'}
                  onClick={() => {
                    if (!suppressClick.current && piece.image) selectPiece(piece.id)
                  }}
                  onPointerDown={(event) => piece.image && startGesture(event, piece.id)}
                  onPointerMove={(event) => moveGesture(event, piece.id)}
                  onPointerUp={(event) => endGesture(event, piece.id)}
                  onPointerCancel={(event) => endGesture(event, piece.id)}
                  onPointerEnter={(event) => {
                    if (event.pointerType !== 'touch' && !gesture.current?.moved) setHoveredId(piece.id)
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType !== 'touch') setHoveredId((current) => current === piece.id ? null : current)
                  }}
                  onFocus={() => setHoveredId(piece.id)}
                  onBlur={() => setHoveredId((current) => current === piece.id ? null : current)}
                  onKeyDown={(event) => handleKeyDown(event, piece.id)}
                  // The button's top edge sits 3cqw above the rod, so its pivot (below) is the point where the hook rests.
                  className={`group absolute block min-w-[44px] select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-text-primary/50 ${held ? 'z-[60] cursor-grabbing' : facing ? 'z-[45] cursor-grab' : 'z-40 cursor-grab'}`}
                  style={{
                    left: `${held ? carried.x : layout.positions[index]}%`,
                    top: `${layout.rodY - 3}cqw`,
                    width: `${layout.spacing}%`,
                    height: `${layout.reach + 3}cqw`,
                    transform: 'translateX(-50%)',
                    perspective: '1100px',
                    // Neighbours glide aside; the carried one tracks the pointer with no lag, then glides home on release.
                    transition: held ? 'none' : 'left 560ms cubic-bezier(0.22, 1, 0.36, 1)',
                    touchAction: 'pan-y',
                  }}
                >
                  {/* Zero-size pivot on the rod: the hanger turns about the hook, as it would on a real rail. */}
                  <div
                    className="pointer-events-none absolute left-1/2 top-[3cqw] h-0 w-0"
                    style={{
                      transform: held
                        ? `translateY(${carried.lift}cqw) rotateY(0deg) rotateZ(${carried.tilt}deg) translateZ(14px)`
                        : `rotateY(${facing ? 0 : 54}deg) rotateZ(${facing ? '-1.5deg' : '0deg'}) translateZ(${facing ? '12px' : '0px'})`,
                      transformStyle: 'preserve-3d',
                      transition: held ? 'transform 200ms ease-out' : 'transform 760ms cubic-bezier(0.2, 0.75, 0.2, 1)',
                      willChange: 'transform',
                    }}
                  >
                    {piece.image && (
                      <img
                        ref={(element) => {
                          if (element?.complete && element.naturalWidth && !anchors[piece.id]) registerAnchor(piece.id, element)
                        }}
                        src={piece.image}
                        alt={piece.imageAlt ?? `${piece.name} on a wooden hanger`}
                        draggable={false}
                        onLoad={(event) => registerAnchor(piece.id, event.currentTarget)}
                        className="pointer-events-none absolute max-w-none select-none"
                        style={{
                          opacity: anchor ? 1 : 0,
                          left: anchor ? `${-anchor.hookX * scale}cqw` : 0,
                          top: anchor ? `${-anchor.restY * scale}cqw` : 0,
                          width: anchor ? `${anchor.width * scale}cqw` : undefined,
                          height: anchor ? `${anchor.height * scale}cqw` : undefined,
                          transform: 'translateZ(1px)',
                          filter: held ? 'drop-shadow(0 22px 22px rgba(42,34,24,0.26))' : 'drop-shadow(0 10px 14px rgba(42,34,24,0.22))',
                          transition: 'opacity 300ms, filter 200ms',
                          backfaceVisibility: 'hidden',
                        }}
                      />
                    )}
                    {!piece.image && (
                      <img
                        src="/images/wooden-hanger-cutout.png"
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        className="pointer-events-none absolute -left-[5.5cqw] -top-[1.5cqw] w-[11cqw] max-w-none select-none object-contain drop-shadow-[0_5px_5px_rgba(48,36,24,0.18)]"
                      />
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* The rail keeps the artwork's proportions (a stretched rod squashes its finials), centred on the rod line. */}
          {[{ label: 'Muted antique-gold clothes rail with curled ends', z: 'z-10' }, { label: '', z: 'z-50' }].map(({ label, z }) => (
            <div
              key={z}
              className={`pointer-events-none absolute ${z}`}
              style={{ left: `${(100 - ROD_WIDTH) / 2}%`, top: `${layout.rodY}cqw`, width: `${ROD_WIDTH}%`, height: 0 }}
            >
              <img
                src="/images/landing-antique-gold-rod.svg"
                alt={label}
                aria-hidden={label ? undefined : true}
                draggable={false}
                className="absolute left-0 top-0 w-full max-w-none select-none"
                style={{
                  aspectRatio: `${ROD_VIEWBOX.width} / ${ROD_VIEWBOX.height}`,
                  transform: `translateY(-${(ROD_VIEWBOX.railY / ROD_VIEWBOX.height) * 100}%)`,
                  ...(label ? { filter: 'drop-shadow(0 2px 3px rgba(35,31,25,0.14))' } : {}),
                }}
              />
            </div>
          ))}
        </div>
      </div>
      {selectedPiece && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#151713]/55 p-4 backdrop-blur-sm" onClick={() => setSelectedId(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="outfit-detail-title" className="relative grid max-h-[90svh] w-[min(94vw,52rem)] grid-cols-1 overflow-hidden rounded-3xl border border-[#355f43]/20 bg-[#faf8f1] shadow-[0_24px_80px_rgba(16,20,16,0.3)] sm:grid-cols-2" onClick={(event) => event.stopPropagation()}>
            <button type="button" aria-label="Close outfit details" onClick={() => setSelectedId(null)} className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-[#faf8f1]/90 text-2xl leading-none text-[#243d2c] shadow">×</button>
            <div className="flex min-h-0 items-center justify-center bg-[#f0eee8] p-4 sm:max-h-[90svh]">
              <img src={selectedPiece.detailImage} alt={selectedPiece.detailAlt ?? `${selectedPiece.name} complete look`} className="max-h-[44svh] w-full object-contain sm:max-h-[78svh]" />
            </div>
            <div className="flex min-h-0 flex-col justify-center overflow-y-auto p-6 sm:p-9">
              <p className="text-xs uppercase tracking-[0.22em] text-[#777364]">Complete look</p>
              <h2 id="outfit-detail-title" className="mt-3 font-display text-2xl text-[#243d2c]">{selectedPiece.name}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#665f52]">Clothing and matching accessories detected in your outfit photo.</p>
              <ul className="mt-5 space-y-2 text-sm text-[#383b32]">
                {selectedPiece.details?.map((detail) => <li key={detail} className="flex gap-2"><span className="text-[#355f43]">•</span>{detail}</li>)}
              </ul>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  )
}
