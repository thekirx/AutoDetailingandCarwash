import { createGateway } from '../server/apiGateway.mjs'
import { handleCustomerAuthLookupRequest } from '../server/customerAuthLookup.mjs'
import { handleCustomerHistoryRequest } from '../server/customerHistoryApi.mjs'
import { handleCustomerPortalRequest } from '../server/customerPortal.mjs'
import { handleCustomerSignupRequest } from '../server/customerSignup.mjs'
import { bearer, readJsonBody, setCors } from '../server/httpUtil.mjs'
import { handlePublicInquiryRequest } from '../server/publicInquiry.mjs'
import { handleProvisionRequest } from '../server/provisionCustomer.mjs'

export const operations = Object.freeze({
  'customer-auth-lookup': (req, res) => {
    setCors(res, 'POST, OPTIONS')
    return handleCustomerAuthLookupRequest(req, res, {
      getBody: () => readJsonBody(req),
      siteOrigin: req.headers.origin || `https://${req.headers.host}`,
    })
  },
  'customer-history': handleCustomerHistoryRequest,
  'customer-portal': (req, res) =>
    handleCustomerPortalRequest(req, res, {
      getAccessToken: () => bearer(req),
    }),
  'customer-signup': (req, res) => {
    setCors(res, 'POST, OPTIONS')
    return handleCustomerSignupRequest(req, res, {
      getBody: () => readJsonBody(req),
    })
  },
  'public-inquiry': handlePublicInquiryRequest,
  'provision-customer': (req, res) => {
    setCors(res, 'POST, OPTIONS')
    const proto = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host
    return handleProvisionRequest(req, res, {
      siteOrigin: `${proto}://${host}`,
      getBody: () => readJsonBody(req),
      getAccessToken: () => {
        const header = req.headers.authorization || ''
        return header.startsWith('Bearer ') ? header.slice(7) : null
      },
    })
  },
})

export default createGateway(operations)
