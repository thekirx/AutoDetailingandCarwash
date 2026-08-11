import { supabase } from '@/lib/supabase'

/**
 * Upload image/video into the public content-media bucket.
 * Returns a public URL string.
 */
export async function uploadContentMedia(file) {
  if (!file) throw new Error('No file selected')
  const ext = String(file.name || 'bin').split('.').pop()?.toLowerCase() || 'bin'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('content-media').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw error
  const { data } = supabase.storage.from('content-media').getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('Missing public URL')
  return data.publicUrl
}
