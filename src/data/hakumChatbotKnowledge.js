/**
 * Static structured menu, quick-reply presets, and rich Hakum process/product
 * constants pulled straight from canonical Hakum data modules. Zero AI calls.
 */

export const CHATBOT_MAIN_MENU = [
  {
    id: 'services',
    label: 'Services & Prices',
    sub: 'Wash, detailing, sizes',
    prompt: 'Show all Hakum services and prices',
    icon: 'sparkles',
  },
  {
    id: 'ppf_ceramic',
    label: 'PPF & Ceramic',
    sub: 'ClearPro & Unlimited Recoat',
    prompt: 'Compare ClearPro PPF and Ceramic Coating',
    icon: 'shield',
  },
  {
    id: 'tint',
    label: 'Window Tint',
    sub: 'VLT, TSER & 3D Finder',
    prompt: 'Tell me about Nano Ceramic Tint and VLT shades',
    icon: 'sun',
  },
  {
    id: 'booking_queue',
    label: 'Book & Live Queue',
    sub: 'Wait times, slots, resched',
    prompt: 'Check live branch queue and how to book',
    icon: 'calendar',
  },
  {
    id: 'loyalty_shop',
    label: 'Rewards & Shop',
    sub: 'Stamps, birthday, merch, cafe',
    prompt: 'How do loyalty stamps, birthday wash, and shop work?',
    icon: 'gift',
  },
  {
    id: 'branches_app',
    label: 'Branches & App',
    sub: 'Locations, hours, /account',
    prompt: 'Where are Hakum branches located and what are the hours?',
    icon: 'mappin',
  },
]

export const CHATBOT_DEFAULT_SUGGESTIONS = [
  'ClearPro PPF prices & warranty',
  'Compare Ceramic Coating tiers',
  'Check live Bacoor queue',
  'Tint VLT & heat rejection',
  'My loyalty stamps & rewards',
  'Shop merch, care gear & coffee',
  'How to book or reschedule',
  'Branch addresses & hours',
]

export const VEHICLE_SIZE_HINTS = [
  {
    slug: 'small',
    label: 'Small (Sedan / Hatchback)',
    ratio: '0.85x',
    keywords: ['small', 'sedan', 'hatch', 'hatchback', 'vios', 'wigo', 'brio', 'mirage', 'city', 'civic', 'altis', 'mazda3', 'yaris', 'swift', 'mini cooper', 'motor', 'motorcycle', 'vespa', 'scooter'],
  },
  {
    slug: 'medium',
    label: 'Medium (Crossover / Compact CUV)',
    ratio: '1.0x',
    keywords: ['medium', 'crossover', 'cuv', 'compact', 'raize', 'corolla cross', 'hr-v', 'hrv', 'br-v', 'brv', 'sonet', 'territory', 'kicks', 'veloz', 'avanza', 'ertiga', 'tesla', 'emax'],
  },
  {
    slug: 'large',
    label: 'Large (SUV / Pickup / MPV)',
    ratio: '1.2x',
    keywords: ['large', 'suv', 'pickup', 'pick-up', 'fortuner', 'montero', 'everest', 'terra', 'hilux', 'raptor', 'ranger', 'navara', 'strada', 'triton', 'innova', 'xpander', 'cr-v', 'crv', 'sorento', 'santa fe', 'zenix', 'dmax', 'd-max'],
  },
  {
    slug: 'extra_large',
    label: 'Extra Large (Van / People Mover)',
    ratio: '1.4x',
    keywords: ['extra large', 'xl', 'van', 'hiace', 'grandia', 'super grandia', 'staria', 'alphard', 'urvan', 'carnival', 'custin', 'odyssey', 'people mover'],
  },
]

/** Taglish / colloquial typo normalization map (applied before token scoring). */
export const CHATBOT_PHRASE_NORMALIZATIONS = [
  [/\bmagkano\b/gi, 'price cost how much'],
  [/\bhm\b/gi, 'price cost how much'],
  [/\bsaan\b/gi, 'where location address branch'],
  [/\bbukas\b/gi, 'open hours schedule'],
  [/\bgaano katagal\b/gi, 'how long duration days hours'],
  [/\bilan nakapila\b/gi, 'live queue waiting cars'],
  [/\bpila\b/gi, 'queue waiting line'],
  [/\bpwede ba walk[- ]?in\b/gi, 'walk in queue or book'],
  [/\bpaano\b/gi, 'how to process'],
  [/\bano\b/gi, 'what'],
  [/\bmga\b/gi, ''],
  [/\bbday\b/gi, 'birthday'],
  [/\bresched\b/gi, 'reschedule'],
  [/\bcermic\b|\bcermaic\b/gi, 'ceramic'],
  [/\bbaccoor\b/gi, 'bacoor'],
  [/\bbatangass\b/gi, 'batangas'],
  [/\bdasma\b|\bdasmarinas\b/gi, 'dasmarinas'],
  [/\bwaranty\b|\bwarrnty\b/gi, 'warranty'],
  [/\bkape\b/gi, 'coffee lounge'],
]

export const CURATED_SHOP_CARE = [
  { name: 'Sonax Concentrat pH-Neutral Car Shampoo', category: 'Studio Care', tag: 'Wash Safe' },
  { name: 'Kisho SiO2 Hydrophobic Maintenance Booster', category: 'Studio Care', tag: 'Coating Care' },
  { name: 'ClearPro TPU & Matte Satin Surface Cleanser', category: 'Studio Care', tag: 'PPF Safe' },
  { name: 'Microtex Twisted-Loop & Edgeless Microfiber Set', category: 'Studio Care', tag: 'Zero Swirl' },
]

export const CHATBOT_QUICK_SUGGESTIONS_BY_TOPIC = {
  services: ['Premium Wash vs Detailing', 'Interior Detailing vs Deep Clean', 'Glass & Engine services', 'How car size pricing works'],
  ppf: ['Compare all 4 ClearPro PPF tiers', 'ClearPro PPF installation process', 'PPF warranty & exclusions', 'PPF cure time & aftercare'],
  ceramic: ['Compare Classic, Premium & Platinum', 'What is Unlimited Recoating?', 'Do I need paint correction first?', 'Book Ceramic Coating'],
  tint: ['Nano Ceramic vs Pro vs Black Series', 'ClearPro shade VLT & TSER specs', 'Does tint block GPS or RFID?', 'Open 3D Tint Finder'],
  booking_queue: ['Check live Bacoor queue', 'Check live Batangas queue', 'Why 2-day lead time for detailing?', 'How to reschedule a booking'],
  loyalty_shop: ['Stamp card & Visit 6–30 gifts', 'Member tiers (Basic to Platinum)', 'How to claim Birthday Car Wash', 'Coffee menu & Merch points shop'],
  branches_app: ['Bacoor & Batangas contact details', 'Opening hours & Waze directions', 'Track my car in Customer App', 'Submit feedback or partnership'],
}
