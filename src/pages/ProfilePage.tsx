import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { ThemePicker } from '@/components/ui/ThemeToggle'
import { clsx } from 'clsx'

import { Button } from '@/components/ui/Button'
import { useUserStore } from '@/store/userStore'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useOutfitStore } from '@/store/outfitStore'
import { styleOptions } from '@/pages/onboarding/onboardingData'
import { useAuth } from '@/contexts/AuthContext'
import { useAvatar } from '@/hooks/useAvatar'

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
  const avatar = useAvatar(profile?.id)

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

  const occasions = profile.typicalOccasions.map((o) => OCCASION_LABEL[o] ?? o.replace('-', ' '))
  const recommendations = [
    FREQUENCY_LABEL[profile.recommendationFrequency],
    profile.genderStylePreference && profile.genderStylePreference !== 'no-preference' ? profile.genderStylePreference : null,
  ].filter(Boolean).join(', ')
  const occupation = [profile.occupation, profile.ageRange && AGE_LABEL[profile.ageRange]].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-warm-cream pt-24 pb-28 md:pb-12 px-4">
      {/* The card is paper in both themes, like the page it is modelled on. */}
      <article className="relative mx-auto max-w-[640px] lg:max-w-[1120px] bg-[#f5f3ee] text-[#16161d] shadow-medium px-6 pt-10 pb-28 sm:px-10 sm:pt-14 lg:px-14 lg:pb-20">
        <header className="flex items-end justify-between pb-3 border-b-2 border-[#16161d]">
          <h1 className="font-sans font-extrabold text-4xl sm:text-6xl lg:text-7xl leading-none whitespace-nowrap tracking-tight text-[#f06ec4]">KLOSET</h1>
          <span className="font-sans text-base sm:text-xl uppercase tracking-tight pb-1 whitespace-nowrap">My profile</span>
        </header>

        {/* One column on phones; on laptops three columns whose rows are shared, so labels line up across them. */}
        <div className="mt-8 grid gap-x-14 lg:mt-10 lg:grid-flow-col lg:grid-cols-3 lg:grid-rows-5">
          <Field label="Name"><span className="capitalize">{profile.name}</span></Field>
          <Field label="Style">{styleLabels.map((s) => s.label).join(' · ') || '—'}</Field>
          <Field label="Occupation">{occupation || '—'}</Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="In the closet"><Big value={wardrobeItems.length} unit="pcs" /></Field>
            <Field label="Saved looks"><Big value={savedOutfits.length} unit="looks" /></Field>
          </div>

          <Field label="On the weekends…">{occasions.join(', ') || '—'}</Field>
          <Field label="Go-to colours">{profile.favouriteColours.join(', ') || '—'}</Field>

          <div className="lg:col-start-3 lg:row-start-1 lg:row-span-5">
            <Polaroid name={profile.name} wears={totalWears} avatar={avatar} />
          </div>

          <Field label="Avoids" className="mt-9 lg:mt-0">{profile.avoidColours.join(', ') || 'Nothing'}</Field>
          <Field label="Lifestyle">{profile.lifestyle || '—'}</Field>
          <Field label="Recommendations"><span className="capitalize">{recommendations || '—'}</span></Field>
        </div>

        <Stamp className="absolute right-6 bottom-4 w-20 h-20" />
      </article>

      <div className="mx-auto max-w-[640px] lg:max-w-[1120px] mt-6">
        <p className="text-2xs uppercase tracking-widest text-text-muted mb-3">Appearance</p>
        <ThemePicker />

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-2xs uppercase tracking-widest font-semibold">
          <TextAction onClick={handleEditProfile}>Edit style</TextAction>
          <TextAction onClick={handleResetOnboarding}>Restart setup</TextAction>
          <TextAction onClick={handleSignOut} hint={user?.email ? `Signed in as ${user.email}` : undefined}>Sign out</TextAction>
          <TextAction onClick={handleClearAll} danger>Clear data</TextAction>
        </div>

        <p className="text-center text-2xs text-text-muted/60 uppercase tracking-widest py-10">Kloset · V1</p>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** A printed label on a rule with the answer handwritten underneath. */
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx('mb-6', className)}>
      <h2 className="font-sans text-[15px] uppercase leading-tight tracking-tight pb-0.5 border-b-2 border-[#16161d]">{label}</h2>
      <p className="font-hand text-[28px] leading-[1.05] pt-1.5 text-[#1d1d33]">{children}</p>
    </section>
  )
}

function Big({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="block text-center">
      <span className="text-5xl tabular-nums">{value}</span>
      <span className="font-sans text-xs uppercase ml-1">{unit}</span>
    </span>
  )
}

/** An instant photo: soft grey frame, picture area and a signature along the bottom. */
function Polaroid({ name, wears, avatar }: { name: string; wears: number; avatar: ReturnType<typeof useAvatar> }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="bg-[#f7f9fc] ring-1 ring-black/10 shadow-card p-3.5 pb-4 rotate-[0.4deg]">
      <div className="relative aspect-[4/5] bg-gradient-to-br from-[#d9dde8] via-[#eef0f5] to-[#cfd3df] flex items-center justify-center ring-1 ring-black/15 overflow-hidden">
        {avatar.url
          ? <img src={avatar.url} alt={`${name}'s photo`} className="absolute inset-0 w-full h-full object-cover" />
          : <span className="font-sans font-extrabold text-6xl text-[#16161d]/80">{getInitials(name)}</span>}

        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={avatar.busy}
          className="absolute bottom-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 h-9 px-3.5 whitespace-nowrap rounded-full bg-[#16161d] text-[#f5f3ee] text-2xs uppercase tracking-widest font-semibold shadow-medium hover:bg-[#f06ec4] transition-colors disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f06ec4]"
        >
          <Camera size={14} strokeWidth={2} />
          {avatar.busy ? 'Saving…' : avatar.url ? 'Change photo' : 'Add photo'}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) void avatar.upload(file); e.target.value = '' }}
        />
      </div>
      <p className="font-hand text-[34px] leading-none text-[#1d1d33] mt-3 text-center capitalize truncate">{name}</p>
      <p className="font-sans text-2xs uppercase tracking-widest text-[#16161d]/50 text-center mt-1">{wears} wears logged</p>
      {avatar.error && <p role="alert" className="text-2xs text-red-700 text-center mt-2">{avatar.error}</p>}
      {avatar.url && (
        <button type="button" onClick={avatar.remove} className="block mx-auto mt-2 text-2xs uppercase tracking-widest text-[#16161d]/50 underline underline-offset-4 hover:text-[#16161d]">
          Remove photo
        </button>
      )}
    </div>
  )
}

/** The pink sunburst sticker in the corner. */
function Stamp({ className }: { className?: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30)
  return (
    <svg viewBox="-50 -50 100 100" className={className} aria-hidden>
      <g stroke="#f06ec4" strokeWidth="2.4" strokeLinecap="round">
        {rays.map((deg) => (
          <line key={deg} x1="0" y1="-31" x2="0" y2="-44" transform={`rotate(${deg})`} />
        ))}
      </g>
      <text x="0" y="6" textAnchor="middle" fontFamily="Montserrat" fontWeight="800" fontSize="17" fill="#f06ec4">KAIA</text>
    </svg>
  )
}

function TextAction({ children, onClick, hint, danger = false }: { children: React.ReactNode; onClick: () => void; hint?: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={hint}
      className={clsx('underline underline-offset-4 transition-opacity hover:opacity-70', danger ? 'text-red-700 dark:text-red-400' : 'text-text-primary')}
    >
      {children}
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
