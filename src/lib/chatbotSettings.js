import { supabase } from './supabase.js'
import { writeAudit } from './audit.js'
import {
  CHATBOT_SETTINGS_EVENT,
  CHATBOT_SETTINGS_KEY,
  DEFAULT_CHATBOT_SETTINGS,
  isChatbotPathVisible,
  normalizeChatbotSettings,
} from './chatbotSettingsRules.js'

export {
  CHATBOT_SETTINGS_EVENT,
  CHATBOT_SETTINGS_KEY,
  DEFAULT_CHATBOT_SETTINGS,
  isChatbotPathVisible,
  normalizeChatbotSettings,
}

export function notifyChatbotSettingsUpdated(settings) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(CHATBOT_SETTINGS_EVENT, {
      detail: normalizeChatbotSettings(settings),
    }),
  )
}

/** Public-safe read: uses SECURITY DEFINER RPC first, falling back gracefully to authenticated app_settings or defaults. */
export async function fetchPublicChatbotSettings() {
  try {
    const { data, error } = await supabase.rpc('get_public_chatbot_settings')
    if (!error && data && typeof data === 'object') {
      return normalizeChatbotSettings(data)
    }
  } catch {
    // Soft fallback below when offline or migration is pending
  }

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', CHATBOT_SETTINGS_KEY)
      .maybeSingle()
    if (!error && data?.value && typeof data.value === 'object') {
      return normalizeChatbotSettings(data.value)
    }
  } catch {
    // Anon users without authenticated app_settings access fall back cleanly to defaults
  }

  return { ...DEFAULT_CHATBOT_SETTINGS }
}

/** Owner (BossMich) read directly from app_settings. */
export async function fetchAdminChatbotSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value, updated_at')
    .eq('key', CHATBOT_SETTINGS_KEY)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return {
    settings: normalizeChatbotSettings(data?.value || DEFAULT_CHATBOT_SETTINGS),
    updatedAt: data?.updated_at || null,
  }
}

/** Owner (BossMich) write to app_settings + audit log + live client broadcast. */
export async function saveAdminChatbotSettings(nextInput, { actorId = null } = {}) {
  const normalized = normalizeChatbotSettings(nextInput)
  const payload = {
    key: CHATBOT_SETTINGS_KEY,
    value: normalized,
    updated_at: new Date().toISOString(),
    ...(actorId ? { updated_by: actorId } : {}),
  }

  const { data, error } = await supabase
    .from('app_settings')
    .upsert(payload, { onConflict: 'key' })
    .select('value, updated_at')
    .single()

  if (error) throw new Error(error.message)

  const saved = normalizeChatbotSettings(data?.value || normalized)
  notifyChatbotSettingsUpdated(saved)

  await writeAudit({
    action: 'settings.chatbot_widget.update',
    entityType: 'app_settings',
    entityId: CHATBOT_SETTINGS_KEY,
    summary: `Hakum Concierge chatbot ${saved.enabled ? 'enabled' : 'disabled'} (${saved.launcher_label})`,
    meta: saved,
  })

  return {
    settings: saved,
    updatedAt: data?.updated_at || payload.updated_at,
  }
}
