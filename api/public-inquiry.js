import { createGateway } from '../server/apiGateway.mjs'
import { handlePublicInquiryRequest } from '../server/publicInquiry.mjs'

/** Operation aliases for the domain gateway allowlist; body.kind still selects the row builder. */
export const operations = Object.freeze({
  complaints: handlePublicInquiryRequest,
  partnership: handlePublicInquiryRequest,
  'event-registration': handlePublicInquiryRequest,
})

// Vercel serves this file before the vercel.json rewrite, so /api/public-inquiry arrives without ?operation;
// every alias is the same handler, so any of them is the right default.
export default createGateway(operations, { defaultOperation: 'complaints' })
