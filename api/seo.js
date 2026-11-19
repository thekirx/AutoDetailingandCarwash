import { createGateway } from '../server/apiGateway.mjs'
import { handleSeoRequest } from '../server/seoApi.mjs'

export const operations = Object.freeze({
  sitemap: handleSeoRequest,
  rss: handleSeoRequest,
  'blog-meta': handleSeoRequest,
  'event-meta': handleSeoRequest,
  'indexnow-key': handleSeoRequest,
})

export default createGateway(operations, { defaultOperation: 'sitemap' })
