import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import TintCertification from './TintCertification'
import { TINT_VEHICLES, tintPackageName, tintPeso, tintWarranty } from '../../lib/tintFinder'
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
 *  The certificate leads; the tables sit in the same open/close panel as the
 *  PPF comparison, and begin open. */
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
            <p className="bd-tint-intro">Eight films in two tints, side by side: light, heat, UV, warranty and price.</p>
            <div className="bd-cmp-block">
              <button
                type="button"
                className="bd-cmp-toggle"
                aria-expanded={open}
                aria-controls="tint-compare-tables"
                onClick={() => setOpen((value) => !value)}
              >
                <span>
                  <b>Compare all eight shades</b>
                  <s>Light, heat, UV, warranty and price, side by side</s>
                </span>
                <ChevronDown size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
          <TintCertification />
        </div>

        <div id="tint-compare-tables" hidden={!open}>
        {PACKAGES.map(({ id, films }) => {
          const pkg = config.packages[id]
          const titleId = `tint-compare-${id}`
          return (
            <div className="bd-tint-package" data-tint-package={id} key={id}>
              <div className="bd-tint-package-head">
                <h3 id={titleId}>{tintPackageName(config, id)}</h3>
                <p>{tintWarranty(pkg.warranty)}</p>
              </div>
              <p className="bd-tint-scroll-hint">Swipe or scroll sideways to compare all four shades.</p>
              <div className="bd-cmp" role="region" aria-labelledby={titleId} tabIndex={0}>
                <table>
                  <caption className="bd-cmp-caption">{tintPackageName(config, id)}: film specifications and warranty</caption>
                  <thead>
                    <tr>
                      <th scope="col">Compare shades</th>
                      {films.map(film => (
                        <th scope="col" key={film.key}>
                          <b>{film.code}</b>
                          <span>{film.shade}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bd-cmp-group"><th colSpan={5} scope="rowgroup">Film performance</th></tr>
                    {METRICS.map(metric => (
                      <tr key={metric.id} data-tint-metric={metric.id}>
                        <th scope="row">{metric.label}<small>{metric.description}</small></th>
                        {films.map(film => {
                          const value = config.films[film.key][metric.id]
                          return <td key={film.key}><span className="bd-tint-cell"><strong>{value}%</strong><MetricBar value={value} /></span></td>
                        })}
                      </tr>
                    ))}
                    <tr data-tint-metric="warranty">
                      <th scope="row">Warranty</th>
                      {films.map(film => <td key={film.key}>{pkg.warranty}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Phones: a sideways table shows one shade at a time, so each
                  shade becomes a row with its four numbers together. */}
              <ul className="bd-tint-shades" aria-label={`${tintPackageName(config, id)} shades`}>
                {films.map(film => (
                  <li key={film.key} className="bd-tint-shade">
                    <div className="bd-tint-shade-head"><strong>{film.shade}</strong><span>{film.code}</span></div>
                    <dl>
                      {METRICS.map(metric => {
                        const value = config.films[film.key][metric.id]
                        return <div key={metric.id}><dt>{metric.label}</dt><dd>{value}%</dd><MetricBar value={value} /></div>
                      })}
                    </dl>
                  </li>
                ))}
              </ul>
              <p className="bd-tint-guide"><b>VLT</b> light let through (lower is darker) · <b>TSER</b> total heat blocked · <b>IRR</b> infrared heat blocked · <b>UVR</b> UV blocked</p>

              {/* One price per vehicle size covers all four shades, so it
                  sits once under the table rather than repeated per column. */}
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
