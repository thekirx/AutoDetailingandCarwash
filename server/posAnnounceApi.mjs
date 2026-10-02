/**
 * POST /api/pos-announce — AI voice clip for "<make> <model>, plate …, is ready for payment."
 * Body: { handoff_id }. Words come from the booking row, never from the client. Returns audio/wav.
 * 501 when GEMINI_API_KEY is unset — the POS then uses the browser voice.
 */
import { createClient } from '@supabase/supabase-js'
import { canAccessPos, getBranchScopeList } from '../src/auth/permissions.js'
import { buildPaymentAnnouncement } from '../src/lib/paymentAnnouncement.js'
import { bearer, json, readJsonBody, setCors, clientIp, rateLimit } from './httpUtil.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_CLIPS = 200
/** ponytail: per-instance cache keyed by text — move to a private Storage bucket if cold starts make repeats miss. */
const clips = new Map()

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

export async function synthesizeGemini(text, { apiKey, model, voice, fetchImpl = fetch }) {
  const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
    signal: AbortSignal.timeout(8000),
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
      .select('id, branch, status, bookings(vehicle_make, vehicle_model, vehicle_plate)')
      .eq('id', handoffId)
      .maybeSingle()
    if (error) return json(res, 400, { error: error.message }, req)
    if (!handoff || handoff.status !== 'pending') return json(res, 404, { error: 'Ticket not waiting to pay' }, req)

    let branchSlugs = staff.branch_slug ? [staff.branch_slug] : []
    if (staff.role === 'admin') {
      const { data: assigns } = await db.from('staff_branch_assignments').select('branch_slug').eq('staff_id', staff.id)
      if (assigns?.length) branchSlugs = assigns.map((a) => a.branch_slug).filter(Boolean)
    }
    if (!staffCanAnnounce(staff, branchSlugs, handoff.branch)) return json(res, 403, { error: 'Forbidden' }, req)

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return json(res, 501, { error: 'AI voice not configured' }, req)

    const booking = handoff.bookings || {}
    const text = buildPaymentAnnouncement({
      make: booking.vehicle_make,
      model: booking.vehicle_model,
      plate: booking.vehicle_plate,
    })
    const model = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts'
    const voice = process.env.GEMINI_TTS_VOICE || 'Kore'
    const cacheKey = `${model}|${voice}|${text}`
    let wav = clips.get(cacheKey)
    if (!wav) {
      wav = await synthesizeGemini(text, { apiKey, model, voice })
      if (clips.size >= MAX_CLIPS) clips.delete(clips.keys().next().value)
      clips.set(cacheKey, wav)
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'audio/wav')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.end(wav)
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) }, req)
  }
}
