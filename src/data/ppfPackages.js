/* The free coatings are no longer uniform across the ladder: Basic carries the
   glass treatment only, and the wheels coating is part of what the step up to
   Ultimate buys. Kept as two named lists rather than one shared constant so the
   difference is visible in the data rather than implied by the tier. */
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

export const PPF_PACKAGES = [
  {
    id: 'basic', title: 'Basic Protection', subtitle: 'Partial PPF + Ceramic Coating',
    headline: 'The panels that take the hits.',
    shortDescription: 'Focused protection for the panels and lighting surfaces most exposed to daily wear.',
    coverageType: 'Partial PPF',
    coverageAreas: ['Hood', 'Headlights', 'Taillights', 'All four doors'],
    priceFrom: 75000,
    filmThickness: '7.5 mil TPU PPF material',
    keyEnhancements: ['Full exterior detailing', 'Paint decontamination', 'Seamless film installation', '2-layer ceramic coating on the rest of the vehicle exterior'],
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
