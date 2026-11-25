export const CHATBOT_SETTINGS_KEY = 'chatbot_widget'
export const CHATBOT_SETTINGS_EVENT = 'hakum:chatbot-settings-updated'

export const HAKUM_FACEBOOK_PAGE_URL = 'https://www.facebook.com/profile.php?id=61573318005308'
export const HAKUM_FACEBOOK_MESSENGER_URL = 'https://m.me/61573318005308'

export const CHATBOT_ACCENT_PRESETS = Object.freeze({
  sapphire: { id: 'sapphire', label: 'Hakum Sapphire', swatchClass: 'bg-blue-600' },
  cobalt: { id: 'cobalt', label: 'Deep Cobalt', swatchClass: 'bg-blue-800' },
  emerald: { id: 'emerald', label: 'Studio Emerald', swatchClass: 'bg-emerald-600' },
  amber: { id: 'amber', label: 'Gold Gloss', swatchClass: 'bg-amber-700' },
})

export const CHATBOT_PROMO_DESTINATIONS = Object.freeze([
  { path: '/services/ppf', label: 'ClearPro PPF (/services/ppf)' },
  { path: '/services/ceramic', label: 'Ceramic Coating (/services/ceramic)' },
  { path: '/tint-finder', label: '3D Tint Finder (/tint-finder)' },
  { path: '/services/tint', label: 'Nano Ceramic Tint (/services/tint)' },
  { path: '/services', label: 'All Services (/services)' },
  { path: '/shop', label: 'Studio Shop (/shop)' },
  { path: '/book', label: 'Book Detailing (/book)' },
  { path: '/queue', label: 'Live Queue (/queue)' },
])

export const DEFAULT_SUGGESTED_PROMPTS = Object.freeze([
  'ClearPro PPF prices & warranty',
  'Compare Ceramic Coating tiers',
  'Check live Bacoor queue',
  'Tint VLT & heat rejection',
  'Talk to a real person',
  'My loyalty stamps & rewards',
  'Shop merch, care gear & coffee',
  'How to book or reschedule',
])

export const DEFAULT_CHATBOT_SETTINGS = Object.freeze({
  enabled: true,
  launcher_label: 'Ask Hakum Concierge',
  welcome_title: 'Hakum Auto Care Concierge',
  welcome_message:
    'Instant answers on car wash, detailing, ClearPro PPF, Ceramic Coating, Nano Ceramic Tint, branches, booking, live queue, and your loyalty rewards.',
  accent_preset: 'sapphire',
  human_handoff_enabled: true,
  human_cta_label: 'Chat on Messenger',
  facebook_url: HAKUM_FACEBOOK_PAGE_URL,
  messenger_url: HAKUM_FACEBOOK_MESSENGER_URL,
  promo_enabled: true,
  promo_eyebrow: 'Studio Spotlight',
  promo_title: 'ClearPro PPF + Free Glass & Wheels Coating',
  promo_description:
    'Self-healing TPU paint protection from ₱48,000, or Unlimited Recoating Ceramic packages built for Philippine roads.',
  promo_cta_label: 'Explore ClearPro PPF',
  promo_cta_path: '/services/ppf',
  suggested_prompts: [...DEFAULT_SUGGESTED_PROMPTS],
})

function trimLimit(value, fallback, maxLen) {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return fallback
  return clean.slice(0, maxLen)
}

export function sanitizeExternalUrl(value, fallback) {
  const raw = String(value ?? '').trim()
  if (!raw) return fallback
  try {
    const parsed = new URL(raw)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString()
    }
  } catch {
    // Reject malformed URLs or unsafe protocols such as javascript:
  }
  return fallback
}

export function sanitizeInternalPath(value, fallback = '/services/ppf') {
  const raw = String(value ?? '').trim()
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback
  return raw.slice(0, 120)
}

export function normalizeSuggestedPrompts(input) {
  const source = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/\r?\n/)
      : DEFAULT_SUGGESTED_PROMPTS
  const clean = []
  const seen = new Set()
  for (const item of source) {
    const text = String(item ?? '').replace(/\s+/g, ' ').trim().slice(0, 64)
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    clean.push(text)
    if (clean.length >= 8) break
  }
  return clean.length ? clean : [...DEFAULT_SUGGESTED_PROMPTS]
}

export function normalizeChatbotSettings(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const enabled = typeof src.enabled === 'boolean' ? src.enabled : src.enabled !== 'false'
  const human_handoff_enabled =
    typeof src.human_handoff_enabled === 'boolean'
      ? src.human_handoff_enabled
      : src.human_handoff_enabled !== 'false'
  const promo_enabled =
    typeof src.promo_enabled === 'boolean' ? src.promo_enabled : src.promo_enabled !== 'false'
  const accentKey = String(src.accent_preset || '').trim().toLowerCase()

  return {
    enabled,
    launcher_label: trimLimit(src.launcher_label, DEFAULT_CHATBOT_SETTINGS.launcher_label, 48),
    welcome_title: trimLimit(src.welcome_title, DEFAULT_CHATBOT_SETTINGS.welcome_title, 64),
    welcome_message: trimLimit(src.welcome_message, DEFAULT_CHATBOT_SETTINGS.welcome_message, 280),
    accent_preset: Object.prototype.hasOwnProperty.call(CHATBOT_ACCENT_PRESETS, accentKey)
      ? accentKey
      : DEFAULT_CHATBOT_SETTINGS.accent_preset,
    human_handoff_enabled,
    human_cta_label: trimLimit(src.human_cta_label, DEFAULT_CHATBOT_SETTINGS.human_cta_label, 32),
    facebook_url: sanitizeExternalUrl(src.facebook_url, HAKUM_FACEBOOK_PAGE_URL),
    messenger_url: sanitizeExternalUrl(src.messenger_url, HAKUM_FACEBOOK_MESSENGER_URL),
    promo_enabled,
    promo_eyebrow: trimLimit(src.promo_eyebrow, DEFAULT_CHATBOT_SETTINGS.promo_eyebrow, 36),
    promo_title: trimLimit(src.promo_title, DEFAULT_CHATBOT_SETTINGS.promo_title, 72),
    promo_description: trimLimit(src.promo_description, DEFAULT_CHATBOT_SETTINGS.promo_description, 180),
    promo_cta_label: trimLimit(src.promo_cta_label, DEFAULT_CHATBOT_SETTINGS.promo_cta_label, 32),
    promo_cta_path: sanitizeInternalPath(src.promo_cta_path, DEFAULT_CHATBOT_SETTINGS.promo_cta_path),
    suggested_prompts: normalizeSuggestedPrompts(src.suggested_prompts),
  }
}

export function isChatbotPathVisible(pathname = '') {
  const path = String(pathname || '').trim().toLowerCase()
  if (!path) return true
  if (path.startsWith('/operations') || path.startsWith('/admin')) return false
  if (path === '/app' || path.startsWith('/app/')) return false
  if (/^\/queue\/[^/]+\/tv(?:\/|$)/.test(path)) return false
  return true
}
