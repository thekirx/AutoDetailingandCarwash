import { createGateway } from '../server/apiGateway.mjs'
import { handleDemoLoginRequest } from '../server/demoLoginApi.mjs'

export const operations = Object.freeze({
  'demo-login': handleDemoLoginRequest,
})

// Vercel serves this file before the vercel.json rewrite, so /api/demo-login arrives without ?operation.
export default createGateway(operations, { defaultOperation: 'demo-login' })