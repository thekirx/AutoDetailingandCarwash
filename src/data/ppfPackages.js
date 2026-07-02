const FREE_ADD_ONS = [
  'FREE Ceramic Coating across all painted areas and black trims',
  'FREE Glass Ceramic Coating treatment',
  'FREE Mag Wheels Ceramic Coating treatment',
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

export const PPF_PACKAGES = [
  {
    id: 'basic', title: 'Basic Protection', subtitle: 'Partial PPF + Ceramic Coating',
    shortDescription: 'Focused protection for the panels and lighting surfaces most exposed to daily wear.',
    coverageType: 'Partial PPF',
    coverageAreas: ['Hood', 'Headlights', 'Taillights', 'All four doors'],
    filmThickness: '7.5 mil premium-grade PPF',
    keyEnhancements: ['Full exterior detailing', 'Paint decontamination', 'Seamless film installation', '2-layer ceramic coating on the rest of the vehicle exterior'],
    filmBenefits: ['Self-healing technology', 'Advanced hydrophobic effect'],
    warranty: ['5-year PPF warranty for manufacturer defects only'],
    replacementClause: [], freeAddOns: FREE_ADD_ONS, coveredDefects: COVERED_DEFECTS,
    exclusions: EXCLUSIONS, operationalDisclaimers: OPERATIONAL_DISCLAIMERS,
    recommendedLabel: null, ctaLabel: 'Book Basic Protection',
  },
  {
    id: 'premium', title: 'Premium Protection', subtitle: 'Full Body PPF',
    shortDescription: 'Complete, virtually invisible protection across the exterior and trims.',
    coverageType: 'Full Body PPF',
    coverageAreas: ['Full exterior', 'Trims', 'Hood', 'Front bumper', 'Rear bumper', 'Headlights', 'Taillights', 'Side mirrors', 'Fenders', 'All four doors', 'Roof', 'Trunk', 'Quarter panels'],
    filmThickness: '7.5 mil premium-grade PPF',
    keyEnhancements: ['Full exterior detailing', 'Paint decontamination'],
    filmBenefits: ['Self-healing technology', 'Advanced hydrophobic properties', 'Seamless installation finish'],
    warranty: ['5-year manufacturer defect warranty'],
    replacementClause: ['2-panel replacement for damaged film only', 'No-questions-asked coverage applies to damaged film only'],
    freeAddOns: FREE_ADD_ONS, coveredDefects: COVERED_DEFECTS, exclusions: EXCLUSIONS,
    operationalDisclaimers: OPERATIONAL_DISCLAIMERS, recommendedLabel: 'Most Popular',
    ctaLabel: 'Book Premium Protection',
  },
  {
    id: 'platinum', title: 'Platinum Protection', subtitle: 'Full Body PPF with Heavier Defense',
    shortDescription: 'Maximum full-body coverage with thicker film for stronger high-impact defense.',
    coverageType: 'Full Body PPF',
    coverageAreas: ['Full exterior', 'Trims', 'Hood', 'Front bumper', 'Rear bumper', 'Headlights', 'Taillights', 'Side mirrors', 'Fenders', 'All four doors', 'Roof', 'Trunk', 'Quarter panels', 'Rocker panels', 'Additional high-impact areas where applicable'],
    filmThickness: '8.5 mil premium-grade PPF',
    keyEnhancements: ['Full exterior detailing', 'Paint decontamination', 'Heavier defense across high-impact areas'],
    filmBenefits: ['Self-healing technology', 'High-tier hydrophobic effect', 'Seamless application'],
    warranty: ['8-year manufacturer defect warranty'],
    replacementClause: ['4-panel replacement for damaged film'], freeAddOns: FREE_ADD_ONS,
    coveredDefects: COVERED_DEFECTS, exclusions: EXCLUSIONS,
    operationalDisclaimers: OPERATIONAL_DISCLAIMERS, recommendedLabel: 'Maximum Defense',
    ctaLabel: 'Book Platinum Protection',
  },
]
