/**
 * Shared CORS + JSON helpers for Vercel / Vite API routes.
 * Browsers need these headers so PWA subscribe/send works cross-origin.
 */

/** ponytail: per-instance Map — upgrade to Redis/Upstash when multi-region abuse matters. */
const rateBuckets = new Map()

export function setCors(res, methods = 'GET, POST, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, apikey, x-client-info')
  res.setHeader('Access-Control-Allow-Methods', methods)
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body)
      return
    }
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

export function bearer(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  if (typeof header !== 'string') return null
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null
}

export function rateLimit({ key, limit = 10, windowMs = 60_000 }) {
  const now = Date.now()
  let bucket = rateBuckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
  }
  bucket.count += 1
  rateBuckets.set(key, bucket)
  if (bucket.count > limit) {
    throw Object.assign(new Error('Too many requests. Try again shortly.'), { status: 429 })
  }
}

export function clientIp(req) {
  const xf = req.headers?.['x-forwarded-for'] || req.headers?.['X-Forwarded-For']
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim()
  return req.socket?.remoteAddress || req.headers?.['x-real-ip'] || 'unknown'
}

export function json(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}
