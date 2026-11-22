import { ALL_BRANDS, brandKey } from '@/lib/brands'
import { COLOUR_PALETTE } from '@/lib/colourUtils'

// Suggestions as you type in Add item → Browse, like a search engine's:
// "j" → jeans, jacket, jumpsuit, Jack & Jones…; "black j" → black jeans,
// black jacket… Built on the device from clothing words, colours and the
// brand directory, so typing costs no searches.

const PIECES = [
  'jeans', 'jacket', 'jumpsuit', 'jumper', 'joggers', 'denim jacket', 'leather jacket', 'bomber jacket',
  't-shirt', 'shirt', 'blouse', 'top', 'tank top', 'crop top', 'corset top', 'bodysuit', 'polo shirt',
  'kurta', 'kurti', 'saree', 'lehenga', 'anarkali', 'co-ord set',
  'dress', 'midi dress', 'maxi dress', 'mini dress', 'slip dress', 'shirt dress',
  'skirt', 'mini skirt', 'midi skirt', 'trousers', 'wide-leg pants', 'cargo pants', 'chinos', 'shorts', 'leggings',
  'blazer', 'coat', 'trench coat', 'cardigan', 'sweater', 'hoodie', 'sweatshirt', 'shacket', 'vest',
  'sneakers', 'loafers', 'heels', 'block heels', 'boots', 'ankle boots', 'sandals', 'ballet flats', 'mules', 'flip flops',
  'tote bag', 'crossbody bag', 'handbag', 'shoulder bag', 'backpack', 'clutch', 'belt', 'earrings', 'necklace',
  'bracelet', 'ring', 'sunglasses', 'watch', 'scarf', 'cap', 'hat',
]
const COLOURS = COLOUR_PALETTE.map((colour) => colour.name.toLowerCase())

/** Up to `limit` suggestions for what's typed so far, best first. */
export function imageSearchSuggestions(input: string, limit = 6): string[] {
  const typed = input.toLowerCase().replace(/\s+/g, ' ').trimStart()
  if (!typed.trim()) return []
  const words = typed.split(' ')
  const last = words[words.length - 1]
  const before = words.slice(0, -1).join(' ')
  const out: string[] = []
  const add = (value: string) => { if (value.trim() && value.trim() !== typed.trim() && !out.includes(value.trim())) out.push(value.trim()) }

  // A finished first word followed by a start ("black j", "zara bla"): complete the last word.
  if (before && last) {
    for (const piece of PIECES) if (piece.startsWith(last)) add(`${before} ${piece}`)
    for (const colour of COLOURS) if (colour.startsWith(last)) add(`${before} ${colour}`)
  }
  // The whole thing as a start: pieces, brands, then colours.
  for (const piece of PIECES) if (piece.startsWith(typed.trim())) add(piece)
  const key = brandKey(typed)
  if (key) for (const brand of ALL_BRANDS) if (brandKey(brand).startsWith(key)) add(brand)
  for (const colour of COLOURS) if (colour.startsWith(typed.trim())) add(`${colour} ${typed.trim() === colour ? 'dress' : ''}`)
  // A brand or colour on its own ("zara ", "black"): suggest it with pieces.
  if (!last && before) for (const piece of ['dress', 'jeans', 'shirt', 'sneakers', 'bag']) add(`${before} ${piece}`)
  // Anything containing it ("leg" → wide-leg pants).
  if (typed.trim().length >= 3) for (const piece of PIECES) if (piece.includes(typed.trim())) add(piece)
  return out.slice(0, limit)
}
