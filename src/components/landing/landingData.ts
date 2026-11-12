/** Real Kloset garment photos (public/images) reused across the landing page demos. */
export interface LandingPiece {
  id: string
  name: string
  /** Transparent cutout on a hanger. */
  image: string
  /** The tags Kloset's photo analysis fills in, shown in the demos. */
  tags: string[]
}

export const PIECES: LandingPiece[] = [
  {
    id: 'knit',
    name: 'Burgundy rib-knit top',
    image: '/images/landing/sm/burgundy-rib-knit-top-on-hanger.webp',
    tags: ['Top', 'Burgundy', 'Rib knit', 'Smart casual'],
  },
  {
    id: 'wrap',
    name: 'Chartreuse buckle-wrap top',
    image: '/images/landing/sm/chartreuse-wrap-top-on-hanger.webp',
    tags: ['Top', 'Chartreuse', 'Sleeveless', 'Date night'],
  },
  {
    id: 'dress',
    name: 'Ivory floral midi dress',
    image: '/images/landing/sm/floral-midi-dress-on-hanger.webp',
    tags: ['Dress', 'Ivory', 'Floral', 'Brunch'],
  },
  {
    id: 'skirt',
    name: 'Red asymmetric skirt',
    image: '/images/landing/sm/red-asymmetric-skirt-on-hanger.webp',
    tags: ['Skirt', 'Red', 'Asymmetric', 'Party'],
  },
  {
    id: 'denim',
    name: 'Navy layers and denim',
    image: '/images/landing/sm/navy-denim-clothing-on-hanger.webp',
    tags: ['Set', 'Navy', 'Denim', 'Weekend'],
  },
  {
    id: 'trench',
    name: 'Chocolate leather trench',
    image: '/images/landing/sm/chocolate-leather-trench-on-hanger.webp',
    tags: ['Outerwear', 'Chocolate', 'Leather', 'Evening'],
  },
]

export const pieceById = (id: string): LandingPiece => PIECES.find((p) => p.id === id) ?? PIECES[0]
