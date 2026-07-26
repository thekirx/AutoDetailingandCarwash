/**
 * Resolve a fresh access token for /api/* calls.
 * Uses single-flight refresh so concurrent callers do not burn refresh_token.
 */
import { supabase } from '@/lib/supabase'
import { ensureFreshAccessToken } from '@/lib/session'

export async function getAccessTokenFresh() {
  try {
    return await ensureFreshAccessToken(supabase.auth)
  } catch {
    return null
  }
}
