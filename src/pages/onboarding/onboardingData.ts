import {
  Briefcase, CalendarDays, CalendarRange, Camera, Coffee, Croissant, Dumbbell, GraduationCap,
  Hand, Heart, Hourglass, Laptop, PartyPopper, Plane, Rocket, Sun, type LucideIcon,
} from 'lucide-react'
import type { Occasion, RecommendationFrequency, UserProfile } from '@/types'
export { COLOUR_PALETTE } from '@/lib/colourUtils'

export const occasionOptions: { value: Occasion; label: string; icon: LucideIcon }[] = [
  { value: 'casual', label: 'Everyday', icon: Coffee },
  { value: 'work', label: 'Work', icon: Briefcase },
  { value: 'weekend', label: 'Brunch & cafés', icon: Croissant },
  { value: 'date-night', label: 'Dates', icon: Heart },
  { value: 'special-event', label: 'Parties', icon: PartyPopper },
  { value: 'formal', label: 'Weddings & festive', icon: PartyPopper },
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
  { value: 'androgynous', label: 'Both' },
  { value: 'no-preference', label: 'No preference' },
]
