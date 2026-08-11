/**
 * Load SA overrides and merge onto the code catalog.
 */
import {
  mergeNotificationTemplates,
  templatesByKeyMap,
} from '../src/lib/notificationTemplates.js'

export async function loadMergedTemplates(db) {
  if (!db) return mergeNotificationTemplates([])
  const { data, error } = await db
    .from('notification_templates')
    .select('key, title, body, sms_body, enabled, updated_at')
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
