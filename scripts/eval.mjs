#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { join, extname, basename, resolve } from 'node:path'
import { readdir } from 'node:fs/promises'
import {
  VISION_MODEL_DEFAULT,
  VISION_SYSTEM_PROMPT,
  VISION_USER_PROMPT,
} from '../server/visionConfig.mjs'

const [inputFolderArg, labelsPathArg] = process.argv.slice(2)
if (!inputFolderArg || !labelsPathArg) {
  console.error('Usage: node scripts/eval.mjs <image-folder> <labels.csv>')
  process.exit(2)
}

const inputFolder = resolve(inputFolderArg)
const labelsPath = resolve(labelsPathArg)
const apiKey = process.env.GROQ_API_KEY
const model = process.env.GROQ_VISION_MODEL || VISION_MODEL_DEFAULT
if (!apiKey) {
  console.error('GROQ_API_KEY is required (the key value is never printed).')
  process.exit(2)
}

function parseCsv(text) {
  const rows = []
  let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' }
    else cell += char
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row) }
  const [header = [], ...data] = rows.filter((entry) => entry.some((part) => part.trim()))
  return data.map((entry) => Object.fromEntries(header.map((key, i) => [key.trim(), (entry[i] ?? '').trim()])))
}

async function analyze(imagePath) {
  const bytes = await readFile(imagePath)
  const ext = extname(imagePath).toLowerCase()
  const mediaType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_completion_tokens: 1200,
      reasoning_format: 'hidden',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: VISION_SYSTEM_PROMPT },
        { role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${bytes.toString('base64')}` } },
          { type: 'text', text: VISION_USER_PROMPT },
        ] },
      ],
    }),
  })
  if (!response.ok) throw new Error(`Groq request failed for ${basename(imagePath)} (${response.status})`)
  const payload = await response.json()
  const content = payload.choices?.[0]?.message?.content ?? ''
  try { return JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()) }
  catch { throw new Error(`Model returned invalid JSON for ${basename(imagePath)}`) }
}

const labels = parseCsv(await readFile(labelsPath, 'utf8'))
const requiredColumns = ['image', 'category', 'subcategory', 'neckline_closure', 'construction', 'primaryColor']
const missing = requiredColumns.filter((column) => !Object.hasOwn(labels[0] ?? {}, column))
if (missing.length) {
  console.error(`labels.csv is missing required columns: ${missing.join(', ')}`)
  process.exit(2)
}

const fields = ['category', 'subcategory', 'neckline_closure', 'construction', 'primaryColor']
const counts = Object.fromEntries(fields.map((field) => [field, { correct: 0, total: 0 }]))
const confusion = new Map()
const allFiles = new Set(await readdir(inputFolder))

for (const label of labels) {
  const imageName = label.image
  if (!allFiles.has(imageName)) {
    console.error(`Image not found: ${imageName}`)
    process.exitCode = 1
    continue
  }
  const prediction = await analyze(join(inputFolder, imageName))
  for (const field of fields) {
    if (!label[field]) continue
    counts[field].total++
    if (String(prediction[field] ?? '').trim().toLowerCase() === label[field].toLowerCase()) counts[field].correct++
  }
  if (label.subcategory) {
    const truth = label.subcategory
    const predicted = String(prediction.subcategory ?? '(null)')
    const key = `${truth}\u0000${predicted}`
    confusion.set(key, (confusion.get(key) ?? 0) + 1)
  }
  console.error(`Evaluated ${imageName}`)
}

const summary = Object.fromEntries(fields.map((field) => {
  const { correct, total } = counts[field]
  return [field, { correct, total, accuracy: total ? Number((correct / total).toFixed(4)) : null }]
}))
const labelsSeen = [...new Set([...confusion.keys()].flatMap((key) => key.split('\u0000')))].sort()
const confusionMatrix = {
  labels: labelsSeen,
  rows: Object.fromEntries(labelsSeen.map((truth) => [truth, Object.fromEntries(labelsSeen.map((predicted) => [predicted, confusion.get(`${truth}\u0000${predicted}`) ?? 0]))])),
}
console.log(JSON.stringify({ model, imagesEvaluated: labels.length, perField: summary, subcategoryConfusionMatrix: confusionMatrix }, null, 2))
