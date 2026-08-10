import { createGateway } from '../server/apiGateway.mjs'
import { handleBusybeeRequest } from '../server/busybeeApi.mjs'
import { handleLifecycleSmsRequest } from '../server/lifecycleSmsApi.mjs'
import { handleNotifyBookingRequest } from '../server/notifyBookingApi.mjs'
import { handlePushSubscribeRequest, handleSendPushRequest } from '../server/pushApi.mjs'
import { handleNotificationSettingsRequest } from '../server/notificationSettingsApi.mjs'
import { handleNotificationBroadcastRequest } from '../server/notificationBroadcastApi.mjs'
import { handleNotificationBroadcastKindsRequest } from '../server/notificationBroadcastKindsApi.mjs'

export const operations = Object.freeze({
  busybee: handleBusybeeRequest,
  'lifecycle-sms': handleLifecycleSmsRequest,
  'notify-booking': handleNotifyBookingRequest,
  'push-subscribe': handlePushSubscribeRequest,
  'send-push': handleSendPushRequest,
  'notification-settings': handleNotificationSettingsRequest,
  'notification-broadcast': handleNotificationBroadcastRequest,
  'notification-broadcast-kinds': handleNotificationBroadcastKindsRequest,
})

export default createGateway(operations)
