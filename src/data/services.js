import { Car, Armchair, Sun, ShieldCheck, ScanLine, Gauge, Layers3, MapPin } from 'lucide-react'

export const services = [
  { name: 'Carwash', description: 'A meticulous exterior reset with a spotless, gloss-forward finish.', icon: Car },
  { name: 'Interior Detailing', description: 'Deep cleaning and restoration for every surface inside your cabin.', icon: Armchair },
  { name: 'Ceramic Tint', description: 'Advanced heat rejection and UV protection without losing clarity.', icon: Sun },
  { name: 'Ceramic Coating', description: 'Long-lasting gloss and hydrophobic paint protection for your vehicle.', icon: ShieldCheck },
  { name: 'Glass Detailing', description: 'Crystal-clear glass treatment for safer driving in all conditions.', icon: ScanLine },
  { name: 'Engine Wash', description: 'Careful degreasing that makes the heart of your car look its best.', icon: Gauge },
  { name: 'PPF', description: 'Nearly invisible film protection against chips, scratches, and road debris.', icon: Layers3 },
  { name: 'Mobile Detailing', description: 'Signature Hakum care, delivered straight to your driveway.', icon: MapPin },
]

export const pricing = {
  'Ceramic Coating': [
    { name: 'Classic', price: '₱8,500', note: '1-year protection', features: ['Exterior wash & decontamination', 'Single-stage paint correction', '1-layer ceramic coating'] },
    { name: 'Premium', price: '₱15,900', oldPrice: '₱22,700', note: '3-year protection', featured: true, features: ['Full paint correction', '2-layer ceramic coating', 'Glass & wheel coating'] },
    { name: 'Platinum', price: '₱27,500', note: '5-year protection', features: ['Multi-stage paint correction', 'Premium 3-layer coating', 'Complete exterior protection'] },
  ],
  PPF: [
    { name: 'Basic', price: '₱18,500', note: 'High-impact areas', features: ['Front bumper', 'Side mirrors', 'Door cups & edges'] },
    { name: 'Premium', price: '₱42,000', oldPrice: '₱60,000', note: 'Full front protection', featured: true, features: ['Full hood & front bumper', 'Fenders & side mirrors', '10-year film warranty'] },
    { name: 'Platinum', price: '₱145,000', note: 'Full body protection', features: ['Complete body coverage', 'Self-healing premium film', '10-year film warranty'] },
  ],
}
