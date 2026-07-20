import { handleCustomerAuthLookupRequest } from '../server/customerAuthLookup.mjs'

function readJson(req) {
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  const origin = req.headers.origin || `https://${req.headers.host}`
  await handleCustomerAuthLookupRequest(req, res, {
    getBody: () => readJson(req),
    siteOrigin: origin,
  })
}
