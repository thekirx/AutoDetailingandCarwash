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
  ceramicApplication: new URL('../../../assets/services/ceramic-tesla-application.jpg', import.meta.url).href,
  tint: new URL('../../../assets/services/ceramic-tint.webp', import.meta.url).href,
  /* Two stills cut from Hakum's own tint clips, so every card on the tint page
     shows tint work — a photo of another service reads as part of the job. */
  tintFinished: new URL('../../../assets/services/tint-finished-wigo.webp', import.meta.url).href,
  tintCabin: new URL('../../../assets/services/tint-cabin-through-glass.webp', import.meta.url).href,
  tintToyota86: new URL('../../../assets/services/tint-toyota86.webp', import.meta.url).href,
  detailing: new URL('../../../assets/services/detailing.webp', import.meta.url).href,
  interior: new URL('../../../assets/services/interior-detailing.webp', import.meta.url).href,
  glass: new URL('../../../assets/services/glass-detailing.webp', import.meta.url).href,
  washGlassCoating: new URL('../../../assets/services/wash-detailing/glass-coating.webp', import.meta.url).href,
  washGlassDetailing: new URL('../../../assets/services/wash-detailing/glass-detailing.webp', import.meta.url).href,
  washInteriorDeepCleaning: new URL('../../../assets/services/wash-detailing/interior-deep-cleaning.webp', import.meta.url).href,
  washBactozero: new URL('../../../assets/services/wash-detailing/bactozero.webp', import.meta.url).href,
  washMobileDetailing: new URL('../../../assets/services/wash-detailing/mobile-detailing.webp', import.meta.url).href,
  washBlackTrims: new URL('../../../assets/services/wash-detailing/black-trims-restoration.webp', import.meta.url).href,
  washGallery01: new URL('../../../assets/services/wash-detailing/gallery/wash-gallery-01.jpg', import.meta.url).href,
  washGallery02: new URL('../../../assets/services/wash-detailing/gallery/wash-gallery-02.jpg', import.meta.url).href,
  washGallery03: new URL('../../../assets/services/wash-detailing/gallery/wash-gallery-03.jpg', import.meta.url).href,
  washGallery04: new URL('../../../assets/services/wash-detailing/gallery/wash-gallery-04.jpg', import.meta.url).href,
  washGallery05: new URL('../../../assets/services/wash-detailing/gallery/wash-gallery-05.jpg', import.meta.url).href,
  washGallery06: new URL('../../../assets/services/wash-detailing/gallery/wash-gallery-06.jpg', import.meta.url).href,
  washGallery07: new URL('../../../assets/services/wash-detailing/gallery/wash-gallery-07.jpg', import.meta.url).href,
  washGallery08: new URL('../../../assets/services/wash-detailing/gallery/wash-gallery-08.jpg', import.meta.url).href,
  carwash: new URL('../../../assets/services/carwash.webp', import.meta.url).href,
  engine: new URL('../../../assets/services/engine-wash.webp', import.meta.url).href,
  ceramicTeslaGloss: new URL('../../../assets/services/ceramic-tesla-gloss.jpg', import.meta.url).href,
  ceramicTeslaFinish: new URL('../../../assets/services/ceramic-tesla-finish.jpg', import.meta.url).href,
  about: new URL('../../../assets/about/about-hkm-21.webp', import.meta.url).href,
  shopfront: new URL('../../../assets/about/hakum-shopfront-dusk.webp', import.meta.url).href,
  /* The same dusk photo cropped to landscape, so the story title can sit on a
     fixed place in it — between the sign and the car roofs. */
  shopfrontWide: new URL('../../../assets/about/hakum-shopfront-dusk-wide.webp', import.meta.url).href,
  hakumStory: new URL('../../../assets/about/hakum-story-clean-cars.webp', import.meta.url).href,
  heroStill: new URL('../../../assets/hero/bredesign-hero-poster.webp', import.meta.url).href,
  event: '/content/events-stay-tuned.webp',
}

export const ORIGIN = {
  eyebrow: 'The Hakum story',
  headline: ['It began', 'with a word', 'for'],
  headlineAccent: 'love.',
  paragraphs: [
    'Founded in 2024, Hakum Auto Care was established on the principle that exceptional service begins with genuine care and pride in every job we undertake.',
    'We specialize in fast, high-quality auto detailing, treating every vehicle with the same attention and respect we give our own. The name “Hakum” originates from a heartfelt expression my son used as a child to say “I love you.” It serves as a constant reminder that our work should always come from a place of sincerity and dedication. Whether it’s a quick wash or comprehensive detailing, our customers can expect expert craftsmanship, premium products, and a team that truly treats every car as if it were their own.',
  ],
  image: IMAGES.hakumStory,
  imageWide: IMAGES.hakumStory,
  imageAlt: 'Hakum storefront under the Clean Cars? headline, listing the Batangas City, Bacoor and Dasma branches, with a car speeding past',
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
    to: '/services/wash-detailing',
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
    id: 'glass-coating',
    title: 'Glass Coating',
    copy: 'Watermark removal followed by a hydrophobic glass treatment that repels water and makes your glass easier to maintain.',
    benefit: 'Hydrophobic protection and easier upkeep',
    image: IMAGES.washGlassCoating,
    alt: 'Freshly treated vehicle glass with a deep, clear finish at Hakum Auto Care',
    available: true,
  },
  {
    id: 'glass-detailing',
    title: 'Glass Detailing',
    copy: 'Restores clearer glass by removing stubborn watermarks and reducing visible wiper scratches.',
    benefit: 'Clearer glass with fewer visible marks',
    image: IMAGES.washGlassDetailing,
    alt: 'A Hakum technician machine polishing vehicle side glass',
    available: true,
  },
  {
    id: 'interior-detailing',
    title: 'Interior Detailing',
    copy: 'A complete 3–4 day interior restoration with seats and carpets removed for a thorough clean. Best for flooded, insect-infested, or long-overdue interiors.',
    benefit: 'Complete interior restoration',
    image: IMAGES.interior,
    alt: 'Interior detailing in progress at Hakum Auto Care',
    available: true,
  },
  {
    id: 'interior-deep-cleaning',
    title: 'Interior Deep Cleaning',
    copy: 'A 1-day interior reset covering seats, carpets, panels, headliners, and a thorough vacuum for a cleaner, refreshed cabin.',
    benefit: 'A cleaner cabin in one day',
    image: IMAGES.washInteriorDeepCleaning,
    alt: 'A Hakum technician deep cleaning the lower cabin of a vehicle',
    available: true,
  },
  {
    id: 'bactozero',
    title: 'Bactozero',
    copy: 'A focused cabin sanitation treatment that helps reduce odor-causing bacteria and refresh the interior environment.',
    benefit: 'A fresher, sanitized cabin',
    image: IMAGES.washBactozero,
    alt: 'Bactozero fogging treatment inside a vehicle cabin at Hakum Auto Care',
    available: true,
  },
  {
    id: 'black-trims-restoration',
    title: 'Black Trims Restoration',
    copy: 'Revives faded exterior black trim to restore a darker, cleaner, and more even finish.',
    benefit: 'Darker, renewed exterior trim',
    image: IMAGES.washBlackTrims,
    alt: 'Restored black grille trim with a clean, even finish at Hakum Auto Care',
    available: true,
  },
  {
    id: 'headlight-restoration',
    title: 'Headlight Restoration',
    copy: 'Careful correction for cloudy, oxidized lenses to restore clarity and a cleaner front-end finish.',
    benefit: 'Brighter, clearer lenses',
    image: IMAGES.detailing,
    alt: 'The front end of a vehicle being worked on at Hakum Auto Care',
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
    image: IMAGES.washMobileDetailing,
    alt: 'A Hakum technician machine polishing a white vehicle',
    available: false,
  },
]

/* The wash page gallery deliberately uses the same paged mosaic vocabulary as
   the homepage Photos & Videos rail. Each photo comes from the owner's CARWASH
   Drive folder and appears once in the real pages; useLoopRail supplies only
   the off-screen copies needed for seamless wrap-around navigation. */
export const WASH_GALLERY_PAGES = [
  {
    id: 'wash-floor-01',
    tiles: [
      { slot: 't', photo: { src: IMAGES.washGallery01, alt: 'Finished gray Honda Brio rear detail under the Hakum lights', caption: 'Finished with care' } },
      { slot: 'w', photo: { src: IMAGES.washGallery02, alt: 'Finished gray Honda Brio front detail under the Hakum lights', caption: 'Clean from every angle' } },
      { slot: 'a', photo: { src: IMAGES.washGallery03, alt: 'Hakum technician carefully washing a wheel', caption: 'The details matter' } },
      { slot: 'b', photo: { src: IMAGES.washGallery04, alt: 'Dusty vehicle step board before detailing', caption: 'Ready for restoration' } },
    ],
  },
  {
    id: 'wash-floor-02',
    tiles: [
      { slot: 't', photo: { src: IMAGES.washGallery05, alt: 'Detailed white vehicle with a high-gloss finish', caption: 'A brighter finish' } },
      { slot: 'w', photo: { src: IMAGES.washGallery06, alt: 'Detailed orange pickup on the Hakum wash floor', caption: 'Fresh from the floor' } },
      { slot: 'a', photo: { src: IMAGES.washGallery07, alt: 'Detailed red Honda wheel and paint finish', caption: 'Restored gloss' } },
      { slot: 'b', photo: { src: IMAGES.washGallery08, alt: 'Glossy red Honda rear detail under the Hakum lights', caption: 'Clean lines, deep shine' } },
    ],
  },
]

export const WHY_SECTIONS = [
  {
    id: 'wash-detailing', eyebrow: 'Premium wash & detailing',
    headline: ['Keep it clean', 'between the big jobs.'],
    lede: ['Everyday care, specialist restoration, and protective treatments—all in one place, with the same Hakum attention to detail.'],
    points: [], cta: { label: 'View the live queue', to: '/queue' }, image: IMAGES.carwash,
    alt: 'Premium car wash service at Hakum Auto Care', flip: false,
  },
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
      ['Hydrophobic performance', 'A water-repelling surface helps the protected finish stay cleaner and easier to maintain.', 'droplet'],
      ['Anti-yellowing TPU', 'ClearPro’s optical TPU is engineered to resist yellowing and preserve the finish underneath.', 'clarity'],
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
      image: '/video/service-proof/ppf/mini-cooper-poster.webp',
      alt: 'A Hakum PPF finish with no swirls or surface marks left in it',
      position: '55% 45%',
    },
    {
      title: 'Impact-ready barrier',
      copy: 'Road debris and light scratches hit the film before they reach the paint.',
      image: IMAGES.ppfClearpro,
      alt: 'ClearPro paint protection film taking surface contact before it reaches the panel',
      position: '50% 40%',
    },
    {
      title: 'Hydrophobic performance',
      copy: 'Water beads and sheets away so the protected surface stays easier to maintain.',
      image: IMAGES.truck,
      alt: 'A protected pickup still clean after driving, photographed at Hakum Auto Care',
      position: '55% 45%',
    },
    {
      title: 'Anti-yellowing TPU',
      copy: 'Optical TPU resists yellowing to preserve the finish underneath.',
      image: '/video/service-proof/ppf/toyota-cross-poster.webp',
      alt: 'The true red of a Hakum-protected panel showing through the clear film',
      position: '50% 45%',
    },
  ],
  ceramic: [
    {
      title: 'Permanent molecular bond',
      copy: 'Bonds chemically to the paint, so it cannot be washed or wiped off.',
      image: IMAGES.ceramicApplication,
      alt: 'A Hakum technician applying ceramic coating directly to a white Tesla panel',
      position: '50% 86%',
    },
    {
      title: 'Extreme gloss & depth',
      copy: 'Deepens the depth and clarity of the paint beyond the day you bought it.',
      image: IMAGES.ceramicTeslaGloss,
      alt: 'Deep gloss on a white Tesla after ceramic coating',
      position: '50% 40%',
    },
    {
      title: 'Hydrophobic self-cleaning',
      copy: 'Water, mud and road grime bead up and sheet straight off.',
      image: IMAGES.ceramicTeslaFinish,
      alt: 'A coated white Tesla left spotless after its finish at Hakum Auto Care',
      position: '50% 40%',
    },
    {
      title: 'UV & chemical resistance',
      copy: 'Blocks UV fade and repels bird droppings, tree sap and acid rain.',
      image: '/video/service-proof/ceramic/mg-poster.webp',
      alt: 'Overhead light held on the coated black paint of an MG at Hakum Auto Care',
    },
  ],
  tint: [
    {
      title: 'Heat rejection',
      copy: 'Infrared is rejected at the glass, so a lighter legal shade still feels cooler.',
      image: '/video/service-proof/tint/naval-poster.webp',
      alt: 'A Hakum technician fitting nano ceramic tint to a door window',
      position: '50% 35%',
    },
    {
      title: 'Clear outward visibility',
      copy: 'No mirror haze and no purple fade. Night visibility stays honest.',
      image: IMAGES.tintFinished,
      alt: 'A Toyota Wigo with nano ceramic tint fitted, seen from the side',
      position: '50% 45%',
    },
    {
      title: 'Signal-safe performance',
      copy: 'No metal in the film, so GPS, radio and mobile signal work normally.',
      image: IMAGES.tintToyota86,
      alt: 'The tinted side glass of a red Toyota 86 at Hakum Auto Care',
      position: '50% 50%',
    },
    {
      /* The cabin seen through the tinted glass, not an interior-detailing
         photo: nothing here should read as a service the tint does not buy. */
      title: 'UV interior protection',
      copy: 'Blocking UV keeps the dashboard from cracking and the seats from fading.',
      image: IMAGES.tintCabin,
      alt: 'Seats and cabin seen through the nano ceramic tint on a vehicle’s side glass',
      position: '50% 50%',
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
   appears once — 16 photos, 23 videos. A clip is named as [service, id] and
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
  {
    layout: 'b',
    tiles: [
      clip('t', 'ppf', 'mini-cooper'),
      clip('w', 'ppf', 'santa-fe'),
      clip('c', 'ppf', 'toyota-cross'),
      clip('d', 'ppf', 'white-hilux-install'),
      clip('a', 'ppf', 'black-vehicle-install'),
      clip('b', 'ppf', 'xpander-cross'),
    ],
  },
]
