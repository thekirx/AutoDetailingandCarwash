import { handleBookingStatusRequest } from '../server/bookingStatus.mjs'

export default async function handler(req, res) {
  await handleBookingStatusRequest(req, res)
}
