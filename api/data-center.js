import { createGateway } from '../server/apiGateway.mjs'
import { handleDataCenterRequest } from '../server/dataCenter.mjs'

export const operations = Object.freeze({
  'data-center': handleDataCenterRequest,
})

// Vercel serves this file before the vercel.json rewrite, so /api/data-center arrives without ?operation.
export default createGateway(operations, { defaultOperation: 'data-center' })
