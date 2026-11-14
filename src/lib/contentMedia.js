import { supabase } from '@/lib/supabase'

const shopfrontDuskWide = new URL('../assets/about/hakum-shopfront-dusk-wide.webp', import.meta.url).href
const storyCleanCars = new URL('../assets/about/hakum-story-clean-cars.webp', import.meta.url).href
const aboutHkm21 = new URL('../assets/about/about-hkm-21.webp', import.meta.url).href
const polishBay = new URL('../assets/footer/hakum-polish-1600.webp', import.meta.url).href
const ppfInstall = new URL('../assets/services/ppf-clearpro-install.webp', import.meta.url).href
const exteriorDetailing = new URL('../assets/services/wash-detailing/full-exterior-detailing.webp', import.meta.url).href

export const STUDIO_MEDIA_PRESETS = [
  {
    id: 'preset-shopfront-dusk',
    name: 'Hakum Studio Shopfront at Dusk',
    url: shopfrontDuskWide,
    alt: 'Hakum Auto Care studio shopfront at dusk',
    category: 'Studio & Branches',
  },
  {
    id: 'preset-polish-bay',
    name: 'Rupes & Menzerna Machine Polish Bay',
    url: polishBay,
    alt: 'Hakum Auto Care machine paint correction bay',
    category: 'Paint & Ceramic',
  },
  {
    id: 'preset-ppf-clearpro',
    name: 'ClearPro TPU Paint Protection Film Install',
    url: ppfInstall,
    alt: 'ClearPro PPF installation at Hakum Auto Care',
    category: 'PPF & Tint',
  },
  {
    id: 'preset-exterior-detail',
    name: 'Two-Bucket pH-Neutral Exterior Detailing',
    url: exteriorDetailing,
    alt: 'Full exterior detailing and foam wash at Hakum Auto Care',
    category: 'Wash & Detailing',
  },
  {
    id: 'preset-story-clean-cars',
    name: 'Clean Cars Matter — Inspection Bay',
    url: storyCleanCars,
    alt: 'Hakum Auto Care detailing technician inspecting paint finish',
    category: 'Studio & Branches',
  },
  {
    id: 'preset-about-hkm21',
    name: 'Hakum Enclosed Detailing Bay',
    url: aboutHkm21,
    alt: 'Enclosed dust-controlled detailing bay at Hakum Auto Care',
    category: 'Studio & Branches',
  },
  {
    id: 'preset-events-banner',
    name: 'Hakum Community Meet & Events Banner',
    url: '/content/events-stay-tuned.webp',
    alt: 'Hakum Auto Care community events and car meets',
    category: 'Events & Branding',
  },
  {
    id: 'preset-brand-blue',
    name: 'Hakum Auto Care Wordmark (Electric Blue)',
    url: '/branding/hakum-lw-blue.png',
    alt: 'Hakum Auto Care electric blue wordmark',
    category: 'Events & Branding',
  },
]

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const commaIndex = result.indexOf(',')
      resolve({
        dataUrl: result,
        base64: commaIndex >= 0 ? result.slice(commaIndex + 1) : result,
      })
    }
    reader.onerror = () => reject(new Error('Failed to read selected file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Upload image/video into the public content-media bucket.
 * Falls back to authenticated `/api/staff?op=manage-content` if client storage RLS blocks,
 * and to inline data URL in offline/local preview environments.
 */
export async function uploadContentMedia(file) {
  if (!file) throw new Error('No file selected')
  const ext = String(file.name || 'bin').split('.').pop()?.toLowerCase()?.replace(/[^a-z0-9]/g, '') || 'bin'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from('content-media').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })

  if (!error) {
    const { data } = supabase.storage.from('content-media').getPublicUrl(path)
    if (data?.publicUrl) return data.publicUrl
  }

  // Fallback 1: Authenticated server endpoint (/api/staff?op=manage-content)
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    const { base64, dataUrl } = await fileToBase64(file)
    if (token) {
      const resp = await fetch('/api/staff?op=manage-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'upload-media',
          fileName: file.name || `upload.${ext}`,
          contentType: file.type || 'image/jpeg',
          base64,
        }),
      })
      if (resp.ok) {
        const json = await resp.json()
        if (json?.publicUrl) return json.publicUrl
      }
    }
    if (dataUrl && file.size <= 3 * 1024 * 1024) {
      return dataUrl
    }
  } catch {
    // Ignore fallback error and surface original error below
  }

  throw error || new Error('Media upload failed')
}

/**
 * List uploaded media from Supabase `content-media` bucket plus curated studio presets.
 */
export async function listContentMediaLibrary() {
  const uploaded = []
  try {
    const { data, error } = await supabase.storage.from('content-media').list('', {
      limit: 40,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    if (!error && Array.isArray(data)) {
      for (const item of data) {
        if (!item?.name || item.name.startsWith('.')) continue
        const isImage = /\.(jpe?g|png|webp|gif)$/i.test(item.name)
        if (!isImage) continue
        const { data: pub } = supabase.storage.from('content-media').getPublicUrl(item.name)
        if (pub?.publicUrl) {
          uploaded.push({
            id: `upload-${item.id || item.name}`,
            name: item.name,
            url: pub.publicUrl,
            alt: item.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
            category: 'Uploaded Media',
            created_at: item.created_at,
          })
        }
      }
    }
  } catch {
    // Keep presets even if bucket listing is unavailable
  }
  return {
    uploaded,
    presets: STUDIO_MEDIA_PRESETS,
    all: [...uploaded, ...STUDIO_MEDIA_PRESETS],
  }
}
