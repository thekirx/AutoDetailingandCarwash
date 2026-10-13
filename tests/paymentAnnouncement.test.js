import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPaymentAnnouncement, pickAnnouncerVoice, spellPlate, waitForVoices } from '../src/lib/paymentAnnouncement.js'
import { handlePosAnnounceRequest, pcmToWav, staffCanAnnounce, synthesizeGemini } from '../server/posAnnounceApi.mjs'

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

describe('synthesizeGemini', () => {
  const reply = (mimeType, bytes) => async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ inlineData: { mimeType, data: Buffer.from(bytes).toString('base64') } }] } }],
    }),
  })

  it('passes WAV through untouched (Gemini 3.8 default)', async () => {
    const wav = pcmToWav(Buffer.alloc(4))
    const out = await synthesizeGemini('hi', { apiKey: 'k', model: 'm', voice: 'v', fetchImpl: reply('audio/wav', wav) })
    assert.deepEqual(out, wav)
  })

  it('wraps legacy raw L16 PCM using the reported sample rate', async () => {
    const out = await synthesizeGemini('hi', {
      apiKey: 'k',
      model: 'm',
      voice: 'v',
      fetchImpl: reply('audio/L16;codec=pcm;rate=16000', [1, 2, 3, 4]),
    })
    assert.equal(out.toString('ascii', 0, 4), 'RIFF')
    assert.equal(out.readUInt32LE(24), 16000)
  })

  it('surfaces provider failures as 502', async () => {
    await assert.rejects(
      synthesizeGemini('hi', { apiKey: 'k', model: 'm', voice: 'v', fetchImpl: async () => ({ ok: false, status: 429 }) }),
      (err) => err.status === 502,
    )
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
