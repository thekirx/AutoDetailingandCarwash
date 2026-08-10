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
    // localStorage = stay signed in across reloads / PWA restarts until explicit logout.
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    flowType: 'pkce',
  },
})
