/**
 * Speak the real POS voiceline through ElevenLabs (station-style woman) and save MP3.
 *   node --env-file=.env scripts/_eleven-pos-voice-sample.mjs
 * Plays on Windows via the default media player. Does not touch the database.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { buildPaymentAnnouncement } from '../src/lib/paymentAnnouncement.js'
import { synthesizeElevenLabs, ELEVENLABS_DEFAULT_VOICE_ID } from '../server/posAnnounceApi.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'pos-voice')
mkdirSync(outDir, { recursive: true })

const apiKey = process.env.ELEVENLABS_API_KEY
if (!apiKey) {
  console.error('ELEVENLABS_API_KEY missing from env')
  process.exit(1)
}

const text = buildPaymentAnnouncement({ make: 'Toyota', model: 'Vios', plate: 'NBC 4821' })
const voiceId = process.env.ELEVENLABS_VOICE_ID || ELEVENLABS_DEFAULT_VOICE_ID
const model = process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2'
const { bytes, contentType } = await synthesizeElevenLabs(text, { apiKey, voiceId, model })
const out = join(outDir, 'eleven-station-payment.mp3')
writeFileSync(out, bytes)
console.log(JSON.stringify({ text, voiceId, model, contentType, bytes: bytes.length, out }, null, 2))

if (process.platform === 'win32') {
  spawn('cmd', ['/c', 'start', '', out], { detached: true, stdio: 'ignore' }).unref()
}
