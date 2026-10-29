import { useState } from 'react'
import type { PointerEvent, RefObject } from 'react'
import { createPortal } from 'react-dom'

type RackPiece = {
  id: string
  name?: string
  image?: string
  imageAlt?: string
  detailImage?: string
  detailAlt?: string
  details?: string[]
  outerwear?: boolean
  warmWeather?: boolean
  left: number
}

const RACK_POSITIONS = [20.25, 28.75, 37.25, 45.75, 54.25, 62.75, 71.25, 79.75]
const OUTFITS: Omit<RackPiece, 'left'>[] = [
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
    id: 'burgundy-shirt-white-trousers',
    name: 'Burgundy Shirt & White Trousers',
    image: '/images/burgundy-shirt-white-trousers-on-hanger.png',
    imageAlt: 'Burgundy button-up shirt with white trousers on one wooden hanger',
    detailImage: '/images/burgundy-shirt-look-reference.png',
    detailAlt: 'Burgundy button-up shirt with white trousers',
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

/** Crop transparent padding so a photo's original canvas dimensions don't set how large it looks on the rack. */
function normalizeTransparentImageBounds(image: HTMLImageElement) {
  if (image.dataset.boundsNormalized === 'true' || !image.naturalWidth || !image.naturalHeight) return
  image.dataset.boundsNormalized = 'true'

  try {
    const source = document.createElement('canvas')
    source.width = image.naturalWidth
    source.height = image.naturalHeight
    const context = source.getContext('2d', { willReadFrequently: true })
    if (!context) return
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, source.width, source.height).data
    let left = source.width
    let top = source.height
    let right = -1
    let bottom = -1

    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        if (pixels[(y * source.width + x) * 4 + 3] <= 20) continue
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
    }

    if (right < left || (left === 0 && top === 0 && right === source.width - 1 && bottom === source.height - 1)) return
    const cropped = document.createElement('canvas')
    cropped.width = right - left + 1
    cropped.height = bottom - top + 1
    cropped.getContext('2d')?.drawImage(source, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height)
    image.src = cropped.toDataURL('image/png')
  } catch {
    // If the browser cannot read the asset canvas, the fixed image slot still prevents it from exceeding rack bounds.
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

function createInitialPieces(): RackPiece[] {
  const outerwear = OUTFITS.filter((outfit) => outfit.outerwear)
  const warmLooks = OUTFITS.filter((outfit) => outfit.warmWeather)
  const season = getSeason()
  const maxOuterwear = season === 'cold' ? 4 : 2
  const minWarmLooks = season === 'warm' ? 4 : 0
  const maxWarmLooks = season === 'warm' ? 6 : 2
  const chosenOuterwear = shuffle(outerwear).slice(0, season === 'cold' ? 4 : 1 + Math.floor(Math.random() * maxOuterwear))
  const chosenWarmLooks = shuffle(warmLooks.filter((look) => !chosenOuterwear.some((piece) => piece.id === look.id)))
    .slice(0, minWarmLooks)
  const chosen = [...chosenOuterwear, ...chosenWarmLooks]
  const remaining = shuffle(OUTFITS.filter((outfit) => !chosen.some((piece) => piece.id === outfit.id)))

  for (const outfit of remaining) {
    if (chosen.length === RACK_POSITIONS.length) break
    const outerwearCount = chosen.filter((piece) => piece.outerwear).length
    const warmCount = chosen.filter((piece) => piece.warmWeather).length
    if (outfit.outerwear && outerwearCount >= maxOuterwear) continue
    if (outfit.warmWeather && warmCount >= maxWarmLooks) continue
    chosen.push(outfit)
  }

  return shuffle(chosen).map((piece, index) => ({ ...piece, left: RACK_POSITIONS[index] }))
}

interface InteractiveRackHeroProps {
  onRackInteract?: () => void
  immersed?: boolean
  sceneRef?: RefObject<HTMLDivElement>
}

/** A lightweight, interactive landing hero built around the user's real rack. */
export function InteractiveRackHero({ onRackInteract, immersed = false, sceneRef }: InteractiveRackHeroProps) {
  const [pieces, setPieces] = useState(createInitialPieces)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const selectedPiece = pieces.find((piece) => piece.id === selectedId && piece.image)

  const trackPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = (event.clientY - bounds.top) / bounds.height
    if (y < 0.14 || y > 0.9) {
      setHoveredId(null)
      return
    }
    const nearestPiece = pieces.reduce((nearest, piece) =>
      Math.abs(piece.left - x) < Math.abs(nearest.left - x) ? piece : nearest,
    )
    setHoveredId(Math.abs(nearestPiece.left - x) < 6.2 ? nearestPiece.id : null)
  }

  const selectPiece = (id: string) => {
    setSelectedId(id)
    onRackInteract?.()
  }

  const movePiece = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return
    setPieces((current) => {
      const from = current.findIndex((piece) => piece.id === draggedId)
      const to = current.findIndex((piece) => piece.id === targetId)
      if (from < 0 || to < 0) return current
      const next = [...current]
      const [piece] = next.splice(from, 1)
      next.splice(to, 0, piece)
      return next.map((item, index) => ({ ...item, left: 20.25 + index * 8.5 }))
    })
    setDraggedId(null)
    onRackInteract?.()
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
        <div className="relative aspect-[2/1] w-[min(96vw,172svh)]" style={{ transform: 'translateY(clamp(14px, 2.5svh, 32px))' }}>
          {/* Keep the rack behind the hanger and outfit; the transparent hanger hook wraps over the rod. */}
          <div className="absolute inset-0" onPointerMove={trackPointer} onPointerLeave={() => setHoveredId(null)}>
            {pieces.map((piece, index) => {
              const selected = selectedId === piece.id
              const facing = hoveredId === piece.id
              return (
                <button
                  key={piece.id}
                  type="button"
                  draggable
                  aria-label={piece.name ? `Select ${piece.name}` : 'Empty wooden hanger'}
                  onClick={() => piece.image && selectPiece(piece.id)}
                  onPointerEnter={(event) => {
                    if (event.pointerType !== 'touch') setHoveredId(piece.id)
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType !== 'touch') setHoveredId((current) => current === piece.id ? null : current)
                  }}
                  onFocus={() => setHoveredId(piece.id)}
                  onBlur={() => setHoveredId((current) => current === piece.id ? null : current)}
                  onDragStart={(event) => {
                    if (!piece.image) {
                      event.preventDefault()
                      return
                    }
                    setDraggedId(piece.id)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', piece.id)
                  }}
                  onDragEnd={() => setDraggedId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    movePiece(piece.id)
                  }}
                  className={`group absolute top-[10.4%] block ${piece.image ? 'h-[90%] w-[clamp(100px,13vw,160px)]' : 'aspect-square w-[clamp(42px,7.8vw,118px)]'} rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-text-primary/50 ${piece.image ? 'z-40' : hoveredId === piece.id || selected ? 'z-30' : 'z-20'} ${draggedId === piece.id ? 'opacity-50' : 'opacity-100'}`}
                  style={{
                    left: `${piece.left}%`,
                    transform: 'translateX(-50%)',
                    perspective: '1100px',
                    animationDelay: `${index * 120}ms`,
                  }}
                >
                  <div
                    className="pointer-events-none relative h-full w-full"
                    style={{
                      transform: `rotateY(${facing ? 0 : 54}deg) rotateZ(${facing ? '-1.5deg' : '0deg'}) translateZ(${facing ? '12px' : '0px'})`,
                      // The top of the rack image has a little transparent
                      // padding: this pivot lines up with the rod's centre,
                      // keeping the hanger hooked on the bar as it rotates.
                      // Pivot at the rod's actual vertical center so the embedded hook
                      // turns around the bar instead of swinging from a point above it.
                      transformOrigin: '50% 4.7%',
                      transformStyle: 'preserve-3d',
                      transition: 'transform 760ms cubic-bezier(0.2, 0.75, 0.2, 1)',
                      willChange: 'transform',
                    }}
                  >
                    {piece.image && (
                      <img
                        src={piece.image}
                        alt={piece.imageAlt ?? `${piece.name} on a wooden hanger`}
                        draggable={false}
                        onLoad={(event) => normalizeTransparentImageBounds(event.currentTarget)}
                        className="pointer-events-none absolute left-1/2 top-0 h-[82%] w-full -translate-x-1/2 select-none object-contain object-top"
                        style={{
                          transform: 'translateX(-50%) translateZ(1px)',
                          transformOrigin: 'top center',
                          filter: 'drop-shadow(0 10px 14px rgba(42,34,24,0.22))',
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
                        className="pointer-events-none absolute left-0 top-0 z-0 w-full select-none object-contain drop-shadow-[0_5px_5px_rgba(48,36,24,0.18)]"
                      />
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <img
            src="/images/landing-antique-gold-rod.svg"
            alt="Muted antique-gold clothes rail with curled ends"
            className="pointer-events-none absolute left-1/2 top-[9.5%] z-10 h-[6%] w-[104%] -translate-x-1/2 select-none object-fill drop-shadow-[0_2px_3px_rgba(35,31,25,0.14)]"
            draggable={false}
          />
          {/* Front pass visually seats each metal hook against the rod. */}
          <img
            src="/images/landing-antique-gold-rod.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[9.5%] z-50 h-[6%] w-[104%] -translate-x-1/2 select-none object-fill"
            draggable={false}
          />
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
