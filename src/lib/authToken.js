/** Resolve a fresh access token for /api/* calls (avoids stale getSession races). */
import { supabase } from '@/lib/supabase'

export async function getAccessTokenFresh() {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session?.access_token) {
    const refreshed = await supabase.auth.refreshSession()
    return refreshed.data.session?.access_token || null
  }
  // ponytail: refresh near expiry — JWT clock skew / long-open tabs otherwise 401 /api/*
  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0
  if (expiresAtMs && expiresAtMs < Date.now() + 60_000) {
    const refreshed = await supabase.auth.refreshSession()
    return refreshed.data.session?.access_token || session.access_token
  }
  return session.access_token
}
