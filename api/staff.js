import { createGateway } from '../server/apiGateway.mjs'
import { readJsonBody, setCors } from '../server/httpUtil.mjs'
import { handleProvisionStaffRequest, handleUpdateStaffRequest } from '../server/provisionStaff.mjs'

export const operations = Object.freeze({
  'provision-staff': (req, res) => {
    setCors(res, 'POST, OPTIONS')
    const proto = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host
    return handleProvisionStaffRequest(req, res, {
      siteOrigin: `${proto}://${host}`,
      getBody: () => readJsonBody(req),
      getAccessToken: () => {
        const header = req.headers.authorization || ''
        return header.startsWith('Bearer ') ? header.slice(7) : null
      },
    })
  },
  'update-staff': (req, res) => {
    setCors(res, 'POST, OPTIONS')
    return handleUpdateStaffRequest(req, res, {
      getBody: () => readJsonBody(req),
      getAccessToken: () => {
        const header = req.headers.authorization || ''
        return header.startsWith('Bearer ') ? header.slice(7) : null
      },
    })
  },
})

export default createGateway(operations)
