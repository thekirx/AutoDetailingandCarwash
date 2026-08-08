import { createGateway } from '../server/apiGateway.mjs'
import { handleBusybeeRequest } from '../server/busybeeApi.mjs'
import { handleLifecycleSmsRequest } from '../server/lifecycleSmsApi.mjs'
import { handleNotifyBookingRequest } from '../server/notifyBookingApi.mjs'
import { handlePushSubscribeRequest, handleSendPushRequest } from '../server/pushApi.mjs'

export const operations = Object.freeze({
  busybee: handleBusybeeRequest,
  'lifecycle-sms': handleLifecycleSmsRequest,
  'notify-booking': handleNotifyBookingRequest,
  'push-subscribe': handlePushSubscribeRequest,
  'send-push': handleSendPushRequest,
})

export default createGateway(operations)
