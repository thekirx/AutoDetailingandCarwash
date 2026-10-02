/**
 * Counter speaker: chime, then "<make> <model>, plate …, is ready for payment."
 * AI voice (/api/pos-announce) when it answers fast; otherwise the browser's own voice.
 * Opt-in per device — only the tablet wired to the speaker should turn it on.
 */
import { useEffect } from 'react'
import { buildPaymentAnnouncement } from '@/lib/paymentAnnouncement'
import { getAccessTokenFresh } from '@/lib/authToken'

const STORAGE_KEY = 'hakum.pos.announcer'
const AI_VOICE_WAIT_MS = 2500
const clipUrls = new Map()
let aiVoiceOff = false
let audioCtx = null
let queue = Promise.resolve()

export function readAnnouncerOn() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeAnnouncerOn(on) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    /* private mode — toggle still works for this visit */
  }
}

/** Browsers block sound until a tap; call from a click/tap handler. */
export function unlockAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  audioCtx ||= new AudioCtx()
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
  window.speechSynthesis?.getVoices()
  return audioCtx
}

function chime() {
  const ctx = unlockAudio()
  if (!ctx) return Promise.resolve()
  const t = ctx.currentTime
  for (const [freq, at] of [[880, 0], [1320, 0.18]]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t + at)
    gain.gain.exponentialRampToValueAtTime(0.35, t + at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t + at)
    osc.stop(t + at + 0.65)
  }
  return new Promise((resolve) => setTimeout(resolve, 750))
}

function pickVoice() {
  const en = (window.speechSynthesis?.getVoices() || []).filter((v) => /^en/i.test(v.lang))
  const natural = (v) => /natural|online/i.test(v.name)
  return (
    en.find((v) => /en-PH/i.test(v.lang) && natural(v)) ||
    en.find(natural) ||
    en.find((v) => /en-PH/i.test(v.lang)) ||
    en.find((v) => v.default) ||
    en[0] ||
    null
  )
}

function speakWithBrowser(text) {
  const synth = window.speechSynthesis
  if (!synth || typeof window.SpeechSynthesisUtterance === 'undefined') return Promise.resolve()
  return new Promise((resolve) => {
    const utter = new window.SpeechSynthesisUtterance(text)
    const voice = pickVoice()
    utter.lang = voice?.lang || 'en-US'
    if (voice) utter.voice = voice
    utter.rate = 0.95
    utter.onend = resolve
    utter.onerror = resolve
    synth.cancel()
    synth.speak(utter)
    setTimeout(resolve, 15_000)
  })
}

async function fetchAiClip(handoffId, text) {
  if (aiVoiceOff) return null
  if (clipUrls.has(text)) return clipUrls.get(text)
  const token = await getAccessTokenFresh()
  if (!token) return null
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), AI_VOICE_WAIT_MS)
  try {
    const res = await fetch('/api/pos-announce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ handoff_id: handoffId }),
      signal: abort.signal,
    })
    if (res.status === 501) aiVoiceOff = true
    if (!res.ok || !String(res.headers.get('content-type') || '').startsWith('audio/')) return null
    const url = URL.createObjectURL(await res.blob())
    clipUrls.set(text, url)
    return url
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function playClip(url) {
  return new Promise((resolve) => {
    const audio = new Audio(url)
    audio.onended = () => resolve(true)
    audio.onerror = () => resolve(false)
    audio.play().catch(() => resolve(false))
  })
}

function enqueue(task) {
  queue = queue.then(task).catch(() => {})
  return queue
}

/** One pos_handoffs row (with bookings join) → chime + voice. Calls are spoken one after another. */
export function announcePayment(row) {
  const booking = row?.bookings || {}
  const text = buildPaymentAnnouncement({
    make: booking.vehicle_make,
    model: booking.vehicle_model,
    plate: booking.vehicle_plate,
  })
  return enqueue(async () => {
    const clip = fetchAiClip(row.id, text)
    await chime()
    const url = await clip
    if (url && (await playClip(url))) return
    await speakWithBrowser(text)
  })
}

export function announceTest() {
  return enqueue(async () => {
    await chime()
    await speakWithBrowser('Payment announcements are on.')
  })
}

/** Keeps the announcer tablet awake and re-arms audio on the first tap after a reload. */
export function useAnnouncerDevice(on) {
  useEffect(() => {
    if (!on) return undefined
    let lock = null
    let stopped = false
    const acquire = () => {
      if (!navigator.wakeLock || document.visibilityState !== 'visible') return
      navigator.wakeLock
        .request('screen')
        .then((next) => {
          if (stopped) next.release().catch(() => {})
          else lock = next
        })
        .catch(() => {})
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', acquire)
      window.removeEventListener('pointerdown', unlockAudio)
      lock?.release().catch(() => {})
    }
  }, [on])
}
