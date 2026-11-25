import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CHATBOT_DEFAULT_SUGGESTIONS,
  CHATBOT_MAIN_MENU,
} from '../src/data/hakumChatbotKnowledge.js'
import {
  detectVehicleSize,
  normalizeChatbotQuery,
  resolveHakumChatbotReply,
} from '../src/lib/hakumChatbotEngine.js'
import {
  DEFAULT_CHATBOT_SETTINGS,
  HAKUM_FACEBOOK_MESSENGER_URL,
  HAKUM_FACEBOOK_PAGE_URL,
  isChatbotPathVisible,
  normalizeChatbotSettings,
  normalizeSuggestedPrompts,
  sanitizeExternalUrl,
  sanitizeInternalPath,
} from '../src/lib/chatbotSettingsRules.js'

const SAMPLE_CATALOG = {
  branches: [
    {
      slug: 'bacoor',
      name: 'Hakum Auto Care Bacoor',
      address: 'RFC Molino II, Molino Blvd, Bacoor',
      comingSoon: false,
      hours: [{ day_of_week: 1, opens_at: '08:00', closes_at: '20:00', is_closed: false }],
    },
    {
      slug: 'batangas',
      name: 'Hakum Auto Care Batangas',
      address: 'National Hwy, Brgy. Alangilan, Batangas City',
      comingSoon: false,
      hours: [{ day_of_week: 1, opens_at: '08:00', closes_at: '20:00', is_closed: false }],
    },
  ],
  services: [
    {
      id: 'svc-wash',
      name: 'Carwash',
      slug: 'premium-car-wash',
      pay_category: 'wash',
      price_minor: 41000,
      service_size_prices: [
        { size_slug: 'small', price_minor: 35000 },
        { size_slug: 'medium', price_minor: 41000 },
        { size_slug: 'large', price_minor: 50000 },
        { size_slug: 'extra_large', price_minor: 58000 },
      ],
    },
    {
      id: 'svc-ceramic',
      name: 'Ceramic Coating',
      slug: 'ceramic-coating',
      pay_category: 'detailing',
      price_minor: 1500000,
      service_size_prices: [
        { size_slug: 'small', price_minor: 1300000 },
        { size_slug: 'medium', price_minor: 1500000 },
        { size_slug: 'large', price_minor: 1800000 },
        { size_slug: 'extra_large', price_minor: 2100000 },
      ],
    },
  ],
  shopItems: [
    {
      id: 'prod-1',
      name: 'Hakum Tshirt',
      category: 'merch',
      price_minor: 65000,
      points_price: 50,
      bacoor_in_stock: true,
      batangas_in_stock: true,
    },
    {
      id: 'prod-2',
      name: 'Spanish Latte',
      category: 'coffee',
      price_minor: 16000,
      points_price: null,
      bacoor_in_stock: true,
      batangas_in_stock: false,
    },
  ],
  queueCounts: [
    { branch: 'bacoor', waiting_count: 2, in_progress_count: 1, final_checking_count: 1, total_active_count: 4 },
    { branch: 'batangas', waiting_count: 0, in_progress_count: 0, final_checking_count: 0, total_active_count: 0 },
  ],
}

describe('Hakum deterministic chatbot settings, sanitization & visibility', () => {
  it('defaults enabled=true, Facebook/Messenger URLs, promo spotlight, and clamps inputs', () => {
    const def = normalizeChatbotSettings()
    assert.deepEqual(def, DEFAULT_CHATBOT_SETTINGS)
    assert.equal(def.facebook_url, 'https://www.facebook.com/profile.php?id=61573318005308')
    assert.equal(def.messenger_url, 'https://m.me/61573318005308')

    const custom = normalizeChatbotSettings({
      enabled: false,
      launcher_label: 'x'.repeat(80),
      accent_preset: 'emerald',
      promo_enabled: false,
      human_handoff_enabled: false,
      facebook_url: 'javascript:alert(1)',
      promo_cta_path: '//evil.com',
    })
    assert.equal(custom.enabled, false)
    assert.equal(custom.launcher_label.length, 48)
    assert.equal(custom.accent_preset, 'emerald')
    assert.equal(custom.promo_enabled, false)
    assert.equal(custom.human_handoff_enabled, false)
    assert.equal(custom.facebook_url, HAKUM_FACEBOOK_PAGE_URL)
    assert.equal(custom.promo_cta_path, '/services/ppf')
    assert.equal(sanitizeExternalUrl('javascript:alert(1)', HAKUM_FACEBOOK_MESSENGER_URL), HAKUM_FACEBOOK_MESSENGER_URL)
    assert.equal(sanitizeInternalPath('//phish.test', '/services'), '/services')
    assert.equal(normalizeSuggestedPrompts([' One ', 'One', 'Two', '']).length, 2)
  })

  it('shows on public & customer app routes and hides on ops & TV kiosks', () => {
    for (const p of ['/home', '/services', '/services/ppf', '/shop', '/tint-finder', '/book', '/queue', '/queue/bacoor', '/account', '/account/loyalty', '/account/visit/123']) {
      assert.equal(isChatbotPathVisible(p), true)
    }
    for (const p of ['/operations', '/operations/finance', '/operations/settings/chatbot', '/admin', '/queue/bacoor/tv', '/app']) {
      assert.equal(isChatbotPathVisible(p), false)
    }
  })
})

describe('Hakum deterministic NLU & product/process knowledge engine', () => {
  it('normalizes Taglish and common typos deterministically', () => {
    assert.match(normalizeChatbotQuery('Magkano cermaic sa baccoor?'), /price cost how much/)
    assert.match(normalizeChatbotQuery('Magkano cermaic sa baccoor?'), /ceramic/)
    assert.match(normalizeChatbotQuery('Magkano cermaic sa baccoor?'), /bacoor/)
    assert.equal(detectVehicleSize('Toyota Fortuner')?.slug, 'large')
    assert.equal(detectVehicleSize('Honda Civic sedan')?.slug, 'small')
    assert.equal(detectVehicleSize('Toyota Hiace Grandia')?.slug, 'extra_large')
  })

  it('renders Main Menu, promo spotlight (when enabled) and respects custom suggestions', () => {
    assert.equal(CHATBOT_MAIN_MENU.length, 6)
    assert.ok(CHATBOT_DEFAULT_SUGGESTIONS.length >= 6)

    const customSettings = normalizeChatbotSettings({
      promo_title: 'Holiday Ceramic Shield',
      promo_cta_path: '/services/ceramic',
      suggested_prompts: ['Check Batangas queue', 'Holiday Ceramic Shield'],
    })

    const menuReply = resolveHakumChatbotReply('main menu', { settings: customSettings })
    assert.equal(menuReply.topicId, 'main_menu')
    assert.equal(menuReply.showMainMenu, true)
    assert.equal(menuReply.promoCard?.title, 'Holiday Ceramic Shield')
    assert.equal(menuReply.promoCard?.ctaPath, '/services/ceramic')
    assert.equal(menuReply.suggestions[0], 'Check Batangas queue')

    const noPromo = normalizeChatbotSettings({ promo_enabled: false })
    const hiReply = resolveHakumChatbotReply('Kumusta!', { settings: noPromo })
    assert.equal(hiReply.topicId, 'greeting')
    assert.equal(hiReply.promoCard, null)
  })

  it('routes real-person requests directly to Hakum Facebook & Messenger links', () => {
    const handoff = resolveHakumChatbotReply('Can I talk to a real person on Messenger?')
    assert.equal(handoff.topicId, 'human_handoff')
    assert.equal(handoff.actions.some((a) => a.href === HAKUM_FACEBOOK_MESSENGER_URL), true)
    assert.equal(handoff.actions.some((a) => a.href === HAKUM_FACEBOOK_PAGE_URL), true)

    const fallback = resolveHakumChatbotReply('xyzzy unknown request')
    assert.equal(fallback.topicId, 'fallback')
    assert.equal(fallback.actions.some((a) => a.href === HAKUM_FACEBOOK_MESSENGER_URL), true)
  })

  it('answers ClearPro PPF pricing, 4-step process & aftercare from static truth', () => {
    const ppf = resolveHakumChatbotReply('ClearPro PPF prices & warranty', { catalog: SAMPLE_CATALOG })
    assert.equal(ppf.topicId, 'ppf_packages_and_pricing')
    assert.equal(ppf.specs.some((r) => r.value.includes('48,000')), true)
    assert.equal(ppf.specs.some((r) => r.value.includes('130,000')), true)

    const care = resolveHakumChatbotReply('What is the PPF installation process and cure time?')
    assert.equal(care.topicId, 'ppf_process_warranty_aftercare')
    assert.match(care.paragraphs.join(' '), /Align/)
  })

  it('provides interactive S/M/L/XL size pricing on Ceramic & Wash answers', () => {
    const ceramic = resolveHakumChatbotReply('Magkano ceramic coating for Fortuner?', { catalog: SAMPLE_CATALOG })
    assert.equal(ceramic.topicId, 'ceramic_coating_packages')
    assert.match(ceramic.paragraphs.join(' '), /Unlimited/)
    assert.equal(ceramic.specs.some((r) => r.value.includes('18,000')), true)
    assert.equal(ceramic.sizePricing?.selectedSize, 'large')
    assert.equal(ceramic.sizePricing?.rowsBySize?.small[0].value, '₱13,000')
    assert.equal(ceramic.sizePricing?.rowsBySize?.extra_large[0].value, '₱21,000')

    const wash = resolveHakumChatbotReply('Carwash price list', { catalog: SAMPLE_CATALOG })
    assert.equal(wash.sizePricing?.rowsBySize?.small[0].value, '₱350')
    assert.equal(wash.sizePricing?.rowsBySize?.large[0].value, '₱500')
  })

  it('answers Window Tint VLT/TSER specs and links 3D Tint Finder', () => {
    const res = resolveHakumChatbotReply('Nano Ceramic Tint VLT and GPS interference')
    assert.equal(res.topicId, 'nano_ceramic_tint')
    assert.match(res.paragraphs.join(' '), /non-metallic/)
    assert.equal(res.actions.some((a) => a.to === '/tint-finder'), true)
  })

  it('reports live queue counts per branch and detailing 2-day lead rule', () => {
    const res = resolveHakumChatbotReply('Ilan nakapila sa Bacoor live queue?', { catalog: SAMPLE_CATALOG })
    assert.equal(res.topicId, 'booking_and_queue_process')
    assert.equal(res.specs.some((r) => r.value.includes('2 waiting')), true)
    assert.match(res.paragraphs.join(' '), /2 calendar days/)
    assert.equal(res.actions.some((a) => a.to === '/queue/bacoor'), true)
  })

  it('covers Studio Shop coffee, merch & aftercare', () => {
    const res = resolveHakumChatbotReply('May kape ba at Hakum Tshirt sa shop?', { catalog: SAMPLE_CATALOG })
    assert.equal(res.topicId, 'shop_merch_and_coffee')
    assert.equal(res.specs.some((r) => r.label === 'Hakum Tshirt' && r.value.includes('50 pts')), true)
  })

  it('gives signed-in customers their live stamps, tier, points & referral code cleanly', () => {
    const guest = resolveHakumChatbotReply('How many stamps do I have?', { catalog: SAMPLE_CATALOG, portal: null })
    assert.equal(guest.actions.some((a) => a.to === '/signin'), true)

    const member = resolveHakumChatbotReply('How many stamps do I have?', {
      catalog: SAMPLE_CATALOG,
      portal: {
        profile: { full_name: 'Juan Dela Cruz', referral_code: 'JUAN88' },
        loyalty: { cardSlots: 10, completed: 4, loyaltyPoints: 120, visitCount: 34, membership: { tier_name: 'Hakum Deluxe Member' } },
        bookings: [{ id: 'b-1', branch: 'bacoor', vehicle_plate: 'ABC 1234', status: 'in_progress' }],
        vehicles: [{ id: 'v-1' }],
        vouchers: { active: [{ code: 'VK99AA' }] },
      },
    })
    assert.match(member.title, /Juan Dela Cruz/)
    assert.equal(member.specs.some((r) => r.value === '4 / 10'), true)
    assert.equal(member.specs.some((r) => r.value === '120 pts'), true)
    assert.equal(member.specs.some((r) => r.value === 'JUAN88'), true)
    assert.equal(member.actions.some((a) => a.to === '/account/visit/b-1'), true)
  })
})
