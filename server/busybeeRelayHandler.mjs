/**
 * Fixed-egress BusyBee relay handler.
 *
 * Deploy this endpoint on a host whose egress IP BrandTxt has whitelisted
 * (Fly dedicated IPv4, DO droplet, or Vercel with Static IPs enabled).
 * The main Vercel app then sets BUSYBEE_RELAY_URL + BUSYBEE_RELAY_SECRET and
 * never needs BrandTxt to whitelist dynamic serverless IPs.
 *
 * Body: { phone, message, secret }
 * BusyBee API keys stay on the relay host only.
 */
import { busybeeSendSmsDirect } from './busybee.mjs'

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

export async function handleBusybeeRelayRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, status: 'failed', providerResponse: 'POST only' })
  }

  const expected = process.env.BUSYBEE_RELAY_SECRET || ''
  if (!expected) {
    return json(res, 503, {
      ok: false,
      status: 'failed',
      providerResponse: 'Relay not configured (BUSYBEE_RELAY_SECRET)',
    })
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    return json(res, 400, { ok: false, status: 'failed', providerResponse: 'Invalid JSON' })
  }

  if (!body?.secret || body.secret !== expected) {
    return json(res, 401, { ok: false, status: 'failed', providerResponse: 'Unauthorized' })
  }

  const result = await busybeeSendSmsDirect({
    phone: body.phone,
    message: body.message,
  })
  return json(res, result.ok ? 200 : 502, result)
}
