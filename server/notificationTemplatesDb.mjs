/**
 * Load SA overrides and merge onto the code catalog.
 */
import {
  mergeNotificationTemplates,
  templatesByKeyMap,
} from '../src/lib/notificationTemplates.js'

export async function loadMergedTemplates(db) {
  if (!db) return mergeNotificationTemplates([])
  let { data, error } = await db
    .from('notification_templates')
    .select('key, title, body, sms_body, enabled, allow_multipart, updated_at')
  if (error && /column .*allow_multipart.* does not exist/i.test(error.message || '')) {
    const fallback = await db
      .from('notification_templates')
      .select('key, title, body, sms_body, enabled, updated_at')
    data = fallback.data
    error = fallback.error
  }
  if (error) {
    console.warn('[notify] templates load failed', error.message)
    return mergeNotificationTemplates([])
  }
  return mergeNotificationTemplates(data || [])
}

export async function loadTemplateMap(db) {
  return templatesByKeyMap(await loadMergedTemplates(db))
}

export function templateEnabled(map, key) {
  const row = map?.[key]
  if (!row) return true
  return row.enabled !== false
}
