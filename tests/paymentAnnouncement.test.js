import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { buildPaymentAnnouncement, isReadyForPaymentVoice, pickAnnouncerVoice, spellPlate, waitForVoices } from '../src/lib/paymentAnnouncement.js'
import {
  ELEVENLABS_DEFAULT_VOICE_ID,
  GEMINI_DEFAULT_VOICE,
  clearPosAnnounceMemoryCache,
  elevenLabsCreditsGone,
  resetElevenLabsCredits,
  geminiTtsPrompt,
  getRememberedClip,
  handlePosAnnounceRequest,
  pcmToWav,
  posAnnounceCacheCandidates,
  posAnnounceCacheKey,
  posAnnounceStoragePath,
  rememberClip,
  resolveCachedPosAnnounce,
  staffCanAnnounce,
  synthesizeElevenLabs,
  synthesizeGemini,
  synthesizePosAnnounce,
} from '../server/posAnnounceApi.mjs'

function response() {
  const out = { statusCode: 200, headers: {}, body: '' }
  return {
    out,
    setHeader(name, value) {
      out.headers[name] = value
    },
    end(body = '') {
      out.body = body
    },
    get statusCode() {
      return out.statusCode
    },
    set statusCode(value) {
      out.statusCode = value
    },
  }
}

describe('spellPlate', () => {
  it('spells letters and digits one by one, pausing between groups', () => {
    assert.equal(spellPlate('nbc 4821'), 'N B C, 4 8 2 1')
    assert.equal(spellPlate('ABC-123'), 'A B C, 1 2 3')
  })

  it('drops anything that is not a letter or digit', () => {
    assert.equal(spellPlate('  <b>12</b> '), 'B, 1 2, B')
    assert.equal(spellPlate(''), '')
    assert.equal(spellPlate(null), '')
  })
})

describe('buildPaymentAnnouncement', () => {
  it('says make, model and plate', () => {
    assert.equal(
      buildPaymentAnnouncement({ make: 'Toyota', model: 'Vios', plate: 'NBC 4821' }),
      'Toyota Vios, plate N B C, 4 8 2 1, is ready for payment.',
    )
  })

  it('does not repeat the make when the model already starts with it', () => {
    assert.equal(
      buildPaymentAnnouncement({ make: 'Toyota', model: 'toyota Vios', plate: 'AAA1' }),
      'toyota Vios, plate A A A, 1, is ready for payment.',
    )
  })

  it('degrades when details are missing', () => {
    assert.equal(buildPaymentAnnouncement({ plate: 'XYZ 9' }), 'Plate X Y Z, 9, is ready for payment.')
    assert.equal(buildPaymentAnnouncement({ make: 'Honda', model: 'City' }), 'Honda City is ready for payment.')
    assert.equal(buildPaymentAnnouncement({}), 'A car is ready for payment.')
    assert.equal(buildPaymentAnnouncement(), 'A car is ready for payment.')
  })

  it('speaks only a visit that is ready for payment', () => {
    const row = (status) => ({ status: 'pending', bookings: { status, vehicle_plate: 'ABC123' } })
    assert.equal(isReadyForPaymentVoice(row('for_payment')), true)
    assert.equal(isReadyForPaymentVoice(row('waiting')), false)
    assert.equal(isReadyForPaymentVoice(row('in_progress')), false)
    assert.equal(isReadyForPaymentVoice(row('final_checking')), false)
    assert.equal(isReadyForPaymentVoice(row('completed')), false)
    assert.equal(isReadyForPaymentVoice({ status: 'pending' }), false)
    const announcer = readFileSync(new URL('../src/lib/posAnnouncer.js', import.meta.url), 'utf8')
    assert.match(announcer, /isReadyForPaymentVoice\(row\)/)
    assert.match(announcer, /res\.status === 402/)
  })

  it('strips markup and caps length so the voice never reads junk', () => {
    const text = buildPaymentAnnouncement({ make: '<script>alert(1)</script>', model: 'x'.repeat(200), plate: '' })
    assert.doesNotMatch(text, /[<>()]/)
    assert.ok(text.length < 110)
  })
})

describe('waitForVoices', () => {
  function fakeSynth(initial) {
    let voices = initial
    const listeners = new Set()
    return {
      getVoices: () => voices,
      addEventListener: (_e, fn) => listeners.add(fn),
      removeEventListener: (_e, fn) => listeners.delete(fn),
      load(next) {
        voices = next
        for (const fn of [...listeners]) fn()
      },
      listeners,
    }
  }
  const rosa = { name: 'Microsoft Rosa Online (Natural) - English (Philippines)', lang: 'en-PH' }
  const david = { name: 'Microsoft David', lang: 'en-US', default: true }

  it('waits for the list the browser loads after page start instead of speaking with no voice', async () => {
    const synth = fakeSynth([])
    const ready = waitForVoices(synth, 2000)
    setTimeout(() => synth.load([david]), 5)
    setTimeout(() => synth.load([david, rosa]), 10)
    assert.deepEqual(await ready, [david, rosa])
    assert.equal(synth.listeners.size, 0)
  })

  it('returns at once when a Philippine voice is already there', async () => {
    assert.deepEqual(await waitForVoices(fakeSynth([david, rosa]), 2000), [david, rosa])
  })

  it('gives up after the timeout with whatever loaded (Chrome has no PH voice)', async () => {
    const synth = fakeSynth([])
    setTimeout(() => synth.load([david]), 5)
    assert.deepEqual(await waitForVoices(synth, 30), [david])
    assert.deepEqual(await waitForVoices(null, 30), [])
  })
})

describe('pickAnnouncerVoice', () => {
  const v = (name, lang, extra = {}) => ({ name, lang, ...extra })
  const robotic = v('Microsoft David', 'en-US', { default: true })
  const usNatural = v('Microsoft Aria Online (Natural)', 'en-US')
  const phEnglish = v('Google English (Philippines)', 'en-PH')
  const filipino = v('Filipino', 'fil-PH')
  const filNatural = v('Microsoft Blessica Online (Natural) - Filipino (Philippines)', 'fil-PH')
  const phNatural = v('Microsoft Rosa Online (Natural) - English (Philippines)', 'en-PH')

  it('prefers a natural Philippine English voice, then a natural Filipino voice', () => {
    assert.equal(pickAnnouncerVoice([robotic, usNatural, filNatural, phNatural]), phNatural)
    assert.equal(pickAnnouncerVoice([robotic, usNatural, phEnglish, filNatural]), filNatural)
  })

  it('picks the female Philippine voice whatever order the browser lists them in', () => {
    const james = v('Microsoft James Online (Natural) - English (Philippines)', 'en-PH')
    const angelo = v('Microsoft Angelo Online (Natural) - Filipino (Philippines)', 'fil-PH')
    assert.equal(pickAnnouncerVoice([james, angelo, filNatural, phNatural]), phNatural)
    assert.equal(pickAnnouncerVoice([james, phNatural]), phNatural)
    assert.equal(pickAnnouncerVoice([angelo, filNatural]), filNatural)
  })

  it('takes any Philippine voice over a non-PH natural voice', () => {
    assert.equal(pickAnnouncerVoice([robotic, usNatural, phEnglish]), phEnglish)
    assert.equal(pickAnnouncerVoice([robotic, usNatural, filipino]), filipino)
  })

  it('Chrome on Windows (no Philippine voice) still gets a woman, never David', () => {
    const david = v('Microsoft David - English (United States)', 'en-US', { default: true })
    const mark = v('Microsoft Mark - English (United States)', 'en-US')
    const zira = v('Microsoft Zira - English (United States)', 'en-US')
    const googleUs = v('Google US English', 'en-US')
    const googleUkF = v('Google UK English Female', 'en-GB')
    const googleUkM = v('Google UK English Male', 'en-GB')
    assert.equal(pickAnnouncerVoice([david, mark, zira, googleUs, googleUkF, googleUkM]), googleUs)
    assert.equal(pickAnnouncerVoice([david, mark, zira]), zira)
  })

  it('falls back to a natural English voice, then the default, then nothing', () => {
    assert.equal(pickAnnouncerVoice([robotic, usNatural]), usNatural)
    assert.equal(pickAnnouncerVoice([v('Kyoko', 'ja-JP'), robotic]), robotic)
    assert.equal(pickAnnouncerVoice([v('Kyoko', 'ja-JP')]), null)
    assert.equal(pickAnnouncerVoice([]), null)
  })
})

describe('staffCanAnnounce', () => {
  it('lets a Branch Admin announce only their own branches', () => {
    const ba = { role: 'admin', branch_slug: 'bacoor' }
    assert.equal(staffCanAnnounce(ba, ['bacoor'], 'bacoor'), true)
    assert.equal(staffCanAnnounce(ba, ['bacoor'], 'imus'), false)
  })

  it('lets Super Admin announce any branch and blocks non-POS roles', () => {
    assert.equal(staffCanAnnounce({ role: 'BossMich' }, [], 'imus'), true)
    assert.equal(staffCanAnnounce({ role: 'team_lead', branch_slug: 'imus' }, ['imus'], 'imus'), false)
    assert.equal(staffCanAnnounce(null, [], 'imus'), false)
  })
})

describe('pcmToWav', () => {
  it('wraps raw 16-bit mono PCM in a RIFF header', () => {
    const wav = pcmToWav(Buffer.alloc(10), 24000)
    assert.equal(wav.length, 54)
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF')
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE')
    assert.equal(wav.readUInt32LE(24), 24000)
    assert.equal(wav.readUInt32LE(40), 10)
  })
})

describe('geminiTtsPrompt', () => {
  it('keeps the payment sentence and adds station-style direction', () => {
    const line = 'Toyota Vios, plate N B C, 4 8 2 1, is ready for payment.'
    const prompt = geminiTtsPrompt(line)
    assert.match(prompt, /Japanese train-station/)
    assert.match(prompt, /high female/)
    assert.ok(prompt.endsWith(line))
    assert.equal(geminiTtsPrompt(line, { stationStyle: false }), line)
  })
})

describe('synthesizeGemini', () => {
  const reply = (mimeType, bytes) => async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ inlineData: { mimeType, data: Buffer.from(bytes).toString('base64') } }] } }],
    }),
  })

  it('passes WAV through untouched (Gemini 3.8 default)', async () => {
    const wav = pcmToWav(Buffer.alloc(4))
    const out = await synthesizeGemini('hi', {
      apiKey: 'k',
      model: 'm',
      voice: 'v',
      stationStyle: false,
      fetchImpl: reply('audio/wav', wav),
    })
    assert.deepEqual(out, wav)
  })

  it('sends station-style prompt with a female default voice name', async () => {
    let sent
    await synthesizeGemini('Toyota Vios, plate N B C, 4 8 2 1, is ready for payment.', {
      apiKey: 'k',
      model: 'm',
      fetchImpl: async (_url, init) => {
        sent = JSON.parse(init.body)
        return reply('audio/wav', pcmToWav(Buffer.alloc(2)))()
      },
    })
    assert.match(sent.contents[0].parts[0].text, /Japanese train-station/)
    assert.match(sent.contents[0].parts[0].text, /is ready for payment\.$/)
    assert.equal(sent.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, GEMINI_DEFAULT_VOICE)
  })

  it('wraps legacy raw L16 PCM using the reported sample rate', async () => {
    const out = await synthesizeGemini('hi', {
      apiKey: 'k',
      model: 'm',
      voice: 'v',
      stationStyle: false,
      fetchImpl: reply('audio/L16;codec=pcm;rate=16000', [1, 2, 3, 4]),
    })
    assert.equal(out.toString('ascii', 0, 4), 'RIFF')
    assert.equal(out.readUInt32LE(24), 16000)
  })

  it('surfaces provider failures as 502', async () => {
    await assert.rejects(
      synthesizeGemini('hi', {
        apiKey: 'k',
        model: 'm',
        voice: 'v',
        stationStyle: false,
        fetchImpl: async () => ({ ok: false, status: 429 }),
      }),
      (err) => err.status === 502,
    )
  })
})

describe('synthesizeElevenLabs', () => {
  it('posts the same English text to ElevenLabs and returns mpeg bytes', async () => {
    const calls = []
    const out = await synthesizeElevenLabs('Toyota Vios, plate N B C, 4 8 2 1, is ready for payment.', {
      apiKey: 'sk_test',
      voiceId: 'voice-1',
      model: 'eleven_multilingual_v2',
      fetchImpl: async (url, init) => {
        calls.push({ url, init })
        return {
          ok: true,
          arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
        }
      },
    })
    assert.equal(out.contentType, 'audio/mpeg')
    assert.deepEqual([...out.bytes], [1, 2, 3, 4])
    assert.match(calls[0].url, /text-to-speech\/voice-1/)
    assert.equal(calls[0].init.headers['xi-api-key'], 'sk_test')
    const body = JSON.parse(calls[0].init.body)
    assert.equal(body.text, 'Toyota Vios, plate N B C, 4 8 2 1, is ready for payment.')
    assert.equal(body.model_id, 'eleven_multilingual_v2')
    assert.ok(body.voice_settings.stability >= 0.8)
  })

  it('surfaces provider failures as 502', async () => {
    await assert.rejects(
      synthesizeElevenLabs('hi', { apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 401 }) }),
      (err) => err.status === 502,
    )
  })
})

describe('synthesizePosAnnounce', () => {
  it('prefers ElevenLabs over Gemini when both keys exist', async () => {
    resetElevenLabsCredits()
    const out = await synthesizePosAnnounce('hi', { ELEVENLABS_API_KEY: 'e', GEMINI_API_KEY: 'g' }, async () => ({
      ok: true,
      arrayBuffer: async () => Uint8Array.from([9]).buffer,
    }))
    assert.equal(out.contentType, 'audio/mpeg')
    assert.equal(out.provider, 'eleven')
    assert.match(out.cacheKey, new RegExp(`^eleven\\|eleven_multilingual_v2\\|${ELEVENLABS_DEFAULT_VOICE_ID}\\|`))
  })

  it('falls back to Gemini when ElevenLabs has an outage and both keys exist', async () => {
    resetElevenLabsCredits()
    let n = 0
    const out = await synthesizePosAnnounce(
      'Toyota Vios, plate N B C, 4 8 2 1, is ready for payment.',
      { ELEVENLABS_API_KEY: 'e', GEMINI_API_KEY: 'g' },
      async () => {
        n += 1
        if (n === 1) return { ok: false, status: 429 }
        const wav = pcmToWav(Buffer.alloc(4))
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } }],
                },
              },
            ],
          }),
        }
      },
    )
    assert.equal(out.provider, 'gemini')
    assert.equal(out.contentType, 'audio/wav')
    assert.match(out.cacheKey, /^gemini\|/)
  })

  it('uses the free browser path when ElevenLabs credit is gone, and does not call Gemini', async () => {
    resetElevenLabsCredits()
    let calls = 0
    const gone = await synthesizePosAnnounce(
      'Toyota Vios, plate N B C, 4 8 2 1, is ready for payment.',
      { ELEVENLABS_API_KEY: 'e', GEMINI_API_KEY: 'g' },
      async () => {
        calls += 1
        return { ok: false, status: 401, text: async () => '{"detail":{"status":"quota_exceeded"}}' }
      },
    )
    assert.equal(gone.exhausted, true)
    assert.equal(calls, 1)
    const again = await synthesizePosAnnounce('another car', { ELEVENLABS_API_KEY: 'e', GEMINI_API_KEY: 'g' }, async () => {
      calls += 1
      return { ok: true, arrayBuffer: async () => Uint8Array.from([1]).buffer }
    })
    assert.equal(again.exhausted, true)
    assert.equal(calls, 1)
    assert.equal(elevenLabsCreditsGone(402), true)
    assert.equal(elevenLabsCreditsGone(500, 'quota_exceeded'), true)
    assert.equal(elevenLabsCreditsGone(429, 'rate limit'), false)
    resetElevenLabsCredits()
  })

  it('returns null when no AI key is configured', async () => {
    assert.equal(await synthesizePosAnnounce('hi', {}, async () => ({ ok: true })), null)
  })
})

describe('pos announce clip cache', () => {
  it('builds a stable path from text hash, not the raw sentence', () => {
    const key = posAnnounceCacheKey({
      provider: 'eleven',
      model: 'eleven_multilingual_v2',
      voice: ELEVENLABS_DEFAULT_VOICE_ID,
      text: 'Toyota Vios, plate N B C, 4 8 2 1, is ready for payment.',
    })
    const again = posAnnounceCacheKey({
      provider: 'eleven',
      model: 'eleven_multilingual_v2',
      voice: ELEVENLABS_DEFAULT_VOICE_ID,
      text: 'Toyota Vios, plate N B C, 4 8 2 1, is ready for payment.',
    })
    assert.equal(key, again)
    assert.match(posAnnounceStoragePath(key), /^eleven\/eleven_multilingual_v2\/.+\/[a-f0-9]{32}\.mp3$/)
  })

  it('lists ElevenLabs before Gemini when both keys are set', () => {
    const keys = posAnnounceCacheCandidates('hi', { ELEVENLABS_API_KEY: 'e', GEMINI_API_KEY: 'g' })
    assert.equal(keys.length, 2)
    assert.match(keys[0], /^eleven\|/)
    assert.match(keys[1], /^gemini\|/)
  })

  it('serves memory cache without calling TTS again for the same line', async () => {
    clearPosAnnounceMemoryCache()
    const text = 'Honda City, plate A B C, 1 2 3, is ready for payment.'
    const key = posAnnounceCacheCandidates(text, { ELEVENLABS_API_KEY: 'e' })[0]
    rememberClip(key, { bytes: Buffer.from([1, 2, 3]), contentType: 'audio/mpeg' })
    const hit = await resolveCachedPosAnnounce(text, { ELEVENLABS_API_KEY: 'e' }, null)
    assert.equal(hit.source, 'memory')
    assert.deepEqual([...hit.bytes], [1, 2, 3])
    assert.equal(getRememberedClip(key).contentType, 'audio/mpeg')
    clearPosAnnounceMemoryCache()
  })
})

describe('handlePosAnnounceRequest', () => {
  it('rejects non-POST and missing sign-in before touching the database', async () => {
    const get = response()
    await handlePosAnnounceRequest({ method: 'GET', headers: {} }, get)
    assert.equal(get.out.statusCode, 405)

    const anon = response()
    await handlePosAnnounceRequest({ method: 'POST', headers: {}, socket: {} }, anon)
    assert.equal(anon.out.statusCode, 401)
  })
})
