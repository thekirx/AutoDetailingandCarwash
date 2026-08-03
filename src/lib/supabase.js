import { createClient } from '@supabase/supabase-js'
import { resolveSupabaseConfig } from './supabaseConfig'

const config = resolveSupabaseConfig({
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY,
  isDev: import.meta.env.DEV,
})

export const supabase = createClient(config.url, config.key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Standard SPA auth flow; keep default storageKey so existing sessions are not wiped
    flowType: 'pkce',
  },
})
