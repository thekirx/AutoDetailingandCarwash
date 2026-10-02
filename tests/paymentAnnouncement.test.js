import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPaymentAnnouncement, spellPlate } from '../src/lib/paymentAnnouncement.js'
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
    assert.equal(buildPaymentAnnouncement({ plate: 'XYZ 9' }), 'Plate X Y Z, 9 is ready for payment.')
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
