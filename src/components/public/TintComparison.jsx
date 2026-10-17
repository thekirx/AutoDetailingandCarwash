import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import TintCertification from './TintCertification'
import { TINT_MOST_POPULAR, TINT_VEHICLES, tintPackageName, tintPeso, tintWarranty } from '../../lib/tintFinder'
import { tintFilmPhoto } from '../../lib/tintFilmPhotos'
import './home/PpfPackagesSection.css'
import './TintComparison.css'

const PACKAGES = [
  { id: 'ceramic', films: [
    { key: 'Clear Bluish', code: 'C70', shade: 'Clear Bluish' },
    { key: 'C30', code: 'C30', shade: 'Light Black' },
    { key: 'C20', code: 'C20', shade: 'Medium Black' },
    { key: 'C08', code: 'C08', shade: 'Super Black' },
  ] },
  { id: 'pro', films: [
    { key: 'HC35', code: 'HC35 Nano', shade: 'Fair Black' },
    { key: 'HC25', code: 'HC25 Nano', shade: 'Light Black' },
    { key: 'HC15', code: 'HC15 Nano', shade: 'Medium Black' },
    { key: 'HC05', code: 'HC05 Nano', shade: 'Super Black' },
  ] },
  { id: 'black', films: [
    { key: 'Black35', code: 'Black35', shade: 'Fair Black' },
    { key: 'Black25', code: 'Black25', shade: 'Light Black' },
    { key: 'Black15', code: 'Black15', shade: 'Medium Black' },
    { key: 'Black05', code: 'Black05', shade: 'Super Black' },
  ] },
]
const METRICS = [
  { id: 'vlt', label: 'VLT', description: 'Visible light transmission' },
  { id: 'tser', label: 'TSER', description: 'Total solar energy rejection' },
  { id: 'irr', label: 'IRR', description: 'Infrared rejection' },
  { id: 'uvr', label: 'UVR', description: 'Ultraviolet rejection' },
]

/* A number with a thin bar under it, so the spread between shades reads at
   a glance. ">99" fills like 99. The bar is decoration; the number is the value. */
function MetricBar({ value }) {
  const width = Math.min(99, Number.parseFloat(String(value).replace('>', '')) || 0)
  return <span className="bd-tint-bar" aria-hidden="true"><i style={{ width: `${width}%` }} /></span>
}

/** Shares the Finder's loaded catalog so specs and prices always agree.
 *  The certificate leads; the shade cards sit in the same open/close panel as
 *  the PPF comparison, and begin open. */
export default function TintComparison({ config }) {
  const [open, setOpen] = useState(true)
  return (
    <section id="tint-comparison" className="bd-packages bd-tint-comparison" aria-labelledby="tint-comparison-title">
      <div className="bd-shell">
        {/* Heading and panel button on the left, the certificate on the right;
            on a phone they stack heading, certificate, button. */}
        <div className="bd-tint-split">
          <div className="bd-tint-comparison-head">
            <p className="bd-eyebrow">Nano ceramic tint packages</p>
            <h2 id="tint-comparison-title">Compare every <em>tint shade.</em></h2>
            <p className="bd-tint-intro">Twelve films in three tints, side by side: light, heat, UV, warranty and price.</p>
            <div className="bd-cmp-block">
              <button
                type="button"
                className="bd-cmp-toggle"
                aria-expanded={open}
                aria-controls="tint-compare-tables"
                onClick={() => setOpen((value) => !value)}
              >
                <span>
                  <b>Compare all twelve shades</b>
                  <s>Light, heat, UV, warranty and price, side by side</s>
                </span>
                <ChevronDown size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
          <TintCertification />
        </div>

        <div id="tint-compare-tables" hidden={!open}>
        {PACKAGES.filter(({ id }) => config.packages[id]).map(({ id, films }) => {
          const pkg = config.packages[id]
          const popular = id === TINT_MOST_POPULAR
          const titleId = `tint-compare-${id}`
          return (
            <div className={`bd-tint-package${popular ? ' is-popular' : ''}`} data-tint-package={id} key={id}>
              <div className="bd-tint-package-head">
                <div className="bd-tint-package-name">
                  {popular ? <span className="bd-tint-popular">Most popular</span> : null}
                  <h3 id={titleId}>{tintPackageName(config, id)}</h3>
                </div>
                {/* The warranty is the clearest difference between the three tints, so it pulses gently. */}
                <p className="bd-tint-warranty" data-tint-warranty={id}>{tintWarranty(pkg.warranty)}</p>
              </div>
              {/* One card per shade, led by the supplier's sample photo: the
                  photo shows how dark the film is, the numbers show what it blocks.
                  On phones the four cards swipe sideways. */}
              <ul className="bd-tint-shades" aria-labelledby={titleId}>
                {films.map(film => (
                  <li key={film.key} className="bd-tint-shade">
                    <img className="bd-tint-shade-photo" src={tintFilmPhoto(film.key)} alt={`${film.code} ${film.shade} film sample`} width="640" height="360" loading="lazy" decoding="async" />
                    <div className="bd-tint-shade-head"><strong>{film.shade}</strong><span>{film.code}</span></div>
                    <dl>
                      {METRICS.map(metric => {
                        const value = config.films[film.key][metric.id]
                        return <div key={metric.id} data-tint-metric={metric.id}><dt><abbr title={metric.description}>{metric.label}</abbr></dt><dd>{value}%</dd><MetricBar value={value} /></div>
                      })}
                    </dl>
                  </li>
                ))}
              </ul>
              <p className="bd-tint-guide"><b>VLT</b> light let through (lower is darker) · <b>TSER</b> total heat blocked · <b>IRR</b> infrared heat blocked · <b>UVR</b> UV blocked</p>

              {/* One price per vehicle size covers all four shades, so it
                  sits once under the cards rather than repeated per shade. */}
              <dl className="bd-tint-prices">
                <div className="bd-tint-prices-lead"><b>Full-window price</b><span>Same for all four shades. Windshield included.</span></div>
                {TINT_VEHICLES.map(vehicle => (
                  <div key={vehicle.id} className="bd-tint-price" data-tint-price={vehicle.id}>
                    <dt>{vehicle.label}</dt>
                    <dd>{tintPeso(pkg.prices[vehicle.id])}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )
        })}
        </div>
      </div>
    </section>
  )
}
