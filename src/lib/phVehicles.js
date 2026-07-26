/**
 * PH passenger / LCV / MPV / pickup models commonly sold or still on the road
 * from the 1990s through present (CAMPI-era + legacy icons).
 * Used by floor autocomplete; Super Admin vehicle_catalog prefers DB when seeded.
 */
export const PH_VEHICLE_CATALOG = {
  Toyota: [
    'Vios', 'Wigo', 'Raize', 'Yaris', 'Yaris Cross', 'Corolla', 'Corolla Altis', 'Corolla Cross',
    'Camry', 'Innova', 'Fortuner', 'Rush', 'Avanza', 'Veloz', 'Hilux', 'Land Cruiser', 'Land Cruiser Prado',
    'Hiace', 'Lite Ace', 'Commuter', 'Grandia', 'Alphard', 'Granvia', 'Rav4', 'C-HR', 'bZ4X',
    'Tamaraw FX', 'Revo', 'Tamaraw', 'Corona', 'Soluna', 'Echo', 'Wish', 'Previa', 'Sienna',
    '86', 'GR86', 'Supra', 'Prius', 'Crown', 'Coaster',
  ],
  Mitsubishi: [
    'Mirage', 'Mirage G4', 'Xpander', 'Xpander Cross', 'Montero Sport', 'Pajero', 'Pajero Sport',
    'Strada', 'L300', 'Adventure', 'Lancer', 'Lancer Evolution', 'Galant', 'Space Wagon',
    'Outlander', 'Eclipse Cross', 'ASX', 'Triton', 'Delica', 'Attrage', 'Fuzion',
  ],
  Honda: [
    'Brio', 'City', 'Civic', 'Civic Type R', 'HR-V', 'BR-V', 'CR-V', 'WR-V', 'Accord',
    'Mobilio', 'Jazz', 'Fit', 'Pilot', 'Odyssey', 'Pilot Hybrid', 'City Hatchback', 'CR-Z', 'Insight',
  ],
  Nissan: [
    'Almera', 'Kicks', 'Terra', 'Navara', 'Patrol', 'Urvan', 'Livina', 'Juke', 'X-Trail',
    'Sentra', 'Cefiro', 'Primera', 'Sunny', 'Frontier', 'Patrol Royale', 'GT-R', 'Leaf', 'Sylphy',
  ],
  Hyundai: [
    'Accent', 'Reina', 'i10', 'i20', 'Getz', 'Eon', 'Venue', 'Creta', 'Tucson', 'Santa Fe',
    'Stargazer', 'Stargazer X', 'Staria', 'Palisade', 'Kona', 'Elantra', 'Sonata',
    'Ioniq 5', 'Ioniq 6', 'H100', 'H-1', 'Grand Starex', 'Porter',
  ],
  Ford: [
    'Ranger', 'Everest', 'Territory', 'Explorer', 'Mustang', 'Transit', 'Bronco', 'EcoSport',
    'Escape', 'Focus', 'Fiesta', 'Laser', 'Lynx', 'Ranger Raptor', 'Expedition', 'F-150',
  ],
  Suzuki: [
    'Swift', 'Dzire', 'Ertiga', 'XL7', 'Jimny', 'S-Presso', 'Celerio', 'Vitara', 'Grand Vitara',
    'Carry', 'APV', 'Alto', 'Wagon R', 'Kizashi', 'SX4', 'Baleno', 'Ignis', 'S-Cross',
  ],
  Kia: [
    'Soluto', 'Rio', 'Seltos', 'Sportage', 'Sorento', 'Carnival', 'Picanto', 'Stonic',
    'Pride', 'Spectra', 'Carens', 'Soul', 'Forte', 'K5', 'EV6', 'EV9', 'Besta', 'Pregio',
  ],
  Mazda: [
    'Mazda2', 'Mazda3', 'CX-3', 'CX-30', 'CX-5', 'CX-60', 'CX-8', 'CX-9', 'BT-50', 'MX-5',
    'Mazda6', 'Familia', '323', '626', 'Premacy', 'MPV', 'CX-7', 'RX-8',
  ],
  Isuzu: [
    'D-Max', 'mu-X', 'Traviz', 'Crosswind', 'Hi-Lander', 'Trooper', 'Panther',
    'N-Series', 'F-Series', 'Elf', 'NPR',
  ],
  Chevrolet: [
    'Spark', 'Sail', 'Trailblazer', 'Colorado', 'Suburban', 'Tahoe', 'Captiva',
    'Aveo', 'Optra', 'Cruze', 'Orlando', 'Spin', 'Tavera', 'Blazer',
  ],
  MG: ['MG5', 'ZS', 'HS', 'RX5', 'GT', 'One', 'Cyberster', 'G50', 'V80', '3', '6', 'RX8'],
  Geely: ['Coolray', 'Okavango', 'Emgrand', 'GX3 Pro', 'Azkarra', 'Geometry C', 'Preface', 'Monjaro'],
  BYD: ['Atto 3', 'Seal', 'Sealion 6', 'Sealion 7', 'Dolphin', 'Tang', 'Han', 'Shark', 'M6', 'eMAX 7', 'Seal U'],
  Chery: [
    'Tiggo 2 Pro', 'Tiggo 4 Pro', 'Tiggo 5x', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'Arrizo 5',
    'Omoda 5', 'Omoda E5', 'Jaecoo J7', 'QQ',
  ],
  Subaru: ['Impreza', 'Legacy', 'Outback', 'Forester', 'XV', 'Crosstrek', 'WRX', 'BRZ', 'Ascent', 'Levorg'],
  Volkswagen: ['Polo', 'Golf', 'Jetta', 'Tiguan', 'Teramont', 'T-Cross', 'Passat', 'Touareg', 'Multivan'],
  BMW: ['1 Series', '2 Series', '3 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X6', 'X7', 'iX', 'i4', 'iX3'],
  'Mercedes-Benz': [
    'A-Class', 'C-Class', 'E-Class', 'S-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'V-Class', 'G-Class', 'CLA',
  ],
  Audi: ['A3', 'A4', 'A6', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron', 'A5', 'TT'],
  Lexus: ['IS', 'ES', 'LS', 'NX', 'RX', 'UX', 'LX', 'LM', 'GX', 'RC'],
  Peugeot: ['2008', '3008', '5008', 'Landtrek', 'Expert', 'Traveller', '208', '308'],
  Foton: ['Toplander', 'Thunder', 'View', 'Transvan', 'Gratour', 'Tornado', 'Sauvana'],
  Hino: ['300 Series', '500 Series', 'Dutro', 'Ranger'],
  GAC: ['GS3', 'GS4', 'Emzoom', 'Emkoo', 'M8', 'GN8', 'Aion Y', 'Aion V'],
  Jetour: ['Dashing', 'X70', 'X70 Plus', 'X90 Plus', 'T2', 'Dashing i-DM'],
  GWM: ['Cannon', 'Haval H6', 'Haval Jolion', 'Tank 300', 'Ora Good Cat', 'Poer', 'Wey'],
  'Great Wall': ['Cannon', 'Poer', 'Wingle', 'Steed'],
  Changan: ['Alsvin', 'CS15', 'CS35 Plus', 'CS55 Plus', 'UNI-T', 'UNI-V', 'Hunter', 'Nevo A05'],
  Dongfeng: ['Rich', 'AX7', 'Glory', 'Captain', 'Mango', 'Nammi 01'],
  Tesla: ['Model 3', 'Model Y', 'Model S', 'Model X'],
  Volvo: ['XC40', 'XC60', 'XC90', 'S60', 'S90', 'C40', 'EX30', 'EX90'],
  Jeep: ['Wrangler', 'Gladiator', 'Cherokee', 'Grand Cherokee', 'Compass', 'Renegade'],
  Porsche: ['911', 'Cayenne', 'Macan', 'Panamera', 'Taycan', '718'],
  SsangYong: ['Musso', 'Rexton', 'Tivoli', 'Korando', 'Actyon'],
  Daihatsu: ['Terios', 'Xenia', 'Gran Max', 'Hijet', 'Rocky'],
  Proton: ['Saga', 'Persona', 'X50', 'X70', 'Exora', 'Waja'],
  Ssangyong: ['Musso Grand', 'Rexton Sports'],
  Fuso: ['Canter', 'Fighter', 'Rosa'],
  Maxus: ['G10', 'G50', 'D60', 'T60', 'Deliver 9', 'Mifa 9'],
  BAIC: ['X55', 'BJ40', 'EU5', 'Beijing X7'],
  Wuling: ['Almaz', 'Cortez', 'Confero', 'Air Ev', 'Binguo Ev', 'Mini Ev'],
  VinFast: ['VF 5', 'VF 6', 'VF 7', 'VF 8', 'VF 9', 'VF e34'],
  DFSK: ['Glory 580', 'Glory i-Auto', 'Gelora', 'C37', 'Super Cab'],
  JAC: ['T8', 'JS4', 'X200', 'Sunray'],
  Mahindra: ['XUV300', 'XUV500', 'Scorpio', 'Bolero', 'Thar', 'KUV100'],
  Haima: ['M3', 'S5', '7X', '8S'],
  Opel: ['Astra', 'Corsa', 'Zafira', 'Vectra'],
  Chrysler: ['300C', 'PT Cruiser', 'Voyager', 'Grand Voyager'],
  Dodge: ['Journey', 'Durango', 'Challenger', 'Ram'],
  // ponytail: 2W brands kept — wash/detail shops see bikes on floor; ceiling = not a full LTO registry
  Yamaha: ['NMAX', 'Aerox', 'Mio', 'Sniper', 'MT-15', 'R15', 'XSR155', 'Mio i 125'],
  Kawasaki: ['Barako', 'Rouser', 'Ninja 400', 'Z400', 'KLX', 'CT100'],
}

export const PH_VEHICLE_MAKES = Object.keys(PH_VEHICLE_CATALOG).sort((a, b) => a.localeCompare(b))

/** Flatten catalog to {make, model, sort_order}[] for DB seed. */
export function flattenVehicleCatalog(catalog = PH_VEHICLE_CATALOG) {
  const rows = []
  for (const make of Object.keys(catalog).sort((a, b) => a.localeCompare(b))) {
    const models = catalog[make] || []
    models.forEach((model, sort_order) => {
      rows.push({ make, model: String(model).trim(), sort_order })
    })
  }
  return rows.filter((r) => r.make && r.model)
}

export function filterVehicleMakes(query, limit = 12) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return PH_VEHICLE_MAKES.slice(0, limit)
  return PH_VEHICLE_MAKES.filter((m) => m.toLowerCase().includes(q)).slice(0, limit)
}

export function modelsForMake(make) {
  if (!make) return []
  const key = PH_VEHICLE_MAKES.find((m) => m.toLowerCase() === String(make).trim().toLowerCase())
  return key ? PH_VEHICLE_CATALOG[key] : []
}

export function filterVehicleModels(make, query, limit = 12) {
  const models = modelsForMake(make)
  const q = String(query || '').trim().toLowerCase()
  if (!q) return models.slice(0, limit)
  return models.filter((m) => m.toLowerCase().includes(q)).slice(0, limit)
}

/** Split "Juan Dela Cruz" → first / last for form autofill. */
export function splitCustomerName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return { first: '', last: '' }
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}
