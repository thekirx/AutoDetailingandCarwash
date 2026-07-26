import { handleCustomerPortalRequest } from '../server/customerPortal.mjs'
import { bearer } from '../server/httpUtil.mjs'

export default async function handler(req, res) {
  await handleCustomerPortalRequest(req, res, {
    getAccessToken: () => bearer(req),
  })
}
