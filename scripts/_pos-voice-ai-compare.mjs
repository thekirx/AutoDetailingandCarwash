/**
 * Same POS voiceline → ElevenLabs + Gemini (female station-style) into e2e-evidence/pos-voice/
 * and a tiny HTML player so you can A/B listen.
 *
 *   node --env-file=.env scripts/_pos-voice-ai-compare.mjs
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { buildPaymentAnnouncement } from '../src/lib/paymentAnnouncement.js'
import {
  ELEVENLABS_DEFAULT_VOICE_ID,
  GEMINI_DEFAULT_VOICE,
  synthesizeElevenLabs,
  synthesizeGemini,
} from '../server/posAnnounceApi.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'pos-voice')
mkdirSync(outDir, { recursive: true })

const text = buildPaymentAnnouncement({ make: 'Toyota', model: 'Vios', plate: 'NBC 4821' })
const report = { text, files: [] }

const elevenKey = process.env.ELEVENLABS_API_KEY
if (elevenKey) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID || ELEVENLABS_DEFAULT_VOICE_ID
  const model = process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2'
  const { bytes } = await synthesizeElevenLabs(text, { apiKey: elevenKey, voiceId, model })
  const out = join(outDir, 'eleven-station-payment.mp3')
  writeFileSync(out, bytes)
  report.files.push({ provider: 'elevenlabs', voice: voiceId, model, bytes: bytes.length, out })
} else {
  report.elevenlabs = 'skipped — ELEVENLABS_API_KEY missing'
}

const geminiKey = process.env.GEMINI_API_KEY
if (!geminiKey) {
  console.error(JSON.stringify({ ...report, error: 'GEMINI_API_KEY missing from .env — add it, then re-run' }, null, 2))
  process.exit(1)
}

const geminiModel = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts'
const geminiVoice = process.env.GEMINI_TTS_VOICE || GEMINI_DEFAULT_VOICE
const wav = await synthesizeGemini(text, {
  apiKey: geminiKey,
  model: geminiModel,
  voice: geminiVoice,
  stationStyle: true,
})
const geminiOut = join(outDir, 'gemini-station-payment.wav')
writeFileSync(geminiOut, wav)
report.files.push({ provider: 'gemini', voice: geminiVoice, model: geminiModel, bytes: wav.length, out: geminiOut })

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>POS voice compare — station woman</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; }
    p { color: #333; line-height: 1.45; }
    article { border: 1px solid #ddd; border-radius: 12px; padding: 1rem 1.25rem; margin: 1rem 0; }
    audio { width: 100%; margin-top: 0.75rem; }
    code { font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>POS announcer — same line, station-style woman</h1>
  <p><strong>Line:</strong> <code>${text.replace(/</g, '&lt;')}</code></p>
  <article>
    <h2>ElevenLabs (Lily)</h2>
    <audio controls src="./eleven-station-payment.mp3"></audio>
  </article>
  <article>
    <h2>Gemini (${geminiVoice})</h2>
    <audio controls src="./gemini-station-payment.wav"></audio>
  </article>
</body>
</html>
`
const htmlOut = join(outDir, 'compare-station.html')
writeFileSync(htmlOut, html)
report.compareHtml = htmlOut

console.log(JSON.stringify(report, null, 2))

if (process.platform === 'win32') {
  if (existsSync(geminiOut)) spawn('cmd', ['/c', 'start', '', geminiOut], { detached: true, stdio: 'ignore' }).unref()
  spawn('cmd', ['/c', 'start', '', htmlOut], { detached: true, stdio: 'ignore' }).unref()
}
