// Run with: node --test server/accounts.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { inactiveAction, sweepInactiveAccounts } from './accounts.mjs'

const now = new Date('2030-06-15T00:00:00Z')
const OLD = '2027-01-01T00:00:00Z'
const RECENT = '2030-06-01T00:00:00Z'
const LONG_AGO_WARNING = '2030-05-01T00:00:00Z'
const FRESH_WARNING = '2030-06-10T00:00:00Z'

test('inactiveAction', () => {
  const action = (lastActive, warnedAt) => inactiveAction({ lastActive, warnedAt }, now)
  assert.equal(action(RECENT, null), 'none')
  assert.equal(action('2027-06-16T00:00:00Z', null), 'none', 'just under 3 years')
  assert.equal(action('2027-06-14T00:00:00Z', null), 'warn', 'just over 3 years')
  assert.equal(action(OLD, null), 'warn')
  assert.equal(action(OLD, FRESH_WARNING), 'none', 'inside the 30 days')
  assert.equal(action(OLD, LONG_AGO_WARNING), 'delete')
  assert.equal(action(RECENT, LONG_AGO_WARNING), 'none', 'came back after the warning')
  assert.equal(action(OLD, '2026-01-01T00:00:00Z'), 'warn', 'warning older than last activity is void')
  assert.equal(action('garbage', LONG_AGO_WARNING), 'none')
  assert.equal(action(null, LONG_AGO_WARNING), 'none')
  assert.equal(action(OLD, 'garbage'), 'none')
})

function run(rows, { failEmail = false, failMark = false, dryRun = false } = {}) {
  const calls = []
  globalThis.fetch = async (url, init = {}) => {
    calls.push(`${init.method} ${url}`)
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
    if (url.includes('/rpc/inactive_accounts')) return json(rows)
    if (url.includes('api.resend.com')) return json({}, failEmail ? 500 : 200)
    if (url.includes('/rest/v1/profiles')) return json({}, failMark ? 500 : 200)
    if (url.includes('/object/list/')) return json([])
    return json({})
  }
  return sweepInactiveAccounts({ supabaseUrl: 'https://db', serviceKey: 's', resendKey: 'r', emailFrom: 'f', dryRun, now })
    .then((summary) => ({ summary, calls }))
}
const row = (id, last_active, warned_at = null) => ({ id, email: `${id}@x.co`, last_active, warned_at })
const hits = (calls, part) => calls.filter((c) => c.includes(part)).length

test('warns, then records the warning, without deleting', async () => {
  const { summary, calls } = await run([row('a', OLD)])
  assert.equal(summary.warned, 1)
  assert.equal(hits(calls, 'api.resend.com'), 1)
  assert.equal(hits(calls, 'PATCH https://db/rest/v1/profiles?id=eq.a'), 1)
  assert.equal(hits(calls, '/auth/v1/admin/users/'), 0)
})

test('a failed email is not recorded as a warning', async () => {
  const { summary, calls } = await run([row('a', OLD)], { failEmail: true })
  assert.deepEqual([summary.warned, summary.failed], [0, 1])
  assert.equal(hits(calls, '/rest/v1/profiles'), 0)
})

test('deletes only after a warning has run its course', async () => {
  const { summary, calls } = await run([row('a', OLD, LONG_AGO_WARNING), row('b', OLD, FRESH_WARNING), row('c', RECENT, LONG_AGO_WARNING)])
  assert.equal(summary.deleted, 1)
  assert.equal(hits(calls, 'DELETE https://db/auth/v1/admin/users/a'), 1)
  assert.equal(hits(calls, '/auth/v1/admin/users/'), 1)
  assert.equal(hits(calls, 'api.resend.com'), 0)
})

test('dry run reports but changes nothing', async () => {
  const { summary, calls } = await run([row('a', OLD), row('b', OLD, LONG_AGO_WARNING)], { dryRun: true })
  assert.deepEqual([summary.warned, summary.deleted], [1, 1])
  assert.equal(calls.length, 1, 'only the listing call')
})

test('one failure does not stop the rest', async () => {
  const { summary } = await run([row('a', OLD), row('b', OLD)], { failMark: true })
  assert.deepEqual([summary.checked, summary.failed], [2, 2])
})
