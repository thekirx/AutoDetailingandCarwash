import { handleFinanceQuoteRequest } from '../server/sendFinanceQuote.mjs'
import { readJsonBody, bearer } from '../server/httpUtil.mjs'

export default async function handler(req, res) {
  return handleFinanceQuoteRequest(req, res, {
    getBody: () => readJsonBody(req),
    getAccessToken: () => bearer(req),
  })
}
