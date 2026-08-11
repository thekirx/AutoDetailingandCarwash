import { createGateway } from '../server/apiGateway.mjs'
import { handleBusybeeRequest } from '../server/busybeeApi.mjs'
import { handleLifecycleSmsRequest } from '../server/lifecycleSmsApi.mjs'
import { handleNotifyBookingRequest } from '../server/notifyBookingApi.mjs'
import { handleNotifyOpsFormRequest } from '../server/notifyOpsFormApi.mjs'
import { handlePushSubscribeRequest, handleSendPushRequest } from '../server/pushApi.mjs'
import { handleNotificationSettingsRequest } from '../server/notificationSettingsApi.mjs'
import { handleNotificationBroadcastRequest } from '../server/notificationBroadcastApi.mjs'
import { handleNotificationBroadcastKindsRequest } from '../server/notificationBroadcastKindsApi.mjs'
import { handleNotificationTemplatesRequest } from '../server/notificationTemplatesApi.mjs'
import { handleBirthdayGreetingsRequest } from '../server/birthdayGreetingsApi.mjs'

export const operations = Object.freeze({
  busybee: handleBusybeeRequest,
  'lifecycle-sms': handleLifecycleSmsRequest,
  'notify-booking': handleNotifyBookingRequest,
  'notify-ops-form': handleNotifyOpsFormRequest,
  'push-subscribe': handlePushSubscribeRequest,
  'send-push': handleSendPushRequest,
  'notification-settings': handleNotificationSettingsRequest,
  'notification-broadcast': handleNotificationBroadcastRequest,
  'notification-broadcast-kinds': handleNotificationBroadcastKindsRequest,
  'notification-templates': handleNotificationTemplatesRequest,
  'birthday-greetings': handleBirthdayGreetingsRequest,
})

export default createGateway(operations)
