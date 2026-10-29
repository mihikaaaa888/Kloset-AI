/**
 * Kloset API Server (local dev)
 *
 * Runs on port 3001 (proxied from Vite at /api/*).
 * Reads API keys from .env in the project root.
 * In production the same app runs as a Netlify Function — see netlify/functions/api.mjs.
 *
 * Start: npm run server
 * Start both servers: npm run dev:all
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// ─── Load .env ────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '../.env')

try {
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
} catch {
  // .env not found — variables can still be set in the environment
}

// Imported after .env is loaded (dynamic import) so nothing reads env too early.
const { app } = await import('./app.mjs')
const PORT = process.env.PORT || 3001

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  Kloset API server → http://localhost:${PORT}`)
  if (!process.env.GROQ_API_KEY) {
    console.log('  ⚠  GROQ_API_KEY not set — AI image analysis disabled')
    console.log('     Add it to .env and restart the server to enable it.')
  } else {
    console.log('  ✓  GROQ_API_KEY detected — AI image analysis ready')
  }
  if (process.env.CLAUDE_API_KEY) {
    console.log('  ✓  CLAUDE_API_KEY detected — chat will fall back to Claude if Groq fails')
  }
  console.log('')
})
