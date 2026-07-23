import { handlePushSubscribeRequest } from '../server/pushApi.mjs'

export default async function handler(req, res) {
  await handlePushSubscribeRequest(req, res)
}
