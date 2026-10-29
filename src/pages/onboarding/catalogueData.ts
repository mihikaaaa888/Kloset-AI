import type { ClothingCategory, StylePreference } from '@/types'

export interface CataloguePickItem {
  id: string
  label: string
  category: ClothingCategory
  subcategory: string
  imageUrl: string
  /** Store the photo comes from, shown on the card. */
  brand: 'H&M' | 'Myntra' | 'Newme'
  productUrl: string
  fallbackColor: string
  style: StylePreference[]
  colour: string
  tags: string[]
}

// Gen Z pieces with real product photos from H&M, Myntra and Newme — the same stores the shop uses.
// Ids are saved on the profile and read by the stylist chat, so change them with care.
export const CATALOGUE_ITEMS: CataloguePickItem[] = [
  // ── TOPS ──
  { id: 'top-baby-tee', label: 'Baby Tee', category: 'tops', subcategory: 'tshirts', brand: 'Myntra', colour: 'Blue',
    imageUrl: 'https://assets.myntassets.com/h_200,w_200,c_fill,g_auto/h_1440,q_75,w_1080/v1/assets/images/2025/JUNE/16/UY02OVgH_4cd40526f08a4749b88c9628cc8c867e.jpg',
    productUrl: 'https://www.myntra.com/tops/bonkerscorner/bonkers-corner-women-my-little-teddy-baby-tee-printed-pure-cotton-crop-top/34957843/buy',
    fallbackColor: '#5B8BD9', style: ['eclectic', 'streetwear'], tags: ['y2k', 'cropped', 'graphic', 'casual'] },
  { id: 'top-corset', label: 'Corset Top', category: 'tops', subcategory: 'tops', brand: 'H&M', colour: 'Black',
    imageUrl: 'https://image.hm.com/assets/hm/f6/90/f690eb3a9c8d1d6a7b8be91c90707a35015ca8f6.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_us/productpage.1361994001.html',
    fallbackColor: '#1F1F1F', style: ['romantic', 'eclectic'], tags: ['corset', 'going-out', 'fitted'] },
  { id: 'top-oversized-shirt', label: 'Striped Oversized Shirt', category: 'tops', subcategory: 'shirts', brand: 'H&M', colour: 'Blue/White',
    imageUrl: 'https://image.hm.com/assets/001/b1/75/b175857837778d12815a1931f19cf87a9146f21d.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_gb/productpage.1166332001.html',
    fallbackColor: '#8FA6CC', style: ['minimalist', 'classic', 'streetwear'], tags: ['oversized', 'striped', 'layering'] },
  { id: 'top-cropped-cardigan', label: 'Cropped Cardigan', category: 'tops', subcategory: 'knitwear', brand: 'H&M', colour: 'Grey',
    imageUrl: 'https://image.hm.com/assets/hm/09/dd/09ddbf01aedc16abf8876ccd685038d82e3dd9cf.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_us/productpage.1366274002.html',
    fallbackColor: '#5A5A5E', style: ['minimalist', 'classic'], tags: ['cropped', 'knit', 'cosy', 'layering'] },
  { id: 'top-bow', label: 'Bow Cami', category: 'tops', subcategory: 'tops', brand: 'Newme', colour: 'Black',
    imageUrl: 'https://assets.newme.asia/wp-content/uploads/2025/12/08123404cec35d4f/NM-IN-56-BLS-24-DEC-12213-BLACK_(1).webp',
    productUrl: 'https://newme.asia/product/black-bow-detail-top',
    fallbackColor: '#1F1F1F', style: ['romantic', 'eclectic'], tags: ['coquette', 'bows', 'going-out'] },
  { id: 'top-cable-knit', label: 'Cable Knit Sweater', category: 'tops', subcategory: 'knitwear', brand: 'Newme', colour: 'Cream',
    imageUrl: 'https://assets.newme.asia/wp-content/uploads/2024/08/24093437d2e60ed2/NM-PRC-162-STR-24-AUG-8505-CREAM(1).webp',
    productUrl: 'https://newme.asia/product/cream-cable-knit-cropped-sweater',
    fallbackColor: '#EDE3CF', style: ['classic', 'minimalist'], tags: ['old money', 'knit', 'cropped', 'cosy'] },
  // ── BOTTOMS ──
  { id: 'bottom-baggy-jeans', label: 'Baggy Jeans', category: 'bottoms', subcategory: 'jeans', brand: 'H&M', colour: 'Blue',
    imageUrl: 'https://image.hm.com/assets/hm/18/c8/18c841361c08ca7323d4232bc42ddd0a23b14266.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_us/productpage.1208532022.html',
    fallbackColor: '#6E8DB5', style: ['streetwear', 'minimalist'], tags: ['baggy', 'denim', 'casual'] },
  { id: 'bottom-flared-jeans', label: 'Flared Jeans', category: 'bottoms', subcategory: 'jeans', brand: 'H&M', colour: 'Light Blue',
    imageUrl: 'https://image.hm.com/assets/hm/09/d6/09d6b9b4317ec6f4872796307f79b032fbd0be0f.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_ca/productpage.1302894016.html',
    fallbackColor: '#A9C1DA', style: ['eclectic', 'bohemian'], tags: ['flared', 'denim', 'y2k'] },
  { id: 'bottom-cargos', label: 'Parachute Cargos', category: 'bottoms', subcategory: 'trousers', brand: 'H&M', colour: 'Khaki',
    imageUrl: 'https://image.hm.com/assets/hm/a5/c0/a5c079a6e5bd2c02576dbbbc68fe3eaa976dd960.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_asia1/productpage.1214167009.html',
    fallbackColor: '#6B6F5A', style: ['streetwear', 'athleisure'], tags: ['cargo', 'baggy', 'utility'] },
  { id: 'bottom-tennis-skirt', label: 'Tennis Skirt', category: 'bottoms', subcategory: 'skirts', brand: 'H&M', colour: 'Light Blue',
    imageUrl: 'https://image.hm.com/assets/hm/fb/ab/fbab0e3cf2959c0043d36e4519ab197b2a3e94af.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_us/productpage.1266486003.html',
    fallbackColor: '#A9C4F0', style: ['athleisure', 'romantic'], tags: ['pleated', 'mini', 'sporty'] },
  { id: 'bottom-denim-mini', label: 'Denim Mini Skirt', category: 'bottoms', subcategory: 'skirts', brand: 'Myntra', colour: 'Grey',
    imageUrl: 'https://assets.myntassets.com/h_200,w_200,c_fill,g_auto/h_1440,q_75,w_1080/v1/assets/images/2024/OCTOBER/29/SudicCLQ_91a7a66473334f18bda5ecff538db86e.jpg',
    productUrl: 'https://www.myntra.com/skirts/lulu+%26+sky/lulu--sky-women-washed-a-line-mini-denim-skirts/31449011/buy',
    fallbackColor: '#7A7F86', style: ['streetwear', 'eclectic'], tags: ['denim', 'mini', 'y2k'] },
  // ── DRESSES ──
  { id: 'dress-slip', label: 'Satin Slip Dress', category: 'dresses', subcategory: 'slip-dresses', brand: 'H&M', colour: 'Cream',
    imageUrl: 'https://image.hm.com/assets/hm/17/be/17be03f58a1f432200b59df09c082522c3c064ef.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_ph/productpage.1235183004.html',
    fallbackColor: '#F1E6D2', style: ['minimalist', 'romantic'], tags: ['satin', 'slip', 'evening'] },
  { id: 'dress-bow-mini', label: 'Bow Mini Dress', category: 'dresses', subcategory: 'mini', brand: 'Myntra', colour: 'Black/White',
    imageUrl: 'https://assets.myntassets.com/h_200,w_200,c_fill,g_auto/h_1440,q_100,w_1080/v1/assets/images/2025/APRIL/24/bN8bFJqF_64030232a5724826840eef6d3edb9c73.jpg',
    productUrl: 'https://www.myntra.com/dresses/lulu26sky/lulu--sky-strapless-bow-detailed-bodycon-mini-dress/26525354/buy',
    fallbackColor: '#1F1F1F', style: ['romantic', 'eclectic'], tags: ['bodycon', 'bows', 'party'] },
  { id: 'dress-sundress', label: 'Floral Sundress', category: 'dresses', subcategory: 'midi', brand: 'H&M', colour: 'Yellow',
    imageUrl: 'https://image.hm.com/assets/hm/2d/8b/2d8b7f7b6d26a9fc3eeba1b4e773ad4d2f9e2193.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_us/productpage.1345870001.html',
    fallbackColor: '#F2DC8C', style: ['bohemian', 'romantic'], tags: ['floral', 'summer', 'flowy'] },
  { id: 'dress-linen-coord', label: 'Linen Co-ord', category: 'dresses', subcategory: 'co-ords', brand: 'Myntra', colour: 'Olive',
    imageUrl: 'https://assets.myntassets.com/h_200,w_200,c_fill,g_auto/h_1440,q_100,w_1080/v1/assets/images/32274331/2025/1/9/4fa6e774-b88a-451b-ad98-bea34718d6251736417438730Co-Ords1.jpg',
    productUrl: 'https://www.myntra.com/co-ords/rimore/women-solid-linen-top-and-trousers-co-ord-set/32274331/buy',
    fallbackColor: '#7C7A55', style: ['minimalist', 'classic'], tags: ['co-ord', 'linen', 'matching set'] },
  // ── OUTERWEAR ──
  { id: 'outer-oversized-blazer', label: 'Oversized Blazer', category: 'outerwear', subcategory: 'blazers', brand: 'H&M', colour: 'Light Blue',
    imageUrl: 'https://image.hm.com/assets/hm/5b/4d/5b4dff898060761c59ea0e45d58354c1891f841a.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_ph/productpage.1207065006.html',
    fallbackColor: '#9DB9DD', style: ['business', 'classic'], tags: ['oversized', 'tailored', 'office'] },
  { id: 'outer-leather-jacket', label: 'Leather Biker Jacket', category: 'outerwear', subcategory: 'jackets', brand: 'H&M', colour: 'Brown',
    imageUrl: 'https://image.hm.com/assets/003/99/85/9985299b38b6ec9d38c1411931ea9a40a00c7734.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_gb/productpage.1216243001.html',
    fallbackColor: '#4A3328', style: ['streetwear', 'eclectic'], tags: ['faux leather', 'biker', 'edgy'] },
  // ── SHOES ──
  { id: 'shoes-chunky-sneakers', label: 'Chunky Sneakers', category: 'shoes', subcategory: 'sneakers', brand: 'H&M', colour: 'Silver',
    imageUrl: 'https://image.hm.com/assets/hm/16/f7/16f7f7238cc59221d8a2b7e3d6848d8a67bb04a6.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_us/productpage.1208972002.html',
    fallbackColor: '#C9C9CC', style: ['streetwear', 'athleisure'], tags: ['chunky', 'dad shoe', 'everyday'] },
  { id: 'shoes-ballet-flats', label: 'Ballet Flats', category: 'shoes', subcategory: 'flats', brand: 'H&M', colour: 'Black/Cream',
    imageUrl: 'https://image.hm.com/assets/hm/d3/1d/d31dec2933571d898d621470651b28d27bbc0e41.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_us/productpage.1219404016.html',
    fallbackColor: '#1F1F1F', style: ['classic', 'romantic', 'minimalist'], tags: ['balletcore', 'flats'] },
  { id: 'shoes-mary-janes', label: 'Mary Janes', category: 'shoes', subcategory: 'flats', brand: 'H&M', colour: 'Black',
    imageUrl: 'https://image.hm.com/assets/hm/f2/29/f229f1c4baaaff7c88c8a02362163dda8f754d40.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_us/productpage.1295842001.html',
    fallbackColor: '#1F1F1F', style: ['romantic', 'eclectic'], tags: ['mary jane', 'coquette'] },
  // ── ACCESSORIES ──
  { id: 'acc-shoulder-bag', label: 'Shoulder Bag', category: 'accessories', subcategory: 'bags', brand: 'H&M', colour: 'Black',
    imageUrl: 'https://image.hm.com/assets/hm/e5/9c/e59cde99f6d2d51d5d52e63f061bede94539ee12.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_us/productpage.1358746001.html',
    fallbackColor: '#1F1F1F', style: ['minimalist', 'classic'], tags: ['bag', 'everyday'] },
  { id: 'acc-denim-bag', label: 'Denim Baguette Bag', category: 'accessories', subcategory: 'bags', brand: 'H&M', colour: 'Black Denim',
    imageUrl: 'https://image.hm.com/assets/hm/61/77/61770f3166f66ea2f0aca523f37dbf8f428c4bfe.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_us/productpage.1240232002.html',
    fallbackColor: '#3C3C40', style: ['eclectic', 'streetwear'], tags: ['baguette', 'y2k', 'bag'] },
  { id: 'acc-gold-hoops', label: 'Gold Hoops', category: 'accessories', subcategory: 'jewellery', brand: 'H&M', colour: 'Gold',
    imageUrl: 'https://image.hm.com/assets/hm/2d/24/2d2408f2cf8d39e53ec51de60cde2a0df2ccbd5f.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_us/productpage.1337141001.html',
    fallbackColor: '#D4AF37', style: ['classic', 'minimalist', 'streetwear'], tags: ['hoops', 'jewellery', 'statement'] },
  { id: 'acc-rectangle-shades', label: 'Rectangle Shades', category: 'accessories', subcategory: 'sunglasses', brand: 'H&M', colour: 'Burgundy',
    imageUrl: 'https://image.hm.com/assets/hm/f8/d6/f8d6d8a6660dc3fd2b81a3a03ad57feff680ef76.jpg?imwidth=1260',
    productUrl: 'https://www2.hm.com/en_ie/productpage.1270166002.html',
    fallbackColor: '#5A1F24', style: ['eclectic', 'streetwear'], tags: ['sunglasses', 'y2k', '90s'] },
]

export const CATALOGUE_CATEGORIES: { value: ClothingCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
]
