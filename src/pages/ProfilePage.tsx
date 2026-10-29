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
  const savedOutfits = useOutfitStore((s) => s.savedOutfits)
  const removeWardrobeItem = useWardrobeStore((s) => s.removeItem)
  const clearOutfits = useOutfitStore((s) => s.clearOutfits)
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
      clearOutfits()
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
      {/* ── Header band: brand forest in light mode, near-black in dark; cream type on both ── */}
      <header className="bg-butter-yellow dark:bg-deep-purple pt-28 pb-14 lg:pt-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 flex items-center gap-5 sm:gap-7">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#fffdd0] flex items-center justify-center flex-shrink-0 shadow-medium">
            <span className="font-display text-3xl sm:text-4xl text-[#355e3b]">{getInitials(profile.name)}</span>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-display text-4xl lg:text-5xl font-medium text-[#fffdd0] leading-none capitalize truncate">
              {profile.name}
            </h1>
            {details.length > 0 && (
              <p className="text-2xs uppercase tracking-widest text-[#fffdd0]/75 mt-3 flex flex-wrap gap-x-2">
                {details.map((detail, index) => (
                  <span key={index} className="whitespace-nowrap">{detail}{index < details.length - 1 && ' ·'}</span>
                ))}
              </p>
            )}
            {styleLabels.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {styleLabels.map((s) => (
                  <span key={s.value} className="px-3 py-1 rounded-full text-2xs uppercase tracking-widest font-medium bg-[#fffdd0]/12 text-[#fffdd0] ring-1 ring-inset ring-[#fffdd0]/30">
                    {s.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <IconButton icon={Pencil} label="Edit profile" onClick={handleEditProfile} className="self-start" />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 -mt-7 space-y-4">

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Stat icon={Shirt} value={wardrobeItems.length} label="Pieces" />
          <Stat icon={Bookmark} value={savedOutfits.length} label="Outfits" />
          <Stat icon={Repeat2} value={totalWears} label="Wears" />
        </div>

        <div className="md:columns-2 md:gap-4">
          {/* ── Colour palette ── */}
          {(profile.favouriteColours.length > 0 || profile.avoidColours.length > 0) && (
            <Card icon={Palette} title="Palette">
              <div className="space-y-5">
                {profile.favouriteColours.length > 0 && (
                  <ColourGroup icon={Heart} label="Loves" colours={profile.favouriteColours} />
                )}
                {profile.avoidColours.length > 0 && (
                  <ColourGroup icon={Ban} label="Avoids" colours={profile.avoidColours} avoided />
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
            <dl className="space-y-4">
              {preferences.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3.5">
                  <IconBadge icon={Icon} size="sm" />
                  <div className="min-w-0">
                    <dt className="text-2xs uppercase tracking-widest text-text-muted">{label}</dt>
                    <dd className="text-sm text-text-primary first-letter:uppercase mt-0.5">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
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

// Cards are plain white surfaces with one hairline and a soft shadow. Colour lives in the header band,
// the icon badges, the numbers and the user's own swatches, so it always means something.
const CARD = 'rounded-3xl bg-surface ring-1 ring-inset ring-text-primary/10 shadow-card'

/** A round icon in brand green on a faint green tint (cream on cream-tint in dark mode). */
function IconBadge({ icon: Icon, danger = false, size = 'md', className }: { icon: LucideIcon; danger?: boolean; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span className={clsx(
      'rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
      size === 'md' ? 'w-10 h-10' : 'w-9 h-9',
      danger ? 'bg-red-600/10 text-red-700 dark:text-red-400' : 'bg-butter-yellow/10 text-butter-yellow',
      className
    )}>
      <Icon size={size === 'md' ? 18 : 16} strokeWidth={1.8} />
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
        'w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-[#fffdd0]/12 text-[#fffdd0] ring-1 ring-inset ring-[#fffdd0]/30 transition-all hover:bg-[#fffdd0] hover:text-[#355e3b] hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fffdd0]',
        className
      )}
    >
      <Icon size={17} strokeWidth={1.8} />
    </button>
  )
}

function Stat({ icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className={clsx(CARD, 'px-3 py-5 sm:py-6 flex flex-col items-center gap-2')}>
      <IconBadge icon={icon} />
      <p className="font-display text-4xl sm:text-5xl text-butter-yellow tabular-nums leading-none mt-1">{value}</p>
      <p className="text-2xs uppercase tracking-widest text-text-muted">{label}</p>
    </div>
  )
}

function Card({ icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <section className={clsx(CARD, 'p-5 sm:p-6 mb-4 break-inside-avoid')}>
      <h2 className="flex items-center gap-3 mb-5">
        <IconBadge icon={icon} />
        <span className="font-display text-2xl font-medium text-text-primary">{title}</span>
      </h2>
      {children}
    </section>
  )
}

function Chip({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 h-9 pl-3 pr-4 rounded-full bg-butter-yellow/10 ring-1 ring-inset ring-butter-yellow/15 text-sm text-text-primary capitalize">
      <Icon size={15} strokeWidth={1.8} className="text-butter-yellow" />
      {children}
    </span>
  )
}

/** Colours as named pills: a dot of the real colour plus its name, so nothing relies on hover or on telling swatches apart. */
function ColourGroup({ icon: Icon, label, colours, avoided = false }: { icon: LucideIcon; label: string; colours: string[]; avoided?: boolean }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-2xs uppercase tracking-widest text-text-muted mb-2.5">
        <Icon size={13} strokeWidth={1.8} />
        {label}
      </p>
      <ul className="flex flex-wrap gap-2">
        {colours.map((c) => (
          <li key={c} className={clsx('inline-flex items-center gap-2.5 h-9 pl-2 pr-3.5 rounded-full ring-1 ring-inset', avoided ? 'ring-text-primary/10 text-text-muted' : 'bg-butter-yellow/10 ring-butter-yellow/15 text-text-primary')}>
            <span className={clsx('block w-5 h-5 rounded-full ring-1 ring-inset ring-black/15', avoided && 'opacity-50')} style={{ backgroundColor: colourNameToHex(c) }} />
            <span className={clsx('text-sm capitalize', avoided && 'line-through decoration-text-muted/60')}>{c}</span>
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
        CARD,
        'group flex flex-col items-center justify-center gap-3 py-5 px-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        danger
          ? 'hover:bg-red-600/5 hover:ring-red-700/30 focus-visible:outline-red-700'
          : 'hover:bg-butter-yellow hover:ring-butter-yellow focus-visible:outline-butter-yellow'
      )}
    >
      <IconBadge icon={icon} danger={danger} className={danger ? undefined : 'group-hover:bg-dark-purple/15 group-hover:text-dark-purple'} />
      <span className={clsx('text-2xs uppercase tracking-widest font-semibold transition-colors', danger ? 'text-red-700 dark:text-red-400' : 'text-text-primary group-hover:text-dark-purple')}>
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
