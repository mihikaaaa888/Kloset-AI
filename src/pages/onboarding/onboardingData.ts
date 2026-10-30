import {
  Briefcase, CalendarDays, CalendarRange, Camera, Coffee, Croissant, Dumbbell, GraduationCap,
  Hand, Heart, Hourglass, Laptop, PartyPopper, Plane, Rocket, Sparkles, Sun, type LucideIcon,
} from 'lucide-react'
import type { StylePreference, Occasion, RecommendationFrequency, UserProfile } from '@/types'
export { COLOUR_PALETTE } from '@/lib/colourUtils'

// Gen Z aesthetics people actually pick, each shown with a real product photo from the
// retailers the shop uses. Each card still saves one of the existing StylePreference values,
// so the stylist and shop keep working.
export const styleOptions: {
  value: StylePreference
  label: string
  description: string
  imageUrl: string
  /** Where the photo comes from, shown on the card. */
  brand: 'H&M' | 'Myntra' | 'Newme'
  productUrl: string
  accent: string
}[] = [
  {
    value: 'minimalist',
    label: 'Clean Girl',
    description: 'Ribbed basics, neutrals, slick bun',
    imageUrl: 'https://image.hm.com/assets/hm/0f/52/0f520d4e3ebf881c3d95c5f1df62587620f6063c.jpg?imwidth=1260',
    brand: 'H&M',
    productUrl: 'https://www2.hm.com/en_ph/productpage.1250800006.html',
    accent: '#EDE8E0',
  },
  {
    value: 'classic',
    label: 'Old Money',
    description: 'Linen, knits, quiet luxury',
    imageUrl: 'https://assets.myntassets.com/h_200,w_200,c_fill,g_auto/h_1440,q_75,w_1080/v1/assets/images/2025/APRIL/15/vNOGKeZ3_a57741f249af4926b982b2d2b8b5a2ad.jpg',
    brand: 'Myntra',
    productUrl: 'https://www.myntra.com/trousers/marksspencer/marks--spencer-women-high-rise-wide-leg-trousers/33621826/buy',
    accent: '#D4C9BE',
  },
  {
    value: 'business',
    label: 'Office Siren',
    description: 'Sharp blazers, pencil skirts',
    imageUrl: 'https://image.hm.com/assets/hm/44/8a/448a33d9afef8202b096bf11a620e91be02bb830.jpg?imwidth=1260',
    brand: 'H&M',
    productUrl: 'https://www2.hm.com/en_us/productpage.1342217001.html',
    accent: '#3A3A3A',
  },
  {
    value: 'romantic',
    label: 'Coquette',
    description: 'Bows, lace, soft pink',
    imageUrl: 'https://assets.newme.asia/wp-content/uploads/2024/12/04105231af806c55/NM-PRC-34-BLS-24-NOV-13085-LIGHTPINK(1).webp',
    brand: 'Newme',
    productUrl: 'https://newme.asia/product/light-pink-lace-halter-neck-bow-top',
    accent: '#F2D0D8',
  },
  {
    value: 'streetwear',
    label: 'Streetwear',
    description: 'Baggy cargos, graphic tees',
    imageUrl: 'https://assets.newme.asia/wp-content/uploads/2023/06/02114405/NM-PRC-34-TSH-23-MAY-115-PINK-1.webp',
    brand: 'Newme',
    productUrl: 'https://newme.asia/product/graphic-baby-tee',
    accent: '#B9B49A',
  },
  {
    value: 'eclectic',
    label: 'Y2K',
    description: 'Baby tees, tinted shades, 2000s fun',
    imageUrl: 'https://assets.newme.asia/wp-content/uploads/2023/12/01122007/NM-IN-50-TSH-23-NOV-206-WHITE-1-scaled.webp',
    brand: 'Newme',
    productUrl: 'https://newme.asia/product/white-blue-graphic-baby-tee',
    accent: '#C8D4F0',
  },
  {
    value: 'bohemian',
    label: 'Boho',
    description: 'Crochet, fringe, earthy layers',
    imageUrl: 'https://assets.newme.asia/wp-content/uploads/2024/05/23101314a58a73ee/NM-PRC-145-BLS-24-MAY-5680-CREAM(1).webp',
    brand: 'Newme',
    productUrl: 'https://newme.asia/product/cream-fringe-detail-crochet-top',
    accent: '#C9B89A',
  },
  {
    value: 'athleisure',
    label: 'Sporty',
    description: 'Matching sets, gym to brunch',
    imageUrl: 'https://assets.myntassets.com/h_200,w_200,c_fill,g_auto/h_1440,q_75,w_1080/v1/assets/images/30103889/2024/7/3/e7b95fc9-ab78-4268-8f6a-140dd38f38c31719998796609PoftikSportsBraYogaPantGymOutfitTracksuit1.jpg',
    brand: 'Myntra',
    productUrl: 'https://www.myntra.com/tracksuits/poftik/poftik-sports-bra-yoga-pant-gym-outfit-tracksuit/30103889/buy',
    accent: '#B8C8E0',
  },
]

// Labels are what people actually dress for; values stay the stored Occasion ids.
export const occasionOptions: { value: Occasion; label: string; icon: LucideIcon }[] = [
  { value: 'casual', label: 'Everyday', icon: Coffee },
  { value: 'work', label: 'Work', icon: Briefcase },
  { value: 'weekend', label: 'Brunch & cafés', icon: Croissant },
  { value: 'date-night', label: 'Dates', icon: Heart },
  { value: 'special-event', label: 'Parties', icon: PartyPopper },
  { value: 'formal', label: 'Weddings & festive', icon: Sparkles },
  { value: 'gym', label: 'Gym', icon: Dumbbell },
  { value: 'travel', label: 'Travel', icon: Plane },
]

// Saved as the label text on profile.occupation, which the stylist reads as-is.
export const occupationOptions: { label: string; icon: LucideIcon }[] = [
  { label: 'Student', icon: GraduationCap },
  { label: 'Working', icon: Briefcase },
  { label: 'Freelancer', icon: Laptop },
  { label: 'Creator', icon: Camera },
  { label: 'Founder', icon: Rocket },
  { label: 'Taking a break', icon: Hourglass },
]

export const frequencyOptions: { value: RecommendationFrequency; label: string; icon: LucideIcon }[] = [
  { value: 'daily', label: 'Daily', icon: Sun },
  { value: 'a-few-times-a-week', label: 'Few times a week', icon: CalendarDays },
  { value: 'weekly', label: 'Weekly', icon: CalendarRange },
  { value: 'on-demand', label: 'Only when I ask', icon: Hand },
]

export const genderStyleOptions: { value: NonNullable<UserProfile['genderStylePreference']>; label: string }[] = [
  { value: 'feminine', label: 'Feminine' },
  { value: 'masculine', label: 'Masculine' },
  { value: 'androgynous', label: 'Androgynous' },
  { value: 'no-preference', label: 'No preference' },
]
