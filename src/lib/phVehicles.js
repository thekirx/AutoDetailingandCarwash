/**
 * Common PH passenger/light commercial brands + models (Hakum floor autocomplete).
 * ponytail: static catalog — no API; extend this map when a brand shows up often.
 */
export const PH_VEHICLE_CATALOG = {
  Toyota: ['Vios', 'Wigo', 'Raize', 'Yaris Cross', 'Corolla Altis', 'Corolla Cross', 'Camry', 'Innova', 'Fortuner', 'Rush', 'Avanza', 'Veloz', 'Hilux', 'Land Cruiser', 'Land Cruiser Prado', 'Hiace', 'Lite Ace', 'Alphard', 'Granvia'],
  Mitsubishi: ['Mirage', 'Mirage G4', 'Xpander', 'Xpander Cross', 'Montero Sport', 'Pajero', 'Strada', 'L300', 'Outlander', 'Eclipse Cross', 'ASX'],
  Honda: ['Brio', 'City', 'Civic', 'HR-V', 'BR-V', 'CR-V', 'WR-V', 'Accord', 'Mobilio', 'Jazz', 'Pilot'],
  Nissan: ['Almera', 'Kicks', 'Terra', 'Navara', 'Patrol', 'Urvan', 'Livina', 'Juke', 'X-Trail', 'GT-R'],
  Hyundai: ['Accent', 'Reina', 'i10', 'i20', 'Venue', 'Creta', 'Tucson', 'Santa Fe', 'Stargazer', 'Staria', 'Palisade', 'Kona', 'Ioniq 5', 'Ioniq 6', 'H100'],
  Ford: ['Ranger', 'Everest', 'Territory', 'Explorer', 'Mustang', 'Transit', 'Bronco', 'EcoSport'],
  Suzuki: ['Swift', 'Dzire', 'Ertiga', 'XL7', 'Jimny', 'S-Presso', 'Celerio', 'Vitara', 'Carry', 'APV', 'Raider', 'Smash', 'Burgman'],
  Kia: ['Soluto', 'Rio', 'Seltos', 'Sportage', 'Sorento', 'Carnival', 'Picanto', 'Stonic', 'EV6', 'EV9'],
  Mazda: ['Mazda2', 'Mazda3', 'CX-3', 'CX-30', 'CX-5', 'CX-60', 'CX-8', 'CX-9', 'BT-50', 'MX-5'],
  Isuzu: ['D-Max', 'mu-X', 'Traviz', 'N-Series', 'F-Series'],
  Chevrolet: ['Spark', 'Sail', 'Trailblazer', 'Colorado', 'Suburban', 'Tahoe', 'Captiva'],
  MG: ['MG5', 'ZS', 'HS', 'RX5', 'GT', 'One', 'Cyberster', 'G50', 'V80'],
  Geely: ['Coolray', 'Okavango', 'Emgrand', 'GX3 Pro', 'Azkarra', 'Geometry C'],
  BYD: ['Atto 3', 'Seal', 'Sealion 6', 'Dolphin', 'Tang', 'Han', 'Shark', 'M6', 'eMAX 7'],
  Chery: ['Tiggo 2 Pro', 'Tiggo 4 Pro', 'Tiggo 5x', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'Arrizo 5', 'Omoda 5'],
  Subaru: ['Impreza', 'Legacy', 'Outback', 'Forester', 'XV', 'Crosstrek', 'WRX', 'BRZ', 'Ascent'],
  Volkswagen: ['Polo', 'Golf', 'Jetta', 'Tiguan', 'Teramont', 'T-Cross', 'Lamando'],
  BMW: ['1 Series', '2 Series', '3 Series', '5 Series', 'X1', 'X3', 'X5', 'X7', 'iX', 'i4'],
  'Mercedes-Benz': ['A-Class', 'C-Class', 'E-Class', 'S-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'V-Class'],
  Audi: ['A3', 'A4', 'A6', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron'],
  Lexus: ['IS', 'ES', 'LS', 'NX', 'RX', 'UX', 'LX', 'LM'],
  Peugeot: ['2008', '3008', '5008', 'Landtrek', 'Expert', 'Traveller'],
  Foton: ['Toplander', 'Thunder', 'View', 'Transvan', 'Gratour'],
  Hino: ['300 Series', '500 Series', 'Dutro'],
  GAC: ['GS3', 'GS4', 'Emzoom', 'Emkoo', 'M8'],
  Jetour: ['Dashing', 'X70', 'X70 Plus', 'X90 Plus', 'T2'],
  GWM: ['Cannon', 'Haval H6', 'Haval Jolion', 'Tank 300', 'Ora Good Cat'],
  Maxus: ['G10', 'G50', 'D60', 'T60', 'Deliver 9'],
  'Great Wall': ['Cannon', 'Poer', 'Wingle'],
  Changan: ['Alsvin', 'CS15', 'CS35 Plus', 'CS55 Plus', 'UNI-T', 'UNI-V'],
  Dongfeng: ['Rich', 'AX7', 'Glory', 'Captain'],
  Yamaha: ['NMAX', 'Aerox', 'Mio', 'Sniper', 'MT-15', 'R15', 'XSR155'],
  Kawasaki: ['Barako', 'Rouser', 'Ninja 400', 'Z400', 'KLX'],
}

export const PH_VEHICLE_MAKES = Object.keys(PH_VEHICLE_CATALOG).sort((a, b) => a.localeCompare(b))

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
