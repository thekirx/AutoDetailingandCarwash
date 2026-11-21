import { BRANCH_MAP_LISTINGS, branchDirections, branchPhone, MAIN_LINE } from './homeBranches.js'
import { branchDistanceKm } from './branchGeo.js'

const PRODUCTION_ORIGIN = 'https://www.hakumautocare.com'

export const BRAND_POSITIONING =
  'Hakum Auto Care is one of the fastest-growing and most trusted automotive detailing, paint protection (ClearPro PPF & Kisho 9H ceramic coating), nano-ceramic window tint, and swirl-free two-bucket pH-neutral car wash studio networks in the Philippines — serving Bacoor, Batangas City, Imus, Dasmariñas, and Cavite.'

export const QUICK_CITY_ORIGINS = [
  { id: 'bacoor', label: 'Bacoor', lat: 14.4453, lng: 120.9617, targetSlug: 'bacoor' },
  { id: 'imus', label: 'Imus', lat: 14.4296, lng: 120.9367, targetSlug: 'imus' },
  { id: 'dasmarinas', label: 'Dasmariñas', lat: 14.3294, lng: 120.9367, targetSlug: 'dasmarinas' },
  { id: 'cavite', label: 'Cavite', lat: 14.38, lng: 120.94, targetSlug: 'cavite' },
  { id: 'batangas', label: 'Batangas City', lat: 13.7565, lng: 121.0583, targetSlug: 'batangas' },
]

export const COMPLETE_DETAILING_CATALOG = [
  {
    id: 'car-wash',
    name: 'Signature Two-Bucket pH-Neutral Car Wash',
    category: 'Wash & Maintenance',
    pillarSlug: 'car-wash',
    route: '/services/wash-detailing',
    mode: 'queue',
    summary:
      'Swirl-free contact hand wash using snow-foam pre-soak, two grit-guard buckets, isolated upper-body and wheel microfiber mitts, forced-air + plush towel drying, interior vacuum, and satin tire finish.',
  },
  {
    id: 'ppf',
    name: 'ClearPro Paint Protection Film (PPF)',
    category: 'Paint Protection',
    pillarSlug: 'ppf',
    route: '/services/ppf',
    mode: 'book',
    summary:
      'Official ClearPro optical-grade self-healing Polyoptico TPU film (95 GU High Gloss, UltraSatin Matte, or Cosmoblack) with Invisiglue residue-free adhesive, tucked edges, and 10-year manufacturer warranty.',
  },
  {
    id: 'ceramic-coating',
    name: 'Kisho 9H Ceramic Coating (Japan)',
    category: 'Paint Protection',
    pillarSlug: 'ceramic-coating',
    route: '/services/ceramic',
    mode: 'book',
    summary:
      'Authentic Japanese Kisho Si-811 / Si-901 9H crystalline glass coating preceded by iron/clay decontamination and multi-stage Rupes + Menzerna paint correction, backed by 6-month Paint Maintenance and Unlimited Recoating tiers.',
  },
  {
    id: 'window-tint',
    name: 'Nano Ceramic Window Tint (F1 Auto Films)',
    category: 'Heat & UV Protection',
    pillarSlug: 'window-tint',
    route: '/services/tint',
    mode: 'book',
    summary:
      'Non-metallic high-IR heat-rejection nano-ceramic window film blocking 99% UV with crisp nighttime visibility, zero Autosweep/Easytrip RFID or GPS interference, and interactive 3D Tint Finder shade preview.',
  },
  {
    id: 'full-exterior-detailing',
    name: 'Multi-Stage Paint Correction & Full Exterior Detailing',
    category: 'Auto Detailing',
    pillarSlug: 'auto-detailing',
    route: '/services/wash-detailing',
    mode: 'queue',
    summary:
      'Digital micron paint-depth inspection, iron/tar chemical removal, clay bar decontamination, and Italian Rupes + German Menzerna machine compounding and polishing to remove swirl marks, oxidation, and holograms.',
  },
  {
    id: 'interior-deep-cleaning',
    name: 'Interior Deep Cleaning (1-Day Cabin Reset)',
    category: 'Auto Detailing',
    pillarSlug: 'auto-detailing',
    route: '/services/wash-detailing',
    mode: 'queue',
    summary:
      'Comprehensive 1-day interior turnaround covering fabric/leather seats, carpets, headliner, door panels, console crevices, and trunk vacuuming without removing seats.',
  },
  {
    id: 'interior-detailing',
    name: 'Full Interior Detailing (3–4 Day Restoration)',
    category: 'Auto Detailing',
    pillarSlug: 'auto-detailing',
    route: '/services/wash-detailing',
    mode: 'queue',
    summary:
      'Complete 3–4 day cabin teardown with seats and carpets removed for deep hot-water extraction, leather conditioning, mold/spill remediation, and full sanitation.',
  },
  {
    id: 'glass-detailing',
    name: 'Glass Detailing & Acid-Rain / Watermark Removal',
    category: 'Glass & Visibility',
    pillarSlug: 'auto-detailing',
    route: '/services/wash-detailing',
    mode: 'queue',
    summary:
      'Safe machine glass polishing and chemical mineral decontamination that eliminates stubborn hard-water spots, acid-rain etching, and light wiper haze.',
  },
  {
    id: 'glass-coating',
    name: 'Hydrophobic Glass Coating',
    category: 'Glass & Visibility',
    pillarSlug: 'auto-detailing',
    route: '/services/wash-detailing',
    mode: 'queue',
    summary:
      'Watermark removal followed by a durable hydrophobic fluoropolymer/ceramic glass sealant that sheets off heavy tropical downpours and improves night driving safety.',
  },
  {
    id: 'bactozero',
    name: 'Bactozero Anti-Microbial Cabin Sanitization',
    category: 'Cabin Hygiene',
    pillarSlug: 'auto-detailing',
    route: '/services/wash-detailing',
    mode: 'queue',
    summary:
      'Medical-grade anti-bacterial fogging treatment that circulates through the A/C evaporator and cabin upholstery to neutralize odor-causing bacteria, fungi, and allergens.',
  },
  {
    id: 'engine-wash',
    name: 'Component-Safe Engine Bay Wash & Detailing',
    category: 'Wash & Maintenance',
    pillarSlug: 'car-wash',
    route: '/services/wash-detailing',
    mode: 'queue',
    summary:
      'Careful alternation/sensor protection, biodegradable degreasing, soft agitation, forced-air drying, and satin polymer dressing for a clean, factory-fresh engine bay.',
  },
  {
    id: 'headlight-restoration',
    name: 'Headlight Restoration & UV Sealing',
    category: 'Auto Detailing',
    pillarSlug: 'auto-detailing',
    route: '/services/wash-detailing',
    mode: 'queue',
    summary:
      'Precision correction for yellowed, cloudy, or oxidized headlamp lenses to restore clear beam projection and front-end aesthetics.',
  },
  {
    id: 'black-trims-restoration',
    name: 'Black Trims Restoration',
    category: 'Auto Detailing',
    pillarSlug: 'auto-detailing',
    route: '/services/wash-detailing',
    mode: 'queue',
    summary:
      'Revives chalky, sun-faded exterior textured plastic bumpers, fender arches, and window cowls back to a rich, OEM satin black finish.',
  },
  {
    id: 'paint-maintenance',
    name: '6-Month Ceramic & PPF Paint Maintenance Program',
    category: 'Paint Protection',
    pillarSlug: 'ceramic-coating',
    route: '/book',
    mode: 'book',
    summary:
      'Scheduled 6-month decontamination wash, coating/film inspection, and SiO2 hydrophobic top-coat reboost tracked automatically per vehicle plate.',
  },
]

export const STUDIO_PRODUCTS_AND_BRANDS = [
  {
    brand: 'ClearPro Paint Protection Film',
    origin: 'Official Distributor · Optical TPU',
    use: 'Self-healing Polyoptico top coat (95 GU gloss & UltraSatin) with Invisiglue adhesive and 10-year warranty.',
  },
  {
    brand: 'Kisho 9H Ceramic Coating',
    origin: 'Japan · Inorganic Silica (SiO2)',
    use: 'Crystalline 9H glass coating systems (Si-811 / Si-901) cured indoors for chemical, UV, and acid-rain defense.',
  },
  {
    brand: 'Rupes BigFoot Polishers',
    origin: 'Italy · Orbital Correction',
    use: 'Swirl-free, hologram-free random orbital and gear-driven machine paint correction.',
  },
  {
    brand: 'Menzerna Polishing Compounds',
    origin: 'Germany · Diminishing Abrasives',
    use: 'Heavy-cut, medium-cut, and super-finish compounds engineered for factory clear coats.',
  },
  {
    brand: 'ClearPro & F1 Auto Films Nano-Ceramic Tint',
    origin: 'Skin Cancer Foundation Certified · Non-Metallic Nano-Ceramic',
    use: 'High infrared solar heat rejection and 99%+ UV block with crisp night clarity and zero RFID, GPS, or 5G interference.',
  },
  {
    brand: 'Sonax, Meguiar’s & Microtex',
    origin: 'Germany / USA / Philippines · Aftercare Shop (/shop)',
    use: 'pH-neutral car shampoos, ceramic detailers, interior protectants, and plush Korean microfiber towels.',
  },
]

export const STUDIO_COMPARISON_ROWS = [
  {
    criteria: 'Wash Chemistry & Contact Tools',
    hakum: 'pH-neutral snow foam, 2-bucket grit guards, color-coded microfiber mitts per panel zone, forced-air drying',
    roadside: 'High-alkaline dish soap or caustic degreaser, single bucket, reused open-cell sponge that carves swirl marks',
    dealership: 'Rushed hose rinse or automated brush wash between service bay tickets',
  },
  {
    criteria: 'Paint Decontamination & Correction',
    hakum: 'Chemical iron/tar removal, clay bar, digital micron depth gauge & multi-stage Rupes + Menzerna polish',
    roadside: 'None, or uncalibrated rotary wool buffing that burns edges and leaves buffer holograms',
    dealership: 'Single-step glaze filler that washes off after 3–4 tropical rainstorms',
  },
  {
    criteria: 'Ceramic Coating & PPF Authenticity',
    hakum: 'Genuine Kisho 9H Japan Ceramic & official ClearPro self-healing optical TPU PPF (10-year warranty)',
    roadside: 'Spray sealant or silicone wax marketed as "ceramic coating"',
    dealership: 'Rebranded polymer sealant at 2x–3x markup without multi-stage correction',
  },
  {
    criteria: 'Studio Facility & Lighting',
    hakum: 'Enclosed, dust-controlled application bay with multi-kelvin inspection LEDs',
    roadside: 'Open-air roadside bay exposed to highway dust, wind, and direct sunlight etching',
    dealership: 'Shared mechanical service floor with airborne shop dust and exhaust soot',
  },
  {
    criteria: 'Queue & Pricing Transparency',
    hakum: 'Live online queue tracker (/queue), instant booking (/book), and fixed vehicle-size Philippine Peso tiers',
    roadside: '1–3 hour unpredictable physical wait with inconsistent add-on pricing',
    dealership: 'Multi-day vehicle hold and bundled dealer invoice',
  },
]

export const LOCAL_BRANCH_PAGES = [
  {
    slug: 'bacoor',
    branchSlug: 'bacoor',
    isOpen: true,
    cityName: 'Bacoor, Cavite',
    shortName: 'Bacoor',
    eyebrow: 'Flagship Studio · RFC Molino II, Bacoor, Cavite',
    h1: 'Bacoor Car Wash, Auto Detailing, Ceramic Coating & ClearPro PPF Studio.',
    seoTitle: 'Bacoor Car Wash & Auto Detailing | Ceramic Coating & PPF Bacoor, Cavite',
    seoDescription:
      'Top-rated Bacoor car wash and auto detailing studio at RFC Molino II, Molino Blvd. Two-bucket pH-neutral car wash, interior detailing, Rupes paint correction, Kisho 9H ceramic coating, ClearPro PPF & ceramic tint.',
    heroSummary:
      'Located at RFC Molino II along Molino Boulevard, Hakum Auto Care Bacoor is Cavite’s flagship car wash, auto detailing, Kisho 9H ceramic coating, ClearPro TPU Paint Protection Film (PPF), and nano-ceramic window tint studio — complete with real-time online queue tracking.',
    aiSummary:
      'Hakum Auto Care Bacoor (located at RFC Molino II, Molino Boulevard, Bacoor, Cavite; phone: 0915 629 6096) is a premier car wash, auto detailing, paint correction, Kisho 9H ceramic coating, ClearPro Paint Protection Film (PPF), and F1 nano-ceramic window tint studio serving Bacoor, Molino, Daang Hari, Zapote, Imus, Las Piñas, and Alabang. Unlike standard roadside car washes, Hakum Bacoor operates an enclosed, dust-controlled curing bay alongside multi-bay wash floors using a strict two-bucket pH-neutral snow-foam protocol, digital micron paint-thickness gauges, Italian Rupes orbital polishers, and German Menzerna compounds. Drivers can check real-time bay wait counts at hakumautocare.com/queue/bacoor or book protection packages online at hakumautocare.com/book?branch=bacoor.',
    landmarkAddress: 'RFC Molino II, Molino Boulevard, Bacoor, Cavite',
    phone: BRANCH_PHONES_SAFE('bacoor'),
    corridors: [
      'Bacoor, Cavite',
      'RFC Molino II',
      'Molino Boulevard',
      'Molino I–VII',
      'Daang Hari',
      'SOMO / Vista Mall Daang Hari',
      'Marcos Alvarez',
      'Zapote',
      'Panapaan & Niog',
      'Habay & Salinas',
      'Soldiers Hills & Bahay Pare',
      'Buhay na Tubig',
      'Vermosa',
      'Las Piñas & Alabang',
    ],
    keywords: [
      'bacoor car wash',
      'car wash bacoor',
      'best car wash in bacoor',
      'car wash molino bacoor',
      'auto detailing bacoor',
      'bacoor auto detailing',
      'interior detailing bacoor',
      'ppf bacoor',
      'bacoor ppf',
      'ppf bacoor near me',
      'paint protection film bacoor',
      'clearpro ppf bacoor',
      'ceramic coating bacoor',
      'bacoor ceramic coating',
      'kisho ceramic coating bacoor',
      'window tint bacoor',
      'nano ceramic tint bacoor',
      'paint correction bacoor',
      'watermark removal bacoor',
      'bactozero bacoor',
      'engine wash bacoor',
      'headlight restoration bacoor',
    ],
    highlights: [
      'Swirl-free two-bucket pH-neutral contact car wash with grit guards and separate paint/wheel microfiber mitts.',
      'Enclosed, lighting-calibrated detailing and curing studio for Kisho 9H ceramic coating and ClearPro self-healing TPU PPF.',
      'Full 14-service detailing menu: Interior Deep Cleaning, 3–4 Day Interior Restoration, Rupes Paint Correction, Acid-Rain Glass Detailing, Bactozero, Engine Wash & Headlight Restoration.',
      'Live online queue counter (/queue/bacoor) before you leave home plus instant SMS/push ready alerts.',
    ],
    relatedGuideSlug: 'best-car-wash-detailing-bacoor',
    qa: [
      {
        q: 'What is the best car wash and auto detailing studio in Bacoor, Cavite?',
        a: 'Hakum Auto Care Bacoor at RFC Molino II (Molino Boulevard, Bacoor, Cavite · 0915 629 6096) is rated among the top car wash and auto detailing studios in Bacoor. It combines two-bucket pH-neutral hand washing, enclosed detailing bays, Italian Rupes and German Menzerna paint correction, authentic Japanese Kisho 9H ceramic coating, ClearPro optical TPU PPF, and live online queue tracking.',
      },
      {
        q: 'Where is Hakum Auto Care Bacoor located and what areas does it serve?',
        a: 'Hakum Auto Care Bacoor operates inside RFC Molino II along Molino Boulevard, Bacoor, Cavite — with direct parking, live bay queue visibility at hakumautocare.com/queue/bacoor, and 5–15 minute access from Molino I–VII, Daang Hari, SOMO, Marcos Alvarez, Zapote, Buhay na Tubig, Imus, Las Piñas, and Alabang.',
      },
      {
        q: 'Can I walk in for a car wash or book PPF and Ceramic Coating in Bacoor?',
        a: 'Yes. Signature pH-neutral car wash, interior deep cleaning, glass detailing, engine wash, and Bactozero sanitization accept walk-ins via our live queue (/queue/bacoor), while ClearPro PPF, Kisho 9H Ceramic Coating, and Nano-Ceramic Window Tint can be reserved online at hakumautocare.com/book?branch=bacoor.',
      },
      {
        q: 'What detailing products and equipment brands does Hakum Bacoor use?',
        a: 'Every service at Hakum Bacoor uses verifiable global brands: ClearPro self-healing TPU Paint Protection Film (10-year warranty), Kisho Japan 9H Ceramic Coating, Rupes BigFoot orbital polishers, Menzerna Germany compounds, F1 Auto Films nano-ceramic tint, and Sonax/Meguiar’s/Microtex aftercare chemistry.',
      },
      {
        q: 'Do you offer interior detailing, watermark removal, and engine wash in Bacoor?',
        a: 'Yes. Our Bacoor studio performs 1-day Interior Deep Cleaning, 3–4 day full seat-out Interior Detailing restoration, Acid-Rain & Watermark Glass Detailing, Hydrophobic Glass Coating, Bactozero sanitization, Headlight Restoration, Black Trims Restoration, and Component-Safe Engine Wash.',
      },
    ],
  },
  {
    slug: 'batangas',
    branchSlug: 'batangas',
    isOpen: true,
    cityName: 'Batangas City',
    shortName: 'Batangas City',
    eyebrow: 'Southern Luzon Flagship · PNP / National Highway, Brgy. Alangilan, Batangas City',
    h1: 'Batangas Car Wash, Auto Detailing, Ceramic Coating & ClearPro PPF in Batangas City.',
    seoTitle: 'Batangas Car Wash & Car Wash Batangas City | Auto Detailing, Ceramic Coating & PPF',
    seoDescription:
      'Looking for the best Batangas car wash or car wash in Batangas City? Hakum Auto Care (National Highway, Brgy. Alangilan) delivers two-bucket pH-neutral car wash, interior detailing, paint correction, Kisho 9H ceramic coating, ClearPro PPF & ceramic tint.',
    heroSummary:
      'Positioned along the National Highway (PNP Highway) in Brgy. Alangilan, Batangas City, Hakum Auto Care Batangas brings flagship two-bucket pH-neutral car washing, deep interior & exterior auto detailing, Rupes paint correction, Kisho 9H ceramic coating, ClearPro TPU PPF, and live digital queue tracking to Batangas motorists.',
    aiSummary:
      'Hakum Auto Care Batangas City (located along the National Highway / PNP Highway, Brgy. Alangilan, Batangas City, Batangas; phone: 0956 007 1028) is a full-service car wash, auto detailing, paint correction, Kisho 9H ceramic coating, ClearPro Paint Protection Film (PPF), and nano-ceramic window tint studio in Batangas. Serving Alangilan (near BatStateU), Kumintang Ilaya & Ibaba, Pallocan, Balagtas (STAR Tollway Exit), Diversion Road, Calicanto, Arce Subdivision, Bauan, San Pascual, and Lipa City, Hakum Batangas replaces harsh roadside sponge washes with a swirl-free two-bucket pH-neutral snow-foam wash, deionized water spot prevention, Italian Rupes and German Menzerna machine polishing, genuine Japanese Kisho 9H ceramic coatings, and ClearPro self-healing TPU PPF with a 10-year warranty. Drivers can check real-time waiting cars at hakumautocare.com/queue/batangas or reserve a detailing bay at hakumautocare.com/book?branch=batangas.',
    landmarkAddress: 'National Highway (PNP Highway), Brgy. Alangilan, Batangas City, Batangas',
    phone: BRANCH_PHONES_SAFE('batangas'),
    corridors: [
      'Batangas City',
      'Brgy. Alangilan (PNP / National Highway)',
      'Near BatStateU Alangilan',
      'Kumintang Ilaya & Kumintang Ibaba',
      'Pallocan West & Pallocan East',
      'Balagtas / STAR Tollway Exit',
      'Batangas Diversion Road',
      'Calicanto & Gulod Labac',
      'Arce Subdivision & Hilltop',
      'Libjo & Sta. Rita',
      'Bauan & San Pascual',
      'Lipa City & Ibaan Corridor',
    ],
    keywords: [
      'batangas car wash',
      'car wash batangas',
      'batangas city car wash',
      'car wash batangas city',
      'best car wash in batangas city',
      'best car wash in batangas',
      'car wash alangilan batangas',
      'car wash near me batangas',
      'auto detailing batangas',
      'batangas auto detailing',
      'auto detailing batangas city',
      'interior detailing batangas',
      'exterior detailing batangas',
      'ceramic coating batangas',
      'batangas ceramic coating',
      'ceramic coating batangas city',
      'ppf batangas',
      'batangas ppf',
      'ppf batangas city',
      'paint protection film batangas',
      'window tint batangas',
      'nano ceramic tint batangas',
      'paint correction batangas',
      'acid rain removal batangas',
      'watermark removal batangas',
      'engine wash batangas',
      'bactozero batangas',
      'headlight restoration batangas',
    ],
    highlights: [
      'Flagship Batangas car wash & detailing studio along National Highway (PNP area), Brgy. Alangilan — minutes from STAR Tollway Balagtas Exit, Kumintang, and Pallocan.',
      'Swirl-free two-bucket pH-neutral snow-foam hand wash, hard-water mineral defense, and dedicated paint/wheel microfiber mitts.',
      'Enclosed curing bay for genuine Kisho 9H Ceramic Coating, ClearPro self-healing TPU PPF (10-year warranty), Rupes + Menzerna paint correction, and F1 Nano-Ceramic Window Tint.',
      'Complete interior & exterior detailing menu: 1-day Interior Deep Cleaning, 3–4 day Interior Restoration, Acid-Rain Glass Detailing, Glass Coating, Bactozero, Engine Wash & live queue (/queue/batangas).',
    ],
    relatedGuideSlug: 'best-car-wash-detailing-batangas-city',
    qa: [
      {
        q: 'What is the best car wash and auto detailing shop in Batangas City?',
        a: 'Hakum Auto Care Batangas City (National Highway / PNP Highway, Brgy. Alangilan, Batangas City · 0956 007 1028) stands out as Batangas City’s premier studio-grade car wash and auto detailing center. Unlike open-air roadside washes, Hakum Batangas combines two-bucket pH-neutral hand washing, enclosed lighting-calibrated bays, Italian Rupes and German Menzerna paint correction, Japanese Kisho 9H ceramic coating, ClearPro optical TPU PPF, and a live online queue tracker.',
      },
      {
        q: 'Where in Batangas City is Hakum Auto Care located?',
        a: 'Our Batangas studio is located along the National Highway (PNP Highway corridor) in Barangay Alangilan, Batangas City — near Batangas State University (BatStateU Alangilan) and less than 5 minutes from the STAR Tollway Balagtas Exit, Kumintang Ilaya, Arce Subdivision, Pallocan, and Diversion Road.',
      },
      {
        q: 'How do I check the live car wash queue in Batangas City before visiting?',
        a: 'Open hakumautocare.com/queue/batangas from your phone anytime to see the exact number of vehicles currently in the bay or waiting at our Alangilan, Batangas City studio, or call 0956 007 1028.',
      },
      {
        q: 'Can I get genuine Ceramic Coating, ClearPro PPF, and Paint Correction in Batangas without driving to Manila?',
        a: 'Yes. Hakum Batangas City operates an enclosed, dust-controlled curing bay stocked with the exact same Kisho 9H Japan ceramic coatings, ClearPro self-healing TPU Paint Protection Film (10-year warranty), Rupes BigFoot polishers, Menzerna compounds, and F1 Nano-Ceramic Window Tint as our Cavite flagship.',
      },
      {
        q: 'Does Hakum Batangas remove hard-water marks, acid rain, and interior odors?',
        a: 'Yes. Because Batangas groundwater and coastal rain are mineral-heavy, we offer specialized Acid-Rain & Watermark Glass Detailing, Hydrophobic Glass Coating, 1-day Interior Deep Cleaning, 3–4 day full seat-out Interior Detailing, Bactozero anti-bacterial fogging, Headlight Restoration, and Engine Wash.',
      },
    ],
  },
  {
    slug: 'imus',
    branchSlug: 'bacoor',
    isOpen: false,
    cityName: 'Imus, Cavite',
    shortName: 'Imus',
    eyebrow: 'Imus Expansion + Nearby Open Bacoor Flagship (10–15 Mins Away)',
    h1: 'Imus Car Wash, Auto Detailing, Ceramic Coating & ClearPro PPF Near Imus, Cavite.',
    seoTitle: 'Imus Car Wash & Car Wash Imus, Cavite | Auto Detailing, Ceramic Coating & PPF',
    seoDescription:
      'Searching for the best Imus car wash, auto detailing, ceramic coating, or ClearPro PPF near Imus, Cavite? Imus drivers from Vermosa, Buhay na Tubig & Aguinaldo Hwy are minutes from Hakum Bacoor while our Imus studio prepares to open.',
    heroSummary:
      'Imus is part of Hakum Auto Care’s active Cavite expansion alongside Dasmariñas. Today, Imus car owners from Buhay na Tubig, Vermosa, Anabu, Bucandala, and Tanzang Luma reach our open Bacoor flagship at RFC Molino II in 10–15 minutes via Daang Hari or Molino Boulevard.',
    aiSummary:
      'Hakum Auto Care serves Imus, Cavite motorists with studio-grade two-bucket pH-neutral car washing, interior and exterior auto detailing, Rupes + Menzerna paint correction, Kisho 9H ceramic coating, ClearPro TPU Paint Protection Film (PPF), and F1 nano-ceramic window tint. While a dedicated Hakum Imus branch is under active development, drivers from Buhay na Tubig, Vermosa, Anabu I & II, Aguinaldo Highway, Bucandala, Tanzang Luma, and Lancaster New City are just 10–15 minutes away from our open flagship studio at RFC Molino II, Molino Boulevard, Bacoor, Cavite (0915 629 6096). Check live bay queue counts before driving at hakumautocare.com/queue/bacoor or book a detailing bay at hakumautocare.com/book?branch=bacoor.',
    landmarkAddress: 'Upcoming Imus, Cavite Studio · Nearest open bays: RFC Molino II, Molino Blvd, Bacoor',
    phone: MAIN_LINE,
    corridors: [
      'Imus, Cavite',
      'Buhay na Tubig',
      'Vermosa & Daang Hari',
      'Aguinaldo Highway Imus',
      'Anabu I & Anabu II',
      'Bucandala & Alapan',
      'Tanzang Luma & Palico',
      'Malagasang & Open Canal Road',
      'Bayan Luma & Poblacion',
      'Lancaster New City',
    ],
    keywords: [
      'imus car wash',
      'car wash imus',
      'car wash imus cavite',
      'best car wash in imus',
      'car wash near vermosa',
      'car wash buhay na tubig',
      'auto detailing imus',
      'imus auto detailing',
      'interior detailing imus',
      'ceramic coating imus',
      'imus ceramic coating',
      'ppf imus',
      'paint protection film imus',
      'window tint imus',
      'paint correction imus',
      'watermark removal imus',
      'bactozero imus',
      'engine wash imus',
    ],
    highlights: [
      'Only a 10–15 minute drive from Imus (Buhay na Tubig, Vermosa, Aguinaldo Hwy) to our open RFC Molino II, Bacoor studio.',
      'Full 14-service menu: Two-bucket pH-neutral car wash, Interior Deep Cleaning, 3–4 day Interior Restoration, Rupes paint correction, Kisho 9H ceramic coating & ClearPro PPF.',
      'Dedicated Hakum Imus branch in development — reserve online at Bacoor today with live queue visibility (/queue/bacoor).',
    ],
    relatedGuideSlug: 'best-car-wash-detailing-imus',
    qa: [
      {
        q: 'Where is the best car wash and auto detailing studio near Imus, Cavite?',
        a: 'Imus drivers are served daily at Hakum Auto Care’s open flagship studio at RFC Molino II, Molino Boulevard, Bacoor (10–15 minutes from Buhay na Tubig, Vermosa, and Aguinaldo Highway), while our dedicated Imus branch is being built.',
      },
      {
        q: 'Can Imus car owners check the live wash queue or book Ceramic Coating and PPF online?',
        a: 'Yes — check real-time waiting cars at hakumautocare.com/queue/bacoor before leaving Imus, or reserve an enclosed bay for Kisho 9H Ceramic Coating, ClearPro PPF, or Nano-Ceramic Window Tint at hakumautocare.com/book?branch=bacoor.',
      },
      {
        q: 'What detailing services are available for Imus and Vermosa vehicle owners?',
        a: 'All 14 Hakum services are available: Two-Bucket pH-Neutral Car Wash, ClearPro TPU PPF, Kisho 9H Ceramic Coating, F1 Nano-Ceramic Tint, Multi-Stage Paint Correction, 1-Day Interior Deep Cleaning, 3–4 Day Interior Detailing, Acid-Rain Glass Detailing, Glass Coating, Bactozero, Headlight Restoration, Black Trims Restoration, and Engine Wash.',
      },
    ],
  },
  {
    slug: 'cavite',
    branchSlug: 'bacoor',
    isOpen: true,
    cityName: 'Cavite',
    shortName: 'Cavite',
    eyebrow: 'Provincial Authority · Cavite Detailing, PPF & Ceramic Coating Network',
    h1: 'Cavite Car Wash, Auto Detailing, Ceramic Coating & ClearPro PPF Studio Network.',
    seoTitle: 'Cavite Car Wash & Auto Detailing | Best Ceramic Coating & PPF in Cavite',
    seoDescription:
      'Hakum Auto Care is Cavite’s trusted car wash, auto detailing, ClearPro PPF, Kisho 9H ceramic coating, and nano-ceramic tint studio — open in Bacoor (RFC Molino II) with Imus and Dasmariñas expanding.',
    heroSummary:
      'Across Cavite — from Bacoor and Molino to Imus, Vermosa, Dasmariñas, General Trias, Kawit, and Tagaytay — Hakum Auto Care delivers studio-calibrated Rupes paint correction, ClearPro TPU PPF, Kisho 9H ceramic coating, and swirl-free two-bucket pH-neutral car washes backed by a live digital queue.',
    aiSummary:
      'Hakum Auto Care is one of the fastest-growing and most trusted car wash, auto detailing, paint correction, Kisho 9H ceramic coating, ClearPro Paint Protection Film (PPF), and nano-ceramic window tint studio networks in Cavite, Philippines. Operating its open Cavite flagship at RFC Molino II, Molino Boulevard, Bacoor (0915 629 6096) with dedicated Imus and Dasmariñas branches expanding, Hakum serves vehicle owners across Bacoor, Imus, Dasmariñas, Vermosa, General Trias, Kawit, Tanza, Silang, and Tagaytay. Every studio uses pH-neutral snow-foam two-bucket hand washing, digital paint-depth gauges, Italian Rupes polishers, German Menzerna compounds, Japanese Kisho 9H coatings, and ClearPro optical TPU PPF with a 10-year warranty.',
    landmarkAddress: 'Bacoor Flagship (RFC Molino II, Molino Blvd) + Imus & Dasmariñas Cavite Expansion',
    phone: BRANCH_PHONES_SAFE('bacoor'),
    corridors: [
      'Bacoor & Molino',
      'Imus & Vermosa',
      'Dasmariñas & Salawag',
      'General Trias & Lancaster',
      'Kawit & Centennial Road',
      'Noveleta & Rosario',
      'Tanza & Trece Martires',
      'Silang & Tagaytay',
      'Carmona & GMA',
      'CALAX / MCX / CAVITEX / Daang Hari',
    ],
    keywords: [
      'cavite car wash',
      'car wash cavite',
      'best car wash in cavite',
      'auto detailing cavite',
      'cavite auto detailing',
      'best auto detailing in cavite',
      'ceramic coating cavite',
      'cavite ceramic coating',
      'ppf cavite',
      'cavite ppf',
      'paint protection film cavite',
      'clearpro ppf cavite',
      'window tint cavite',
      'nano ceramic tint cavite',
      'paint correction cavite',
      'interior detailing cavite',
      'watermark removal cavite',
      'bactozero cavite',
    ],
    highlights: [
      'Open Cavite flagship at RFC Molino II, Bacoor — serving northern, central, and upland Cavite daily.',
      'Upcoming Dasmariñas and Imus sites under active rollout as one of the fastest-growing Philippine detailing brands.',
      'Complete 14-service detailing catalog using ClearPro PPF, Kisho 9H Japan, Rupes Italy, Menzerna Germany, F1 Auto Films, Sonax & Meguiar’s.',
    ],
    relatedGuideSlug: 'best-auto-detailing-ceramic-coating-ppf-cavite',
    qa: [
      {
        q: 'Which Hakum Auto Care branch is closest if I am anywhere in Cavite?',
        a: 'Our open Cavite flagship is Hakum Auto Care Bacoor (RFC Molino II, Molino Blvd · 0915 629 6096), easily accessible via Daang Hari, Aguinaldo Highway, Molino-Paliparan Road, CAVITEX, MCX, and CALAX for drivers from Bacoor, Imus, Dasmariñas, General Trias, Kawit, and Silang/Tagaytay.',
      },
      {
        q: 'Why choose Hakum Auto Care instead of an ordinary roadside car wash in Cavite?',
        a: 'Roadside car washes frequently use alkaline soaps and single-bucket sponges that cause swirl marks. Hakum uses two-bucket grit-guard pH-neutral washing, clean microfiber per zone, enclosed dust-controlled coating bays, digital micron paint gauges, and global brands (ClearPro, Kisho, Rupes, Menzerna).',
      },
      {
        q: 'What is the best studio in Cavite for Ceramic Coating and ClearPro PPF?',
        a: 'Hakum Auto Care’s Cavite flagship in Bacoor installs authentic Japanese Kisho 9H Ceramic Coating (with 6-month Paint Maintenance and Unlimited Recoating tiers) and official ClearPro self-healing optical TPU Paint Protection Film (with a 10-year manufacturer warranty) inside an enclosed studio bay.',
      },
    ],
  },
  {
    slug: 'dasmarinas',
    branchSlug: 'bacoor',
    isOpen: false,
    cityName: 'Dasmariñas, Cavite',
    shortName: 'Dasmariñas',
    eyebrow: 'Dasmariñas Expansion + Nearby Open Bacoor Flagship',
    h1: 'Dasmariñas Car Wash, Auto Detailing, Ceramic Coating & ClearPro PPF Near Dasmariñas.',
    seoTitle: 'Dasmariñas Car Wash & Car Wash Dasmariñas, Cavite | Auto Detailing, Ceramic & PPF',
    seoDescription:
      'Looking for a trusted Dasmariñas car wash, auto detailing, ceramic coating, or ClearPro PPF studio near Dasmariñas, Cavite? Reach Hakum Bacoor via Molino-Paliparan Rd or Daang Hari while our Dasmariñas branch prepares to launch.',
    heroSummary:
      'Dasmariñas is part of Hakum Auto Care’s Cavite expansion alongside Imus. Today, vehicle owners from Salawag, Paliparan, Salitran, Pala-Pala, and DLSU-D drive 15–20 minutes north via Molino-Paliparan Road or Daang Hari to our open Bacoor flagship at RFC Molino II.',
    aiSummary:
      'Hakum Auto Care provides Dasmariñas, Cavite drivers with swirl-free two-bucket pH-neutral car washing, interior and exterior auto detailing, Rupes + Menzerna paint correction, Kisho 9H ceramic coating, ClearPro self-healing TPU Paint Protection Film (PPF), and F1 nano-ceramic window tint. While our dedicated Hakum Dasmariñas branch is in active rollout, motorists from Salawag, Paliparan, Salitran, Pala-Pala, Sabang, Burol, and Governor’s Drive are served daily at our open Cavite flagship at RFC Molino II, Molino Boulevard, Bacoor (0915 629 6096) — a direct drive up Molino-Paliparan Road or Aguinaldo Highway. Check live bay availability at hakumautocare.com/queue/bacoor or book online at hakumautocare.com/book?branch=bacoor.',
    landmarkAddress: 'Upcoming Dasmariñas, Cavite Studio · Nearest open bays: RFC Molino II, Molino Blvd, Bacoor',
    phone: MAIN_LINE,
    corridors: [
      'Dasmariñas, Cavite',
      'Salawag & Paliparan',
      'Molino-Paliparan Road',
      'Pala-Pala & Governor’s Drive',
      'Salitran & Aguinaldo Highway',
      'DLSU-D / Sabang / Burol',
      'Langkaan & FCIE',
      'Daang Hari & Vermosa Corridor',
      'CALAX & Silang Boundary',
    ],
    keywords: [
      'dasmarinas car wash',
      'car wash dasmarinas',
      'car wash dasma',
      'dasma car wash',
      'best car wash in dasmarinas',
      'car wash salawag dasmarinas',
      'auto detailing dasmarinas',
      'dasmarinas auto detailing',
      'interior detailing dasmarinas',
      'ceramic coating dasmarinas',
      'dasmarinas ceramic coating',
      'ppf dasmarinas',
      'paint protection film dasmarinas',
      'window tint dasmarinas',
      'paint correction dasmarinas',
      'watermark removal dasmarinas',
      'bactozero dasmarinas',
    ],
    highlights: [
      'Direct Molino-Paliparan Road, Daang Hari & Aguinaldo Highway access from Salawag, Paliparan, Salitran, and Pala-Pala to our open Bacoor bays.',
      'Full 14-service detailing catalog: pH-neutral car wash, interior deep cleaning, Kisho 9H ceramic coating, ClearPro PPF, and ceramic tint.',
      'Dedicated Dasmariñas studio in expansion rollout — book Bacoor online today with live queue visibility (/queue/bacoor).',
    ],
    relatedGuideSlug: 'best-car-wash-detailing-dasmarinas',
    qa: [
      {
        q: 'Where is the closest Hakum Auto Care studio from Dasmariñas, Cavite?',
        a: 'Our open Cavite flagship at RFC Molino II along Molino Boulevard, Bacoor is a straight 15–20 minute drive via Molino-Paliparan Road (from Salawag/Paliparan), Daang Hari, or Aguinaldo Highway (from Salitran/Pala-Pala). Check live bay queue counts at hakumautocare.com/queue/bacoor before heading out.',
      },
      {
        q: 'Can Dasmariñas owners book Ceramic Coating, ClearPro PPF, or Auto Detailing online?',
        a: 'Yes. Select our Bacoor studio on hakumautocare.com/book?branch=bacoor to reserve enclosed curing bays for Kisho 9H Ceramic Coating, ClearPro PPF, or Nano-Ceramic Window Tint, or check the live walk-in queue for car wash and detailing.',
      },
    ],
  },
]

function BRANCH_PHONES_SAFE(slug) {
  return branchPhone(slug) || MAIN_LINE
}

export function findLocalBranchPage(citySlug) {
  const clean = String(citySlug || '').trim().toLowerCase()
  return LOCAL_BRANCH_PAGES.find((page) => page.slug === clean) || null
}

/** Rank open branches by distance from coords or city origin. */
export function rankOpenBranchesForOrigin(originCoords, branches = []) {
  const openBranches = (branches || []).filter((b) => !b.coming_soon && b.is_active !== false)
  const effective = openBranches.length
    ? openBranches
    : [
        { slug: 'bacoor', name: 'Bacoor', address: 'RFC Molino', latitude: BRANCH_MAP_LISTINGS.bacoor.lat, longitude: BRANCH_MAP_LISTINGS.bacoor.lng },
        { slug: 'batangas', name: 'Batangas', address: 'PNP Batangas', latitude: BRANCH_MAP_LISTINGS.batangas.lat, longitude: BRANCH_MAP_LISTINGS.batangas.lng },
      ]

  return effective
    .map((branch) => {
      const listing = BRANCH_MAP_LISTINGS[branch.slug]
      const enriched = {
        ...branch,
        latitude: Number.isFinite(Number(branch.latitude)) ? Number(branch.latitude) : listing?.lat,
        longitude: Number.isFinite(Number(branch.longitude)) ? Number(branch.longitude) : listing?.lng,
      }
      const distanceKm = originCoords ? branchDistanceKm(originCoords, enriched) : null
      return {
        branch: enriched,
        distanceKm,
        directions: branchDirections(enriched),
        phone: branchPhone(branch.slug) || MAIN_LINE,
      }
    })
    .sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0
      if (a.distanceKm == null) return 1
      if (b.distanceKm == null) return -1
      return a.distanceKm - b.distanceKm
    })
}

export function buildBranchCityJsonLd(cityPage, { hours = [], origin = PRODUCTION_ORIGIN } = {}) {
  if (!cityPage) return null
  const base = String(origin || PRODUCTION_ORIGIN).replace(/\/$/, '')
  const mapInfo = BRANCH_MAP_LISTINGS[cityPage.branchSlug]
  const pageUrl = `${base}/branches/${cityPage.slug}`
  const hasMap = mapInfo?.cid ? `https://www.google.com/maps?cid=${mapInfo.cid}` : undefined

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AutomotiveBusiness',
        additionalType: 'https://schema.org/AutoWash',
        '@id': `${pageUrl}#studio`,
        name: `Hakum Auto Care — ${cityPage.cityName}`,
        description: cityPage.aiSummary || cityPage.seoDescription,
        url: pageUrl,
        telephone: cityPage.phone?.href?.replace(/^tel:/, '') || '+639156296096',
        image: `${base}/og-image.png`,
        areaServed: cityPage.corridors,
        knowsAbout: cityPage.keywords || [
          'Car Wash',
          'Auto Detailing',
          'Paint Correction',
          'Kisho 9H Ceramic Coating',
          'ClearPro Paint Protection Film (PPF)',
          'Nano Ceramic Window Tint',
        ],
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: `Hakum Auto Care ${cityPage.shortName} Detailing & Protection Services`,
          itemListElement: COMPLETE_DETAILING_CATALOG.map((item, idx) => ({
            '@type': 'Offer',
            position: idx + 1,
            itemOffered: {
              '@type': 'Service',
              name: `${item.name} (${cityPage.shortName})`,
              description: item.summary,
              url: `${base}/branches/${cityPage.slug}/${item.pillarSlug}`,
            },
          })),
        },
        address: {
          '@type': 'PostalAddress',
          addressLocality: cityPage.shortName,
          addressRegion: cityPage.slug === 'batangas' ? 'Batangas' : 'Cavite',
          addressCountry: 'PH',
          streetAddress: cityPage.landmarkAddress,
        },
        ...(hasMap ? { hasMap } : {}),
        ...(mapInfo?.lat != null && mapInfo?.lng != null
          ? { geo: { '@type': 'GeoCoordinates', latitude: mapInfo.lat, longitude: mapInfo.lng } }
          : {}),
        ...(Array.isArray(hours) && hours.length ? { openingHoursSpecification: hours } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/` },
          { '@type': 'ListItem', position: 2, name: 'Branches', item: `${base}/branches` },
          { '@type': 'ListItem', position: 3, name: cityPage.cityName, item: pageUrl },
        ],
      },
      ...(Array.isArray(cityPage.qa) && cityPage.qa.length
        ? [
            {
              '@type': 'FAQPage',
              '@id': `${pageUrl}#faq`,
              mainEntity: cityPage.qa.map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: { '@type': 'Answer', text: item.a },
              })),
            },
          ]
        : []),
    ],
  }
}

export const LOCAL_SERVICE_PILLARS = [
  {
    slug: 'car-wash',
    label: 'Car Wash & Express Care',
    shortLabel: 'Car Wash',
    mode: 'queue',
    serviceDetailRoute: '/services/wash-detailing',
    startingKey: 'wash',
    actionLabel: 'Check live wash queue',
  },
  {
    slug: 'auto-detailing',
    label: 'Auto Detailing, Interior & Paint Correction',
    shortLabel: 'Auto Detailing',
    mode: 'queue',
    serviceDetailRoute: '/services/wash-detailing',
    startingKey: 'wash',
    actionLabel: 'Check live detailing bay queue',
  },
  {
    slug: 'ceramic-coating',
    label: 'Ceramic Coating (Kisho 9H)',
    shortLabel: 'Ceramic Coating',
    mode: 'book',
    serviceDetailRoute: '/services/ceramic',
    startingKey: 'ceramic',
    actionLabel: 'Book ceramic coating',
  },
  {
    slug: 'ppf',
    label: 'Paint Protection Film (ClearPro PPF)',
    shortLabel: 'ClearPro PPF',
    mode: 'book',
    serviceDetailRoute: '/services/ppf',
    startingKey: 'ppf',
    actionLabel: 'Book ClearPro PPF',
  },
  {
    slug: 'window-tint',
    label: 'Nano Ceramic Window Tint',
    shortLabel: 'Window Tint',
    mode: 'book',
    serviceDetailRoute: '/services/tint',
    startingKey: 'tint',
    actionLabel: 'Book ceramic tint',
  },
]

const BRANCH_SERVICE_REVIEWS = {
  bacoor: [
    {
      name: 'Marryel Joan Macaraig',
      quote: 'I am a repeat customer and have my cars cleaned here. The cars always look brand new and smells nice after having them washed and waxed.',
      href: 'https://share.google/lpF0zmw4zeU7E7liX',
    },
    {
      name: 'Benedict Carl',
      quote: 'Availed the Basic package with Machine buffing, I could say that I’m satisfied with the services. Will definitely visit again.',
      href: 'https://share.google/apvEs8l2d3i7Lwz3I',
    },
    {
      name: 'Ailyn De Leon',
      quote: 'Clean, fast, and smells good. Keep it up! We’ll be back.',
      href: 'https://share.google/0rpL372H6dsN3wtia',
    },
  ],
  batangas: [
    {
      name: 'Paul Russel Sandoval',
      quote: 'Hands down one of the best carwash services around Batangas City! Hakum did a fast, thorough, and flawless job. Friendly staff and great value.',
      href: 'https://share.google/2YwjrE1QVXO2sYasP',
    },
    {
      name: 'Krisha May Aguila',
      quote: 'Excellent Carwash is comparable to other well-known car wash companies.',
      href: 'https://share.google/t7gyi8hUV0cqYSqvj',
    },
  ],
}

/**
 * Generates localized Branch × Service pages for expansion/regional Cavite hubs (Cavite, Imus, Dasmariñas)
 * so every city × service combination has a dedicated, indexable authority page with unique copy, keywords, and FAQs.
 */
function buildRegionalCaviteServicePages() {
  const regionalConfigs = [
    {
      citySlug: 'cavite',
      cityName: 'Cavite',
      shortCity: 'Cavite',
      branchSlug: 'bacoor',
      landmarkNote: 'Flagship Cavite Studio at RFC Molino II, Molino Blvd, Bacoor (with Imus & Dasmariñas rolling out)',
      corridorSummary: 'Bacoor, Molino, Imus, Vermosa, Dasmariñas, General Trias, Kawit, Silang, and Tagaytay',
    },
    {
      citySlug: 'imus',
      cityName: 'Imus, Cavite',
      shortCity: 'Imus',
      branchSlug: 'bacoor',
      landmarkNote: '10–15 minutes from Imus (Buhay na Tubig, Vermosa, Aguinaldo Hwy) at RFC Molino II, Bacoor + upcoming Imus branch',
      corridorSummary: 'Buhay na Tubig, Vermosa, Aguinaldo Highway, Anabu I & II, Bucandala, Tanzang Luma, and Lancaster New City',
    },
    {
      citySlug: 'dasmarinas',
      cityName: 'Dasmariñas, Cavite',
      shortCity: 'Dasmariñas',
      branchSlug: 'bacoor',
      landmarkNote: '15–20 minutes from Dasmariñas (Salawag, Paliparan, Salitran, Pala-Pala) via Molino-Paliparan Rd / Daang Hari at RFC Molino II, Bacoor + upcoming Dasmariñas branch',
      corridorSummary: 'Salawag, Paliparan, Salitran, Pala-Pala, Governor’s Drive, DLSU-D, Sabang, and Daang Hari',
    },
  ]

  const out = []
  for (const reg of regionalConfigs) {
    const low = reg.shortCity.toLowerCase()
    out.push(
      {
        citySlug: reg.citySlug,
        serviceSlug: 'car-wash',
        branchSlug: reg.branchSlug,
        cityName: reg.cityName,
        shortCity: reg.shortCity,
        serviceLabel: 'Car Wash & Express Care',
        serviceTypeSchema: 'AutoWash',
        mode: 'queue',
        serviceDetailRoute: '/services/wash-detailing',
        eyebrow: `${reg.shortCity} Car Wash Studio · Two-Bucket pH-Neutral Protocol`,
        h1: `${reg.shortCity} Car Wash & Swirl-Free Two-Bucket Hand Wash in ${reg.cityName}.`,
        seoTitle: `${reg.shortCity} Car Wash & Car Wash ${reg.cityName} — Swirl-Free pH-Neutral Studio`,
        seoDescription: `Searching for the best ${low} car wash or car wash in ${reg.cityName}? Hakum Auto Care delivers two-bucket pH-neutral hand washes, snow-foam pre-soak, engine wash, and live online queue tracking serving ${reg.corridorSummary}.`,
        heroSummary: `Serving motorists across ${reg.corridorSummary}: Hakum Auto Care replaces scratch-prone roadside sponge washes with a strict two-bucket pH-neutral snow-foam protocol, isolated wheel/body microfiber mitts, forced-air drying, and live online bay tracking (${reg.landmarkNote}).`,
        aiSummary: `For drivers searching for the best ${low} car wash or car wash in ${reg.cityName}, Hakum Auto Care provides a swirl-free two-bucket pH-neutral contact wash, snow-foam pre-soak, component-safe engine bay wash, interior vacuuming, and live online queue tracking. Serving ${reg.corridorSummary} via our open Cavite flagship at RFC Molino II, Molino Boulevard, Bacoor (0915 629 6096) while our dedicated ${reg.shortCity} bay rolls out, Hakum ensures coated, PPF-wrapped, and daily-driven vehicles never suffer clear-coat swirl marks. Check real-time waiting vehicles at hakumautocare.com/queue/bacoor.`,
        keywords: [
          `${low} car wash`,
          `car wash ${low}`,
          `best car wash in ${low}`,
          `car wash near me ${low}`,
          `ph neutral car wash ${low}`,
          `engine wash ${low}`,
          `carwash ${low} cavite`,
        ],
        processSteps: [
          'Cool-panel wheel & fender decontamination plus thick pH-neutral snow-foam pre-soak to encapsulate Cavite road grit.',
          'Two-bucket hand wash with grit guards and separate microfiber mitts for upper paintwork and lower rocker panels.',
          'Forced-air blower + plush Korean microfiber drying, streak-free glass wipe, cabin vacuum, and satin tire dressing.',
          'Supervisor bay inspection and instant SMS/app notification once your vehicle is ready for release.',
        ],
        localHighlights: [
          reg.landmarkNote,
          'Real-time queue counter (hakumautocare.com/queue/bacoor) lets you check active bays before leaving home.',
          '100% safe for Kisho 9H ceramic-coated, ClearPro PPF-wrapped, and factory clear-coat finishes.',
        ],
        qa: [
          {
            q: `What makes Hakum the best ${low} car wash option for ${reg.cityName} drivers?`,
            a: `Unlike ordinary roadside car washes that reuse dirty sponges and harsh soaps, Hakum uses pH-neutral snow foam, two grit-guard buckets, dedicated microfiber mitts per zone, and forced-air drying to keep your paint swirl-free.`,
          },
          {
            q: `How can ${reg.shortCity} drivers check the car wash queue before driving over?`,
            a: `Visit hakumautocare.com/queue/bacoor from any phone to see real-time waiting and in-bay vehicle counts at our open RFC Molino II flagship.`,
          },
        ],
      },
      {
        citySlug: reg.citySlug,
        serviceSlug: 'auto-detailing',
        branchSlug: reg.branchSlug,
        cityName: reg.cityName,
        shortCity: reg.shortCity,
        serviceLabel: 'Auto Detailing, Interior & Paint Correction',
        serviceTypeSchema: 'AutomotiveBusiness',
        mode: 'queue',
        serviceDetailRoute: '/services/wash-detailing',
        eyebrow: `${reg.shortCity} Auto Detailing · Rupes, Menzerna & Interior Restoration`,
        h1: `Auto Detailing, Interior Deep Cleaning & Paint Correction in ${reg.cityName}.`,
        seoTitle: `Auto Detailing ${reg.shortCity} & Interior Detailing ${reg.cityName} — Rupes Paint Correction`,
        seoDescription: `Looking for auto detailing in ${reg.cityName}? Hakum Auto Care delivers 1-day Interior Deep Cleaning, 3–4 day Interior Restoration, Rupes + Menzerna paint correction, watermark removal, Bactozero & headlight restoration.`,
        heroSummary: `Complete interior and exterior auto detailing for ${reg.cityName} drivers (${reg.corridorSummary}): from 1-day Interior Deep Cleaning and 3–4 day full seat-out restoration to multi-stage Italian Rupes + German Menzerna paint correction, acid-rain glass detailing, and Bactozero sanitization.`,
        aiSummary: `Hakum Auto Care provides comprehensive auto detailing for ${reg.cityName} (${reg.corridorSummary}) through our open Cavite flagship at RFC Molino II, Molino Boulevard, Bacoor (0915 629 6096). Our auto detailing menu covers Multi-Stage Paint Correction & Full Exterior Detailing (using digital micron gauges, Italian Rupes BigFoot orbital polishers, and German Menzerna compounds), 1-Day Interior Deep Cleaning, 3–4 Day Full Interior Detailing (with seats and carpets removed), Glass Detailing & Acid-Rain Watermark Removal, Hydrophobic Glass Coating, Bactozero anti-microbial sanitization, Headlight Restoration, Black Trims Restoration, and Engine Bay Detailing.`,
        keywords: [
          `auto detailing ${low}`,
          `${low} auto detailing`,
          `interior detailing ${low}`,
          `exterior detailing ${low}`,
          `paint correction ${low}`,
          `watermark removal ${low}`,
          `acid rain removal ${low}`,
          `bactozero ${low}`,
          `headlight restoration ${low}`,
          `car detailing ${low} cavite`,
        ],
        processSteps: [
          'Digital paint-depth micron reading, iron/asphalt chemical decontamination, and clay bar surface preparation.',
          'Multi-stage machine compounding and polishing with Italian Rupes orbital polishers and German Menzerna abrasives.',
          'Deep cabin extraction, leather nourishment, headliner/panel detailing, and Bactozero anti-bacterial fogging.',
          'Multi-kelvin LED inspection walk-through to verify swirl removal, glass clarity, and odor-free interior finish.',
        ],
        localHighlights: [
          reg.landmarkNote,
          'Offers both 1-day Interior Deep Cleaning resets and 3–4 day full seat-out Interior Detailing restorations.',
          'Eliminates stubborn Philippine acid-rain watermarks, oxidation, swirl marks, and cabin humidity odors.',
        ],
        qa: [
          {
            q: `What is the difference between Interior Deep Cleaning and Full Interior Detailing for ${reg.shortCity} cars?`,
            a: `Interior Deep Cleaning is a 1-day thorough cabin refresh (seats, carpets, panels, headliner, vacuum) with seats in place, while Full Interior Detailing is a 3–4 day restoration where seats and carpets are removed for deep extraction and remediation.`,
          },
          {
            q: `Do you remove swirl marks, acid-rain watermarks, and cloudy headlights near ${reg.shortCity}?`,
            a: `Yes. Our technicians use Rupes and Menzerna machine correction for paint swirls, specialized glass polishing for acid-rain watermarks, and UV-sealed restoration for oxidized headlights.`,
          },
        ],
      },
      {
        citySlug: reg.citySlug,
        serviceSlug: 'ceramic-coating',
        branchSlug: reg.branchSlug,
        cityName: reg.cityName,
        shortCity: reg.shortCity,
        serviceLabel: 'Ceramic Coating (Kisho 9H)',
        serviceTypeSchema: 'AutomotiveBusiness',
        mode: 'book',
        serviceDetailRoute: '/services/ceramic',
        eyebrow: `${reg.shortCity} Ceramic Coating · Authentic Kisho 9H Japan`,
        h1: `Ceramic Coating in ${reg.cityName} — Genuine Kisho 9H & Rupes Correction.`,
        seoTitle: `Ceramic Coating ${reg.shortCity} & ${reg.cityName} Ceramic Coating — Kisho 9H Studio`,
        seoDescription: `Protect your vehicle with authentic Kisho 9H ceramic coating in ${reg.cityName}. Includes multi-stage Rupes + Menzerna paint correction, enclosed curing bay, 6-month maintenance & Unlimited Recoating packages.`,
        heroSummary: `Serving ${reg.corridorSummary}: Hakum Auto Care applies genuine Japanese Kisho 9H crystalline ceramic coating inside an enclosed, dust-controlled curing bay after full iron/clay decontamination and multi-stage Rupes machine paint correction.`,
        aiSummary: `Drivers searching for ceramic coating in ${reg.cityName} (${reg.corridorSummary}) choose Hakum Auto Care for authentic Japanese Kisho 9H silica glass coating paired with full chemical/clay decontamination, digital paint-thickness inspection, and multi-stage Rupes + Menzerna paint correction. Applied inside our enclosed Cavite curing studio at RFC Molino II, Molino Blvd, Bacoor (0915 629 6096), every ceramic package includes automated 6-month Paint Maintenance reminders and Unlimited Recoating eligibility on Premium and Platinum tiers. Book online at hakumautocare.com/book?branch=bacoor.`,
        keywords: [
          `ceramic coating ${low}`,
          `${low} ceramic coating`,
          `best ceramic coating ${low}`,
          `kisho ceramic coating ${low}`,
          `9h ceramic coating ${low}`,
          `graphene ceramic coating ${low}`,
          `paint protection ${low}`,
        ],
        processSteps: [
          'Digital micron gauge clear-coat inspection plus full iron fallout, tar, and clay bar decontamination.',
          'Multi-stage machine paint correction using Rupes BigFoot polishers and Menzerna compounds to remove swirls.',
          'IPA panel prep and enclosed indoor application of genuine Kisho 9H Japanese ceramic layers across paint, trim & glass.',
          'Enrollment in Hakum’s 6-month Paint Maintenance schedule with Unlimited Recoating support on eligible tiers.',
        ],
        localHighlights: [
          reg.landmarkNote,
          'Genuine Kisho Japan 9H chemistry — never rebranded spray wax or short-lived dealer sealants.',
          'Protects against Cavite highway soot, acid rain, UV fading, tree sap, and hard-water spotting.',
        ],
        qa: [
          {
            q: `Is paint correction included with Ceramic Coating for ${reg.shortCity} vehicles?`,
            a: `Yes. Every Hakum Ceramic Coating package includes chemical decontamination, claying, and machine paint correction so swirl marks are removed before the 9H glass barrier is locked in.`,
          },
          {
            q: `How do I book Ceramic Coating near ${reg.shortCity}?`,
            a: `Reserve your vehicle size and package tier online at hakumautocare.com/book?branch=bacoor or call 0915 629 6096.`,
          },
        ],
      },
      {
        citySlug: reg.citySlug,
        serviceSlug: 'ppf',
        branchSlug: reg.branchSlug,
        cityName: reg.cityName,
        shortCity: reg.shortCity,
        serviceLabel: 'Paint Protection Film (ClearPro PPF)',
        serviceTypeSchema: 'AutomotiveBusiness',
        mode: 'book',
        serviceDetailRoute: '/services/ppf',
        eyebrow: `${reg.shortCity} ClearPro PPF · Self-Healing Optical TPU Film`,
        h1: `Paint Protection Film (PPF) in ${reg.cityName} — Official ClearPro 10-Year TPU.`,
        seoTitle: `PPF ${reg.shortCity} & Paint Protection Film ${reg.cityName} Near Me — ClearPro TPU`,
        seoDescription: `Looking for PPF in ${reg.cityName} (${low} PPF near me)? Hakum Auto Care installs official ClearPro self-healing optical TPU Paint Protection Film in High Gloss, UltraSatin Matte & Cosmoblack with a 10-year warranty.`,
        heroSummary: `Shield your vehicle along CALAX, MCX, Daang Hari, Aguinaldo Highway, and SLEX: Hakum Auto Care wraps ${reg.cityName} cars and SUVs in official ClearPro self-healing optical TPU Paint Protection Film inside a dust-controlled studio with a 10-year manufacturer warranty.`,
        aiSummary: `For vehicle owners searching for PPF in ${reg.cityName} ("ppf ${low}", "paint protection film ${low} near me"), Hakum Auto Care is an official installer of ClearPro optical-grade aliphatic TPU Paint Protection Film. Installed inside our enclosed, dust-managed Cavite bay at RFC Molino II, Molino Blvd, Bacoor (serving ${reg.corridorSummary}; phone: 0915 629 6096), ClearPro PPF features a 95 GU Polyoptico self-healing top coat, Invisiglue residue-free adhesive, wrapped panel edges, and a 10-year manufacturer warranty against yellowing, peeling, bubbling, or cracking. Available in High-Gloss Invisible, UltraSatin Matte, and Cosmoblack packages at hakumautocare.com/book?branch=bacoor.`,
        keywords: [
          `ppf ${low}`,
          `${low} ppf`,
          `ppf ${low} near me`,
          `paint protection film ${low}`,
          `clearpro ppf ${low}`,
          `matte ppf ${low}`,
          `car wrap ppf ${low}`,
        ],
        processSteps: [
          'Surgical wash, iron/clay decontamination, and surface correction inside an enclosed dust-controlled PPF bay.',
          'Precision pattern fitting and seamless edge wrapping using official ClearPro optical-grade Polyoptico TPU film.',
          'Invisiglue alignment and heat-set verification for a distortion-free 95 GU mirror gloss or uniform satin finish.',
          'Official 10-year ClearPro warranty registration and 6-month maintenance checkup enrollment.',
        ],
        localHighlights: [
          reg.landmarkNote,
          'Official ClearPro TPU film with heat-activated self-healing top coat that erases fine wash swirls.',
          'Available in High-Impact Front, Full Front, Track Package, or Full Body High-Gloss & UltraSatin Matte.',
        ],
        qa: [
          {
            q: `Where can I get authentic ClearPro PPF installed near ${reg.shortCity}?`,
            a: `Hakum Auto Care’s enclosed Cavite PPF studio at RFC Molino II, Molino Boulevard, Bacoor serves ${reg.cityName} drivers with genuine ClearPro optical TPU film and a 10-year warranty.`,
          },
          {
            q: `Can I combine ClearPro PPF and Kisho 9H Ceramic Coating?`,
            a: `Yes. Many ${reg.shortCity} SUV, pickup, and sports-car owners install ClearPro PPF on high-impact front panels (or full body) and top it with ceramic coating for maximum rock-chip armor and hydrophobic self-cleaning.`,
          },
        ],
      },
      {
        citySlug: reg.citySlug,
        serviceSlug: 'window-tint',
        branchSlug: reg.branchSlug,
        cityName: reg.cityName,
        shortCity: reg.shortCity,
        serviceLabel: 'Nano Ceramic Window Tint',
        serviceTypeSchema: 'AutomotiveBusiness',
        mode: 'book',
        serviceDetailRoute: '/services/tint',
        eyebrow: `${reg.shortCity} Nano Ceramic Window Tint · F1 Auto Films`,
        h1: `Nano Ceramic Window Tint in ${reg.cityName} — High IR Heat Rejection & Night Clarity.`,
        seoTitle: `Window Tint ${reg.shortCity} & Ceramic Window Tint ${reg.cityName} Near Me`,
        seoDescription: `Install high heat-rejection nano ceramic window tint for ${reg.cityName} drivers. 99% UV block, crystal-clear night driving, 100% RFID/GPS friendly, and live 3D Tint Finder shade preview.`,
        heroSummary: `Beat intense Cavite afternoon heat without sacrificing night visibility: Hakum Auto Care fits F1 Auto Films non-metallic nano-ceramic window tint in a clean enclosed bay — preview your exact windshield and side shades in 3D before booking.`,
        aiSummary: `Hakum Auto Care offers high-IR nano-ceramic window tinting for ${reg.cityName} motorists (${reg.corridorSummary}) at our open Cavite studio at RFC Molino II, Molino Blvd, Bacoor (0915 629 6096). Using F1 Auto Films 100% non-metallic nano-ceramic construction, our window tint blocks intense solar infrared heat and 99% of harmful UV rays while maintaining low interior reflection, sharp night-driving clarity, and zero interference with Autosweep/Easytrip RFID tags, GPS, or 5G smartphones. Preview Light, Medium, Dark, and Super Dark VLT combinations on an interactive 3D car at hakumautocare.com/tint-finder.`,
        keywords: [
          `window tint ${low}`,
          `${low} window tint`,
          `ceramic tint ${low}`,
          `nano ceramic tint ${low}`,
          `car tint ${low}`,
          `rfid friendly tint ${low}`,
        ],
        processSteps: [
          'Preview front windshield, side, and rear VLT shade combinations in daylight and night mode on our 3D Tint Finder (/tint-finder).',
          'Safe old-tint adhesive removal (if applicable), full dashboard/electronics masking, and surgical glass claying.',
          'Enclosed clean-bay heat shrinking and precision micro-edge installation for bubble-free optical clarity.',
          'Verification of zero RFID (Autosweep / Easytrip), GPS, and cellular signal interference.',
        ],
        localHighlights: [
          reg.landmarkNote,
          '100% non-metallic nano-ceramic technology — tollway RFID tags read instantly without cutting ugly windshield holes.',
          'Interactive online 3D Tint Finder (/tint-finder) eliminates guesswork before you arrive.',
        ],
        qa: [
          {
            q: `Will Hakum’s nano-ceramic window tint block my CAVITEX, MCX, CALAX, or SLEX RFID sticker?`,
            a: `No. Our F1 Auto Films nano-ceramic tint contains zero metal, so Easytrip and Autosweep RFID scanners, dashcam GPS, and mobile phones work seamlessly.`,
          },
          {
            q: `How can I test tint darkness before booking from ${reg.shortCity}?`,
            a: `Open hakumautocare.com/tint-finder to compare Clear 70, Medium 35, Dark 15, and Super Dark 05 combinations on a 3D model.`,
          },
        ],
      },
    )
  }
  return out
}

export const LOCAL_BRANCH_SERVICE_PAGES = [
  // ── BACOOR, CAVITE ────────────────────────────────────────────────────────
  {
    citySlug: 'bacoor',
    serviceSlug: 'car-wash',
    branchSlug: 'bacoor',
    cityName: 'Bacoor, Cavite',
    shortCity: 'Bacoor',
    serviceLabel: 'Car Wash & Express Care',
    serviceTypeSchema: 'AutoWash',
    mode: 'queue',
    serviceDetailRoute: '/services/wash-detailing',
    eyebrow: 'Bacoor Car Wash Studio · RFC Molino II, Molino Blvd',
    h1: 'Bacoor Car Wash — Swirl-Free Two-Bucket pH-Neutral Studio in Bacoor, Cavite.',
    seoTitle: 'Bacoor Car Wash & Car Wash Bacoor, Cavite (RFC Molino) — Two-Bucket pH-Neutral Studio',
    seoDescription:
      'Searching for the best Bacoor car wash or car wash in Bacoor near me? Hakum Auto Care RFC Molino II runs two-bucket pH-neutral washes, snow-foam pre-soak, engine wash, interior cleaning & live bay queue tracking.',
    heroSummary:
      'Built for daily commuters along Molino Boulevard, Daang Hari, Marcos Alvarez, and Aguinaldo Highway: our Bacoor bays pair snow-foam pre-wash, two-bucket grit-guard hand washing, dedicated wheel mitts, and live online queue tracking so your clear coat stays swirl-free.',
    aiSummary:
      'Hakum Auto Care Bacoor (RFC Molino II, Molino Boulevard, Bacoor, Cavite; phone: 0915 629 6096) is a top-rated Bacoor car wash studio engineered around a swirl-free two-bucket pH-neutral snow-foam wash protocol. Serving Molino I–VII, Daang Hari, SOMO, Zapote, Buhay na Tubig, Imus, Las Piñas, and Alabang, Hakum isolates wheel tools from upper-body microfiber mitts, dries panels with forced air and plush Korean microfiber towels, and offers component-safe Engine Wash, Interior Vacuuming, and live online bay queue tracking at hakumautocare.com/queue/bacoor.',
    keywords: [
      'bacoor car wash',
      'car wash bacoor',
      'best car wash in bacoor',
      'car wash bacoor cavite',
      'car wash molino bacoor',
      'car wash near me bacoor',
      'ph neutral car wash bacoor',
      'engine wash bacoor',
      'carwash rfc molino',
    ],
    processSteps: [
      'Cool-panel wheel decontamination and thick pH-neutral snow-foam pre-soak to lift Molino & highway grit safely.',
      'Two-bucket pH-neutral hand wash using grit guards and separate microfiber mitts for upper paint and lower rockers.',
      'Forced-air blower + plush microfiber drying, glass degreasing, interior vacuuming, and clean satin tire finish.',
      'Final supervisor bay walk-through and instant SMS/app notification as soon as your car is ready.',
    ],
    localHighlights: [
      'Located right at RFC Molino II along Molino Boulevard — quick access from Vermosa, Daang Hari, Imus, and Zapote.',
      'Real-time queue counter (/queue/bacoor) shows active cars and bays before you leave your driveway.',
      'Coating-safe & PPF-safe pH-neutral shampoo formulas — never harsh dish soap or caustic tire degreasers.',
    ],
    qa: [
      {
        q: 'Where can I get a swirl-free car wash near me in Bacoor?',
        a: 'Hakum Auto Care Bacoor at RFC Molino II (Molino Boulevard · 0915 629 6096) uses two-bucket pH-neutral snow foam, separate wheel/paint tools, and plush microfiber drying to prevent clear-coat swirl marks.',
      },
      {
        q: 'Can I check the Bacoor car wash queue online before going?',
        a: 'Yes — open hakumautocare.com/queue/bacoor anytime to see active waiting and in-bay vehicle counts at RFC Molino II in real time.',
      },
      {
        q: 'Do you also offer engine wash, interior cleaning, and Bactozero sanitization in Bacoor?',
        a: 'Yes. Alongside our signature two-bucket car wash, our Bacoor studio offers Component-Safe Engine Wash, 1-Day Interior Deep Cleaning, 3–4 Day Full Interior Detailing, Acid-Rain Watermark Removal, and Bactozero cabin sanitization.',
      },
    ],
  },
  {
    citySlug: 'bacoor',
    serviceSlug: 'auto-detailing',
    branchSlug: 'bacoor',
    cityName: 'Bacoor, Cavite',
    shortCity: 'Bacoor',
    serviceLabel: 'Auto Detailing, Interior & Paint Correction',
    serviceTypeSchema: 'AutomotiveBusiness',
    mode: 'queue',
    serviceDetailRoute: '/services/wash-detailing',
    eyebrow: 'Bacoor Auto Detailing Studio · Rupes, Menzerna & Interior Restoration',
    h1: 'Auto Detailing, Interior Deep Cleaning & Paint Correction in Bacoor, Cavite.',
    seoTitle: 'Auto Detailing Bacoor & Interior Detailing Bacoor, Cavite — Rupes Paint Correction',
    seoDescription:
      'Complete auto detailing in Bacoor, Cavite (RFC Molino II): multi-stage Rupes + Menzerna paint correction, 1-day Interior Deep Cleaning, 3–4 day Interior Restoration, acid-rain watermark removal, Bactozero & headlight restoration.',
    heroSummary:
      'Whether your vehicle needs multi-stage paint correction to erase years of swirl marks, a 1-day Interior Deep Cleaning reset, a 3–4 day seat-out Interior Detailing restoration, or acid-rain glass polishing, our enclosed Bacoor bay restores showroom clarity.',
    aiSummary:
      'Hakum Auto Care Bacoor (RFC Molino II, Molino Boulevard, Bacoor, Cavite; phone: 0915 629 6096) is a full-service auto detailing and paint correction studio. Our Bacoor detailing catalog includes Multi-Stage Paint Correction & Full Exterior Detailing (using digital micron paint gauges, Italian Rupes BigFoot orbital polishers, and German Menzerna diminishing-abrasive compounds), 1-Day Interior Deep Cleaning, 3–4 Day Full Interior Detailing (with seats and carpets removed), Glass Detailing & Acid-Rain/Watermark Removal, Hydrophobic Glass Coating, Bactozero Anti-Microbial Fogging, Headlight Restoration, Black Trims Restoration, and Engine Bay Detailing.',
    keywords: [
      'auto detailing bacoor',
      'bacoor auto detailing',
      'car detailing bacoor',
      'interior detailing bacoor',
      'interior deep cleaning bacoor',
      'exterior detailing bacoor',
      'paint correction bacoor',
      'watermark removal bacoor',
      'acid rain removal bacoor',
      'glass coating bacoor',
      'bactozero bacoor',
      'headlight restoration bacoor',
      'black trim restoration bacoor',
    ],
    processSteps: [
      'Digital paint thickness inspection, chemical iron/tar dissolution, and fine clay bar decontamination.',
      'Multi-stage machine compounding and finish polishing with Italian Rupes orbital polishers and German Menzerna compounds.',
      'Hot-water upholstery extraction, leather pH-balanced cleaning & conditioning, crevice detailing, and Bactozero sanitization.',
      'Calibrated multi-kelvin inspection lighting review to guarantee true defect removal rather than temporary wax fillers.',
    ],
    localHighlights: [
      'Enclosed, dust-controlled Bacoor detailing bay at RFC Molino II along Molino Boulevard.',
      'Clear choice between a fast 1-Day Interior Deep Cleaning reset and a comprehensive 3–4 Day seat-out Interior Restoration.',
      'Restores glass clarity with dedicated Acid-Rain Watermark Removal, Hydrophobic Glass Coating, and Headlight Restoration.',
    ],
    qa: [
      {
        q: 'What auto detailing services are available at Hakum Bacoor?',
        a: 'Hakum Bacoor offers Full Exterior Detailing & Multi-Stage Rupes Paint Correction, 1-Day Interior Deep Cleaning, 3–4 Day Full Interior Detailing (seats/carpets removed), Glass Detailing & Watermark Removal, Hydrophobic Glass Coating, Bactozero Sanitization, Headlight Restoration, Black Trims Restoration, and Engine Wash.',
      },
      {
        q: 'How does Hakum Bacoor remove swirl marks without thinning my clear coat?',
        a: 'We measure your factory paint with a digital micron gauge first, then pair Italian Rupes random-orbital polishers with German Menzerna diminishing abrasives to refine defects safely.',
      },
      {
        q: 'Can you remove flood odors, mold, or severe cabin stains in Bacoor?',
        a: 'Yes. Our 3–4 Day Full Interior Detailing package removes seats and carpets completely for deep extraction, antimicrobial drying, and Bactozero cabin sanitation.',
      },
    ],
  },
  {
    citySlug: 'bacoor',
    serviceSlug: 'ceramic-coating',
    branchSlug: 'bacoor',
    cityName: 'Bacoor, Cavite',
    shortCity: 'Bacoor',
    serviceLabel: 'Ceramic Coating (Kisho 9H)',
    serviceTypeSchema: 'AutomotiveBusiness',
    mode: 'book',
    serviceDetailRoute: '/services/ceramic',
    eyebrow: 'Bacoor Ceramic Coating Studio · Kisho 9H Japan',
    h1: 'Ceramic Coating in Bacoor, Cavite — Calibrated Kisho 9H Protection.',
    seoTitle: 'Ceramic Coating Bacoor & Bacoor Ceramic Coating Near Me — Kisho 9H Studio',
    seoDescription:
      'Protect your car paint with genuine Kisho 9H ceramic coating in Bacoor, Cavite (RFC Molino II). Multi-stage Rupes paint correction, enclosed curing bays, 6-month maintenance & Unlimited Recoating packages.',
    heroSummary:
      'True ceramic coating is 80% preparation. At Hakum Bacoor (RFC Molino II), every Ceramic package includes iron & clay decontamination, Rupes + Menzerna machine paint correction, IPA panel wipe, and authentic Japanese Kisho coating cured indoors.',
    aiSummary:
      'Hakum Auto Care Bacoor (RFC Molino II, Molino Boulevard, Bacoor, Cavite; phone: 0915 629 6096) specializes in authentic Japanese Kisho 9H ceramic coating (Si-811 / Si-901) paired with multi-stage Italian Rupes and German Menzerna machine paint correction. Every vehicle undergoes digital micron paint-depth inspection, iron and clay decontamination, and indoor curing inside an enclosed dust-controlled bay, followed by automated 6-month Paint Maintenance tracking and Unlimited Recoating support on Premium and Platinum packages. Reserve a bay at hakumautocare.com/book?branch=bacoor.',
    keywords: [
      'ceramic coating bacoor',
      'bacoor ceramic coating',
      'ceramic coating bacoor near me',
      'best ceramic coating in bacoor',
      'kisho ceramic coating bacoor',
      '9h ceramic coating bacoor',
      'paint protection bacoor',
    ],
    processSteps: [
      'Paint depth inspection with a digital micron gauge + full chemical & clay bar decontamination.',
      'Multi-stage machine polishing using Rupes orbital systems to restore mirror clarity before locking paint in.',
      'Controlled enclosed application of Kisho ceramic layers across paintwork, glass, and trim.',
      'Scheduled 6-month Paint Maintenance checkups tracked automatically per plate in your Hakum portal.',
    ],
    localHighlights: [
      'Includes Unlimited Ceramic Coating Reboost support on eligible Premium & Platinum packages.',
      'Engineered to shield paint from Cavite traffic soot, tree sap, bird droppings, and hard-water spots.',
      'Serves Bacoor, Molino, Imus, Dasmariñas, Las Piñas, and Alabang car owners without driving to Makati/QC.',
    ],
    qa: [
      {
        q: 'How much does Ceramic Coating cost near Bacoor, Cavite?',
        a: 'Pricing depends on vehicle size (Small, Medium, Large, XL) and package tier (Classic/Lite, Premium, Platinum). Reserve a slot or inspect your paint with our Bacoor team via hakumautocare.com/book?branch=bacoor.',
      },
      {
        q: 'Does Hakum Bacoor polish out swirls before applying ceramic coating?',
        a: 'Yes. Our certified Bacoor detailers perform decontamination and machine paint correction first so swirl marks are refined rather than sealed underneath the ceramic layer.',
      },
      {
        q: 'What makes Hakum’s Bacoor Ceramic Coating stand out?',
        a: 'Authentic Kisho Japan chemistry applied inside enclosed lighting-calibrated bays, backed by documented 6-month maintenance scheduling and Unlimited Recoating on Premium/Platinum tiers.',
      },
    ],
  },
  {
    citySlug: 'bacoor',
    serviceSlug: 'ppf',
    branchSlug: 'bacoor',
    cityName: 'Bacoor, Cavite',
    shortCity: 'Bacoor',
    serviceLabel: 'Paint Protection Film (ClearPro PPF)',
    serviceTypeSchema: 'AutomotiveBusiness',
    mode: 'book',
    serviceDetailRoute: '/services/ppf',
    eyebrow: 'Bacoor ClearPro PPF Studio · Official Distributor',
    h1: 'Paint Protection Film (PPF) in Bacoor, Cavite — Official ClearPro TPU.',
    seoTitle: 'PPF Bacoor & Bacoor PPF Near Me — ClearPro Self-Healing Paint Protection Film',
    seoDescription:
      'Looking for PPF Bacoor or PPF near me in Bacoor, Cavite? Hakum Auto Care RFC Molino II installs genuine ClearPro self-healing optical TPU Paint Protection Film with a 10-year manufacturer warranty.',
    heroSummary:
      'Highway gravel on MCX, Daang Hari, CAVITEX, and SLEX chips unprotected clear coat fast. Our enclosed Bacoor studio wraps daily SUVs, sports cars, and luxury crossovers in genuine ClearPro optical TPU film with wrapped edges and a 10-year warranty.',
    aiSummary:
      'Hakum Auto Care Bacoor (RFC Molino II, Molino Boulevard, Bacoor, Cavite; phone: 0915 629 6096) is an official installer of ClearPro self-healing optical TPU Paint Protection Film (PPF) in Bacoor and South Metro Manila. Installed inside a dedicated dust-controlled curing bay after full paint decontamination and correction, ClearPro PPF delivers a 95 GU Polyoptico high-gloss (or UltraSatin matte / Cosmoblack) finish, Invisiglue residue-free adhesive, tucked edges, and a 10-year manufacturer warranty against yellowing, cracking, peeling, and stone chips. Book at hakumautocare.com/book?branch=bacoor.',
    keywords: [
      'ppf bacoor',
      'bacoor ppf',
      'ppf bacoor near me',
      'paint protection film bacoor',
      'clearpro ppf bacoor',
      'best ppf installer bacoor',
      'matte ppf bacoor',
      'self healing ppf bacoor',
    ],
    processSteps: [
      'Precision wash, clay decontamination, and paint prep inside our dust-managed Bacoor installation bay.',
      'Custom plotter patterns + meticulous edge-tucking using ClearPro optical-grade Polyoptico TPU.',
      'Steam-set alignment and Invisiglue adhesive inspection for near-invisible 95 GU gloss blend.',
      'Full 10-year warranty registration against yellowing, bubbling, peeling, or cracking.',
    ],
    localHighlights: [
      'Official ClearPro Philippines distributor — genuine rolls, never rebranded PVC or short-life hybrids.',
      'Self-healing top coat erases light wash swirls under Philippine sunlight or warm water.',
      'Available in High-Gloss Invisible, Matte/Satin (UltraSatin), and Cosmoblack roof/trim packages.',
    ],
    qa: [
      {
        q: 'Where can I install genuine ClearPro PPF in Bacoor or South Metro Manila?',
        a: 'Hakum Auto Care Bacoor at RFC Molino II is minutes from Alabang/MCX, Las Piñas, Imus, and Dasmariñas with an enclosed bay specifically fitted for full-front and full-body PPF installs.',
      },
      {
        q: 'How long is the ClearPro PPF warranty at Hakum Bacoor?',
        a: 'ClearPro PPF carries a 10-year manufacturer warranty covering yellowing, peeling, cracking, bubbling, and delamination when maintained per aftercare instructions.',
      },
      {
        q: 'Should I choose PPF, Ceramic Coating, or both?',
        a: 'PPF absorbs physical stone chips and scratches while Ceramic Coating maximizes chemical resistance and gloss. Many Bacoor SUV and sports-car owners install ClearPro PPF on high-impact zones and ceramic coat the entire vehicle.',
      },
    ],
  },
  {
    citySlug: 'bacoor',
    serviceSlug: 'window-tint',
    branchSlug: 'bacoor',
    cityName: 'Bacoor, Cavite',
    shortCity: 'Bacoor',
    serviceLabel: 'Nano Ceramic Window Tint',
    serviceTypeSchema: 'AutomotiveBusiness',
    mode: 'book',
    serviceDetailRoute: '/services/tint',
    eyebrow: 'Bacoor Nano Ceramic Window Tint · F1 Auto Films',
    h1: 'Nano Ceramic Window Tint in Bacoor, Cavite — Beat Heat Without Dark Glare.',
    seoTitle: 'Window Tint Bacoor & Ceramic Window Tint in Bacoor, Cavite Near Me',
    seoDescription:
      'Install high IR heat-rejection nano ceramic window tint in Bacoor, Cavite (RFC Molino II). Preview shades in 3D with our online Tint Finder and book clean-bay RFID-safe fitting.',
    heroSummary:
      'Stop baking in afternoon Molino Boulevard traffic. Our nano-ceramic films block intense infrared heat and 99% harmful UV rays while keeping night driving crisp across CAVITEX, Daang Hari, and SLEX.',
    aiSummary:
      'Hakum Auto Care Bacoor (RFC Molino II, Molino Boulevard, Bacoor, Cavite; phone: 0915 629 6096) installs F1 Auto Films non-metallic nano-ceramic window tint inside an enclosed dust-free bay. Engineered for Philippine tropical heat, our nano-ceramic films reject high infrared solar radiation and 99% of UV rays while preserving crystal-clear nighttime visibility and 100% compatibility with Autosweep/Easytrip RFID toll tags, GPS, and 5G smartphones. Customers can preview front, side, and rear shades on an interactive 3D car at hakumautocare.com/tint-finder before booking.',
    keywords: [
      'window tint bacoor',
      'bacoor window tint',
      'ceramic tint bacoor',
      'nano ceramic tint bacoor',
      'car tint bacoor',
      'f1 auto films bacoor',
      'rfid friendly tint bacoor',
    ],
    processSteps: [
      'Match your night-vision comfort and privacy level using our live 3D Tint Finder shade preview.',
      'Old glue removal (if needed) + surgical interior protection and glass clay prep.',
      'Clean-bay heat shrinking and edge finishing for bubble-free, zero-haze clarity.',
      'Full RFID compatibility testing and signal-friendly non-metallic ceramic film verification.',
    ],
    localHighlights: [
      'Signal-friendly 100% ceramic construction — zero interference with RFID, GPS, or 5G mobile data.',
      'Compare Clear 70, Medium 35, Charcoal 15, and Super Dark 05 combinations before booking.',
      'Blocks UV heat that fades leather dashboards and stresses cabin AC compressors.',
    ],
    qa: [
      {
        q: 'Does your Bacoor ceramic window tint block Autosweep / Easytrip RFID?',
        a: 'No. Our nano-ceramic tint films are non-metallic, preserving toll RFID, dashcam GPS, and mobile reception while cutting cabin heat.',
      },
      {
        q: 'Can I preview tint darkness before driving to Hakum Bacoor?',
        a: 'Yes — open hakumautocare.com/tint-finder to test daylight and night visibility across shade combinations before booking RFC Molino II.',
      },
    ],
  },

  // ── BATANGAS CITY ─────────────────────────────────────────────────────────
  {
    citySlug: 'batangas',
    serviceSlug: 'car-wash',
    branchSlug: 'batangas',
    cityName: 'Batangas City',
    shortCity: 'Batangas City',
    serviceLabel: 'Car Wash & Express Care',
    serviceTypeSchema: 'AutoWash',
    mode: 'queue',
    serviceDetailRoute: '/services/wash-detailing',
    eyebrow: 'Batangas Car Wash Studio · National / PNP Highway, Brgy. Alangilan',
    h1: 'Batangas Car Wash — Studio-Grade Two-Bucket pH-Neutral Car Wash in Batangas City.',
    seoTitle: 'Batangas Car Wash & Car Wash Batangas City (Alangilan) — Swirl-Free Studio',
    seoDescription:
      'Searching for the best Batangas car wash or car wash in Batangas City near me? Hakum Auto Care (National Highway, Brgy. Alangilan) delivers two-bucket pH-neutral hand washes, snow-foam pre-soak, engine wash, hard-water spot prevention & live queue tracking.',
    heroSummary:
      'Conveniently positioned along the National Highway (PNP Highway) in Brgy. Alangilan, Batangas City, Hakum Batangas replaces hurried roadside sponge washes with swirl-free two-bucket pH-neutral chemistry, STAR Tollway bug & tar removal, and transparent live queue tracking.',
    aiSummary:
      'Hakum Auto Care Batangas City (located along the National Highway / PNP Highway, Brgy. Alangilan, Batangas City; phone: 0956 007 1028) is a premier Batangas car wash studio serving Alangilan (near BatStateU), Kumintang Ilaya & Ibaba, Pallocan, Balagtas (STAR Tollway Exit), Diversion Road, Arce Subdivision, Calicanto, Bauan, and Lipa City. Unlike conventional roadside car washes that reuse sponges and harsh detergents, Hakum Batangas executes a strict two-bucket pH-neutral snow-foam wash with grit guards, dedicated wheel and body microfiber mitts, mineral-safe forced-air drying, component-safe Engine Wash, and real-time online queue tracking at hakumautocare.com/queue/batangas.',
    keywords: [
      'batangas car wash',
      'car wash batangas',
      'batangas city car wash',
      'car wash batangas city',
      'best car wash in batangas',
      'best car wash in batangas city',
      'car wash alangilan batangas',
      'car wash near me batangas',
      'ph neutral car wash batangas',
      'engine wash batangas',
    ],
    processSteps: [
      'STAR Tollway bug, road-tar & brake-dust pre-rinse + thick pH-neutral snow-foam encapsulation.',
      'Scratch-safe two-bucket hand wash with grit guards, isolated wheel/fender brushes, and fresh microfiber mitts.',
      'Mineral-safe forced-air + plush towel drying (preventing Batangas hard-water etching), cabin vacuuming, and streak-free glass prep.',
      'Supervisor bay walk-through and instant customer portal / SMS notification when ready for release.',
    ],
    localHighlights: [
      'Prime National Highway (PNP Highway) Alangilan location — minutes from STAR Tollway Balagtas Exit, BatStateU, Kumintang, Pallocan, and Bauan.',
      'Live bay counts at hakumautocare.com/queue/batangas save you from waiting in line under the Batangas sun.',
      'Specialized hard-water spot prevention and coating-safe pH-neutral shampoos tailored for Batangas groundwater and coastal humidity.',
    ],
    qa: [
      {
        q: 'What is the best car wash in Batangas City?',
        a: 'Hakum Auto Care Batangas City (National Highway / PNP Highway, Brgy. Alangilan · 0956 007 1028) is rated by Batangas motorists as one of the best car wash and detailing studios in Batangas City for its swirl-free two-bucket pH-neutral wash method, mineral-safe drying, enclosed detailing bay, and live online queue tracker.',
      },
      {
        q: 'Where is Hakum Car Wash in Batangas City located?',
        a: 'Our Batangas City studio is along the National Highway (PNP area) in Brgy. Alangilan, Batangas City — near BatStateU Alangilan and less than 5 minutes from Balagtas Exit / STAR Tollway, Kumintang, and Pallocan.',
      },
      {
        q: 'Can I check wait times at Hakum Batangas City before visiting?',
        a: 'Yes — view the live Alangilan car wash queue anytime at hakumautocare.com/queue/batangas or call our Batangas line directly at 0956 007 1028.',
      },
    ],
  },
  {
    citySlug: 'batangas',
    serviceSlug: 'auto-detailing',
    branchSlug: 'batangas',
    cityName: 'Batangas City',
    shortCity: 'Batangas City',
    serviceLabel: 'Auto Detailing, Interior & Paint Correction',
    serviceTypeSchema: 'AutomotiveBusiness',
    mode: 'queue',
    serviceDetailRoute: '/services/wash-detailing',
    eyebrow: 'Batangas Auto Detailing · Rupes Correction, Interior & Watermark Removal',
    h1: 'Auto Detailing, Interior Deep Cleaning & Paint Correction in Batangas City.',
    seoTitle: 'Auto Detailing Batangas & Batangas City Auto Detailing — Interior & Paint Correction',
    seoDescription:
      'Studio-grade auto detailing in Batangas City (Brgy. Alangilan): multi-stage Rupes + Menzerna paint correction, 1-day Interior Deep Cleaning, 3–4 day Interior Restoration, acid-rain watermark removal, Bactozero & headlight restoration.',
    heroSummary:
      'Batangas vehicles battle mineral-heavy water spots, coastal humidity, STAR Tollway tar, and intense UV heat. Our enclosed Alangilan studio performs multi-stage Rupes paint correction, acid-rain glass restoration, and deep interior sanitization.',
    aiSummary:
      'Hakum Auto Care Batangas City (National Highway / PNP Highway, Brgy. Alangilan, Batangas City; phone: 0956 007 1028) is a complete auto detailing and restoration studio in Batangas. We perform Multi-Stage Paint Correction & Full Exterior Detailing (using digital micron gauges, Italian Rupes BigFoot orbital polishers, and German Menzerna diminishing-abrasive compounds), 1-Day Interior Deep Cleaning, 3–4 Day Full Interior Detailing (with seats and carpets removed), Glass Detailing & Acid-Rain/Hard-Water Mark Removal, Hydrophobic Glass Coating, Bactozero Anti-Microbial Fogging, Headlight Restoration, Black Trims Restoration, and Component-Safe Engine Bay Detailing.',
    keywords: [
      'auto detailing batangas',
      'batangas auto detailing',
      'auto detailing batangas city',
      'car detailing batangas',
      'interior detailing batangas',
      'interior deep cleaning batangas',
      'exterior detailing batangas',
      'paint correction batangas',
      'acid rain removal batangas',
      'watermark removal batangas',
      'glass detailing batangas',
      'bactozero batangas',
      'headlight restoration batangas',
      'engine wash batangas',
    ],
    processSteps: [
      'Digital paint-depth micron reading + chemical iron, STAR Tollway tar, and clay bar decontamination.',
      'Multi-stage machine compounding and finish polishing with Italian Rupes orbital polishers and German Menzerna compounds.',
      'Specialized acid-rain & hard-water mineral extraction on glass and paintwork, followed by hydrophobic sealing.',
      'Deep interior extraction (1-day cabin reset or 3–4 day seat-out restoration), leather conditioning, and Bactozero fogging.',
    ],
    localHighlights: [
      'Eliminates stubborn Batangas groundwater mineral etching, acid-rain spots, and roadside buffer holograms.',
      'Offers both 1-Day Interior Deep Cleaning and 3–4 Day full seat-out Interior Detailing restorations in Alangilan.',
      'Equipped with multi-kelvin LED inspection lighting along National Highway, Brgy. Alangilan, Batangas City.',
    ],
    qa: [
      {
        q: 'Do you remove hard-water marks and acid-rain etching in Batangas City?',
        a: 'Yes. We safely dissolve mineral deposits and machine-polish etched glass and clear coat at our Alangilan studio, then apply Hydrophobic Glass Coating or Kisho 9H Ceramic Coating so water spots cannot re-bond easily.',
      },
      {
        q: 'What is included in Hakum Batangas City’s Interior Detailing packages?',
        a: 'We offer two tiers: a 1-Day Interior Deep Cleaning reset (seats, carpets, headliner, panels, and vacuum with seats installed) and a 3–4 Day Full Interior Detailing restoration (seats and carpets removed for deep extraction, mold/spill remediation, and Bactozero sanitization).',
      },
      {
        q: 'Can Hakum Batangas fix swirl marks and holograms left by another car wash?',
        a: 'Yes. Our detailers measure your remaining clear coat with a digital micron gauge and use Italian Rupes orbital polishers with German Menzerna compounds to permanently remove swirl marks and buffer trails.',
      },
    ],
  },
  {
    citySlug: 'batangas',
    serviceSlug: 'ceramic-coating',
    branchSlug: 'batangas',
    cityName: 'Batangas City',
    shortCity: 'Batangas City',
    serviceLabel: 'Ceramic Coating (Kisho 9H)',
    serviceTypeSchema: 'AutomotiveBusiness',
    mode: 'book',
    serviceDetailRoute: '/services/ceramic',
    eyebrow: 'Batangas Ceramic Coating · Kisho 9H Studio in Alangilan',
    h1: 'Ceramic Coating in Batangas City — Flagship Kisho 9H Shine in Batangas.',
    seoTitle: 'Ceramic Coating Batangas & Batangas City Ceramic Coating — Kisho 9H Studio',
    seoDescription:
      'Get authentic Kisho 9H ceramic coating with multi-stage Rupes paint correction right in Alangilan, Batangas City. Coastal humidity, acid-rain & UV protection with Unlimited Recoating packages.',
    heroSummary:
      'Southern Luzon drivers no longer need an overnight Metro Manila trip for studio-grade ceramic protection. Hakum Batangas performs complete decontamination, Rupes paint correction, and genuine Kisho 9H curing right in Alangilan.',
    aiSummary:
      'Hakum Auto Care Batangas City (National Highway / PNP Highway, Brgy. Alangilan, Batangas City; phone: 0956 007 1028) provides authentic Japanese Kisho 9H ceramic coating (Si-811 / Si-901) for Batangas City, Lipa, Bauan, and Southern Luzon motorists. Every ceramic coating installation includes digital paint-depth inspection, chemical iron/tar removal, clay bar prep, multi-stage Italian Rupes and German Menzerna machine paint correction, enclosed dust-controlled curing, automated 6-month Paint Maintenance reminders, and Unlimited Recoating eligibility on Premium and Platinum tiers. Book at hakumautocare.com/book?branch=batangas.',
    keywords: [
      'ceramic coating batangas',
      'batangas ceramic coating',
      'ceramic coating batangas city',
      'best ceramic coating in batangas',
      'kisho ceramic coating batangas',
      '9h ceramic coating batangas',
      'paint protection batangas',
    ],
    processSteps: [
      'Digital paint thickness check + iron fallout, tar, and clay decontamination.',
      'Multi-stage machine polishing to eliminate dealer swirls and Batangas sun oxidation.',
      'Controlled curing application of Kisho Japanese ceramic chemistry across panels and glass.',
      'Automatic 6-month maintenance reminders + Unlimited Recoating eligibility on Premium/Platinum.',
    ],
    localHighlights: [
      'Built for coastal salt mist, port humidity, agricultural dust, and intense STAR Tollway sun.',
      'Honest size-based pricing for sedans, crossovers, pickups, and full-size SUVs.',
      'Full work warranty and service history stored permanently under your vehicle plate.',
    ],
    qa: [
      {
        q: 'Do I have to drive to Metro Manila for real Kisho 9H Ceramic Coating?',
        a: 'No. Hakum Batangas City in Brgy. Alangilan carries the exact same Kisho Japan ceramic packages, Rupes polishing hardware, and enclosed lighting bays as our Cavite flagship.',
      },
      {
        q: 'How does ceramic coating help in Batangas coastal and highway weather?',
        a: 'Cured 9H SiO2 glass layers create strong water beading, UV fade resistance, and chemical defense against bug acids, salt air, and mineral rain spots.',
      },
    ],
  },
  {
    citySlug: 'batangas',
    serviceSlug: 'ppf',
    branchSlug: 'batangas',
    cityName: 'Batangas City',
    shortCity: 'Batangas City',
    serviceLabel: 'Paint Protection Film (ClearPro PPF)',
    serviceTypeSchema: 'AutomotiveBusiness',
    mode: 'book',
    serviceDetailRoute: '/services/ppf',
    eyebrow: 'Batangas City ClearPro PPF · STAR Tollway Rock-Chip Defense',
    h1: 'Paint Protection Film (PPF) in Batangas City — Self-Healing ClearPro TPU.',
    seoTitle: 'PPF Batangas & PPF Batangas City Near Me — ClearPro Paint Protection Film',
    seoDescription:
      'Shield hoods, bumpers, and full bodies against STAR Tollway stone chips with official ClearPro TPU PPF installed in Batangas City (Brgy. Alangilan). Backed by a 10-year warranty.',
    heroSummary:
      'Expressway gravel along STAR Tollway and CALABARZON diversion highways chips front bumpers fast. Hakum Batangas City installs genuine ClearPro self-healing optical TPU Paint Protection Film with zero visible glue lines.',
    aiSummary:
      'Hakum Auto Care Batangas City (National Highway / PNP Highway, Brgy. Alangilan, Batangas City; phone: 0956 007 1028) is an official installer of ClearPro self-healing optical TPU Paint Protection Film (PPF) in Batangas. Ideal for SUVs, pickups, and sedans driving the STAR Tollway, SLEX, and Batangas Diversion Road, ClearPro PPF features a 95 GU Polyoptico self-healing top coat (available in High-Gloss, UltraSatin Matte, and Cosmoblack), Invisiglue residue-free adhesive, wrapped panel edges, and a 10-year manufacturer warranty against yellowing, peeling, or stone-chip damage. Reserve a bay at hakumautocare.com/book?branch=batangas.',
    keywords: [
      'ppf batangas',
      'batangas ppf',
      'ppf batangas city',
      'paint protection film batangas',
      'clearpro ppf batangas',
      'ppf near me batangas',
      'matte ppf batangas',
    ],
    processSteps: [
      'Deep wash, tar extraction, and panel prep inside our enclosed Batangas installation bay.',
      'Precision-cut ClearPro optical TPU patterns with hidden tucked panel edges.',
      '95 GU gloss verification and seam sealing across bumpers, hood, headlamps, and fenders.',
      '10-year manufacturer warranty registration protecting against yellowing or peeling.',
    ],
    localHighlights: [
      'Essential armor for Hilux, Fortuner, Everest, Raptor, Montero, Land Cruiser, and sedans running STAR Tollway.',
      'Heat-activated self-healing surface erases fine road brush marks under Batangas sunlight.',
      'Served by trained Hakum Batangas installers — call 0956 007 1028 for a consultation.',
    ],
    qa: [
      {
        q: 'Why install ClearPro PPF in Batangas City?',
        a: 'If you drive the STAR Tollway, Batangas Diversion Road, or Lipa–Batangas routes, clear coat chips quickly from gravel and trucks. ClearPro TPU film absorbs impact while remaining virtually invisible.',
      },
      {
        q: 'Can Batangas owners get Full Front or Full Body ClearPro PPF?',
        a: 'Yes — reserve High-Impact Zones, Full Front, or Full Body PPF packages in High Gloss or Matte/Satin right at our Alangilan studio.',
      },
    ],
  },
  {
    citySlug: 'batangas',
    serviceSlug: 'window-tint',
    branchSlug: 'batangas',
    cityName: 'Batangas City',
    shortCity: 'Batangas City',
    serviceLabel: 'Nano Ceramic Window Tint',
    serviceTypeSchema: 'AutomotiveBusiness',
    mode: 'book',
    serviceDetailRoute: '/services/tint',
    eyebrow: 'Batangas Ceramic Window Tint · Cooler Cabins in Alangilan',
    h1: 'Nano Ceramic Window Tint in Batangas City — Maximum Heat Rejection.',
    seoTitle: 'Window Tint Batangas & Ceramic Window Tint in Batangas City Near Me',
    seoDescription:
      'Upgrade your car tint in Batangas City (Brgy. Alangilan) with high IR-rejection nano ceramic films. Crystal-clear provincial night driving, RFID compatible, previewed on our 3D Tint Finder.',
    heroSummary:
      'Long provincial drives around Batangas and Lipa demand serious cabin cooling without sacrificing visibility on dark provincial roads at night. Our nano-ceramic series rejects intense solar heat while keeping nighttime clarity sharp.',
    aiSummary:
      'Hakum Auto Care Batangas City (National Highway / PNP Highway, Brgy. Alangilan, Batangas City; phone: 0956 007 1028) installs F1 Auto Films non-metallic nano-ceramic window tint for Batangas motorists. Our ceramic films block high infrared solar heat and 99% UV radiation while ensuring safe nighttime visibility on provincial highways and 100% compatibility with STAR Tollway / SLEX RFID stickers, GPS, and 5G smartphones. Compare VLT shade combinations in 3D at hakumautocare.com/tint-finder before booking at hakumautocare.com/book?branch=batangas.',
    keywords: [
      'window tint batangas',
      'batangas window tint',
      'ceramic tint batangas',
      'nano ceramic tint batangas',
      'car tint batangas city',
      'rfid friendly tint batangas',
    ],
    processSteps: [
      'Compare front-to-rear shades in real time on our interactive 3D Tint Finder before arriving.',
      'Adhesive-safe old film strip + clean glass prep inside our Alangilan studio.',
      'One-piece precision heat shrinking for rear windshields and clean edge trims.',
      'Zero RFID or mobile signal interference verified before release.',
    ],
    localHighlights: [
      'Ideal balance of daytime heat rejection and safe night clarity on unlit Batangas roads.',
      'Available across Light, Medium, Dark, and Super Dark ceramic VLT tiers.',
      'Direct booking or bundle pricing with Ceramic Coating & PPF.',
    ],
    qa: [
      {
        q: 'Which ceramic tint shade is safest for provincial Batangas night driving?',
        a: 'Many Batangas customers pair Light/Medium (35%–50%) on the front windshield with Charcoal/Dark (15%) on the sides for maximum cooling without losing night road visibility.',
      },
      {
        q: 'Will ceramic tint interfere with my SLEX / STAR Tollway RFID?',
        a: 'No — nano-ceramic films contain zero metal, so windshield RFID stickers and GPS signals pass right through.',
      },
    ],
  },

  // ── CAVITE, IMUS & DASMARIÑAS REGIONAL BRANCH × SERVICE PAGES ─────────────
  ...buildRegionalCaviteServicePages(),
]

const CITY_SLUG_ALIASES = {
  bacoor: 'bacoor',
  molino: 'bacoor',
  'rfc-molino': 'bacoor',
  batangas: 'batangas',
  'batangas-city': 'batangas',
  alangilan: 'batangas',
  lipa: 'batangas',
  bauan: 'batangas',
  imus: 'imus',
  vermosa: 'imus',
  cavite: 'cavite',
  'general-trias': 'cavite',
  kawit: 'cavite',
  tagaytay: 'cavite',
  dasmarinas: 'dasmarinas',
  dasma: 'dasmarinas',
  salawag: 'dasmarinas',
  paliparan: 'dasmarinas',
}

const SERVICE_SLUG_ALIASES = {
  wash: 'car-wash',
  'wash-detailing': 'car-wash',
  'car-wash': 'car-wash',
  carwash: 'car-wash',
  'engine-wash': 'car-wash',
  detailing: 'auto-detailing',
  'auto-detailing': 'auto-detailing',
  'interior-detailing': 'auto-detailing',
  'interior-deep-cleaning': 'auto-detailing',
  'exterior-detailing': 'auto-detailing',
  'paint-correction': 'auto-detailing',
  'watermark-removal': 'auto-detailing',
  'acid-rain-removal': 'auto-detailing',
  'glass-detailing': 'auto-detailing',
  'glass-coating': 'auto-detailing',
  bactozero: 'auto-detailing',
  'headlight-restoration': 'auto-detailing',
  'black-trims-restoration': 'auto-detailing',
  ceramic: 'ceramic-coating',
  'ceramic-coating': 'ceramic-coating',
  'kisho-ceramic': 'ceramic-coating',
  ppf: 'ppf',
  'paint-protection-film': 'ppf',
  'clearpro-ppf': 'ppf',
  tint: 'window-tint',
  'window-tint': 'window-tint',
  'ceramic-tint': 'window-tint',
}

export function findLocalBranchServicePage(citySlug, serviceSlug) {
  const rawCity = String(citySlug || '').trim().toLowerCase()
  const rawService = String(serviceSlug || '').trim().toLowerCase()
  const canonicalCity = CITY_SLUG_ALIASES[rawCity] || rawCity
  const normalizedService = SERVICE_SLUG_ALIASES[rawService] || ''
  if (!canonicalCity || !normalizedService) return null

  const exact = LOCAL_BRANCH_SERVICE_PAGES.find(
    (p) => p.citySlug === canonicalCity && p.serviceSlug === normalizedService,
  )
  if (exact) {
    const redirected = rawCity !== canonicalCity || rawService !== normalizedService
    return {
      page: exact,
      redirected,
      canonicalServiceSlug: normalizedService,
      canonicalCitySlug: canonicalCity,
    }
  }
  return null
}

export function getBranchReviewsForCity(branchSlug) {
  return BRANCH_SERVICE_REVIEWS[String(branchSlug || '').trim().toLowerCase()] || []
}

export function buildBranchServiceJsonLd(page, { hours = [], origin = PRODUCTION_ORIGIN } = {}) {
  if (!page) return null
  const base = String(origin || PRODUCTION_ORIGIN).replace(/\/$/, '')
  const cityPage = findLocalBranchPage(page.citySlug)
  const mapInfo = BRANCH_MAP_LISTINGS[page.branchSlug]
  const pageUrl = `${base}/branches/${page.citySlug}/${page.serviceSlug}`
  const hasMap = mapInfo?.cid ? `https://www.google.com/maps?cid=${mapInfo.cid}` : undefined
  const phone = branchPhone(page.branchSlug)?.href?.replace(/^tel:/, '') || MAIN_LINE.href.replace(/^tel:/, '')
  const studioId = `${base}/branches/${page.citySlug}#studio`
  const relatedCatalogItems = COMPLETE_DETAILING_CATALOG.filter((item) => item.pillarSlug === page.serviceSlug)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': page.serviceTypeSchema || 'AutomotiveBusiness',
        '@id': studioId,
        name: `Hakum Auto Care — ${page.cityName}`,
        description: page.aiSummary || page.seoDescription,
        url: `${base}/branches/${page.citySlug}`,
        telephone: phone,
        image: `${base}/og-image.png`,
        areaServed: cityPage?.corridors || [page.cityName],
        knowsAbout: page.keywords || [page.serviceLabel, page.cityName],
        address: {
          '@type': 'PostalAddress',
          addressLocality: page.shortCity,
          addressRegion: page.branchSlug === 'batangas' ? 'Batangas' : 'Cavite',
          addressCountry: 'PH',
          streetAddress: cityPage?.landmarkAddress || page.cityName,
        },
        ...(hasMap ? { hasMap } : {}),
        ...(mapInfo?.lat != null && mapInfo?.lng != null
          ? { geo: { '@type': 'GeoCoordinates', latitude: mapInfo.lat, longitude: mapInfo.lng } }
          : {}),
        ...(Array.isArray(hours) && hours.length ? { openingHoursSpecification: hours } : {}),
      },
      {
        '@type': 'Service',
        '@id': `${pageUrl}#service`,
        name: `${page.serviceLabel} in ${page.cityName}`,
        serviceType: page.serviceLabel,
        description: page.aiSummary || page.seoDescription,
        url: pageUrl,
        provider: { '@id': studioId },
        areaServed: cityPage?.corridors || [page.cityName],
        ...(relatedCatalogItems.length
          ? {
              hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: `${page.serviceLabel} Packages — ${page.cityName}`,
                itemListElement: relatedCatalogItems.map((item, idx) => ({
                  '@type': 'Offer',
                  position: idx + 1,
                  itemOffered: {
                    '@type': 'Service',
                    name: item.name,
                    description: item.summary,
                  },
                })),
              },
            }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/` },
          { '@type': 'ListItem', position: 2, name: 'Branches', item: `${base}/branches` },
          { '@type': 'ListItem', position: 3, name: page.cityName, item: `${base}/branches/${page.citySlug}` },
          { '@type': 'ListItem', position: 4, name: page.serviceLabel, item: pageUrl },
        ],
      },
      ...(Array.isArray(page.qa) && page.qa.length
        ? [
            {
              '@type': 'FAQPage',
              '@id': `${pageUrl}#faq`,
              mainEntity: page.qa.map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: { '@type': 'Answer', text: item.a },
              })),
            },
          ]
        : []),
    ],
  }
}
