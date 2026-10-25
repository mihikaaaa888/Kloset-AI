import { useNavigate } from 'react-router-dom'
import { ThemePicker } from '@/components/ui/ThemeToggle'
import { Pencil, ArrowRight } from 'lucide-react'
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

  return (
    <div className="min-h-screen bg-warm-cream pb-28 md:pb-12">
      {/* ── Header band ── */}
      <header className="bg-deep-purple pt-28 pb-14 lg:pt-32 lg:pb-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-end gap-8">
          {/* Monogram */}
          <div className="w-24 h-28 bg-butter-yellow flex items-center justify-center flex-shrink-0">
            <span className="font-display text-4xl text-dark-purple">{getInitials(profile.name)}</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-2xs uppercase tracking-ultra-wide text-butter-yellow font-medium mb-3">Your profile</p>
            <h1 className="font-display text-5xl lg:text-6xl font-medium text-text-primary leading-none capitalize">
              {profile.name}
            </h1>
            {details.length > 0 && (
              <p className="text-2xs uppercase tracking-widest text-text-muted mt-4">{details.join(' · ')}</p>
            )}
            {styleLabels.length > 0 && (
              <p className="font-display italic text-2xl text-butter-yellow mt-3">
                {styleLabels.map((s) => s.label).join(' · ')}
              </p>
            )}
          </div>

          <button onClick={handleEditProfile} className="text-tab self-start sm:self-end" aria-label="Edit profile">
            <Pencil size={12} /> Edit profile
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 border-b border-text-primary/15">
          <Stat value={wardrobeItems.length} label="Pieces" />
          <Stat value={savedOutfits.length} label="Saved outfits" />
          <Stat value={totalWears} label="Wears logged" />
        </div>

        {/* ── Colour palette ── */}
        {(profile.favouriteColours.length > 0 || profile.avoidColours.length > 0) && (
          <ProfileSection title="Palette">
            <div className="space-y-8">
              {profile.favouriteColours.length > 0 && (
                <div>
                  <p className="text-2xs uppercase tracking-widest text-text-muted mb-4">Loves</p>
                  <div className="flex flex-wrap gap-5">
                    {profile.favouriteColours.map((c) => <Swatch key={c} name={c} hex={colourNameToHex(c)} />)}
                  </div>
                </div>
              )}
              {profile.avoidColours.length > 0 && (
                <div>
                  <p className="text-2xs uppercase tracking-widest text-text-muted mb-4">Avoids</p>
                  <div className="flex flex-wrap gap-5">
                    {profile.avoidColours.map((c) => <Swatch key={c} name={c} hex={colourNameToHex(c)} avoided />)}
                  </div>
                </div>
              )}
            </div>
          </ProfileSection>
        )}

        {/* ── Occasions ── */}
        {profile.typicalOccasions.length > 0 && (
          <ProfileSection title="Occasions">
            <p className="font-display text-2xl text-text-primary leading-snug capitalize">
              {profile.typicalOccasions.map((o) => o.replace('-', ' ')).join(', ')}
            </p>
          </ProfileSection>
        )}

        {/* ── Preferences ── */}
        <ProfileSection title="Preferences">
          <dl>
            <PreferenceRow label="Recommendations" value={FREQUENCY_LABEL[profile.recommendationFrequency]} />
            {profile.genderStylePreference && profile.genderStylePreference !== 'no-preference' && (
              <PreferenceRow label="Style direction" value={profile.genderStylePreference} />
            )}
            {profile.lifestyle && <PreferenceRow label="Lifestyle" value={profile.lifestyle} />}
          </dl>
        </ProfileSection>

        {/* ── Appearance ── */}
        <ProfileSection title="Appearance">
          <ThemePicker />
          <p className="text-sm text-text-muted mt-3">System follows your device's light or dark setting.</p>
        </ProfileSection>

        {/* ── Account ── */}
        <ProfileSection title="Account">
          <div>
            <ActionRow label="Edit style profile" description="Update your preferences, occasions, and colours" onClick={handleEditProfile} />
            <ActionRow label="Restart onboarding" description="Redo the setup — your wardrobe is kept" onClick={handleResetOnboarding} />
            <ActionRow label="Clear all data" description="Delete everything and start fresh" onClick={handleClearAll} danger />
            <ActionRow
              label="Sign out"
              description={user?.email ? `Signed in as ${user.email}` : 'Sign out of Kloset on this device'}
              onClick={handleSignOut}
            />
          </div>
        </ProfileSection>

        <p className="text-center text-2xs text-text-muted/60 uppercase tracking-widest py-12">Kloset.ai · V1</p>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="py-10 text-center border-l border-text-primary/15 first:border-l-0">
      <p className="font-display text-5xl text-text-primary tabular-nums leading-none">{value}</p>
      <p className="text-2xs uppercase tracking-widest text-text-muted mt-3">{label}</p>
    </div>
  )
}

/** Editorial two-column section — heading on the left, content on the right, hairline above. */
function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 py-10 border-b border-text-primary/15">
      <h2 className="font-display text-3xl font-medium text-text-primary">{title}</h2>
      <div className="md:col-span-3">{children}</div>
    </section>
  )
}

/** Paint-chip swatch. Avoided colours are faded with the name struck through. */
function Swatch({ name, hex, avoided = false }: { name: string; hex: string; avoided?: boolean }) {
  return (
    <div className="w-16">
      <div
        className={clsx('h-20 ring-1 ring-inset ring-black/10', avoided && 'opacity-35')}
        style={{ backgroundColor: hex }}
        title={name}
      />
      <p className={clsx('text-2xs uppercase tracking-wider mt-2 truncate', avoided ? 'text-text-muted line-through' : 'text-text-primary')}>
        {name}
      </p>
    </div>
  )
}

function PreferenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3.5 border-b border-text-primary/10 last:border-0 first:pt-0">
      <dt className="text-2xs uppercase tracking-widest text-text-muted">{label}</dt>
      <dd className="text-sm text-text-primary capitalize text-right">{value}</dd>
    </div>
  )
}

function ActionRow({
  label,
  description,
  onClick,
  danger = false,
}: {
  label: string
  description: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center justify-between gap-4 py-4 border-b border-text-primary/10 last:border-0 first:pt-0 text-left"
    >
      <div>
        <p className={clsx('text-xs uppercase tracking-widest font-semibold transition-colors', danger ? 'text-red-700 dark:text-red-400' : 'text-text-primary group-hover:text-butter-yellow')}>
          {label}
        </p>
        <p className="text-sm text-text-muted mt-1">{description}</p>
      </div>
      <ArrowRight size={15} className={clsx('flex-shrink-0 transition-transform duration-300 group-hover:translate-x-1', danger ? 'text-red-700/60 dark:text-red-400/60' : 'text-text-muted')} />
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

