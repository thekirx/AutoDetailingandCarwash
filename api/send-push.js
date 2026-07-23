import { handleSendPushRequest } from '../server/pushApi.mjs'

export default async function handler(req, res) {
  await handleSendPushRequest(req, res)
}
