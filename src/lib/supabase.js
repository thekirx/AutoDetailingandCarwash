import { createClient } from '@supabase/supabase-js'
import { resolveSupabaseConfig } from './supabaseConfig.js'

const config = resolveSupabaseConfig({
  url: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || globalThis.process?.env?.VITE_SUPABASE_URL || '',
  key: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || globalThis.process?.env?.VITE_SUPABASE_ANON_KEY || '',
  isDev: typeof import.meta !== 'undefined' && import.meta.env ? Boolean(import.meta.env.DEV) : true,
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
