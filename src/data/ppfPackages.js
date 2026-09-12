/* The free coatings are no longer uniform across the ladder: the two front-end
   tiers carry the glass treatment only, and the wheels coating is part of what
   the step up to Ultimate buys. Kept as two named lists rather than one shared
   constant so the difference is visible in the data rather than implied by the
   tier. */
export const PPF_ADD_ONS_GLASS_ONLY = ['FREE Glass Ceramic Coating']
export const PPF_ADD_ONS_GLASS_AND_WHEELS = [
  'FREE Glass Ceramic Coating',
  'FREE Wheels Ceramic Coating',
]

/* Film characteristics quoted from the ClearPro specification. They are shared
   by every tier except where the tier's own entry overrides them. */
const FILM_TRAITS = [
  'Polyoptico Glossy Finish',
  'Aliphatic — non-yellowing material',
  'Invisiglue technology — leaves no glue residue on removal',
]

const COVERED_DEFECTS = ['Adhesive failure', 'Bubbling', 'Cracking', 'Delamination', 'Extreme yellowing']
const EXCLUSIONS = [
  'Minor yellowing is normal aging',
  'Film peeling caused by high-pressure washers is not covered',
  'External road event damage is not covered',
  'Final installation inspection happens after 7 days',
]
const OPERATIONAL_DISCLAIMERS = [
  'PPF is not recommended for repainted bodywork',
  'Repainted areas must be disclosed before application',
  'Complex curves and bumpers may still have minor visible seams or stretch marks',
  'Panel disassembly and edge wrapping are done only where technically feasible',
  'Free ceramic coatings are maintenance coatings and are not additional PPF layers',
  'Pricing may change for oversized or heavily modified vehicles',
]

export const PPF_FILM_BRAND = {
  name: 'ClearPro',
  url: 'https://www.clearpro.com/',
}

/* The ladder on /services/ppf reads each tier's `ladderLabel`, `coverageLine`
   and `ladderNote`. A note says what the step buys over the tier before it —
   or, where the two tiers cover different panels rather than more of them, says
   that plainly instead of claiming "everything in" the tier below. */
export const PPF_PACKAGES = [
  {
    /* Added 2026-09-12 from the owner's brief: film on the front of the car and
       ceramic coating on the rest, from ₱48,000. Film, warranty and free
       extras match Basic Protection, as Kirk directed — to be confirmed with
       Hakum before anything beyond the website depends on them. */
    id: 'high-impact', title: 'High Impact Protection', subtitle: 'Front PPF + Ceramic Coating',
    headline: 'Where the road hits first.',
    shortDescription: 'Film on the front of the car, where stone chips land, and ceramic coating on the rest.',
    coverageType: 'Front PPF',
    coverageAreas: ['Hood', 'Headlights', 'Side mirrors', 'Front bumper', 'Front fenders'],
    ladderLabel: 'Frontal defense',
    coverageLine: 'Front PPF · hood, headlights, side mirrors, front bumper, front fenders',
    ladderNote: null,
    priceFrom: 48000,
    filmThickness: '7.5 mil TPU PPF material',
    keyEnhancements: ['Full exterior detailing', 'Paint decontamination', 'Seamless film installation', '2-layer ceramic coating on the rest of the vehicle exterior'],
    filmBenefits: ['Hydrophobic coating', 'Thermal self-healing — light scratches heal under heat', ...FILM_TRAITS],
    warranty: ['7-year factory warranty'],
    replacementClause: [], freeAddOns: PPF_ADD_ONS_GLASS_ONLY, coveredDefects: COVERED_DEFECTS,
    exclusions: EXCLUSIONS, operationalDisclaimers: OPERATIONAL_DISCLAIMERS,
    recommendedLabel: null, ctaLabel: 'Book High Impact Protection',
  },
  {
    /* Full-body film since 2026-09-12, per Kirk: Basic covers the whole car, so
       the steps up to Ultimate and Platinum are the film, the warranty and the
       extras rather than the panels. With no bare panels left, the ceramic
       coating "on the rest of the vehicle" no longer applies to this tier. */
    id: 'basic', title: 'Basic Protection', subtitle: 'Full Body PPF',
    headline: 'The whole car, on essential film.',
    shortDescription: 'Full-body protection on 7.5 mil film with a 7-year warranty.',
    coverageType: 'Full Body PPF',
    coverageAreas: ['Full exterior', 'Trims', 'Hood', 'Front bumper', 'Rear bumper', 'Headlights', 'Taillights', 'Side mirrors', 'Fenders', 'All four doors', 'Roof', 'Trunk', 'Quarter panels'],
    ladderLabel: 'Essential',
    coverageLine: 'Full body PPF · every painted panel and trims',
    ladderNote: {
      label: 'Over High Impact',
      text: 'The whole car instead of the front only',
      tone: 'step',
    },
    priceFrom: 75000,
    filmThickness: '7.5 mil TPU PPF material',
    keyEnhancements: ['Full exterior detailing', 'Paint decontamination', 'Seamless film installation'],
    filmBenefits: ['Hydrophobic coating', 'Thermal self-healing — light scratches heal under heat', ...FILM_TRAITS],
    warranty: ['7-year factory warranty'],
    replacementClause: [], freeAddOns: PPF_ADD_ONS_GLASS_ONLY, coveredDefects: COVERED_DEFECTS,
    exclusions: EXCLUSIONS, operationalDisclaimers: OPERATIONAL_DISCLAIMERS,
    recommendedLabel: null, ctaLabel: 'Book Basic Protection',
  },
  {
    id: 'ultimate', title: 'Ultimate Protection', subtitle: 'Full Body PPF',
    headline: 'Every painted panel, covered.',
    shortDescription: 'Complete, virtually invisible protection across the exterior and trims.',
    coverageType: 'Full Body PPF',
    coverageAreas: ['Full exterior', 'Trims', 'Hood', 'Front bumper', 'Rear bumper', 'Headlights', 'Taillights', 'Side mirrors', 'Fenders', 'All four doors', 'Roof', 'Trunk', 'Quarter panels'],
    ladderLabel: 'Hakum recommends',
    coverageLine: 'Full body PPF · thicker film and panel replacement',
    ladderNote: {
      label: 'Over Basic',
      text: 'Thicker film · +3 years warranty · faster self-healing · super hydrophobic · panel replacement · wheels coating',
      tone: 'step',
    },
    priceFrom: 94000,
    filmThickness: '8 mil TPU PPF material',
    keyEnhancements: ['Full exterior detailing', 'Paint decontamination'],
    filmBenefits: ['Super hydrophobic coating', 'Fast self-healing — light scratches heal under heat', ...FILM_TRAITS],
    warranty: ['10-year factory warranty'],
    replacementClause: ['2-panel PPF replacement shop warranty', 'No-questions-asked coverage applies to damaged film only'],
    freeAddOns: PPF_ADD_ONS_GLASS_AND_WHEELS, coveredDefects: COVERED_DEFECTS, exclusions: EXCLUSIONS,
    operationalDisclaimers: OPERATIONAL_DISCLAIMERS, recommendedLabel: 'Most Popular', isHighlighted: true,
    ctaLabel: 'Book Ultimate Protection',
  },
  {
    id: 'platinum', title: 'Platinum Protection', subtitle: 'Full Body PPF with Heavier Defense',
    headline: 'Nothing left exposed.',
    shortDescription: 'Maximum full-body coverage with thicker film for stronger high-impact defense.',
    coverageType: 'Full Body PPF',
    coverageAreas: ['Full exterior', 'Trims', 'Hood', 'Front bumper', 'Rear bumper', 'Headlights', 'Taillights', 'Side mirrors', 'Fenders', 'All four doors', 'Roof', 'Trunk', 'Quarter panels', 'Rocker panels', 'Additional high-impact areas where applicable'],
    ladderLabel: 'Maximum defense',
    coverageLine: 'Full body PPF + rocker panels & high-impact areas',
    ladderNote: {
      label: 'Over Ultimate',
      text: 'Thickest film · rocker panels & extra high-impact areas · +2 years warranty · 3 panels replaced',
      tone: 'step',
    },
    priceFrom: 130000,
    filmThickness: '8.5 mil TPU PPF material',
    keyEnhancements: ['Full exterior detailing', 'Paint decontamination', 'Heavier defense across high-impact areas'],
    filmBenefits: ['Super hydrophobic coating', 'Fast self-healing — light scratches heal under heat', ...FILM_TRAITS],
    warranty: ['12-year factory warranty'],
    replacementClause: ['3-panel PPF replacement shop warranty'], freeAddOns: PPF_ADD_ONS_GLASS_AND_WHEELS,
    coveredDefects: COVERED_DEFECTS, exclusions: EXCLUSIONS,
    operationalDisclaimers: OPERATIONAL_DISCLAIMERS, recommendedLabel: 'Maximum Defense',
    ctaLabel: 'Book Platinum Protection',
  },
]
