import { createClient } from '@supabase/supabase-js'

const cachedClients = new Map()

/**
 * Shared service-role Supabase client cached per `(url, serviceKey)` pair so warm
 * serverless containers reuse one client instead of recreating it per request,
 * while env overrides in tests remain isolated.
 */
export function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  const cacheKey = `${url}\n${key}`
  let client = cachedClients.get(cacheKey)
  if (!client) {
    client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    cachedClients.set(cacheKey, client)
  }
  return client
}
