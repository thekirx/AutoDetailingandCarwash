import { PPF_PACKAGES, PPF_FILM_BRAND } from '../data/ppfPackages.js'
import { SERVICE_DETAIL_CONTENT } from '../data/serviceDetailContent.js'
import { ceramicPackages, ppfInformation, ceramicSection } from '../data/publicHomeContent.js'
import { WASH_SERVICES } from '../components/public/bredesign/content.js'
import tintFinderConfig from '../data/tintFinderConfig.json' with { type: 'json' }
import { MERCH_POINTS, MEMBER_TIERS, SERVICE_POINTS, VISIT_REWARDS, memberTier } from './rewardsCatalog.js'
import { BOOKING_LEAD_DAYS } from './bookingLead.js'
import { RESCHEDULE_ACK } from './bookingReschedule.js'
import { BIRTHDAY_GIFT_LABEL } from './birthdayPerk.js'
import { referralOfferCopy } from './referralProgram.js'
import { BRANCH_MAP_LISTINGS, MAIN_LINE, branchDirections, branchPhone, publicBranchName } from './homeBranches.js'
import { PRICING_SIZES, resolveServicePriceMinor } from './servicePricing.js'
import { isDetailingPayCategory } from './serviceKinds.js'
import {
  DEFAULT_CHATBOT_SETTINGS,
  HAKUM_FACEBOOK_MESSENGER_URL,
  HAKUM_FACEBOOK_PAGE_URL,
} from './chatbotSettingsRules.js'
import {
  CHATBOT_DEFAULT_SUGGESTIONS,
  CHATBOT_MAIN_MENU,
  CHATBOT_PHRASE_NORMALIZATIONS,
  CHATBOT_QUICK_SUGGESTIONS_BY_TOPIC,
  CURATED_SHOP_CARE,
  VEHICLE_SIZE_HINTS,
} from '../data/hakumChatbotKnowledge.js'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function formatPeso(minorOrPesos, { isMinor = true } = {}) {
  const value = isMinor ? Number(minorOrPesos || 0) / 100 : Number(minorOrPesos || 0)
  if (!Number.isFinite(value) || value <= 0) return 'Custom quote'
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
}

export function normalizeChatbotQuery(raw = '') {
  let text = String(raw || '').toLowerCase().trim()
  for (const [pattern, replacement] of CHATBOT_PHRASE_NORMALIZATIONS) {
    text = text.replace(pattern, ` ${replacement} `)
  }
  return text.replace(/[^a-z0-9₱.\s-]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function detectVehicleSize(query = '') {
  const norm = normalizeChatbotQuery(query)
  for (const size of VEHICLE_SIZE_HINTS) {
    if (size.keywords.some((kw) => new RegExp(`\\b${kw.replace(/[-/]/g, '[-/ ]?')}\\b`, 'i').test(norm))) {
      return size
    }
  }
  return null
}

function tokenize(text) {
  return normalizeChatbotQuery(text)
    .split(/\s+/)
    .filter((w) => w.length >= 2)
}

function summarizeHours(hours = []) {
  if (!Array.isArray(hours) || !hours.length) return 'Daily studio hours — message or call branch to confirm holiday times'
  const openRows = hours.filter((h) => !h.is_closed && h.opens_at && h.closes_at)
  if (!openRows.length) return 'Check branch page for hours'
  const sample = openRows[0]
  const fmt = (hhmm) => {
    const [h, m] = String(hhmm).slice(0, 5).split(':').map(Number)
    if (!Number.isFinite(h)) return String(hhmm)
    const d = new Date(2000, 0, 1, h, m || 0)
    return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  }
  const allSame = openRows.every((r) => r.opens_at === sample.opens_at && r.closes_at === sample.closes_at)
  if (allSame && openRows.length === 7) return `Daily ${fmt(sample.opens_at)} – ${fmt(sample.closes_at)}`
  return openRows
    .slice(0, 3)
    .map((r) => `${DAY_NAMES[r.day_of_week] || ''}: ${fmt(r.opens_at)}–${fmt(r.closes_at)}`)
    .join(' · ')
}

function queueSummaryForBranch(slug, queueCounts = []) {
  const row = (queueCounts || []).find((q) => String(q.branch || '').toLowerCase() === String(slug || '').toLowerCase())
  if (!row) return { label: 'Live', detail: 'Check live branch bay counter', waiting: 0, working: 0, total: 0 }
  const waiting = Number(row.waiting_count ?? row.waiting ?? 0)
  const working =
    Number(row.in_progress_count ?? row.in_progress ?? 0) +
    Number(row.final_checking_count ?? row.final_checking ?? 0)
  const total = Number(row.total_active_count ?? waiting + working)
  const label = total === 0 ? 'Clear' : total <= 3 ? 'Short' : total <= 6 ? 'Moderate' : 'Busy'
  const detail =
    total === 0
      ? 'Bay clear · 0 waiting'
      : `${waiting} waiting · ${working} in bay / final check`
  return { label, detail, waiting, working, total }
}

function findMatchingLiveServices(query, services = []) {
  const q = normalizeChatbotQuery(query)
  const qTokens = new Set(tokenize(q))
  const scored = []
  for (const svc of services || []) {
    const name = String(svc.name || '').toLowerCase()
    const slug = String(svc.slug || '').toLowerCase()
    if (!name) continue
    let score = 0
    if (q.includes(name) || q.includes(slug.replace(/-/g, ' '))) score += 12
    for (const part of name.split(/\s+/)) {
      if (part.length >= 3 && qTokens.has(part)) score += 3
    }
    if (score > 0) scored.push({ svc, score })
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.svc)
}

function buildServicePricingSpecs(svc, sizeObj) {
  if (!svc) return []
  if (sizeObj) {
    const minor = resolveServicePriceMinor(svc, sizeObj.slug)
    return [{ label: `${svc.name} (${sizeObj.label})`, value: formatPeso(minor) }]
  }
  return PRICING_SIZES.map((sz) => ({
    label: `${sz.label} (${sz.short})`,
    value: formatPeso(resolveServicePriceMinor(svc, sz.slug)),
  }))
}

/** Interactive size-switch table for any live services list (S/M/L/XL). */
function buildInteractiveSizePricing(servicesList = [], selectedSlug = 'medium') {
  const list = (servicesList || []).filter((s) => Number(s?.price_minor || 0) > 0).slice(0, 4)
  if (!list.length) return null
  const rowsBySize = {}
  for (const sz of PRICING_SIZES) {
    rowsBySize[sz.slug] = list.map((svc) => ({
      label: svc.name,
      value: formatPeso(resolveServicePriceMinor(svc, sz.slug)),
    }))
  }
  return {
    selectedSize: selectedSlug || 'medium',
    rowsBySize,
  }
}

function buildHumanHandoffActions(settings = {}) {
  if (settings.human_handoff_enabled === false) return []
  const messengerUrl = settings.messenger_url || HAKUM_FACEBOOK_MESSENGER_URL
  const facebookUrl = settings.facebook_url || HAKUM_FACEBOOK_PAGE_URL
  const label = settings.human_cta_label || DEFAULT_CHATBOT_SETTINGS.human_cta_label
  return [
    { label, href: messengerUrl, external: true, variant: 'primary' },
    { label: 'Hakum Facebook Page', href: facebookUrl, external: true, variant: 'secondary' },
  ]
}

function buildPromoCard(settings = {}) {
  if (settings.promo_enabled === false) return null
  return {
    eyebrow: settings.promo_eyebrow || DEFAULT_CHATBOT_SETTINGS.promo_eyebrow,
    title: settings.promo_title || DEFAULT_CHATBOT_SETTINGS.promo_title,
    description: settings.promo_description || DEFAULT_CHATBOT_SETTINGS.promo_description,
    ctaLabel: settings.promo_cta_label || DEFAULT_CHATBOT_SETTINGS.promo_cta_label,
    ctaPath: settings.promo_cta_path || DEFAULT_CHATBOT_SETTINGS.promo_cta_path,
  }
}

/** Deterministic intent table + live catalog resolvers. */
function buildTopics(ctx) {
  const { catalog = {}, portal = null, detectedSize = null, rawQuery = '', settings = DEFAULT_CHATBOT_SETTINGS } = ctx
  const liveServices = catalog.services || []
  const liveBranches = catalog.branches || []
  const liveShop = catalog.shopItems || []
  const liveQueue = catalog.queueCounts || []
  const liveMilestones = (catalog.milestones && catalog.milestones.length)
    ? catalog.milestones.map((m) => ({ visit: Number(m.threshold_points), label: m.reward_label }))
    : VISIT_REWARDS
  const liveTiers = (catalog.membershipTiers && catalog.membershipTiers.length)
    ? catalog.membershipTiers
    : MEMBER_TIERS
  const loyaltyCfg = catalog.loyaltySettings || { stamps_enabled: true, points_enabled: true, card_slots: 30 }
  const handoffActions = buildHumanHandoffActions(settings)

  return [
    {
      id: 'human_handoff',
      category: 'branches_app',
      keywords: ['real person', 'human', 'person', 'agent', 'representative', 'staff', 'cs', 'messenger', 'facebook', 'fb', 'chat live', 'talk to someone', 'kausap', 'tao', 'may tao'],
      phrases: ['talk to a real person', 'speak to someone', 'chat with a human', 'hakum facebook', 'message on messenger'],
      weight: 5,
      resolve: () => ({
        title: 'Chat With the Hakum Studio Team',
        badge: 'Live Team Handoff',
        paragraphs: [
          'Need a custom quotation, paint inspection advice, or direct follow-up from our branch representatives? Connect directly with Hakum Auto Care on Facebook Messenger or visit our official Facebook Page.',
          'Prefer a quick call? Reach Bacoor Flagship on 0915 629 6096 or Batangas City on 0956 007 1028.',
        ],
        specs: [
          { label: 'Official Facebook Page', value: 'Hakum Auto Care (FB)' },
          { label: 'Bacoor Hotline', value: '0915 629 6096' },
          { label: 'Batangas City Hotline', value: '0956 007 1028' },
        ],
        actions: handoffActions.length
          ? handoffActions
          : [{ label: 'Contact Hakum Studio', to: '/contact', variant: 'primary' }],
        suggestions: CHATBOT_QUICK_SUGGESTIONS_BY_TOPIC.branches_app,
      }),
    },

    {
      id: 'personal_account_status',
      category: 'loyalty_shop',
      keywords: ['my stamps', 'my points', 'my reward', 'my rewards', 'my car', 'my cars', 'my vehicle', 'my booking', 'track my car', 'my visit', 'my referral', 'my code', 'my voucher', 'my birthday'],
      phrases: ['how many stamps do i have', 'how many points do i have', 'check my car status', 'track my visit', 'what is my referral code'],
      weight: 4,
      resolve: () => {
        if (!portal) {
          return {
            title: 'Your Hakum Customer Portal',
            badge: 'Account & Live Tracker',
            paragraphs: [
              'Sign in to your Hakum Customer account to check your exact stamp progress, loyalty spend points, active vouchers, registered vehicles, referral code, and step-by-step bay progress.',
              'If you visited Hakum before creating an account, your vehicle history links automatically when you sign up with your matching phone number or plate.',
            ],
            specs: [
              { label: 'Garage & Vehicle Sizes', value: '/account/cars' },
              { label: 'Stamps & Points Shop', value: '/account/loyalty' },
              { label: 'Visit Progress & Reschedule', value: '/account/visit' },
              { label: 'Birthday Wash & Vouchers', value: '/account/vouchers' },
            ],
            actions: [
              { label: 'Sign in to my account', to: '/signin', variant: 'primary' },
              { label: 'Create customer account', to: '/signup', variant: 'secondary' },
            ],
            suggestions: CHATBOT_QUICK_SUGGESTIONS_BY_TOPIC.loyalty_shop,
          }
        }
        const slots = Number(portal.loyalty?.cardSlots || loyaltyCfg.card_slots || 10)
        const completed = Math.min(Number(portal.loyalty?.completed || 0), slots)
        const points = Number(portal.loyalty?.loyaltyPoints || 0)
        const visits = Number(portal.loyalty?.visitCount || 0)
        const tier = portal.loyalty?.membership?.tier_name || memberTier(visits).name
        const activeBooking = portal.bookings?.[0] || null
        const refCode = portal.rewards?.referral_code || portal.profile?.referral_code || 'Available in /account/referral'
        const specs = [
          { label: 'Member Tier', value: `${tier} (${visits} visits)` },
          { label: 'Loyalty Stamps', value: `${completed} / ${slots}` },
          { label: 'Spend Points', value: `${points} pts` },
          { label: 'Referral Code', value: refCode },
          { label: 'Registered Vehicles', value: `${(portal.vehicles || []).length} saved` },
        ]
        if (activeBooking) {
          specs.unshift({
            label: 'Active Visit',
            value: `${activeBooking.vehicle_plate || 'Vehicle'} · ${String(activeBooking.status || 'booked').replace(/_/g, ' ')}`,
          })
        }
        return {
          title: `Hi ${portal.profile?.full_name || 'Hakum Driver'} — Your Live Account`,
          badge: 'Verified Customer',
          paragraphs: [
            activeBooking
              ? `Your active visit at ${publicBranchName({ slug: activeBooking.branch })} is currently at stage "${String(activeBooking.status || '').replace(/_/g, ' ')}".`
              : `You currently have ${completed} of ${slots} stamps and ${points} redeemable points (${tier}).`,
          ],
          specs,
          highlights: (portal.vouchers?.active || []).slice(0, 2).map((v) => `Active voucher: ${v.code}`),
          actions: [
            activeBooking
              ? { label: 'Track live visit', to: `/account/visit/${activeBooking.id}`, variant: 'primary' }
              : { label: 'Open my rewards', to: '/account/loyalty', variant: 'primary' },
            { label: 'Manage my cars', to: '/account/cars', variant: 'secondary' },
          ],
          suggestions: CHATBOT_QUICK_SUGGESTIONS_BY_TOPIC.loyalty_shop,
        }
      },
    },

    {
      id: 'ppf_packages_and_pricing',
      category: 'ppf_ceramic',
      keywords: ['ppf', 'paint protection film', 'clearpro', 'high impact', 'basic ppf', 'ultimate ppf', 'platinum ppf', 'mil', 'tpu', 'panel replacement', 'stone chip'],
      phrases: ['clearpro ppf', 'ppf price', 'ppf prices', 'ppf packages', 'compare clearpro ppf'],
      weight: 3,
      resolve: () => ({
        title: `ClearPro Paint Protection Film (${PPF_FILM_BRAND.name})`,
        badge: 'Official ClearPro Distributor',
        paragraphs: [
          'Hakum Auto Care is an official Philippine distributor of genuine ClearPro optical TPU film — built with Polyoptico™ mirror gloss (95 GU at 60°), Invisiglue™ residue-free adhesive, self-healing topcoat, and 8K roll inspection.',
          'Every PPF package includes FREE Glass Ceramic Coating + FREE Wheels Ceramic Coating. Pricing scales smoothly by car size for oversized/modified vehicles after quick inspection.',
        ],
        specs: PPF_PACKAGES.map((pkg) => ({
          label: `${pkg.title} (${pkg.filmThickness.replace(' TPU PPF material', '')} · ${pkg.warranty[0]})`,
          value: `From ${formatPeso(pkg.priceFrom, { isMinor: false })}`,
        })),
        highlights: [
          'FREE Glass Ceramic Coating',
          'FREE Wheels Ceramic Coating',
          '105° Hydrophobic Contact Angle',
          'Self-healing under heat',
        ],
        actions: [
          { label: 'Explore ClearPro PPF page', to: '/services/ppf', variant: 'primary' },
          { label: 'Book PPF consultation', to: '/book', state: { service: 'Paint Protection Film' }, variant: 'secondary' },
          ...(handoffActions[0] ? [{ ...handoffActions[0], variant: 'secondary' }] : []),
        ],
        suggestions: CHATBOT_QUICK_SUGGESTIONS_BY_TOPIC.ppf,
      }),
    },

    {
      id: 'ppf_process_warranty_aftercare',
      category: 'ppf_ceramic',
      keywords: ['ppf process', 'align', 'seal', 'ultrasatin', 'cosmoblack', 'matte ppf', 'satin ppf', 'ppf warranty', 'ppf care', 'ppf wash', 'repainted', 'polyoptico', 'invisiglue'],
      phrases: ['ppf installation process', 'ppf cure time', 'ppf exclusions', 'how do i care for my ppf'],
      weight: 3,
      resolve: () => ({
        title: 'ClearPro PPF Process, Finishes & Aftercare',
        badge: 'Studio Process & Warranty',
        paragraphs: [
          `4-Step Studio Installation: ${ppfInformation.chapters.map((c) => `${c.number} ${c.label}`).join(' -> ')}. We also carry specialty matte/satin/black films: UltraSatin, Cosmoblack, and Carbon Fiber Black.`,
          SERVICE_DETAIL_CONTENT.ppf.faqs[7].answer,
        ],
        specs: [
          { label: 'Covered Defects', value: 'Adhesive failure, bubbling, cracking, delamination, extreme yellowing' },
          { label: 'Cure & Inspection', value: 'Wait 3 days before washing · Final check at 7 days' },
          { label: 'Wash Rule', value: 'Hand wash only · Avoid pressure-washing directly at film edges' },
          { label: 'Repainted Panels', value: 'Not recommended; any repainted areas must be disclosed pre-install' },
        ],
        actions: [
          { label: 'View PPF proof & specs', to: '/services/ppf', variant: 'primary' },
          { label: 'Book PPF assessment', to: '/book', state: { service: 'Paint Protection Film' }, variant: 'secondary' },
        ],
        suggestions: CHATBOT_QUICK_SUGGESTIONS_BY_TOPIC.ppf,
      }),
    },

    {
      id: 'ceramic_coating_packages',
      category: 'ppf_ceramic',
      keywords: ['ceramic', 'kisho', 'coating', 'titanium catalyst', 'classic ceramic', 'premium ceramic', 'platinum ceramic', 'unlimited recoating', 'reboost', 'paint correction', 'swirl', 'cure'],
      phrases: ['ceramic coating', 'compare ceramic', 'unlimited recoating', 'paint maintenance'],
      weight: 3,
      resolve: () => {
        const liveCeramic = findMatchingLiveServices('ceramic coating', liveServices)[0]
        const specs = ceramicPackages.map((pkg) => ({
          label: `${pkg.title} · ${pkg.warrantyYears}-Year Unlimited Recoating`,
          value: pkg.includes[1] || `${pkg.warrantyYears} years`,
        }))
        if (liveCeramic) {
          specs.push(...buildServicePricingSpecs(liveCeramic, detectedSize))
        }
        const tierSummary = ceramicPackages.map((pkg) => `${pkg.title} ${pkg.warrantyYears}-yr`).join(' / ') || '3-yr / 5-yr / 8-yr'
        return {
          title: 'Hakum Ceramic Coating & Unlimited Recoating',
          badge: 'Japanese Titanium Catalyst',
          paragraphs: [
            `${ceramicSection.techTitle} — engineered specifically for Philippine sun, rain, and daily dust with deep wet gloss and hydrophobic water sheeting.`,
            `Unlimited Ceramic Coating Reboost: If your coating’s hydrophobic performance begins to degrade during your warranty period (${tierSummary}), Hakum adds a fresh reboost layer free of charge.`,
          ],
          specs,
          sizePricing: liveCeramic ? buildInteractiveSizePricing([liveCeramic], detectedSize?.slug || 'medium') : null,
          highlights: [
            'Paint correction done BEFORE coating',
            ceramicPackages.map((pkg, i) => `${pkg.title} (${i + 1}-Layer)`).join(' · ') || 'Multi-layer Nano Ceramic packages',
            'Unlimited Recoating Warranty',
          ],
          actions: [
            { label: 'Compare Ceramic tiers', to: '/services/ceramic', variant: 'primary' },
            { label: 'Book Ceramic Coating', to: '/book', state: { service: 'Ceramic Coating' }, variant: 'secondary' },
          ],
          suggestions: CHATBOT_QUICK_SUGGESTIONS_BY_TOPIC.ceramic,
        }
      },
    },

    {
      id: 'nano_ceramic_tint',
      category: 'tint',
      keywords: ['tint', 'vlt', 'tser', 'irr', 'uvr', '3d tint', 'tint finder', 'windshield', 'visor', 'shade', 'gps', 'rfid', 'skin cancer', 'clearpro tint', 'black series'],
      phrases: ['window tint', 'nano ceramic tint', 'tint vlt', 'tint price', 'heat rejection'],
      weight: 3,
      resolve: () => {
        const pkgs = Object.values(tintFinderConfig.packages || {})
        const films = Object.values(tintFinderConfig.films || {})
        return {
          title: 'ClearPro Nano Ceramic Window Tint',
          badge: 'Skin Cancer Foundation Certified',
          paragraphs: [
            'ClearPro nano-ceramic films are made in a Class 1000 dust-free cleanroom, block 99%+ of harmful UVA/UVB rays, reject infrared heat without dark-dye haze, and use non-metallic materials so mobile data, GPS, Wi-Fi, and RFID work with zero interference.',
            'Preview front windshield, side window, and rear glass darkness live in our interactive 3D Tint Finder before booking.',
          ],
          specs: [
            ...pkgs.map((p) => ({
              label: `${p.name} (${p.warranty})`,
              value: `${formatPeso(p.prices?.sedan ?? p.prices?.small, { isMinor: false })} – ${formatPeso(p.prices?.van ?? p.prices?.xl, { isMinor: false })}`,
            })),
            ...films.slice(0, 4).map((f) => ({
              label: `${f.name} (${f.vlt}% VLT)`,
              value: `${f.tser}% TSER · ${f.irr}% IRR · ${f.uvr}% UVR`,
            })),
          ],
          actions: [
            { label: 'Open 3D Tint Finder', to: '/tint-finder', variant: 'primary' },
            { label: 'Book Window Tint', to: '/book', state: { service: 'Nano Ceramic Tint' }, variant: 'secondary' },
          ],
          suggestions: CHATBOT_QUICK_SUGGESTIONS_BY_TOPIC.tint,
        }
      },
    },

    {
      id: 'wash_and_detailing_services',
      category: 'services',
      keywords: ['carwash', 'car wash', 'wash', 'exterior', 'interior detailing', 'interior deep', 'deep clean', 'glass coating', 'glass detailing', 'engine wash', 'bactozero', 'black trim', 'headlight', 'mobile detailing', 'two bucket', 'ph neutral', 'price', 'service', 'services', 'package', 'packages'],
      phrases: ['show all hakum services', 'how much is car wash', 'interior detailing vs deep clean', 'walk in wash', 'premium wash'],
      weight: 2,
      resolve: () => {
        const matched = findMatchingLiveServices(rawQuery, liveServices)
        const primary = matched[0] || liveServices[0] || null
        const interactiveTarget = matched.length ? matched : liveServices
        const specs = primary
          ? buildServicePricingSpecs(primary, detectedSize)
          : WASH_SERVICES.filter((w) => w.available !== false)
              .slice(0, 6)
              .map((w) => ({ label: w.title, value: w.benefit }))

        return {
          title: matched.length === 1 && primary ? primary.name : 'Hakum Car Wash & Detailing Menu',
          badge: matched.length === 1 && isDetailingPayCategory(primary?.pay_category) ? 'Multi-Day Detailing (Book)' : 'Same-Day & Detailing',
          paragraphs: [
            matched.length === 1 && primary?.description
              ? primary.description
              : 'Walk-in bays handle swirl-free Two-Bucket pH-Neutral Car Wash, Express/Full Packages, Glass Coating & Detailing, Bactozero cabin sanitation, Black Trims & Headlight Restoration, and safe Engine Wash. Multi-day jobs (3–4 day seats-out Interior Detailing, Ceramic, PPF, Tint) are booked with at least 2 days lead time.',
            'Mobile Detailing is currently marked Coming Soon — studio bays in Bacoor and Batangas City are open daily.',
          ],
          specs: specs.slice(0, 6),
          sizePricing: buildInteractiveSizePricing(interactiveTarget, detectedSize?.slug || 'medium'),
          highlights: [
            'Small = Sedan/Hatch (0.85x)',
            'Medium = Crossover (1.0x)',
            'Large = SUV/Pickup (1.2x)',
            'XL = Van/MPV (1.4x)',
          ],
          actions: [
            { label: 'Explore all services', to: '/services', variant: 'primary' },
            { label: 'Check live wash queue', to: '/queue', variant: 'secondary' },
            { label: 'Book detailing slot', to: '/book', variant: 'secondary' },
          ],
          suggestions: CHATBOT_QUICK_SUGGESTIONS_BY_TOPIC.services,
        }
      },
    },

    {
      id: 'booking_and_queue_process',
      category: 'booking_queue',
      keywords: ['book', 'booking', 'appointment', 'schedule', 'queue', 'line', 'wait', 'waiting', 'walk in', 'walk-in', 'lead time', 'reschedule', 'cancel', 'stages', 'how long', 'bay'],
      phrases: ['check live', 'how to book', 'live queue', 'bacoor queue', 'batangas queue', 'how to reschedule'],
      weight: 3,
      resolve: () => {
        const wantsBatangas = /\bbatangas\b/i.test(rawQuery)
        const wantsBacoor = /\bbacoor\b/i.test(rawQuery)
        const queueRows = liveBranches.length
          ? liveBranches.filter((b) => !b.coming_soon).map((b) => ({ slug: b.slug, name: b.name || publicBranchName(b) }))
          : [
              { slug: 'bacoor', name: 'Hakum Bacoor (RFC Molino II)' },
              { slug: 'batangas', name: 'Hakum Batangas City (Alangilan)' },
            ]
        const specs = queueRows.map((b) => {
          const s = queueSummaryForBranch(b.slug, liveQueue)
          return { label: `${b.name} — ${s.label}`, value: s.detail }
        })
        const queueTo = wantsBatangas ? '/queue/batangas' : wantsBacoor ? '/queue/bacoor' : '/queue'
        return {
          title: 'Live Bay Queue & Detailing Booking Process',
          badge: 'Real-Time Operations',
          paragraphs: [
            `Walk-in Car Wash & Same-Day Packages use live daily queue numbers that reset each Manila calendar day. Multi-day Detailing (Ceramic, ClearPro PPF, Nano Ceramic Tint, Paint Maintenance) requires booking at least ${BOOKING_LEAD_DAYS} calendar days ahead so a specialist bay is reserved.`,
            'Full Studio Pipeline: Pending -> Confirmed -> Waiting -> Intake -> In Progress -> Final Checking (QC) -> For Payment -> Completed. You can request a one-time reschedule while a booking is still before work (pending, confirmed, or waiting): ' + RESCHEDULE_ACK,
          ],
          specs,
          actions: [
            { label: wantsBatangas ? 'Open Batangas queue' : wantsBacoor ? 'Open Bacoor queue' : 'Check Live Queue', to: queueTo, variant: 'primary' },
            { label: 'Book detailing (2+ days ahead)', to: '/book', variant: 'secondary' },
          ],
          suggestions: CHATBOT_QUICK_SUGGESTIONS_BY_TOPIC.booking_queue,
        }
      },
    },

    {
      id: 'loyalty_rewards_birthday_referral',
      category: 'loyalty_shop',
      keywords: ['loyalty', 'stamp', 'stamps', 'milestone', 'tier', 'deluxe', 'platinum', 'birthday', 'free wash', 'referral', 'refer', 'friend code', 'voucher', 'promo', 'vk', 'points', 'discount'],
      phrases: ['loyalty stamps', 'birthday wash', 'referral code', 'voucher code', 'member tiers'],
      weight: 3,
      resolve: () => ({
        title: 'Hakum Loyalty Stamps, Tiers, Birthday & Referrals',
        badge: 'Rewards Program',
        paragraphs: [
          `Collect 1 stamp per paid visit across a ${loyaltyCfg.card_slots || 30}-slot card plus visit milestone bonuses at visits 6, 12, 18, 24, and 30. Spendable points are earned per service (up to 60 pts for Platinum PPF) and redeem for Hakum gear & ClearPro merch in Points Shop.`,
          `Birthday Gift: Save your birthdate once in /account/more?tab=account (locked after first save) to claim ${BIRTHDAY_GIFT_LABEL} on your birthday (7-day BDxxxx pass). Friend Referral: ${referralOfferCopy()} Promo vouchers use codes like VKxxxx in /account/vouchers or at booking.`,
        ],
        specs: [
          ...liveMilestones.slice(0, 5).map((m) => ({
            label: `Visit ${m.visit} Milestone`,
            value: m.label,
          })),
          ...liveTiers.slice(1, 4).map((t) => ({
            label: `${t.name} (${t.min_visits}+ visits)`,
            value: `${t.discount_percent}% off · ${t.loyalty_multiplier}x points`,
          })),
        ],
        actions: [
          { label: 'Open my Rewards card', to: '/account/loyalty', variant: 'primary' },
          { label: 'Birthday & Vouchers', to: '/account/vouchers', variant: 'secondary' },
          { label: 'My Referral link', to: '/account/referral', variant: 'secondary' },
        ],
        suggestions: CHATBOT_QUICK_SUGGESTIONS_BY_TOPIC.loyalty_shop,
      }),
    },

    {
      id: 'shop_merch_and_coffee',
      category: 'loyalty_shop',
      keywords: ['shop', 'merch', 'shirt', 'tshirt', 'keychain', 'coffee', 'latte', 'americano', 'macchiato', 'spanish latte', 'lounge', 'shampoo', 'sonax', 'towel', 'microfiber', 'air spencer', 'scent', 'spray', 'fusso', 'mug', 'bag', 'points shop'],
      phrases: ['shop merch', 'coffee menu', 'points shop', 'car care products'],
      weight: 3,
      resolve: () => {
        const liveSpecs = liveShop.slice(0, 6).map((item) => {
          const pts = Number(item.points_price) > 0 ? `${item.points_price} pts` : ''
          const php = Number(item.price_minor) > 0 ? formatPeso(item.price_minor) : ''
          const stock = [item.bacoor_in_stock ? 'Bacoor' : '', item.batangas_in_stock ? 'Batangas' : ''].filter(Boolean).join(' & ') || 'Ask counter'
          return {
            label: item.name,
            value: [php, pts, stock].filter(Boolean).join(' · '),
          }
        })
        const fallbackSpecs = liveSpecs.length
          ? liveSpecs
          : [
              ...MERCH_POINTS.slice(0, 4).map((m) => ({ label: m.name, value: `${m.points} pts` })),
              ...CURATED_SHOP_CARE.slice(0, 2).map((c) => ({ label: c.name, value: c.tag })),
            ]

        return {
          title: 'Hakum Studio Shop, Care Gear & Coffee Lounge',
          badge: 'Merch · Points · Cafe',
          paragraphs: [
            'Browse Hakum Studio apparel & accessories (Shirt 50 pts, Keychain 20 pts, ClearPro Mug 30 pts, Yellow Tote 30 pts, Coffee Kit 60 pts), coating-safe aftercare (Sonax pH-Neutral Shampoo, Kisho SiO2 Booster, ClearPro Film Cleanser, Microtex Towels), plus freshly pulled espresso drinks while you wait.',
            'Signed-in customers can redeem loyalty points at counter or submit an item inquiry right on /shop to confirm Bacoor or Batangas stock.',
          ],
          specs: fallbackSpecs,
          actions: [
            { label: 'Browse Studio Shop', to: '/shop', variant: 'primary' },
            { label: 'View Points Rewards', to: '/account/loyalty', variant: 'secondary' },
          ],
          suggestions: [
            'Show all merch points prices',
            'What aftercare shampoo is coating-safe?',
            'Check Bacoor live queue',
            'Where are Hakum branches?',
          ],
        }
      },
    },

    {
      id: 'branches_hours_contact_feedback',
      category: 'branches_app',
      keywords: ['branch', 'branches', 'address', 'location', 'bacoor', 'batangas', 'imus', 'dasmarinas', 'cavite', 'molino', 'alangilan', 'hours', 'open', 'close', 'phone', 'contact', 'map', 'waze', 'google maps', 'partner', 'partnership', 'collab', 'event', 'complaint', 'feedback', 'review'],
      phrases: ['where is hakum', 'branch addresses', 'opening hours', 'contact number', 'submit complaint', 'brand partnership'],
      weight: 3,
      resolve: () => {
        const specs = []
        const openSlugs = ['bacoor', 'batangas']
        for (const slug of openSlugs) {
          const b = liveBranches.find((r) => r.slug === slug)
          const phone = branchPhone(slug)?.display || MAIN_LINE.display
          const hoursText = summarizeHours(b?.hours)
          specs.push({
            label: `${slug === 'bacoor' ? 'Hakum Bacoor Flagship' : 'Hakum Batangas City'} (${phone})`,
            value: `${b?.address || (slug === 'bacoor' ? 'RFC Molino II, Molino Blvd' : 'National Hwy, Alangilan')} · ${hoursText}`,
          })
        }
        specs.push({
          label: 'Imus & Dasmariñas (Cavite)',
          value: 'Coming Soon — open nearby today at Bacoor Flagship',
        })

        const bacoorDirs = branchDirections({ slug: 'bacoor', ...BRANCH_MAP_LISTINGS.bacoor })
        return {
          title: 'Hakum Auto Care Branches, Hours & Studio Support',
          badge: 'Locations & Support',
          paragraphs: [
            'Two full detailing & car wash studios are open daily in Bacoor (Cavite) and Alangilan (Batangas City), with Imus and Dasmariñas branches coming soon.',
            'For brand collaborations or car meets visit /partnerships. For any service concern or formal management follow-up, submit a report at /complaints or tap Thumbs Up/Down after your visit.',
          ],
          specs,
          actions: [
            { label: 'Explore Branches & Maps', to: '/branches', variant: 'primary' },
            ...(handoffActions[0] ? [{ ...handoffActions[0], variant: 'secondary' }] : [{ label: 'Contact & Partnerships', to: '/contact', variant: 'secondary' }]),
            bacoorDirs?.waze ? { label: 'Waze: Bacoor Flagship', href: bacoorDirs.waze, external: true, variant: 'secondary' } : null,
          ].filter(Boolean),
          suggestions: CHATBOT_QUICK_SUGGESTIONS_BY_TOPIC.branches_app,
        }
      },
    },

    {
      id: 'customer_app_features',
      category: 'branches_app',
      keywords: ['app', 'pwa', 'install', 'portal', 'account', 'garage', 'pickup', 'notification', 'push', 'sms', 'busybee', 'password', 'signin', 'signup', 'theme', 'dark mode', 'light mode', 'thumbs'],
      phrases: ['customer app', 'what is in the customer app', 'install app', 'how do notifications work'],
      weight: 3,
      resolve: () => ({
        title: 'Hakum Customer App (/account) Guide',
        badge: 'PWA & Self-Service',
        paragraphs: [
          'The Hakum Customer App (/account) gives you a live vehicle tracker, 5-tab pocket navigation (Home, Queue, Book, Rewards, Cars), your Digital Garage with car sizes & photos, Pickup confirmation (/account/pickup), Web Push + BusyBee SMS status alerts, Dark/Light theme switching, and one-tap Detailing booking.',
          'Installing on iPhone or Android: open Hakum in Safari or Chrome and tap "Add to Home Screen" so Web Push alerts wake you cleanly when your vehicle reaches Final Checking or For Payment.',
        ],
        specs: [
          { label: 'Home & Active Visit Timeline', value: '/account & /account/visit' },
          { label: 'Live Branch Queue', value: '/account/queue' },
          { label: 'Detailing Booking', value: '/account/book' },
          { label: 'Stamps, Points, Birthday & Referral', value: '/account/loyalty · /vouchers · /referral' },
          { label: 'Garage & Settings / Alerts', value: '/account/cars · /account/more' },
        ],
        actions: [
          { label: portal ? 'Open my Account' : 'Sign in to Customer App', to: portal ? '/account' : '/signin', variant: 'primary' },
          { label: 'Explore Blog & Guides', to: '/blog', variant: 'secondary' },
        ],
        suggestions: CHATBOT_QUICK_SUGGESTIONS_BY_TOPIC.branches_app,
      }),
    },

    {
      id: 'service_points_table_detail',
      category: 'loyalty_shop',
      keywords: ['how many points', 'points table', 'earn points', 'points per service', 'points list'],
      phrases: ['points earned per service', 'how many points per wash', 'merch points prices'],
      weight: 3,
      resolve: () => ({
        title: 'How Hakum Spend Points Work',
        badge: 'Earning & Redemption',
        paragraphs: [
          'You earn points automatically on every completed visit based on the service performed — and higher member tiers apply up to a 2.0x points multiplier (Platinum 100+ visits).',
        ],
        specs: [
          ...SERVICE_POINTS.slice(0, 5).map((s) => ({ label: s.name, value: `+${s.points} pts` })),
          ...PPF_PACKAGES.slice(2, 4).map((p) => ({
            label: p.title,
            value: `+${p.id === 'platinum' ? 60 : 50} pts`,
          })),
          ...MERCH_POINTS.slice(0, 4).map((m) => ({ label: `Redeem: ${m.name}`, value: `${m.points} pts` })),
        ],
        actions: [
          { label: 'Open Points Shop', to: '/account/loyalty', variant: 'primary' },
          { label: 'Browse Studio Shop', to: '/shop', variant: 'secondary' },
        ],
        suggestions: CHATBOT_QUICK_SUGGESTIONS_BY_TOPIC.loyalty_shop,
      }),
    },
  ]
}

/**
 * Deterministic router + scorer. Zero LLMs, zero network guesses:
 * matches explicit menu IDs first, then scores normalized tokens + phrase hits,
 * enriches with live catalog, Owner promo/handoff config & customer portal context.
 */
export function resolveHakumChatbotReply(input, context = {}) {
  const rawQuery = String(input || '').trim()
  const norm = normalizeChatbotQuery(rawQuery)
  const detectedSize = detectVehicleSize(rawQuery)
  const settings = context.settings || DEFAULT_CHATBOT_SETTINGS
  const configuredSuggestions =
    Array.isArray(settings.suggested_prompts) && settings.suggested_prompts.length
      ? settings.suggested_prompts
      : CHATBOT_DEFAULT_SUGGESTIONS
  const handoffActions = buildHumanHandoffActions(settings)
  const promoCard = buildPromoCard(settings)
  const topics = buildTopics({ ...context, detectedSize, rawQuery, settings })

  if (!norm || norm === 'menu' || norm === 'main menu' || norm === 'help' || norm === 'start') {
    return {
      topicId: 'main_menu',
      title: 'How can Hakum Concierge help?',
      badge: 'Main Menu',
      paragraphs: [
        'Pick any category below or type your question in English or Taglish — e.g. "How much is Ceramic Coating for Fortuner?", "Check Bacoor queue", or "Talk to a real person".',
      ],
      showMainMenu: true,
      promoCard,
      specs: [],
      actions: [
        { label: 'Book detailing', to: '/book', variant: 'primary' },
        { label: 'Live queue', to: '/queue', variant: 'secondary' },
      ],
      suggestions: configuredSuggestions.slice(0, 6),
      confidence: 1,
    }
  }

  // Greeting shortcut
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|kumusta|kamusta|yo|helo)$/i.test(norm)) {
    return {
      topicId: 'greeting',
      title: 'Welcome to Hakum Auto Care',
      badge: 'Instant Concierge',
      paragraphs: [
        'Founded in 2024 in Cavite, Hakum Auto Care treats every car like our own — from swirl-free Two-Bucket Car Wash to ClearPro PPF, Kisho Titanium Ceramic Coating, and Nano Ceramic Tint.',
        'Tap a topic below or ask about any package price, branch wait line, booking step, or reward!',
      ],
      showMainMenu: true,
      promoCard,
      specs: [],
      actions: [],
      suggestions: configuredSuggestions.slice(0, 6),
      confidence: 1,
    }
  }

  const tokens = tokenize(norm)
  let best = null
  let bestScore = 0
  const ranked = []

  for (const topic of topics) {
    let score = 0
    for (const phrase of topic.phrases || []) {
      if (norm.includes(phrase)) score += 10 * (topic.weight || 1)
    }
    for (const kw of topic.keywords || []) {
      if (kw.includes(' ')) {
        if (norm.includes(kw)) score += 6 * (topic.weight || 1)
      } else if (tokens.includes(kw) || new RegExp(`\\b${kw}`, 'i').test(norm)) {
        score += 4 * (topic.weight || 1)
      }
    }
    if (score > 0) {
      ranked.push({ topic, score })
      if (score > bestScore) {
        bestScore = score
        best = topic
      }
    }
  }

  // Fallback check: did user mention a specific live service name directly?
  if ((!best || bestScore < 6) && (context.catalog?.services || []).length > 0) {
    const matchedServices = findMatchingLiveServices(rawQuery, context.catalog.services)
    if (matchedServices.length > 0) {
      const washTopic = topics.find((t) => t.id === 'wash_and_detailing_services')
      if (washTopic) {
        const res = washTopic.resolve()
        return { topicId: washTopic.id, ...res, confidence: 0.9 }
      }
    }
  }

  if (best && bestScore >= 4) {
    const resolved = best.resolve()
    return {
      topicId: best.id,
      showMainMenu: false,
      ...resolved,
      confidence: Math.min(1, bestScore / 16),
    }
  }

  // Polite deterministic fallback offering Main Menu + Messenger real-person escape hatch
  const nearSuggestions = ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => CHATBOT_MAIN_MENU.find((m) => m.id === entry.topic.category)?.prompt)
    .filter(Boolean)

  return {
    topicId: 'fallback',
    title: 'Want our studio team to help directly?',
    badge: 'Try Menu or Messenger',
    paragraphs: [
      'I can answer anything about Hakum car wash & detailing services, S/M/L/XL pricing, ClearPro PPF, Ceramic Coating, Nano Ceramic Tint, Studio Shop, live branch queues, booking/rescheduling, loyalty stamps, and your Customer App.',
      settings.human_handoff_enabled !== false
        ? 'Need a real person for a custom quote or vehicle-specific advice? Message us directly on Facebook Messenger or explore a topic below.'
        : 'Try selecting a quick topic below or opening our services catalog.',
    ],
    showMainMenu: true,
    promoCard: null,
    specs: [],
    actions: [
      ...(handoffActions.length ? handoffActions : [{ label: 'Contact Hakum Studio', to: '/contact', variant: 'primary' }]),
      { label: 'View Services & Rates', to: '/services', variant: 'secondary' },
    ],
    suggestions: nearSuggestions.length ? [...nearSuggestions, ...configuredSuggestions.slice(0, 3)] : configuredSuggestions.slice(0, 5),
    confidence: 0,
  }
}
