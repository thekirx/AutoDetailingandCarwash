import { handleCustomerPortalRequest } from '../server/customerPortal.mjs'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

  await handleCustomerPortalRequest(req, res, {
    getAccessToken: () => {
      const header = req.headers.authorization || ''
      return header.startsWith('Bearer ') ? header.slice(7) : null
    },
  })
}
