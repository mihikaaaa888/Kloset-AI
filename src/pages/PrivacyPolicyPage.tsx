import { Link } from 'react-router-dom'

const sections = [
  {
    title: 'Information you add',
    body: 'Kloset stores your account email and the profile details you choose to provide, such as your name, style preferences, favourite and avoided colours, and clothing preferences. Your closet items, item photos, saved outfits, wear logs, and friend shares are also stored so the app can provide its features.',
  },
  {
    title: 'Where information is stored',
    body: 'Account and closet data sync through Supabase, which provides authentication, database, and file storage services. Some app preferences and cached data are kept in your browser or device storage. Data saved only on one device may not appear on another.',
  },
  {
    title: 'AI styling and photos',
    body: 'When you ask Kaia for styling help, the app may send your message, relevant closet item names and categories, selected style profile details, and any image you attach to the configured AI provider (Groq and, when configured as a fallback, Anthropic). This lets the provider generate a response. Do not upload photos or details you do not want processed by those providers.',
  },
  {
    title: 'Other services',
    body: 'Shop and inspiration searches may use Pexels to retrieve product-style images. Weather uses Open-Meteo; if you enable location, your device provides approximate coordinates for the forecast and the app remembers the chosen location on that device. These providers receive the query or information needed for the requested feature.',
  },
  {
    title: 'Sharing and your choices',
    body: 'Friend features share the closet or outfit content you choose to send. You can edit or remove closet items, or use account settings to request account deletion and remove synced profile and closet data. You can also stop using the app and sign out at any time.',
  },
  {
    title: 'Changes and questions',
    body: 'This notice may be updated as Kloset changes. The current version will be available here.',
  },
]

export function PrivacyPolicyPage() {
  return <main className="min-h-screen bg-warm-cream px-5 pb-24 pt-24 text-text-primary lg:pt-32">
    <article className="mx-auto max-w-3xl">
      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Kloset</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Privacy Policy</h1>
      <p className="mt-2 text-xs text-text-muted">Last updated 4 November 2026</p>
      <p className="mt-4 text-sm leading-relaxed text-text-muted">This notice explains what information Kloset uses and how it supports the app’s features.</p>
      <div className="mt-10 divide-y divide-text-primary/10 border-y border-text-primary/10">
        {sections.map((section) => <section key={section.title} className="py-5">
          <h2 className="text-base font-medium">{section.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">{section.body}</p>
        </section>)}
      </div>
      <Link to="/" className="mt-8 inline-block text-sm text-text-primary underline underline-offset-4">Back to Kloset</Link>
    </article>
  </main>
}
