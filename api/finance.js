import { createGateway } from '../server/apiGateway.mjs'
import { bearer, readJsonBody } from '../server/httpUtil.mjs'
import { handleFinanceQuoteRequest } from '../server/sendFinanceQuote.mjs'

export const operations = Object.freeze({
  'send-finance-quote': (req, res) =>
    handleFinanceQuoteRequest(req, res, {
      getBody: () => readJsonBody(req),
      getAccessToken: () => bearer(req),
    }),
})

export default createGateway(operations)
