import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, Coffee, MapPin, ShieldCheck, Sparkles, Star, X } from 'lucide-react'
import FormLegalNotice from '../components/FormLegalNotice'
import BdPageHero from '../components/public/bredesign/BdPageHero'
import useReveal from '../components/public/bredesign/useReveal'
import { PUBLIC_ROUTE_SEO } from '../lib/publicSeoCatalog'
import { usePageMeta } from '../lib/pageMeta'
import { BRANCH_MAP_LISTINGS, branchDirections, branchPhone } from '../lib/homeBranches'
import { submitPublicInquiry } from '../lib/publicInquiryApi'
import { supabase } from '../lib/supabase'

const SHOP_CATEGORIES = [
  { id: 'all', label: 'All Studio Gear' },
  { id: 'merch', label: 'Merch & Gear' },
  { id: 'care', label: 'Studio Care' },
  { id: 'coffee', label: 'Coffee Lounge' },
]

const CURATED_STUDIO_CARE = [
  {
    id: 'sonax-gloss-shampoo',
    category: 'care',
    brand: 'Sonax Germany',
    name: 'Sonax Concentrat pH-Neutral Car Shampoo',
    summary: 'Zero-wax, coating-safe high-lubricity snow foam and bucket shampoo safe for Kisho 9H Ceramic Coating and ClearPro PPF.',
    pointsPrice: null,
    priceMinor: null,
    sizes: [],
    bacoorInStock: true,
    batangasInStock: true,
    tag: 'Wash Safe',
  },
  {
    id: 'kisho-quick-booster',
    category: 'care',
    brand: 'Kisho Japan',
    name: 'SiO2 Hydrophobic Maintenance Booster',
    summary: 'Restores sharp water beading and slickness between 6-month Paint Maintenance bay visits without streaking dark clear coats.',
    pointsPrice: null,
    priceMinor: null,
    sizes: [],
    bacoorInStock: true,
    batangasInStock: true,
    tag: 'Coating Care',
  },
  {
    id: 'clearpro-film-clean',
    category: 'care',
    brand: 'ClearPro Aftercare',
    name: 'TPU Film & Matte Satin Surface Cleanser',
    summary: 'Leaves UltraSatin Matte and 95 GU High-Gloss PPF clean and UV-shielded without silicones or harsh petroleum distillates.',
    pointsPrice: null,
    priceMinor: null,
    sizes: [],
    bacoorInStock: true,
    batangasInStock: true,
    tag: 'PPF Safe',
  },
  {
    id: 'microtex-plush-towels',
    category: 'care',
    brand: 'Microtex / Korean Edgeless',
    name: 'High-GSM Twisted-Loop & Edgeless Microfiber Set',
    summary: 'Scratch-free ultrasonic-cut drying towels and panel-buffing cloths — separate color sets recommended for paint, glass, and wheels.',
    pointsPrice: null,
    priceMinor: null,
    sizes: [],
    bacoorInStock: true,
    batangasInStock: true,
    tag: 'Zero Swirl',
  },
]

function formatPhp(minor) {
  const value = Number(minor) || 0
  if (value <= 0) return null
  return `₱${(value / 100).toLocaleString('en-PH', { minimumFractionDigits: value % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
}

function mapLiveCatalogRow(row) {
  const cat = String(row.category || '').toLowerCase() === 'coffee' ? 'coffee' : 'merch'
  const pointsPrice = Number(row.points_price) > 0 ? Number(row.points_price) : null
  const priceMinor = Number(row.price_minor) > 0 ? Number(row.price_minor) : null
  const sizes = Array.isArray(row.size_options)
    ? row.size_options.map((s) => s?.label).filter(Boolean)
    : []
  return {
    id: row.id,
    category: cat,
    brand: cat === 'coffee' ? 'Hakum Lounge' : 'Hakum Studio',
    name: row.name,
    summary: row.description || 'Stocked at Hakum Auto Care studio counters for walk-in pickup or loyalty points redemption.',
    priceMinor,
    pointsPrice,
    sizes,
    bacoorInStock: Boolean(row.bacoor_in_stock),
    batangasInStock: Boolean(row.batangas_in_stock),
    tag: pointsPrice ? `${pointsPrice} pts` : cat === 'coffee' ? 'In-Lounge Menu' : 'Counter Gear',
  }
}

export default function PublicShopPage() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [liveRows, setLiveRows] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [formState, setFormState] = useState({
    branch: 'bacoor',
    name: '',
    phone: '',
    email: '',
    note: '',
    company_website: '',
  })
  const [submitBusy, setSubmitBusy] = useState(false)
  const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' })
  const openedAtRef = useRef(Date.now())

  usePageMeta({
    title: PUBLIC_ROUTE_SEO['/shop'].title,
    description: PUBLIC_ROUTE_SEO['/shop'].description,
    path: '/shop',
  })
  useReveal()

  useEffect(() => {
    let active = true
    supabase
      .rpc('get_public_shop_catalog')
      .then(({ data, error }) => {
        if (!active || error || !Array.isArray(data)) return
        setLiveRows(data.map(mapLiveCatalogRow))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedItem) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !submitBusy) setSelectedItem(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedItem, submitBusy])

  const allItems = useMemo(() => [...liveRows, ...CURATED_STUDIO_CARE], [liveRows])

  const items = useMemo(() => {
    if (activeCategory === 'all') return allItems
    return allItems.filter((item) => item.category === activeCategory)
  }, [activeCategory, allItems])

  function openInquiryModal(item) {
    openedAtRef.current = Date.now()
    setSubmitStatus({ type: '', message: '' })
    setSelectedItem(item)
    setFormState((prev) => ({
      ...prev,
      branch: item.bacoorInStock ? 'bacoor' : item.batangasInStock ? 'batangas' : prev.branch,
      note: '',
      company_website: '',
    }))
  }

  async function handleSubmitInquiry(event) {
    event.preventDefault()
    if (!selectedItem || submitBusy) return
    setSubmitBusy(true)
    setSubmitStatus({ type: '', message: '' })
    const res = await submitPublicInquiry(
      'shop_inquiry',
      {
        productName: selectedItem.name,
        branch: formState.branch,
        name: formState.name,
        phone: formState.phone,
        email: formState.email,
        note: formState.note,
      },
      {
        openedAt: openedAtRef.current,
        honeypot: formState.company_website,
      },
    )
    setSubmitBusy(false)
    if (!res.ok) {
      setSubmitStatus({ type: 'error', message: res.error })
      return
    }
    setSubmitStatus({
      type: 'success',
      message: `Inquiry sent for ${selectedItem.name}. Our ${formState.branch === 'batangas' ? 'Batangas City' : 'Bacoor'} counter will confirm stock shortly.`,
    })
  }

  const openPickupBranches = [
    {
      slug: 'bacoor',
      name: 'Hakum Bacoor Flagship',
      address: 'RFC Molino II, Molino Boulevard, Bacoor, Cavite',
      phone: branchPhone('bacoor'),
      directions: branchDirections({ slug: 'bacoor', ...BRANCH_MAP_LISTINGS.bacoor }),
    },
    {
      slug: 'batangas',
      name: 'Hakum Batangas City Studio',
      address: 'National Highway (PNP Highway), Brgy. Alangilan, Batangas City',
      phone: branchPhone('batangas'),
      directions: branchDirections({ slug: 'batangas', ...BRANCH_MAP_LISTINGS.batangas }),
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
        copy="Keep ceramic coatings, ClearPro PPF, and cabin surfaces spotless between studio visits with live counter merch, lounge coffee, and coating-safe chemistry stocked in Bacoor and Batangas City."
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
              <h2 id="shop-catalog-heading">Counter Stock, Chemistry &amp; Hakum Gear</h2>
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
            {items.map((item) => {
              const priceText = formatPhp(item.priceMinor)
              return (
                <article key={item.id} className="bd-shop-card">
                  <div>
                    <div className="bd-shop-card-top">
                      <span className="bd-blog-cat">{item.brand}</span>
                      <span className="bd-shop-badge">
                        {item.category === 'coffee' ? <Coffee size={11} aria-hidden="true" /> : null}
                        {item.tag}
                      </span>
                    </div>
                    <h3>{item.name}</h3>
                    <p>{item.summary}</p>
                  </div>

                  <div>
                    {priceText || item.sizes.length ? (
                      <div className="bd-shop-price-row">
                        {priceText ? <span className="bd-shop-price">{priceText}</span> : <span className="bd-shop-sizes">Points reward</span>}
                        {item.sizes.length ? <span className="bd-shop-sizes">{item.sizes.join(' · ')}</span> : null}
                      </div>
                    ) : null}

                    <div className="bd-shop-stock-pills" aria-label="Branch availability">
                      <span className={`bd-shop-stock-pill${item.bacoorInStock ? '' : ' is-muted'}`}>
                        Bacoor: {item.bacoorInStock ? 'In stock' : 'Ask branch'}
                      </span>
                      <span className={`bd-shop-stock-pill${item.batangasInStock ? '' : ' is-muted'}`}>
                        Batangas: {item.batangasInStock ? 'In stock' : 'Ask branch'}
                      </span>
                    </div>

                    <div className="bd-shop-card-foot">
                      {item.pointsPrice ? (
                        <Link to="/account/loyalty" className="bd-text-link">
                          <Star size={14} aria-hidden="true" /> {item.pointsPrice} pts in portal
                        </Link>
                      ) : (
                        <span className="bd-shop-stock-note">
                          <ShieldCheck size={14} aria-hidden="true" /> Counter pickup
                        </span>
                      )}
                      <button type="button" className="bd-btn bd-btn-quiet" onClick={() => openInquiryModal(item)}>
                        Reserve / Ask Stock
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
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
                    {b.phone ? (
                      <a href={b.phone.href} className="bd-btn bd-btn-primary">
                        Call {b.phone.display}
                      </a>
                    ) : null}
                    {b.directions?.google ? (
                      <a href={b.directions.google} target="_blank" rel="noreferrer noopener" className="bd-btn bd-btn-quiet">
                        Directions
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {selectedItem ? (
        <div
          className="bd-shop-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitBusy) setSelectedItem(null)
          }}
        >
          <div className="bd-shop-modal" role="dialog" aria-modal="true" aria-labelledby="shop-modal-title">
            <div className="bd-shop-modal-head">
              <div>
                <p className="bd-eyebrow">Branch Counter Reservation</p>
                <h2 id="shop-modal-title">{selectedItem.name}</h2>
              </div>
              <button
                type="button"
                className="bd-shop-modal-close"
                aria-label="Close modal"
                onClick={() => !submitBusy && setSelectedItem(null)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form className="bd-shop-modal-form" onSubmit={handleSubmitInquiry}>
              <div className="bd-shop-honeypot" aria-hidden="true">
                <label htmlFor="shop-company-website">
                  Company website
                  <input
                    id="shop-company-website"
                    name="company_website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={formState.company_website}
                    onChange={(e) => setFormState((s) => ({ ...s, company_website: e.target.value }))}
                  />
                </label>
              </div>

              <label htmlFor="shop-branch">
                Pickup Branch
                <select
                  id="shop-branch"
                  value={formState.branch}
                  onChange={(e) => setFormState((s) => ({ ...s, branch: e.target.value }))}
                >
                  <option value="bacoor">Bacoor — RFC Molino II</option>
                  <option value="batangas">Batangas City — Alangilan</option>
                </select>
              </label>

              <label htmlFor="shop-name">
                Your Name
                <input
                  id="shop-name"
                  required
                  placeholder="Juan Dela Cruz"
                  value={formState.name}
                  onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                />
              </label>

              <label htmlFor="shop-phone">
                Mobile Number
                <input
                  id="shop-phone"
                  type="tel"
                  required
                  placeholder="0917 123 4567"
                  value={formState.phone}
                  onChange={(e) => setFormState((s) => ({ ...s, phone: e.target.value }))}
                />
              </label>

              <label htmlFor="shop-email">
                Email (optional)
                <input
                  id="shop-email"
                  type="email"
                  placeholder="you@email.com"
                  value={formState.email}
                  onChange={(e) => setFormState((s) => ({ ...s, email: e.target.value }))}
                />
              </label>

              <label htmlFor="shop-note">
                Variant / Pickup Time Note (optional)
                <textarea
                  id="shop-note"
                  rows={2}
                  placeholder="e.g. Size L shirt or Iced Spanish Latte during afternoon wash"
                  value={formState.note}
                  onChange={(e) => setFormState((s) => ({ ...s, note: e.target.value }))}
                />
              </label>

              <FormLegalNotice id="shop-form-legal" />

              {submitStatus.message ? (
                <p className={`bd-shop-feedback ${submitStatus.type === 'error' ? 'is-error' : 'is-success'}`}>
                  {submitStatus.message}
                </p>
              ) : null}

              <div className="bd-shop-modal-actions">
                <button
                  type="button"
                  className="bd-btn bd-btn-quiet"
                  disabled={submitBusy}
                  onClick={() => setSelectedItem(null)}
                >
                  Close
                </button>
                <button type="submit" className="bd-btn bd-btn-primary" disabled={submitBusy || submitStatus.type === 'success'}>
                  {submitBusy ? 'Sending…' : submitStatus.type === 'success' ? 'Request Sent' : 'Send Stock Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
