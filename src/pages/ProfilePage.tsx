import { useNavigate } from 'react-router-dom'
import { ThemePicker } from '@/components/ui/ThemeToggle'
import {
  Ban, Bell, Bookmark, Briefcase, CalendarHeart, Coffee, Compass, Dumbbell, Gem, Heart, Leaf,
  LogOut, Palette, PartyPopper, Pencil, Plane, Repeat2, RotateCcw, Shirt, SlidersHorizontal,
  Sun, SunMoon, Trash2, Wine,
  type LucideIcon,
} from 'lucide-react'
import { clsx } from 'clsx'

import { Button } from '@/components/ui/Button'
import { colourNameToHex } from '@/lib/colourUtils'
import { useUserStore } from '@/store/userStore'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useOutfitStore } from '@/store/outfitStore'
import { styleOptions } from '@/pages/onboarding/onboardingData'
import { useAuth } from '@/contexts/AuthContext'

// ─── Avatar helpers ───────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const navigate = useNavigate()
  const profile = useUserStore((s) => s.profile)
  const clearProfile = useUserStore((s) => s.clearProfile)
  const wardrobeItems = useWardrobeStore((s) => s.items)
  const { savedOutfits, savedOutfits: allOutfits } = useOutfitStore()
  const removeWardrobeItem = useWardrobeStore((s) => s.removeItem)
  const unsaveOutfitAction = useOutfitStore((s) => s.unsaveOutfit)
  const { user, signOut } = useAuth()

  if (!profile) {
    return (
      <div className="min-h-screen bg-text-primary/3 pt-16 lg:pt-20 flex items-center justify-center">
        <div className="text-center px-6">
          <h2 className="font-display text-2xl text-text-primary mb-3">No profile yet</h2>
          <Button onClick={() => navigate('/onboarding')}>Complete Onboarding</Button>
        </div>
      </div>
    )
  }

  const totalWears = wardrobeItems.reduce((sum, i) => sum + i.timesWorn, 0)
  const styleLabels = styleOptions.filter((s) => profile.stylePreferences.includes(s.value))

  const handleEditProfile = () => navigate('/onboarding?edit=true')

  const handleResetOnboarding = () => {
    if (window.confirm('This will restart your onboarding and clear your profile. Your wardrobe and saved outfits will remain. Continue?')) {
      clearProfile()
      navigate('/onboarding')
    }
  }

  const handleClearAll = () => {
    if (window.confirm('This will permanently delete your profile, wardrobe, and saved outfits. Are you sure?')) {
      wardrobeItems.forEach((item) => removeWardrobeItem(item.id))
      allOutfits.forEach((o) => unsaveOutfitAction(o.id))
      clearProfile()
      navigate('/')
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      console.log('[profile] signed out')
      navigate('/')
    } catch (err) {
      console.error('[profile] sign out failed', err)
    }
  }

  const details = [profile.occupation, profile.ageRange && AGE_LABEL[profile.ageRange]].filter(Boolean)
  const preferences: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Bell, label: 'Recommendations', value: FREQUENCY_LABEL[profile.recommendationFrequency] },
    ...(profile.genderStylePreference && profile.genderStylePreference !== 'no-preference'
      ? [{ icon: Compass, label: 'Style direction', value: profile.genderStylePreference }]
      : []),
    ...(profile.lifestyle ? [{ icon: Leaf, label: 'Lifestyle', value: profile.lifestyle }] : []),
  ]

  return (
    <div className="min-h-screen bg-warm-cream pb-28 md:pb-12">
      {/* ── Header band ── */}
      <header className="bg-deep-purple pt-28 pb-12 lg:pt-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 flex items-center gap-5 sm:gap-7">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-butter-yellow flex items-center justify-center flex-shrink-0 shadow-soft">
            <span className="font-display text-3xl sm:text-4xl text-dark-purple">{getInitials(profile.name)}</span>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-display text-4xl lg:text-5xl font-medium text-text-primary leading-none capitalize truncate">
              {profile.name}
            </h1>
            {details.length > 0 && (
              <p className="text-2xs uppercase tracking-widest text-text-muted mt-3">{details.join(' · ')}</p>
            )}
            {styleLabels.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {styleLabels.map((s) => (
                  <span key={s.value} className="px-3 py-1 rounded-full text-2xs uppercase tracking-widest font-medium bg-butter-yellow/15 text-butter-yellow ring-1 ring-inset ring-butter-yellow/25">
                    {s.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <IconButton icon={Pencil} label="Edit profile" onClick={handleEditProfile} className="self-start" />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 -mt-6 space-y-4">

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Stat icon={Shirt} value={wardrobeItems.length} label="Pieces" />
          <Stat icon={Bookmark} value={savedOutfits.length} label="Outfits" />
          <Stat icon={Repeat2} value={totalWears} label="Wears" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ── Colour palette ── */}
          {(profile.favouriteColours.length > 0 || profile.avoidColours.length > 0) && (
            <Card icon={Palette} title="Palette">
              <div className="space-y-4">
                {profile.favouriteColours.length > 0 && (
                  <SwatchRow icon={Heart} label="Loves" colours={profile.favouriteColours} />
                )}
                {profile.avoidColours.length > 0 && (
                  <SwatchRow icon={Ban} label="Avoids" colours={profile.avoidColours} avoided />
                )}
              </div>
            </Card>
          )}

          {/* ── Occasions ── */}
          {profile.typicalOccasions.length > 0 && (
            <Card icon={CalendarHeart} title="Occasions">
              <div className="flex flex-wrap gap-2">
                {profile.typicalOccasions.map((o) => {
                  const Icon = OCCASION_ICON[o] ?? Sun
                  return (
                    <Chip key={o} icon={Icon}>
                      {OCCASION_LABEL[o] ?? o.replace('-', ' ')}
                    </Chip>
                  )
                })}
              </div>
            </Card>
          )}

          {/* ── Preferences ── */}
          <Card icon={SlidersHorizontal} title="Preferences">
            <div className="flex flex-wrap gap-2">
              {preferences.map(({ icon, label, value }) => (
                <Chip key={label} icon={icon} title={label}>{value}</Chip>
              ))}
            </div>
          </Card>

          {/* ── Appearance ── */}
          <Card icon={SunMoon} title="Appearance">
            <ThemePicker />
          </Card>
        </div>

        {/* ── Account ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <ActionTile icon={Pencil} label="Edit style" onClick={handleEditProfile} />
          <ActionTile icon={RotateCcw} label="Restart setup" hint="Redo onboarding — your wardrobe is kept" onClick={handleResetOnboarding} />
          <ActionTile icon={LogOut} label="Sign out" hint={user?.email ? `Signed in as ${user.email}` : undefined} onClick={handleSignOut} />
          <ActionTile icon={Trash2} label="Clear data" hint="Delete everything and start fresh" onClick={handleClearAll} danger />
        </div>

        <p className="text-center text-2xs text-text-muted/60 uppercase tracking-widest py-10">Kloset AI · V1</p>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IconBadge({ icon: Icon, danger = false }: { icon: LucideIcon; danger?: boolean }) {
  return (
    <span className={clsx(
      'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
      danger ? 'bg-red-600/10 text-red-700 dark:text-red-400' : 'bg-butter-yellow/15 text-butter-yellow'
    )}>
      <Icon size={18} strokeWidth={1.8} />
    </span>
  )
}

function IconButton({ icon: Icon, label, onClick, className }: { icon: LucideIcon; label: string; onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        'w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-butter-yellow/15 text-butter-yellow ring-1 ring-inset ring-butter-yellow/25 transition-all hover:bg-butter-yellow hover:text-dark-purple hover:scale-105',
        className
      )}
    >
      <Icon size={17} strokeWidth={1.8} />
    </button>
  )
}

function Stat({ icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="rounded-3xl bg-warm-cream ring-1 ring-inset ring-text-primary/10 shadow-soft px-3 py-5 sm:py-6 flex flex-col items-center gap-2">
      <IconBadge icon={icon} />
      <p className="font-display text-3xl sm:text-4xl text-text-primary tabular-nums leading-none">{value}</p>
      <p className="text-2xs uppercase tracking-widest text-text-muted">{label}</p>
    </div>
  )
}

function Card({ icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-text-primary/[0.03] ring-1 ring-inset ring-text-primary/10 p-5 sm:p-6">
      <h2 className="flex items-center gap-3 mb-5">
        <IconBadge icon={icon} />
        <span className="font-display text-2xl font-medium text-text-primary">{title}</span>
      </h2>
      {children}
    </section>
  )
}

function Chip({ icon: Icon, title, children }: { icon: LucideIcon; title?: string; children: React.ReactNode }) {
  return (
    <span title={title} className="inline-flex items-center gap-2 h-9 pl-3 pr-4 rounded-full bg-warm-cream ring-1 ring-inset ring-text-primary/10 text-sm text-text-primary capitalize">
      <Icon size={15} strokeWidth={1.8} className="text-butter-yellow" />
      {children}
    </span>
  )
}

/** A row of round colour chips. Names show on hover; avoided colours are faded and crossed out. */
function SwatchRow({ icon: Icon, label, colours, avoided = false }: { icon: LucideIcon; label: string; colours: string[]; avoided?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <span title={label} aria-label={label} className="text-text-muted flex-shrink-0">
        <Icon size={16} strokeWidth={1.8} />
      </span>
      <ul className="flex flex-wrap gap-2.5">
        {colours.map((c) => (
          <li key={c} title={c} aria-label={c} className="relative">
            <span
              className={clsx('block w-9 h-9 rounded-full ring-1 ring-inset ring-black/10 shadow-soft', avoided && 'opacity-40')}
              style={{ backgroundColor: colourNameToHex(c) }}
            />
            {avoided && <span className="absolute left-1/2 top-1/2 w-10 h-px -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-text-primary/60" />}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ActionTile({
  icon,
  label,
  hint,
  onClick,
  danger = false,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={hint ?? label}
      className={clsx(
        'group flex flex-col items-center justify-center gap-3 rounded-3xl py-5 px-3 ring-1 ring-inset transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft',
        danger
          ? 'ring-red-700/20 hover:bg-red-600/5'
          : 'ring-text-primary/10 bg-text-primary/3 hover:bg-butter-yellow/10 hover:ring-butter-yellow/30'
      )}
    >
      <IconBadge icon={icon} danger={danger} />
      <span className={clsx('text-2xs uppercase tracking-widest font-semibold', danger ? 'text-red-700 dark:text-red-400' : 'text-text-primary')}>
        {label}
      </span>
    </button>
  )
}

// ─── Label maps ───────────────────────────────────────────────────────────────

const AGE_LABEL: Record<string, string> = {
  'under-25': 'Under 25',
  '25-34': '25 – 34',
  '35-44': '35 – 44',
  '45-54': '45 – 54',
  '55+': '55+',
}

const FREQUENCY_LABEL: Record<string, string> = {
  daily: 'Daily',
  'a-few-times-a-week': 'A few times a week',
  weekly: 'Weekly',
  'on-demand': 'On demand',
}

const OCCASION_ICON: Record<string, LucideIcon> = {
  work: Briefcase,
  casual: Coffee,
  formal: Gem,
  'date-night': Wine,
  weekend: Sun,
  travel: Plane,
  gym: Dumbbell,
  'special-event': PartyPopper,
}

// Short chip labels ("Work" rather than "Work / Office").
const OCCASION_LABEL: Record<string, string> = {
  work: 'Work',
  casual: 'Casual',
  formal: 'Formal',
  'date-night': 'Date night',
  weekend: 'Weekend',
  travel: 'Travel',
  gym: 'Active',
  'special-event': 'Special events',
}
