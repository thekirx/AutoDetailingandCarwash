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
  image: '/media/ppf-install/desktop/frame-0001.webp',
  imageAlt: 'Ford Ranger Raptor beginning a paint protection film installation sequence',
  eyebrow: 'Paint Protection Film',
  title: 'Between your paint\nAnd everything out there.',
  copy: 'Precision-installed protection designed to disappear into the finish.',
  introEnd: 0.12,
  chapters: [
    {
      number: '01',
      label: 'Align',
      heading: 'It starts with precision.',
      copy: 'Every panel is carefully positioned for accurate coverage.',
      start: 0.12,
      end: 0.32,
    },
    {
      number: '02',
      label: 'Form',
      heading: 'Shaped to every curve.',
      copy: 'The film conforms to every contour and body line.',
      start: 0.32,
      end: 0.55,
    },
    {
      number: '03',
      label: 'Seal',
      heading: 'Locked edge to edge.',
      copy: 'Edges are carefully finished for a clean, secure fit.',
      start: 0.55,
      end: 0.78,
    },
    {
      number: '04',
      label: 'Protected',
      heading: 'Now you see the paint.\nNot the protection.',
      copy: 'Stone chips, scratches, and road debris meet the film first.',
      start: 0.78,
      end: 1,
    },
  ],
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
    title: 'PREMIUM',
    warrantyYears: 5,
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
    warrantyYears: 8,
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
