export const aboutImage = new URL('../assets/about/about-hkm-21.webp', import.meta.url).href

export const HOME_SECTION_IDS = [
  'hero',
  'ceramic',
  'ppf-information',
  'ppf-packages',
  'nano-ceramic-tint',
  'media-gallery',
  'latest-post',
  'events',
  'partnership',
  'queue',
  'branches',
]

export const ppfInformation = {
  image: new URL('../assets/services/paint-protection-film.webp', import.meta.url).href,
  imageAlt: 'Paint Protection Film installation at Hakum Auto Care',
  title: 'Protection you barely see.',
  copy: 'Paint Protection Film is a clear, precision-applied layer that helps defend your vehicle from stone chips, light scratches, road debris, and daily wear while preserving the original finish.',
}

export const nanoCeramicTint = {
  image: new URL('../assets/services/ceramic-tint.webp', import.meta.url).href,
  imageAlt: 'Nano ceramic tint installed at Hakum Auto Care',
  title: 'Cooler cabin. Clearer drive.',
  copy: 'Nano ceramic tint helps reduce heat and UV exposure without sacrificing visibility, giving every drive a more comfortable and refined feel.',
}

export const services = [
  { number: '01', title: 'Carwash', copy: 'A careful exterior clean that brings back a crisp, spotless finish.', image: new URL('../assets/services/carwash.webp', import.meta.url).href, imageAlt: 'Carwash service at Hakum Auto Care', available: true },
  { number: '02', title: 'Interior Detailing', copy: 'Deep cabin care for cleaner surfaces, fresher air, and renewed comfort.', image: new URL('../assets/services/interior-detailing.webp', import.meta.url).href, imageAlt: 'Interior Detailing service at Hakum Auto Care', available: true },
  { number: '03', title: 'Ceramic Tint', copy: 'Heat-rejecting tint with lasting clarity, comfort, and UV protection.', image: new URL('../assets/services/ceramic-tint.webp', import.meta.url).href, imageAlt: 'Ceramic Tint service at Hakum Auto Care', available: true },
  { number: '04', title: 'Ceramic Coating', copy: 'Long-term gloss and hydrophobic protection for everyday driving.', image: new URL('../assets/services/ceramic-coating.webp', import.meta.url).href, imageAlt: 'Ceramic Coating service at Hakum Auto Care', available: true },
  { number: '05', title: 'Glass Detailing', copy: 'Polished, decontaminated glass for sharper vision in every condition.', image: new URL('../assets/services/glass-detailing.webp', import.meta.url).href, imageAlt: 'Glass Detailing service at Hakum Auto Care', available: true },
  { number: '06', title: 'Engine Wash', copy: 'A precise, component-safe clean for a neater engine bay.', image: new URL('../assets/services/engine-wash.webp', import.meta.url).href, imageAlt: 'Engine Wash service at Hakum Auto Care', available: true },
  { number: '07', title: 'Paint Protection Film', copy: 'Virtually invisible impact protection for the paint that matters most.', image: new URL('../assets/services/paint-protection-film.webp', import.meta.url).href, imageAlt: 'Paint Protection Film service at Hakum Auto Care', available: true },
  { number: '08', title: 'Mobile Detailing', copy: 'Premium Hakum car care delivered where it is most convenient.', image: null, imageAlt: null, available: false },
]

export const featuredServices = [
  {
    title: 'PAINT PROTECTION FILM',
    copy: 'Invisible protection that helps shield your paint from scratches, stone chips, and everyday road damage.',
    image: new URL('../assets/services/paint-protection-film.webp', import.meta.url).href,
    imageAlt: 'Paint Protection Film service at Hakum Auto Care',
  },
  {
    title: 'CERAMIC COATING',
    copy: 'Long-lasting gloss and hydrophobic protection that keeps your vehicle cleaner, shinier, and easier to maintain.',
    image: new URL('../assets/services/ceramic-coating.webp', import.meta.url).href,
    imageAlt: 'Ceramic Coating service at Hakum Auto Care',
  },
  {
    title: 'DETAILING',
    copy: "Deep exterior and interior care designed to restore your vehicle's finish, cleanliness, and overall appearance.",
    image: new URL('../assets/services/detailing.webp', import.meta.url).href,
    imageAlt: 'Vehicle detailing service at Hakum Auto Care',
  },
]

export const ceramicSection = {
  eyebrow: 'Ceramic Coating Packages',
  title: 'SHINE BEYOND LIMITS.',
  copy: 'Choose the level of lasting gloss and paint protection that fits how you drive, park, and care for your vehicle.',
}

export const ceramicPackages = [
  {
    title: 'CLASSIC',
    bgImage: new URL('../assets/services/ceramic-classic.webp', import.meta.url).href,
    copy: 'Essential ceramic protection for everyday vehicles, adding lasting gloss and an easier-to-maintain finish.',
    includes: [
      'Ceramic paint protection',
      'Enhanced gloss and shine',
      'Hydrophobic surface finish',
      'Easier regular maintenance',
    ],
  },
  {
    title: 'PREMIUM',
    bgImage: new URL('../assets/services/ceramic-premium.webp', import.meta.url).href,
    copy: 'Enhanced protection with deeper gloss and stronger hydrophobic performance for drivers who want more lasting results.',
    includes: [
      'Enhanced ceramic protection',
      'Deeper paint gloss',
      'Improved water repellency',
      'Longer-lasting protection',
    ],
  },
  {
    title: 'PLATINUM',
    bgImage: new URL('../assets/services/ceramic-platinum.webp', import.meta.url).href,
    copy: 'Our highest level of ceramic protection, created for maximum gloss, durability, and long-term paint preservation.',
    includes: [
      'Premium ceramic protection',
      'Maximum gloss and depth',
      'Advanced hydrophobic finish',
      'Long-term paint protection',
    ],
  },
]

export const otherServices = [
  {
    title: 'CARWASH',
    copy: 'A thorough exterior wash that removes everyday dirt and restores a clean, refreshed finish.',
    image: new URL('../assets/services/carwash.webp', import.meta.url).href,
    imageAlt: 'Carwash service at Hakum Auto Care',
  },
  {
    title: 'INTERIOR DETAILING',
    copy: 'Deep interior cleaning for fresher surfaces, improved comfort, and a cleaner cabin.',
    image: new URL('../assets/services/interior-detailing.webp', import.meta.url).href,
    imageAlt: 'Interior Detailing service at Hakum Auto Care',
  },
  {
    title: 'GLASS DETAILING',
    copy: 'Detailed glass cleaning and decontamination for clearer visibility and a spotless finish.',
    image: new URL('../assets/services/glass-detailing.webp', import.meta.url).href,
    imageAlt: 'Glass Detailing service at Hakum Auto Care',
  },
  {
    title: 'ENGINE WASH',
    copy: 'A careful, component-safe engine bay cleaning for a cleaner and more presentable finish.',
    image: new URL('../assets/services/engine-wash.webp', import.meta.url).href,
    imageAlt: 'Engine Wash service at Hakum Auto Care',
  },
]

export const mediaGallery = [
  featuredServices[2],
  featuredServices[0],
  featuredServices[1],
]
