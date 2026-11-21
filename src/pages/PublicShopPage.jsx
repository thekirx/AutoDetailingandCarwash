import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, MapPin, ShieldCheck, Sparkles, Star } from 'lucide-react'
import BdPageHero from '../components/public/bredesign/BdPageHero'
import useReveal from '../components/public/bredesign/useReveal'
import { PUBLIC_ROUTE_SEO } from '../lib/publicSeoCatalog'
import { usePageMeta } from '../lib/pageMeta'
import { BRANCH_MAP_LISTINGS, branchDirections, branchPhone } from '../lib/homeBranches'

const SHOP_CATEGORIES = [
  { id: 'all', label: 'All Studio Gear' },
  { id: 'wash', label: 'Wash & Shampoo' },
  { id: 'ceramic', label: 'Ceramic & PPF Care' },
  { id: 'towels', label: 'Towels & Applicators' },
  { id: 'merch', label: 'Hakum Merch & Cabin' },
]

const SHOP_CATALOG = [
  {
    id: 'sonax-gloss-shampoo',
    category: 'wash',
    brand: 'Sonax Germany',
    name: 'Sonax Concentrat pH-Neutral Car Shampoo',
    summary: 'Zero-wax, coating-safe high-lubricity snow foam and bucket shampoo safe for Kisho 9H Ceramic Coating and ClearPro PPF.',
    pointsEligible: false,
    tag: 'Wash Safe',
  },
  {
    id: 'kisho-quick-booster',
    category: 'ceramic',
    brand: 'Kisho Japan',
    name: 'SiO2 Hydrophobic Maintenance Booster',
    summary: 'Restores sharp water beading and slickness between 6-month Paint Maintenance bay visits without streaking dark clear coats.',
    pointsEligible: false,
    tag: 'Coating Care',
  },
  {
    id: 'clearpro-film-clean',
    category: 'ceramic',
    brand: 'ClearPro Aftercare',
    name: 'TPU Film & Matte Satin Surface Cleanser',
    summary: 'Leaves UltraSatin Matte and 95 GU High-Gloss PPF clean and UV-shielded without silicones or harsh petroleum distillates.',
    pointsEligible: false,
    tag: 'PPF Safe',
  },
  {
    id: 'microtex-plush-towels',
    category: 'towels',
    brand: 'Microtex / Korean Edgeless',
    name: 'High-GSM Twisted-Loop & Edgeless Microfiber Set',
    summary: 'Scratch-free ultrasonic-cut drying towels and panel-buffing cloths — separate color sets recommended for paint, glass, and wheels.',
    pointsEligible: false,
    tag: 'Zero Swirl',
  },
  {
    id: 'hakum-car-care-kit',
    category: 'merch',
    brand: 'Hakum Studio',
    name: 'Hakum Signature Car Care Kit',
    summary: 'Complete starter pack prepared for daily drivers and coated cars — available in-branch or redeemable in Customer Rewards.',
    pointsEligible: true,
    pointsCost: 50,
    tag: '50 Points Eligible',
  },
  {
    id: 'hakum-car-scent',
    category: 'merch',
    brand: 'Hakum Studio',
    name: 'Hakum Cabin Fragrance Spray',
    summary: 'Clean studio interior signature mist calibrated for fresh leather, fabric, and cabin trim without oily residue.',
    pointsEligible: true,
    pointsCost: 30,
    tag: '30 Points Eligible',
  },
  {
    id: 'air-spencer-squash',
    category: 'merch',
    brand: 'Air Spencer Japan',
    name: 'Air Spencer Authentic Cabin Canister',
    summary: 'Long-lasting Japanese solid interior freshener stocked fresh at both our Bacoor and Batangas City service counters.',
    pointsEligible: true,
    pointsCost: 30,
    tag: '30 Points Eligible',
  },
  {
    id: 'hakum-tee-keychain',
    category: 'merch',
    brand: 'Hakum Studio',
    name: 'Hakum Auto Care Tee & Studio Keychain',
    summary: 'Heavyweight studio apparel (S–2XL) and woven Hakum keychain available over the counter or via loyalty points redemption.',
    pointsEligible: true,
    pointsCost: 20,
    tag: 'From 20 Points',
  },
]

export default function PublicShopPage() {
  const [activeCategory, setActiveCategory] = useState('all')
  usePageMeta({
    title: PUBLIC_ROUTE_SEO['/shop'].title,
    description: PUBLIC_ROUTE_SEO['/shop'].description,
    path: '/shop',
  })
  useReveal()

  const items = useMemo(() => {
    if (activeCategory === 'all') return SHOP_CATALOG
    return SHOP_CATALOG.filter((item) => item.category === activeCategory)
  }, [activeCategory])

  const openPickupBranches = [
    {
      slug: 'bacoor',
      name: 'Hakum Bacoor Flagship',
      address: 'RFC Molino II, Molino Boulevard, Bacoor, Cavite',
      phone: branchPhone('bacoor'),
      directions: branchDirections(BRANCH_MAP_LISTINGS.bacoor),
    },
    {
      slug: 'batangas',
      name: 'Hakum Batangas City Studio',
      address: 'National Highway (PNP Highway), Brgy. Alangilan, Batangas City',
      phone: branchPhone('batangas'),
      directions: branchDirections(BRANCH_MAP_LISTINGS.batangas),
    },
  ]

  return (
    <>
      <BdPageHero
        eyebrow="Studio Aftercare & Merch"
        title={
          <>
            Studio-grade care,
            <br />
            <em>ready at the counter.</em>
          </>
        }
        copy="Keep ceramic coatings, ClearPro PPF, and cabin surfaces spotless between studio visits with coating-safe shampoos, plush Korean microfibers, and Hakum merch stocked in Bacoor and Batangas City."
      >
        <div className="bd-cta-row bd-page-hero-links">
          <Link className="bd-btn bd-btn-primary" to="/account/loyalty">
            Redeem Loyalty Points <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <Link className="bd-btn bd-btn-quiet" to="/branches">
            Branch Pickup Counter
          </Link>
        </div>
      </BdPageHero>

      <section aria-labelledby="shop-catalog-heading">
        <div className="bd-shell">
          <div className="bd-blog-toolbar">
            <div>
              <p className="bd-eyebrow">Curated Shelf</p>
              <h2 id="shop-catalog-heading">Certified Chemistry &amp; Hakum Gear</h2>
            </div>
            <div className="bd-blog-pills" role="tablist" aria-label="Product categories">
              {SHOP_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === cat.id}
                  className={`bd-pill${activeCategory === cat.id ? ' is-active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bd-shop-grid bd-reveal">
            {items.map((item) => (
              <article key={item.id} className="bd-shop-card">
                <div className="bd-shop-card-top">
                  <span className="bd-blog-cat">{item.brand}</span>
                  <span className="bd-shop-badge">{item.tag}</span>
                </div>
                <h3>{item.name}</h3>
                <p>{item.summary}</p>
                <div className="bd-shop-card-foot">
                  {item.pointsEligible ? (
                    <Link to="/account/loyalty" className="bd-text-link">
                      <Star size={14} aria-hidden="true" /> Redeem {item.pointsCost} pts in portal
                    </Link>
                  ) : (
                    <span className="bd-shop-stock-note">
                      <ShieldCheck size={14} aria-hidden="true" /> In-branch stock check via counter
                    </span>
                  )}
                  <Link to="/contact" className="bd-btn bd-btn-quiet">
                    Ask stock
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="bd-shop-pickup-band bd-reveal">
            <div>
              <p className="bd-eyebrow">Over-the-Counter &amp; Points Redemption</p>
              <h2>Pick up during any wash, detailing, or 6-month maintenance visit.</h2>
              <ul className="bd-shop-promises">
                <li><CheckCircle2 size={16} aria-hidden="true" /> 100% genuine sealed bottles &amp; authentic ClearPro / Kisho aftercare</li>
                <li><CheckCircle2 size={16} aria-hidden="true" /> Earned Loyalty Points redeem directly at our Bacoor &amp; Batangas POS counters</li>
                <li><Sparkles size={16} aria-hidden="true" /> Staff will match dilution ratios safely for gloss, satin PPF, or coated clear coats</li>
              </ul>
            </div>
            <div className="bd-shop-pickup-cards">
              {openPickupBranches.map((b) => (
                <div key={b.slug} className="bd-shop-pickup-card">
                  <h3>{b.name}</h3>
                  <p><MapPin size={14} aria-hidden="true" /> {b.address}</p>
                  <div className="bd-shop-pickup-actions">
                    <a href={b.phone.href} className="bd-btn bd-btn-primary">
                      Call {b.phone.display}
                    </a>
                    <a href={b.directions.google} target="_blank" rel="noreferrer noopener" className="bd-btn bd-btn-quiet">
                      Directions
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
