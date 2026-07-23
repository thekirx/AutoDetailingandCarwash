/**
 * BusyBee BrandTxT SMS client (busybeeapi.md — /api/v2|v3/SendSMS).
 * Secrets: BUSYBEE_API_KEY, BUSYBEE_CLIENT_ID, BUSYBEE_SENDER_ID, BUSYBEE_API_BASE_URL
 */
function cfg() {
  const apiKey = process.env.BUSYBEE_API_KEY || process.env.SMS_PROVIDER_API_KEY
  const clientId = process.env.BUSYBEE_CLIENT_ID
  const senderId = process.env.BUSYBEE_SENDER_ID || 'HAKUM'
  const baseUrl = (process.env.BUSYBEE_API_BASE_URL || 'https://brandtxt.busybee.ph').replace(/\/$/, '')
  return { apiKey, clientId, senderId, baseUrl }
}

/** Normalize PH mobiles to digits BusyBee expects (63XXXXXXXXXX). */
export function normalizePhMobile(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('63') && digits.length >= 12) return digits
  if (digits.startsWith('0') && digits.length >= 11) return `63${digits.slice(1)}`
  if (digits.length === 10 && digits.startsWith('9')) return `63${digits}`
  return digits
}

export async function busybeeBalance() {
  const { apiKey, clientId, baseUrl } = cfg()
  if (!apiKey || !clientId) throw new Error('BusyBee credentials missing')

  const tryParse = (res, text) => {
    if (res.status === 429 || /too many requests/i.test(text)) {
      return { ok: false, status: 429, json: { ErrorCode: 429, ErrorDescription: 'Too many requests' }, baseUrl }
    }
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      json = { ErrorCode: -1, ErrorDescription: text.slice(0, 200), raw: true }
    }
    return { ok: res.ok && Number(json?.ErrorCode) === 0, status: res.status, json, baseUrl }
  }

  // Prefer POST — some BusyBee hosts serve parking/JS challenges on GET
  try {
    const res = await fetch(`${baseUrl}/api/v2/Balance`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'HakumAutoCare/1.0',
      },
      body: JSON.stringify({ ApiKey: apiKey, ClientId: clientId, apiKey, clientId }),
      signal: AbortSignal.timeout(20000),
    })
    const text = await res.text()
    const parsed = tryParse(res, text)
    if (!parsed.json?.raw) return parsed
  } catch {
    /* fall through to GET */
  }

  const url = `${baseUrl}/api/v2/Balance?ApiKey=${encodeURIComponent(apiKey)}&ClientId=${encodeURIComponent(clientId)}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'HakumAutoCare/1.0' },
    signal: AbortSignal.timeout(20000),
  })
  return tryParse(res, await res.text())
}

/**
 * Send one SMS via BusyBee. Tries v3 POST then v2 POST (PascalCase + camelCase).
 * @returns {{ ok: boolean, status: string, providerResponse: string, messageId?: string }}
 */
export async function busybeeSendSms({ phone, message }) {
  const { apiKey, clientId, senderId, baseUrl } = cfg()
  if (!apiKey || !clientId) {
    return { ok: false, status: 'skipped', providerResponse: 'BusyBee credentials not configured' }
  }
  const mobile = normalizePhMobile(phone)
  if (!mobile) return { ok: false, status: 'failed', providerResponse: 'Invalid phone' }
  if (!message?.trim()) return { ok: false, status: 'failed', providerResponse: 'Empty message' }

  const bodies = [
    {
      path: '/api/v3/SendSMS',
      body: {
        apiKey,
        clientId,
        senderId,
        message: message.trim(),
        mobileNumbers: mobile,
        is_Unicode: false,
        is_Flash: false,
      },
    },
    {
      path: '/api/v2/SendSMS',
      body: {
        ApiKey: apiKey,
        ClientId: clientId,
        SenderId: senderId,
        Message: message.trim(),
        MobileNumbers: mobile,
        Is_Unicode: false,
        Is_Flash: false,
      },
    },
  ]

  let last = { ok: false, status: 'failed', providerResponse: 'No attempt' }
  for (const attempt of bodies) {
    try {
      const res = await fetch(`${baseUrl}${attempt.path}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'HakumAutoCare/1.0',
        },
        body: JSON.stringify(attempt.body),
        signal: AbortSignal.timeout(25000),
      })
      const text = await res.text()
      if (res.status === 429 || /too many requests/i.test(text)) {
        return {
          ok: false,
          status: 'rate_limited',
          providerResponse: text.slice(0, 500),
          httpStatus: 429,
          path: attempt.path,
        }
      }
      let json = null
      try {
        json = JSON.parse(text)
      } catch {
        json = null
      }
      const errorCode = json?.ErrorCode ?? json?.errorCode
      const ok = res.ok && (errorCode === 0 || errorCode === '0' || (res.ok && errorCode == null && !String(text).includes('<html')))
      last = {
        ok: Boolean(ok),
        status: ok ? 'sent' : 'failed',
        providerResponse: text.slice(0, 1500),
        messageId: json?.Data?.[0]?.MessageId || json?.data?.[0]?.messageId || null,
        httpStatus: res.status,
        path: attempt.path,
      }
      if (ok) return last
      // HTML parking page → try next shape won't help same host; still try v2
      if (String(text).includes('<html')) continue
    } catch (err) {
      last = { ok: false, status: 'failed', providerResponse: String(err.message || err) }
    }
  }
  return last
}
