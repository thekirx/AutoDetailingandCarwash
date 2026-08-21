import { createGateway } from '../server/apiGateway.mjs'
import { handlePublicInquiryRequest } from '../server/publicInquiry.mjs'

/** Operation aliases for the domain gateway allowlist; body.kind still selects the row builder. */
export const operations = Object.freeze({
  complaints: handlePublicInquiryRequest,
  contact: handlePublicInquiryRequest,
  partnership: handlePublicInquiryRequest,
})

export default createGateway(operations)
