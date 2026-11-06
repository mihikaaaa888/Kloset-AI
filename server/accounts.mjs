/**
 * Account deletion, shared by the "Delete account" button (/api/account) and the
 * daily inactive-account job (/api/cron/inactive-accounts, see vercel.json).
 */

const INACTIVE_YEARS = 3
const WARNING_DAYS = 30
// Keeps one run inside the function time limit; anything left waits for tomorrow's run.
const MAX_PER_RUN = 25

/** Removes the user's photos, then the Auth user (database rows cascade from it). Throws if a step fails. */
export async function deleteAccountData(supabaseUrl, serviceKey, userId) {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }

  // Remove this account's private wardrobe and shared-image objects before
  // deleting the Auth user. Bucket absence is okay for older installations.
  const collectObjects = async (bucket, prefix) => {
    const response = await fetch(`${supabaseUrl}/storage/v1/object/list/${bucket}`, {
      method: 'POST', headers,
      body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
    })
    if (response.status === 404) return []
    if (!response.ok) throw new Error('Could not prepare account photos for deletion.')
    const entries = await response.json()
    const paths = []
    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`
      if (entry.id || entry.metadata) paths.push(path)
      else paths.push(...await collectObjects(bucket, path))
    }
    return paths
  }
  for (const bucket of ['wardrobe-images', 'shared-images']) {
    const paths = await collectObjects(bucket, userId)
    for (let start = 0; start < paths.length; start += 100) {
      const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
        method: 'DELETE', headers,
        body: JSON.stringify({ prefixes: paths.slice(start, start + 100) }),
      })
      if (!response.ok) throw new Error('Could not delete account photos. Please try again.')
    }
  }

  const deleteResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE', headers,
  })
  if (!deleteResponse.ok) throw new Error('Could not delete the account. Please try again.')
}

/**
 * 'none' | 'warn' | 'delete'. Deleting needs a warning sent after the person's last activity and
 * at least WARNING_DAYS ago, so coming back at any point cancels it. Unreadable dates mean 'none'.
 */
export function inactiveAction({ lastActive, warnedAt }, now = new Date()) {
  // new Date(null) is 1970, which would read as long inactive.
  const active = lastActive ? new Date(lastActive).getTime() : NaN
  const inactiveBefore = new Date(now).setFullYear(now.getFullYear() - INACTIVE_YEARS)
  if (!Number.isFinite(active) || active >= inactiveBefore) return 'none'
  if (!warnedAt) return 'warn'
  const warned = new Date(warnedAt).getTime()
  if (!Number.isFinite(warned)) return 'none'
  if (warned <= active) return 'warn'
  return warned <= now.getTime() - WARNING_DAYS * 86_400_000 ? 'delete' : 'none'
}

async function sendWarningEmail(to, apiKey, from) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: 'tryklosetai@gmail.com',
      subject: 'Your Kloset account will be deleted in 30 days',
      text: `Hi,

You haven't used Kloset for ${INACTIVE_YEARS} years, so under our privacy policy your account will be deleted in ${WARNING_DAYS} days, along with your wardrobe, photos and outfits.

To keep your account, just sign in before then: https://trykloset.com/login

If you're happy for it to go, you don't need to do anything.

Questions? Reply to this email.

Kloset`,
    }),
  })
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`)
}

/**
 * One run of the job. Warns first and only records the warning once the email was accepted, so
 * nobody is deleted unwarned. dryRun reports what would happen without emailing or deleting.
 */
export async function sweepInactiveAccounts({ supabaseUrl, serviceKey, resendKey, emailFrom, dryRun = false, now = new Date() }) {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
  const inactiveBefore = new Date(now)
  inactiveBefore.setFullYear(now.getFullYear() - INACTIVE_YEARS)

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/inactive_accounts`, {
    method: 'POST', headers,
    body: JSON.stringify({
      inactive_before: inactiveBefore.toISOString(),
      warned_before: new Date(now.getTime() - WARNING_DAYS * 86_400_000).toISOString(),
      max_rows: MAX_PER_RUN,
    }),
  })
  if (!response.ok) throw new Error(`Could not list inactive accounts (${response.status}): is supabase/inactive_accounts.sql installed?`)

  const summary = { checked: 0, warned: 0, deleted: 0, failed: 0, dryRun }
  for (const row of await response.json()) {
    summary.checked++
    const action = inactiveAction({ lastActive: row.last_active, warnedAt: row.warned_at }, now)
    if (action === 'none') continue
    if (dryRun) { summary[action === 'warn' ? 'warned' : 'deleted']++; continue }
    try {
      if (action === 'warn') {
        if (!row.email) throw new Error('no email address to warn')
        await sendWarningEmail(row.email, resendKey, emailFrom)
        const mark = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(row.id)}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ inactivity_warned_at: now.toISOString() }),
        })
        if (!mark.ok) throw new Error(`Could not record the warning (${mark.status})`)
        summary.warned++
      } else {
        await deleteAccountData(supabaseUrl, serviceKey, row.id)
        summary.deleted++
      }
    } catch (error) {
      summary.failed++
      console.error(`[inactive-accounts] ${action} failed for ${row.id}:`, error?.message ?? error)
    }
  }
  console.log('[inactive-accounts] run finished', summary)
  return summary
}
