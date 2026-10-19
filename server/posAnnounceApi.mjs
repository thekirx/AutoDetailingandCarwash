/**
 * POST /api/pos-announce — AI voice clip for "<make> <model>, plate …, is ready for payment."
 * Body: { handoff_id }. Words come from the booking row, never from the client. Returns audio/mpeg or audio/wav.
 * Prefers ElevenLabs (Japanese-station polite English woman) when ELEVENLABS_API_KEY is set.
 * A provider outage can use Gemini. When ElevenLabs credit is gone, this route returns 402
 * and the POS uses the free browser voice. It does not spend Gemini on a dead credit balance.
 * Clips are keyed by spoken text + voice settings and kept in memory + private Storage so repeat
 * customers (same plate/line) do not burn TTS tokens again.
 */
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { canAccessPos, getBranchScopeList } from '../src/auth/permissions.js'
import { buildPaymentAnnouncement } from '../src/lib/paymentAnnouncement.js'
import { bearer, json, readJsonBody, setCors, clientIp, rateLimit } from './httpUtil.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_CLIPS = 200
/** Private bucket — service role only (no authenticated policies). */
export const POS_ANNOUNCE_BUCKET = 'pos-announce-clips'
/** Lily — soft, clear, high female; settings below aim at Japanese station / keigo commercial calm. */
export const ELEVENLABS_DEFAULT_VOICE_ID = 'pFZP5JQG7iQjIQuC4Bku'
/** Female Gemini prebuilt voices (station-style default: Aoede — breezy / higher). */
export const GEMINI_DEFAULT_VOICE = 'Aoede'
/** In-process L1; Storage is L2 across cold starts. Value: { bytes, contentType }. */
const clips = new Map()
/** Process latch: once credit is gone, later cars skip ElevenLabs entirely. */
let elevenCreditsGone = false

/** 402, or a body that says the character quota / credit balance is finished. */
export function elevenLabsCreditsGone(status, body = '') {
  if (Number(status) === 402) return true
  return /quota_exceeded|quota|insufficient.?credit|payment required/i.test(String(body || ''))
}

export function resetElevenLabsCredits() {
  elevenCreditsGone = false
}

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function staffCanAnnounce(staff, branchSlugs, branch) {
  if (!staff || !canAccessPos(staff)) return false
  const scope = getBranchScopeList({ ...staff, branch_slugs: branchSlugs })
  return scope === null || scope.includes(branch)
}

export function pcmToWav(pcm, sampleRate = 24000) {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

function textHash(text) {
  return createHash('sha256').update(String(text)).digest('hex').slice(0, 32)
}

function safePathPart(value) {
  return String(value || 'x').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)
}

/** Stable cache identity for a provider + spoken line (not handoff_id). */
export function posAnnounceCacheKey({ provider, model, voice, text }) {
  return `${provider}|${model}|${voice}|${textHash(text)}`
}

export function posAnnounceStoragePath(cacheKey) {
  const [provider, model, voice, hash] = String(cacheKey).split('|')
  const ext = provider === 'eleven' ? 'mp3' : 'wav'
  return `${safePathPart(provider)}/${safePathPart(model)}/${safePathPart(voice)}/${safePathPart(hash)}.${ext}`
}

/** Lookup order: preferred ElevenLabs key first, then Gemini — matches synthesize fallback. */
export function posAnnounceCacheCandidates(text, env = process.env) {
  const keys = []
  if (env.ELEVENLABS_API_KEY) {
    keys.push(
      posAnnounceCacheKey({
        provider: 'eleven',
        model: env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2',
        voice: env.ELEVENLABS_VOICE_ID || ELEVENLABS_DEFAULT_VOICE_ID,
        text,
      }),
    )
  }
  if (env.GEMINI_API_KEY) {
    keys.push(
      posAnnounceCacheKey({
        provider: 'gemini',
        model: env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts',
        voice: env.GEMINI_TTS_VOICE || GEMINI_DEFAULT_VOICE,
        text,
      }),
    )
  }
  return keys
}

export function rememberClip(cacheKey, clip) {
  if (!cacheKey || !clip?.bytes?.length) return
  if (clips.size >= MAX_CLIPS) clips.delete(clips.keys().next().value)
  clips.set(cacheKey, { bytes: clip.bytes, contentType: clip.contentType || 'audio/mpeg' })
}

export function getRememberedClip(cacheKey) {
  return clips.get(cacheKey) || null
}

/** Test / cold-start helper — clears L1 only. */
export function clearPosAnnounceMemoryCache() {
  clips.clear()
}

export async function loadClipFromStorage(db, cacheKey) {
  if (!db || !cacheKey) return null
  try {
    const path = posAnnounceStoragePath(cacheKey)
    const { data, error } = await db.storage.from(POS_ANNOUNCE_BUCKET).download(path)
    if (error || !data) return null
    const bytes = Buffer.from(await data.arrayBuffer())
    if (!bytes.length) return null
    const contentType = path.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg'
    return { bytes, contentType }
  } catch {
    return null
  }
}

export async function saveClipToStorage(db, cacheKey, clip) {
  if (!db || !cacheKey || !clip?.bytes?.length) return false
  try {
    const path = posAnnounceStoragePath(cacheKey)
    const { error } = await db.storage.from(POS_ANNOUNCE_BUCKET).upload(path, clip.bytes, {
      contentType: clip.contentType || 'audio/mpeg',
      upsert: true,
    })
    return !error
  } catch {
    return false
  }
}

/**
 * Same payment sentence. Optional styleHint steers delivery (Japanese station / keigo calm)
 * without changing the words after the colon — Gemini TTS style prompting.
 */
export function geminiTtsPrompt(text, { stationStyle = true } = {}) {
  if (!stationStyle) return text
  return (
    'Say calmly in a polite, formal, high female customer-service tone ' +
    'like a Japanese train-station or shop announcement, in clear English: ' +
    text
  )
}

export async function synthesizeGemini(
  text,
  { apiKey, model, voice = GEMINI_DEFAULT_VOICE, stationStyle = true, fetchImpl = fetch } = {},
) {
  const spoken = geminiTtsPrompt(text, { stationStyle })
  const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: spoken }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) throw Object.assign(new Error(`Voice provider error ${res.status}`), { status: 502 })
  const body = await res.json()
  const audio = body?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.data)?.inlineData
  if (!audio) throw Object.assign(new Error('Voice provider returned no audio'), { status: 502 })
  const bytes = Buffer.from(audio.data, 'base64')
  const mime = String(audio.mimeType || '')
  // Gemini 3.8 TTS returns WAV; older TTS models return headerless 16-bit PCM.
  return /wav/i.test(mime) ? bytes : pcmToWav(bytes, Number(/rate=(\d+)/i.exec(mime)?.[1]) || 24000)
}

/**
 * Same English voiceline as the browser path. Delivery: calm, formal, high female
 * customer-service tone (Japanese station / commercial keigo character), not a new script.
 */
export async function synthesizeElevenLabs(
  text,
  {
    apiKey,
    voiceId = ELEVENLABS_DEFAULT_VOICE_ID,
    model = 'eleven_multilingual_v2',
    fetchImpl = fetch,
  } = {},
) {
  const res = await fetchImpl(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          // High stability + low style ≈ measured PA / keigo commercial calm.
          stability: 0.85,
          similarity_boost: 0.5,
          style: 0.12,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(12_000),
    },
  )
  if (!res.ok) {
    const detail = typeof res.text === 'function' ? await res.text().catch(() => '') : ''
    throw Object.assign(new Error(`Voice provider error ${res.status}`), {
      status: 502,
      creditsGone: elevenLabsCreditsGone(res.status, detail),
    })
  }
  const bytes = Buffer.from(await res.arrayBuffer())
  if (!bytes.length) throw Object.assign(new Error('Voice provider returned no audio'), { status: 502 })
  return { bytes, contentType: 'audio/mpeg' }
}

async function synthesizeGeminiClip(text, env, fetchImpl) {
  const model = env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts'
  const voice = env.GEMINI_TTS_VOICE || GEMINI_DEFAULT_VOICE
  const bytes = await synthesizeGemini(text, {
    apiKey: env.GEMINI_API_KEY,
    model,
    voice,
    fetchImpl,
  })
  return {
    bytes,
    contentType: 'audio/wav',
    cacheKey: posAnnounceCacheKey({ provider: 'gemini', model, voice, text }),
    provider: 'gemini',
  }
}

/**
 * ElevenLabs first when keyed. A credit/quota failure returns `{ exhausted: true }`
 * and does not call Gemini. Any other ElevenLabs error can still use Gemini.
 * Returns null only when no AI key is configured.
 */
export async function synthesizePosAnnounce(text, env = process.env, fetchImpl = fetch) {
  const elevenKey = env.ELEVENLABS_API_KEY
  const geminiKey = env.GEMINI_API_KEY
  let elevenErr = null

  if (elevenKey && elevenCreditsGone) return { exhausted: true }

  if (elevenKey) {
    const voiceId = env.ELEVENLABS_VOICE_ID || ELEVENLABS_DEFAULT_VOICE_ID
    const model = env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2'
    try {
      const { bytes, contentType } = await synthesizeElevenLabs(text, {
        apiKey: elevenKey,
        voiceId,
        model,
        fetchImpl,
      })
      return {
        bytes,
        contentType,
        cacheKey: posAnnounceCacheKey({ provider: 'eleven', model, voice: voiceId, text }),
        provider: 'eleven',
      }
    } catch (err) {
      if (err.creditsGone) {
        elevenCreditsGone = true
        return { exhausted: true }
      }
      elevenErr = err
      if (!geminiKey) throw err
    }
  }

  if (geminiKey) {
    try {
      return await synthesizeGeminiClip(text, env, fetchImpl)
    } catch (err) {
      if (elevenErr) throw elevenErr
      throw err
    }
  }

  return null
}

/** L1 memory then L2 Storage — never calls TTS. */
export async function resolveCachedPosAnnounce(text, env = process.env, db = null) {
  for (const key of posAnnounceCacheCandidates(text, env)) {
    const mem = getRememberedClip(key)
    if (mem) return { ...mem, cacheKey: key, source: 'memory' }
    if (!db) continue
    const stored = await loadClipFromStorage(db, key)
    if (stored) {
      rememberClip(key, stored)
      return { ...stored, cacheKey: key, source: 'storage' }
    }
  }
  return null
}

export async function handlePosAnnounceRequest(req, res) {
  setCors(res, 'POST, OPTIONS', req)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' }, req)

  try {
    rateLimit({ key: `pos-announce:${clientIp(req)}`, limit: 30, windowMs: 60_000 })
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Unauthorized' }, req)
    const db = admin()
    const { data: userData } = await db.auth.getUser(token)
    if (!userData?.user) return json(res, 401, { error: 'Unauthorized' }, req)

    const { data: staff } = await db
      .from('staff_profiles')
      .select('id, role, is_active, permission_grants, branch_slug')
      .eq('id', userData.user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!canAccessPos(staff)) return json(res, 403, { error: 'Forbidden' }, req)

    const body = await readJsonBody(req)
    const handoffId = String(body.handoff_id || '')
    if (!UUID.test(handoffId)) return json(res, 400, { error: 'handoff_id required' }, req)

    const { data: handoff, error } = await db
      .from('pos_handoffs')
      .select('id, branch, status, bookings(status, vehicle_make, vehicle_model, vehicle_plate)')
      .eq('id', handoffId)
      .maybeSingle()
    if (error) return json(res, 400, { error: error.message }, req)
    const booking = Array.isArray(handoff?.bookings) ? handoff.bookings[0] : handoff?.bookings
    if (!handoff || handoff.status !== 'pending' || booking?.status !== 'for_payment') {
      return json(res, 404, { error: 'Ticket not waiting to pay' }, req)
    }

    let branchSlugs = staff.branch_slug ? [staff.branch_slug] : []
    if (staff.role === 'admin') {
      const { data: assigns } = await db.from('staff_branch_assignments').select('branch_slug').eq('staff_id', staff.id)
      if (assigns?.length) branchSlugs = assigns.map((a) => a.branch_slug).filter(Boolean)
    }
    if (!staffCanAnnounce(staff, branchSlugs, handoff.branch)) return json(res, 403, { error: 'Forbidden' }, req)

    const spokenBooking = booking || {}
    const text = buildPaymentAnnouncement({
      make: spokenBooking.vehicle_make,
      model: spokenBooking.vehicle_model,
      plate: spokenBooking.vehicle_plate,
    })

    const cached = await resolveCachedPosAnnounce(text, process.env, db)
    if (cached) {
      res.statusCode = 200
      res.setHeader('Content-Type', cached.contentType)
      res.setHeader('Cache-Control', 'private, max-age=86400')
      res.setHeader('X-Pos-Announce-Cache', cached.source)
      res.end(cached.bytes)
      return
    }

    const synthesized = await synthesizePosAnnounce(text)
    if (synthesized?.exhausted) {
      return json(res, 402, { error: 'ElevenLabs credits are gone', fallback: 'browser' }, req)
    }
    if (!synthesized) return json(res, 501, { error: 'AI voice not configured' }, req)

    const clip = { bytes: synthesized.bytes, contentType: synthesized.contentType }
    rememberClip(synthesized.cacheKey, clip)
    // Durable save — failure must not drop the live response (tokens already spent).
    await saveClipToStorage(db, synthesized.cacheKey, clip)

    res.statusCode = 200
    res.setHeader('Content-Type', synthesized.contentType)
    res.setHeader('Cache-Control', 'private, max-age=86400')
    res.setHeader('X-Pos-Announce-Cache', 'miss')
    res.end(synthesized.bytes)
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) }, req)
  }
}
