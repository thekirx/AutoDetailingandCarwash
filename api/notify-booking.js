import { handleNotifyBookingRequest } from '../server/notifyBookingApi.mjs'

export default async function handler(req, res) {
  await handleNotifyBookingRequest(req, res)
}
