/**
 * Vercel serverless function that serves every /api/* route by running the
 * same Express app as local dev and Netlify (server/app.mjs).
 *
 * Unlike Netlify Functions (AWS Lambda event/context shape, needs the
 * `serverless-http` adapter), Vercel's Node.js runtime calls functions with
 * plain (req, res) — exactly what an Express app already is — so the app can
 * be handed to Vercel directly, wrapped only for request logging (success +
 * error paths), matching netlify/functions/api.mjs's behaviour.
 *
 * The `[...path]` filename makes this a catch-all: every request under
 * /api/* (e.g. /api/chat, /api/analyze-image) is routed here, and Express's
 * own router (unchanged from local dev) handles the exact sub-path.
 *
 * Env vars (GROQ_API_KEY, CLAUDE_API_KEY, etc.) come from the Vercel
 * project's Environment Variables settings in production — not from .env,
 * which is local-dev only and gitignored.
 */

import { app } from '../server/app.mjs'

export default function handler(req, res) {
  const started = Date.now()
  const { method, url } = req

  res.on('finish', () => {
    console.log(`[vercel-api] ${method} ${url} → ${res.statusCode} in ${Date.now() - started}ms`)
  })

  try {
    return app(req, res)
  } catch (e) {
    console.error(`[vercel-api] ${method} ${url} crashed:`, e?.message ?? e)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Server error. Please try again.' }))
    }
  }
}
