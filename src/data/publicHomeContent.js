export const aboutImage = new URL('../assets/about/about-hkm-21.webp', import.meta.url).href

export const HOME_SECTION_IDS = [
  'hero',
  'ceramic',
  'ppf-information',
  'ppf-packages',
  'nano-ceramic-tint',
  'before-after',
  'media-gallery',
  'latest-post',
  'events',
  'branches',
]

export const ppfInformation = {
  image: '/ppf-frames/desktop/ppf_001.webp',
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
    id: 'premium',
    title: 'PREMIUM',
    warrantyYears: 5,
    pitch: 'Deeper gloss and stronger water repellency, covered for five years.',
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
    id: 'platinum',
    title: 'PLATINUM',
    warrantyYears: 8,
    pitch: 'Our highest gloss and longest paint preservation, covered for eight years.',
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
  {
    ...featuredServices[1],
    image: new URL('../assets/services/ceramic-coating-gallery.webp', import.meta.url).href,
  },
]

/**
 * Close-ups of Hakum's own PPF installs, shown beside the packages.
 *
 * Deliberately empty. The section renders no proof strip until real Hakum work
 * is added here — a rendered product frame or a stock install shot would be
 * exactly the generic evidence a six-figure buyer discounts on sight.
 *
 * What earns a slot: tight shots that show the work, not the car — a wrapped
 * edge at a panel gap, film following a bumper curve, a door handle recess, a
 * finished seam. Shoot them under shop lighting on cars you actually did.
 *
 *   { image: new URL('../assets/ppf-install/raptor-fender-edge.webp', import.meta.url).href,
 *     alt: 'Film wrapped into the fender edge on a Ranger Raptor',
 *     caption: 'Fender edge, wrapped' }
 */
export const ppfInstallProof = []

/**
 * Draggable before/after pairs.
 *
 * Deliberately empty: the section renders nothing until real Hakum jobs are
 * added here, because a stand-in comparison would be a claim we cannot back.
 * Add pairs as:
 *
 *   {
 *     title: 'Toyota Innova Zenix',
 *     service: 'Premium ceramic coating',
 *     branch: 'Bacoor',
 *     before: new URL('../assets/before-after/innova-before.webp', import.meta.url).href,
 *     after: new URL('../assets/before-after/innova-after.webp', import.meta.url).href,
 *     beforeAlt: 'Innova paint before correction, swirl marks visible under shop lighting',
 *     afterAlt: 'The same Innova after correction and ceramic coating',
 *   }
 *
 * Shoot both frames from the same spot under the same lighting — a slider
 * exposes a changed camera angle instantly.
 */
export const beforeAfterShowcase = {
  eyebrow: 'Proof',
  title: 'Drag the line.',
  copy: 'Same car, same light, same angle. The only thing that changed is the work.',
  items: [],
}

export function publicServiceOverview() {
  return services.filter((item) => item.available !== false).map((item) => ({
    title: item.title,
    copy: item.copy,
  }))
}

/** @deprecated use publicPackageOverview from ../lib/publicCatalog.js */
export function publicPackageOverviewLegacy() {
  return {
    ceramic: ceramicPackages.map((item) => item.title),
    ppf: ['Basic Protection', 'Premium Protection', 'Platinum Protection'],
  }
}
