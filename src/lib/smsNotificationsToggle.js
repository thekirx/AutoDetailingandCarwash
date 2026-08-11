/** Shop-wide SMS kill switch stored in app_settings.sms_notifications.value */
export function smsNotificationsEnabledFromSetting(value) {
  if (!value) return true
  return value.enabled !== false
}
