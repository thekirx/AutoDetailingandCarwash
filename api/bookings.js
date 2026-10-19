import { createGateway } from '../server/apiGateway.mjs'
import { handleBookingStatusRequest } from '../server/bookingStatus.mjs'
import { handleMaintenanceSchedulesRequest } from '../server/maintenanceSchedulesApi.mjs'
import { handlePublicBookRequest } from '../server/publicBook.mjs'
import { handleReferralStaffRequest } from '../server/referralStaff.mjs'
import { handleAccessoryPointsRequest } from '../server/accessoryPoints.mjs'
import { handleReferralProgramRequest } from '../server/referralProgram.mjs'
import { handlePublicPlateLookup } from '../server/publicPlateLookup.mjs'

export const operations = Object.freeze({
  'accessory-points': handleAccessoryPointsRequest,
  'booking-status': handleBookingStatusRequest,
  'maintenance-schedules': handleMaintenanceSchedulesRequest,
  'plate-lookup': handlePublicPlateLookup,
  'public-book': handlePublicBookRequest,
  'referral-program': handleReferralProgramRequest,
  'referral-staff': handleReferralStaffRequest,
})

export default createGateway(operations)
