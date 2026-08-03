const LOCAL_PREVIEW_URL = 'https://local-preview.invalid'
const LOCAL_PREVIEW_KEY = 'local-preview-public-key'

export function resolveSupabaseConfig({ url, key, isDev }) {
  if (url && key) return { url, key, isPreview: false }

  if (isDev) {
    return {
      url: LOCAL_PREVIEW_URL,
      key: LOCAL_PREVIEW_KEY,
      isPreview: true,
    }
  }

  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}
