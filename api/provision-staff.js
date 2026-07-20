import { handleProvisionStaffRequest } from '../server/provisionStaff.mjs'

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

  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const siteOrigin = `${proto}://${host}`

  await handleProvisionStaffRequest(req, res, {
    siteOrigin,
    getBody: () => readJson(req),
    getAccessToken: () => {
      const header = req.headers.authorization || ''
      return header.startsWith('Bearer ') ? header.slice(7) : null
    },
  })
}
