/* Copy for the BreDESIGN homepage, taken from the approved design mock B.
 *
 * The origin story is the business's own About Us text, supplied by the owner.
 * The headline is drawn from it — the name's meaning is the actual story, and
 * far stronger than the one that stood here before it arrived.
 */

/* Each URL is written out in full rather than built by a helper: Vite only
   rewrites `new URL(...)` when the path is a static string, so a template
   literal here would ship the source path and every image would 404. */
export const IMAGES = {
  ppf: new URL('../../../assets/services/paint-protection-film.webp', import.meta.url).href,
  /* The three frames of the install collage above, cut apart so each can carry
     one card on the PPF page. */
  ppfEdge: new URL('../../../assets/services/ppf-film-edge.webp', import.meta.url).href,
  ppfTrim: new URL('../../../assets/services/ppf-trim-tuck.webp', import.meta.url).href,
  ppfClearpro: new URL('../../../assets/services/ppf-clearpro-install.webp', import.meta.url).href,
  truck: new URL('../../../assets/services/ppf-information-grey-truck-clean.jpg', import.meta.url).href,
  /* Two different polish frames: this one leads the service, the North Wolf
     shot carries the photo wall. Both sit on the homepage, so they must not be
     the same picture. */
  ceramic: new URL('../../../assets/services/ceramic.webp', import.meta.url).href,
  ceramicPolish: new URL('../../../assets/services/ceramic-coating-gallery.webp', import.meta.url).href,
  ceramicClassic: new URL('../../../assets/services/ceramic-classic.webp', import.meta.url).href,
  ceramicPremium: new URL('../../../assets/services/ceramic-premium.webp', import.meta.url).href,
  ceramicPlatinum: new URL('../../../assets/services/ceramic-platinum.webp', import.meta.url).href,
  tint: new URL('../../../assets/services/ceramic-tint.webp', import.meta.url).href,
  detailing: new URL('../../../assets/services/detailing.webp', import.meta.url).href,
  interior: new URL('../../../assets/services/interior-detailing.webp', import.meta.url).href,
  glass: new URL('../../../assets/services/glass-detailing.webp', import.meta.url).href,
  carwash: new URL('../../../assets/services/carwash.webp', import.meta.url).href,
  engine: new URL('../../../assets/services/engine-wash.webp', import.meta.url).href,
  about: new URL('../../../assets/about/about-hkm-21.webp', import.meta.url).href,
  shopfront: new URL('../../../assets/about/hakum-shopfront-dusk.webp', import.meta.url).href,
  /* The same dusk photo cropped to landscape, so the story title can sit on a
     fixed place in it — between the sign and the car roofs. */
  shopfrontWide: new URL('../../../assets/about/hakum-shopfront-dusk-wide.webp', import.meta.url).href,
  heroStill: new URL('../../../assets/hero/bredesign-hero-poster.webp', import.meta.url).href,
  event: '/content/events-stay-tuned.webp',
}

export const ORIGIN = {
  eyebrow: 'The Hakum story',
  headline: ['It began', 'with a word', 'for'],
  headlineAccent: 'love.',
  paragraphs: [
    'Founded in 2024, Hakum Auto Care was established on the principle that exceptional service begins with genuine care and pride in every job we undertake.',
    'We specialize in fast, high-quality auto detailing, treating every vehicle with the same attention and respect we give our own. The name “Hakum” originates from a heartfelt expression my son used as a child to say “I love you.” It serves as a constant reminder that our work should always come from a place of sincerity and dedication.',
  ],
  tagTitle: 'Est. 2024',
  tagLine: 'Cavite — three branches, one standard',
  image: IMAGES.shopfront,
  imageWide: IMAGES.shopfrontWide,
  imageAlt: 'Hakum Auto Care branch at dusk with illuminated signage and cars waiting outside',
}

export const SERVICES = [
  {
    number: '01',
    title: 'Paint Protection Film',
    copy: 'A clear, self-healing layer that takes the stone chips and scratches your paint would otherwise keep forever.',
    cta: 'Why PPF',
    to: '/services/ppf',
    image: IMAGES.ppf,
    alt: 'Paint protection film installed on a vehicle at Hakum Auto Care',
  },
  {
    number: '02',
    title: 'Ceramic Coating',
    copy: 'A glass-like layer bonded into the paint itself. Deeper gloss, water that sheets straight off, far easier upkeep.',
    cta: 'Why ceramic',
    to: '/services/ceramic',
    image: IMAGES.ceramic,
    alt: 'A technician machine-polishing a masked panel at Hakum Auto Care',
  },
  {
    number: '03',
    title: 'Nano Ceramic Tint',
    copy: 'Rejects heat and UV at the glass instead of just darkening it — a cooler cabin without losing your view out.',
    cta: 'Why upgrade',
    to: '/services/tint',
    image: IMAGES.tint,
    alt: 'Nano ceramic tint being fitted at Hakum Auto Care',
  },
  /* Wash and detailing is walk-in work, so this card opens the wash & detailing
     pop-up rather than a page or the booking form. Inside it, every service's
     only action is the live queue — for a wash the useful question is which
     branch is busy right now, not which date is free. */
  {
    number: '04',
    title: 'Premium Wash & Detailing',
    copy: 'Deep interior and exterior care that resets the finish — and the groundwork everything else is bonded onto.',
    cta: 'See wash & detailing',
    popup: 'wash',
    image: IMAGES.interior,
    alt: 'Interior detailing in progress at Hakum Auto Care',
  },
]

/* The walk-in services behind card 04. Copy and photos are the site's existing
   descriptions of each; the benefit line is the outcome those descriptions
   already name. */
export const WASH_SERVICES = [
  {
    id: 'car-wash',
    title: 'Premium Car Wash',
    copy: 'A thorough exterior wash that removes everyday dirt and restores a clean, refreshed finish.',
    benefit: 'A crisp, spotless finish',
    image: IMAGES.carwash,
    alt: 'A car being washed at Hakum Auto Care',
    available: true,
  },
  {
    id: 'interior-detailing',
    title: 'Interior Detailing',
    copy: 'Deep interior cleaning for fresher surfaces, improved comfort, and a cleaner cabin.',
    benefit: 'Fresher air, renewed comfort',
    image: IMAGES.interior,
    alt: 'Interior detailing in progress at Hakum Auto Care',
    available: true,
  },
  {
    id: 'glass-detailing',
    title: 'Glass Detailing',
    copy: 'Detailed glass cleaning and decontamination for clearer visibility and a spotless finish.',
    benefit: 'Sharper vision in every condition',
    image: IMAGES.glass,
    alt: 'Glass detailing in progress at Hakum Auto Care',
    available: true,
  },
  {
    id: 'engine-wash',
    title: 'Engine Wash',
    copy: 'A careful, component-safe engine bay cleaning for a cleaner and more presentable finish.',
    benefit: 'A neater engine bay',
    image: IMAGES.engine,
    alt: 'A cleaned engine bay',
    available: true,
  },
  {
    id: 'mobile-detailing',
    title: 'Mobile Detailing',
    copy: 'Premium Hakum car care delivered where it is most convenient.',
    benefit: 'We come to you',
    image: null,
    alt: '',
    available: false,
  },
]

export const WHY_SECTIONS = [
  {
    id: 'ppf',
    eyebrow: 'Why paint protection film',
    headline: ['From the', 'first mile.'],
    lede: [
      'Your car is most vulnerable the moment it leaves the dealership. ',
      { strong: 'Road debris, UV radiation, and environmental fallout' },
      ' attack your paint every single day — quietly taking resale value and the finish you paid for with them.',
    ],
    points: [
      ['Self-healing top coat', 'ClearPro’s TPU film is designed so minor swirls and light surface marks can recover with heat or sunlight.', 'shield'],
      ['Impact-ready barrier', 'The film takes the everyday contact from road debris and light scratches before it reaches the original paint.', 'impact'],
      ['Optical clarity', 'ClearPro builds its clear film to preserve the color and gloss underneath rather than masking the factory finish.', 'clarity'],
      ['Hydrophobic & anti-yellowing', 'A water-repelling surface and non-yellowing optical TPU help the protected finish stay clearer and easier to maintain.', 'droplet'],
    ],
    cta: { label: 'Protect your vehicle today', to: '/book' },
    image: IMAGES.ppf,
    alt: 'A vehicle with paint protection film installed',
    flip: false,
  },
  {
    id: 'ceramic',
    eyebrow: 'Ceramic coating',
    /* The old headline ("Beyond a wax.") was a hook that left the claim
       unstated. The owner asked for the claim itself, so the durability is
       the headline now and nothing else has to carry it. */
    headline: ['More durable than', 'your regular', 'wax.'],
    lede: [
      'Traditional waxes wash away in weeks. Ceramic coating is a different beast entirely — a ',
      { strong: 'liquid polymer that bonds permanently at the molecular level' },
      ' to your paint, creating a rigid, glass-like layer that wax and sealants simply cannot replicate.',
    ],
    points: [
      ['Permanent molecular bond', 'Unlike wax, ceramic chemically bonds to your paint — it cannot be washed or wiped off.', 'bond'],
      ['Extreme gloss & depth', "Nano-ceramic technology amplifies your paint's depth and clarity — it reads better than the day you bought it.", 'gloss'],
      ['Hydrophobic self-cleaning', 'Water, mud, and road grime bead up and sheet off effortlessly — keeping your car cleaner, longer.', 'droplet'],
      ['UV & chemical resistance', 'Blocks oxidation and UV fade, while repelling bird droppings, tree sap, and acid rain that etch bare paint.', 'sun'],
    ],
    cta: { label: 'Get a ceramic coating quote', to: '/book' },
    image: IMAGES.ceramic,
    alt: 'A technician machine-polishing a masked panel at Hakum Auto Care',
    flip: true,
  },
  {
    id: 'tint',
    eyebrow: 'Why upgrade to nano ceramic tint',
    headline: ['Not darker.', 'Cooler.'],
    lede: [
      'Ordinary tint buys you privacy by blocking light. Nano ceramic rejects ',
      { strong: 'heat and UV specifically' },
      ' — so the cabin drops several degrees without the view, the night visibility, or your phone signal going with it.',
    ],
    points: [
      ['Heat, not darkness', 'Infrared is rejected at the glass, so you can run a lighter, legal shade and still feel the drop.', 'heat'],
      ['Clarity kept', 'No mirror haze and no purple fade over time. Night visibility stays honest.', 'clarity'],
      ['Signal-safe', 'Unlike metallic film, nano ceramic does not interfere with GPS, radio, or mobile signal.', 'signal'],
      ['Interior preserved', 'UV is what cracks a dashboard and fades seats. Blocking it protects the part you actually sit in.', 'cabin'],
    ],
    cta: { label: 'Book nano ceramic tint', to: '/book' },
    image: IMAGES.tint,
    alt: 'Nano ceramic tint being fitted at Hakum Auto Care',
    flip: false,
  },
]

/* Each service's four points as photo cards: Hakum's own photography, a
   heading, and one line. The full sentences stay in WHY_SECTIONS, which each
   page's meta description is built from. No photo repeats one already on the
   same page — the hero image and the ceramic package photos are left out of
   their own pages. Tint has one photo of its own so far, so three of its cards
   use stills from the tint installation clips until more arrive. */
export const SERVICE_POINT_CARDS = {
  ppf: [
    {
      title: 'Self-healing top coat',
      copy: 'Minor swirls and light surface marks recover with heat or sunlight.',
      image: IMAGES.ppfTrim,
      alt: 'A technician tucking paint protection film under a trim',
    },
    {
      title: 'Impact-ready barrier',
      copy: 'Road debris and light scratches hit the film before they reach the paint.',
      image: '/video/service-proof/ppf/panel-install-poster.webp',
      alt: 'A technician applying paint protection film to a black panel',
      position: '50% 40%',
    },
    {
      title: 'Optical clarity',
      copy: 'Built to keep the colour and gloss underneath, not mask the factory finish.',
      image: IMAGES.truck,
      alt: 'The glossy hood and grille of a grey pickup',
      position: '62% 30%',
    },
    {
      title: 'Hydrophobic & anti-yellowing',
      copy: 'Water-repelling, non-yellowing TPU that stays clearer and easier to keep.',
      image: IMAGES.ppfEdge,
      alt: 'A squeegee working paint protection film along a panel edge',
    },
  ],
  ceramic: [
    {
      title: 'Permanent molecular bond',
      copy: 'Bonds chemically to the paint, so it cannot be washed or wiped off.',
      image: IMAGES.ceramicPolish,
      alt: 'Machine polishing a panel before ceramic coating',
    },
    {
      title: 'Extreme gloss & depth',
      copy: 'Deepens the depth and clarity of the paint beyond the day you bought it.',
      image: IMAGES.ceramicClassic,
      alt: 'Headlight and hood gloss under the shop lights',
      position: '50% 40%',
    },
    {
      title: 'Hydrophobic self-cleaning',
      copy: 'Water, mud and road grime bead up and sheet straight off.',
      image: IMAGES.heroStill,
      alt: 'A Hakum technician polishing a wet hood',
      position: '55% 60%',
    },
    {
      title: 'UV & chemical resistance',
      copy: 'Blocks UV fade and repels bird droppings, tree sap and acid rain.',
      image: IMAGES.about,
      alt: 'Close-up of a detailed headlight',
    },
  ],
  tint: [
    {
      title: 'Heat, not darkness',
      copy: 'Infrared is rejected at the glass, so a lighter legal shade still feels cooler.',
      image: '/video/service-proof/tint/naval-poster.webp',
      alt: 'A Hakum technician fitting nano ceramic tint to a door window',
      position: '50% 35%',
    },
    {
      title: 'Clarity kept',
      copy: 'No mirror haze and no purple fade. Night visibility stays honest.',
      image: IMAGES.glass,
      alt: 'Glass detailing in progress at Hakum Auto Care',
    },
    {
      title: 'Signal-safe',
      copy: 'No metal in the film, so GPS, radio and mobile signal work normally.',
      image: '/video/service-proof/tint/wigo-poster.webp',
      alt: 'Nano ceramic tint being installed on a Toyota Wigo',
      position: '50% 45%',
    },
    {
      title: 'Interior preserved',
      copy: 'Blocking UV keeps the dashboard from cracking and the seats from fading.',
      image: IMAGES.interior,
      alt: 'A detailed car interior at Hakum Auto Care',
    },
  ],
}

/* Two service-proof clips bundled with the app rather than served from
   /public. They were never in the gallery; everything we have is now. */
export const GALLERY_EXTRA_CLIPS = {
  'ppf-proof': {
    id: 'ppf-proof',
    serviceId: 'ppf',
    serviceName: 'Paint Protection Film',
    label: 'Hakum technician working paint protection film around a door handle',
    caption: 'Film worked around the door handle',
    poster: new URL('../../../assets/service-proof/ppf-proof-poster.webp', import.meta.url).href,
    sources: { h264: new URL('../../../assets/service-proof/ppf-proof.mp4', import.meta.url).href },
  },
  'ceramic-proof': {
    id: 'ceramic-proof',
    serviceId: 'ceramic',
    serviceName: 'Ceramic Coating',
    label: 'Ceramic coating gloss finish on a red Honda at Hakum',
    caption: 'Honda · Gloss finish',
    poster: new URL('../../../assets/service-proof/ceramic-proof-poster.webp', import.meta.url).href,
    sources: { h264: new URL('../../../assets/service-proof/ceramic-proof.mp4', import.meta.url).href },
  },
}

/* The homepage gallery, page by page. Every page is the original collage: a
   tall tile each side of a wide one, with the small tiles beneath. Layout "a"
   ends in a tall tile, layout "b" in two small ones. Each photo and each clip
   appears once — 16 photos, 17 videos. A clip is named as [service, id] and
   read from SERVICE_DETAIL_CONTENT, or from GALLERY_EXTRA_CLIPS. */
const photo = (slot, src, caption, alt, position) => ({ slot, photo: { src, caption, alt, position } })
const clip = (slot, service, id) => ({ slot, clip: [service, id] })

export const GALLERY_PAGES = [
  {
    layout: 'a',
    tiles: [
      photo('t', IMAGES.detailing, 'Correction', 'Paint correction under inspection lighting'),
      photo('w', IMAGES.ceramicPolish, 'Coated and cured', 'Machine polishing a panel before ceramic coating'),
      clip('v', 'ceramic', 'honda-city'),
      clip('a', 'ppf', 'fortuner'),
      photo('b', IMAGES.interior, 'Interior', 'Interior detailing in progress'),
    ],
  },
  {
    layout: 'b',
    tiles: [
      clip('t', 'tint', 'naval'),
      photo('w', IMAGES.heroStill, 'Hands on the hood', 'A Hakum technician machine-polishing a hood'),
      photo('c', IMAGES.glass, 'Glass prep', 'Glass decontaminated before tinting'),
      clip('d', 'ppf', 'panel-install'),
      photo('a', IMAGES.ppf, 'Film, finished', 'A vehicle with paint protection film installed'),
      clip('b', 'ceramic', 'byd-emax6'),
    ],
  },
  {
    layout: 'a',
    tiles: [
      clip('t', 'extra', 'ppf-proof'),
      photo('w', IMAGES.shopfrontWide, 'The branch at dusk', 'Hakum Auto Care branch at dusk with illuminated signage', '45% 50%'),
      clip('v', 'tint', 'wigo'),
      photo('a', IMAGES.about, 'Headlight detail', 'Close-up of a detailed headlight'),
      clip('b', 'ceramic', 'crv'),
    ],
  },
  {
    layout: 'b',
    tiles: [
      clip('t', 'ppf', 'hilux'),
      photo('w', IMAGES.truck, 'Ranger Raptor', 'A clean Ford Ranger Raptor, front three-quarter view'),
      photo('c', IMAGES.ceramic, 'Machine polish', 'A technician machine-polishing a masked panel'),
      clip('d', 'tint', 'toyota86'),
      photo('a', IMAGES.ceramicClassic, 'Gloss under the lights', 'Headlight and hood gloss under the shop lights'),
      clip('b', 'ceramic', 'veloz'),
    ],
  },
  {
    layout: 'a',
    tiles: [
      clip('t', 'extra', 'ceramic-proof'),
      photo('w', IMAGES.carwash, 'Wash bay', 'A car being washed at Hakum Auto Care'),
      clip('v', 'ppf', 'sorento'),
      photo('a', IMAGES.engine, 'Engine bay', 'A cleaned engine bay'),
      clip('b', 'ceramic', 'vios'),
    ],
  },
  {
    layout: 'b',
    tiles: [
      clip('t', 'ppf', 'full-body-install'),
      photo('w', IMAGES.ceramicPremium, 'Premium coating', 'Premium ceramic coating finish'),
      photo('c', IMAGES.ceramicPlatinum, 'Platinum coating', 'Platinum ceramic coating finish'),
      clip('d', 'ceramic', 'nissan'),
      photo('a', IMAGES.tint, 'Tint, fitted', 'Nano ceramic tint being fitted'),
      clip('b', 'ppf', 'civic-feedback'),
    ],
  },
]
