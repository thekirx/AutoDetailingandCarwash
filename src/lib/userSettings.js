/** Per-user SMS opt-in via auth user_metadata (no extra table). Theme uses next-themes. */
import { supabase } from '@/lib/supabase'

export async function loadUserSettings() {
  const { data } = await supabase.auth.getUser()
  const meta = data.user?.user_metadata || {}
  return { sms_opt_in: meta.sms_opt_in !== false }
}

export async function saveSmsOptIn(sms_opt_in) {
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session?.user?.id) throw new Error('Sign in required.')
  const { error } = await supabase.auth.updateUser({
    data: { sms_opt_in: Boolean(sms_opt_in) },
  })
  if (error) throw error
  return { sms_opt_in: Boolean(sms_opt_in) }
}
