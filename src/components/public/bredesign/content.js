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
  ceramic: new URL('../../../assets/services/ceramic-coating.webp', import.meta.url).href,
  ceramicGallery: new URL('../../../assets/services/ceramic-coating-gallery.webp', import.meta.url).href,
  tint: new URL('../../../assets/services/ceramic-tint.webp', import.meta.url).href,
  detailing: new URL('../../../assets/services/detailing.webp', import.meta.url).href,
  interior: new URL('../../../assets/services/interior-detailing.webp', import.meta.url).href,
  glass: new URL('../../../assets/services/glass-detailing.webp', import.meta.url).href,
  carwash: new URL('../../../assets/services/carwash.webp', import.meta.url).href,
  about: new URL('../../../assets/about/about-hkm-21.webp', import.meta.url).href,
}

export const ORIGIN = {
  eyebrow: 'The Hakum story',
  headline: ['It began', 'with a word', 'for'],
  headlineAccent: 'love.',
  paragraphs: [
    'Founded in 2024, Hakum Auto Care was established on the principle that exceptional service begins with genuine care and pride in every job we undertake.',
    'We specialize in fast, high-quality auto detailing, treating every vehicle with the same attention and respect we give our own. The name “Hakum” originates from a heartfelt expression my son used as a child to say “I love you.” It serves as a constant reminder that our work should always come from a place of sincerity and dedication.',
    'Whether it’s a quick wash or comprehensive detailing, our customers can expect expert craftsmanship, premium products, and a team that truly treats every car as if it were their own.',
  ],
  tagTitle: 'Est. 2024',
  tagLine: 'Cavite — three branches, one standard',
  image: IMAGES.detailing,
  imageAlt: 'Paint correction under inspection lighting at Hakum Auto Care',
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
    alt: 'Ceramic coating applied at Hakum Auto Care',
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
  {
    number: '04',
    title: 'Premium Wash & Detailing',
    copy: 'Deep interior and exterior care that resets the finish — and the groundwork everything else is bonded onto.',
    cta: 'Book detailing',
    to: '/book',
    image: IMAGES.interior,
    alt: 'Interior detailing in progress at Hakum Auto Care',
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
      ['Self-healing technology', 'Minor swirls and light scratches disappear with heat — your paint stays factory-perfect.'],
      ['Rock chip & impact barrier', '7.5 mil of invisible armour absorbs road debris that would otherwise pit or chip bare paint permanently.'],
      ['Preserves resale value', 'Pristine original paint commands thousands more at trade-in — PPF pays for itself many times over.'],
      ['UV & chemical resistance', 'Blocks UV fade and repels bird droppings, tree sap, and road chemicals that etch unprotected paint.'],
    ],
    cta: { label: 'Protect your vehicle today', to: '/book' },
    image: IMAGES.ppf,
    alt: 'A vehicle with paint protection film installed',
    flip: false,
  },
  {
    id: 'ceramic',
    eyebrow: 'What is ceramic coating',
    headline: ['Beyond', 'a wax.'],
    lede: [
      'Traditional waxes wash away in weeks. Ceramic coating is a different beast entirely — a ',
      { strong: 'liquid polymer that bonds permanently at the molecular level' },
      ' to your paint, creating a rigid, glass-like layer that wax and sealants simply cannot replicate.',
    ],
    points: [
      ['Permanent molecular bond', 'Unlike wax, ceramic chemically bonds to your paint — it cannot be washed or wiped off.'],
      ['Extreme gloss & depth', "Nano-ceramic technology amplifies your paint's depth and clarity — it reads better than the day you bought it."],
      ['Hydrophobic self-cleaning', 'Water, mud, and road grime bead up and sheet off effortlessly — keeping your car cleaner, longer.'],
      ['UV & chemical resistance', 'Blocks oxidation and UV fade, while repelling bird droppings, tree sap, and acid rain that etch bare paint.'],
    ],
    cta: { label: 'Get a ceramic coating quote', to: '/book' },
    image: IMAGES.ceramicGallery,
    alt: 'A finished vehicle after ceramic coating at Hakum Auto Care',
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
      ['Heat, not darkness', 'Infrared is rejected at the glass, so you can run a lighter, legal shade and still feel the drop.'],
      ['Clarity kept', 'No mirror haze and no purple fade over time. Night visibility stays honest.'],
      ['Signal-safe', 'Unlike metallic film, nano ceramic does not interfere with GPS, radio, or mobile signal.'],
      ['Interior preserved', 'UV is what cracks a dashboard and fades seats. Blocking it protects the part you actually sit in.'],
    ],
    cta: { label: 'Read the full tint story', to: '/services' },
    image: IMAGES.tint,
    alt: 'Nano ceramic tint being fitted at Hakum Auto Care',
    flip: false,
  },
]

export const PHOTOS = [
  { src: IMAGES.detailing, alt: 'Paint correction under inspection lighting', caption: 'Correction', span: 'tall' },
  { src: IMAGES.ceramicGallery, alt: 'A finished car after ceramic coating', caption: 'Coated and cured', span: 'wide' },
  { src: IMAGES.interior, alt: 'Interior detailing in progress', caption: 'Interior' },
  { src: IMAGES.glass, alt: 'Glass decontaminated before tinting', caption: 'Glass prep' },
  { src: IMAGES.ppf, alt: 'A vehicle with paint protection film installed', caption: 'Film, finished' },
  { src: IMAGES.carwash, alt: 'A car being washed at Hakum Auto Care', caption: 'Wash bay' },
]
