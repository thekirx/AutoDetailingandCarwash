import { createGateway } from '../server/apiGateway.mjs'
import { handleBookingStatusRequest } from '../server/bookingStatus.mjs'
import { handleMaintenanceSchedulesRequest } from '../server/maintenanceSchedulesApi.mjs'
import { handlePublicBookRequest } from '../server/publicBook.mjs'
import { handlePublicPlateLookup } from '../server/publicPlateLookup.mjs'

export const operations = Object.freeze({
  'booking-status': handleBookingStatusRequest,
  'maintenance-schedules': handleMaintenanceSchedulesRequest,
  'plate-lookup': handlePublicPlateLookup,
  'public-book': handlePublicBookRequest,
})

export default createGateway(operations)
