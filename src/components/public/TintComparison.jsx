import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import TintCertification from './TintCertification'
import { TINT_VEHICLES, tintPackageName, tintPeso } from '../../lib/tintFinder'
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

/** Shares the Finder's loaded catalog so specs and prices always agree.
 *  The certificate leads; the tables sit in the same open/close panel as the
 *  PPF comparison, and begin open. */
export default function TintComparison({ config }) {
  const [open, setOpen] = useState(true)
  return (
    <section id="tint-comparison" className="bd-packages bd-tint-comparison" aria-labelledby="tint-comparison-title">
      <div className="bd-shell">
        <div className="bd-tint-comparison-head">
          <p className="bd-eyebrow">Nano ceramic tint packages</p>
          <h2 id="tint-comparison-title">Compare every <em>tint shade.</em></h2>
        </div>

        <TintCertification />

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

        <div id="tint-compare-tables" hidden={!open}>
        {PACKAGES.map(({ id, films }) => {
          const pkg = config.packages[id]
          const titleId = `tint-compare-${id}`
          return (
            <div className="bd-tint-package" data-tint-package={id} key={id}>
              <div className="bd-tint-package-head">
                <h3 id={titleId}>{tintPackageName(config, id)}</h3>
                <p>{pkg.warranty} warranty</p>
              </div>
              <p className="bd-tint-scroll-hint">Swipe or scroll sideways to compare all four shades.</p>
              <div className="bd-cmp" role="region" aria-labelledby={titleId} tabIndex={0}>
                <table>
                  <caption className="bd-cmp-caption">{tintPackageName(config, id)}: film specifications, warranty, and full-window package prices</caption>
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
                        {films.map(film => <td key={film.key}>{config.films[film.key][metric.id]}%</td>)}
                      </tr>
                    ))}
                    <tr data-tint-metric="warranty">
                      <th scope="row">Warranty</th>
                      {films.map(film => <td key={film.key}>{pkg.warranty}</td>)}
                    </tr>
                  </tbody>
                  <tbody>
                    <tr className="bd-cmp-group"><th colSpan={5} scope="rowgroup">Full-window package prices</th></tr>
                    {TINT_VEHICLES.map(vehicle => (
                      <tr key={vehicle.id} data-tint-price={vehicle.id}>
                        <th scope="row">{vehicle.label}</th>
                        {films.map(film => <td key={film.key}>{tintPeso(pkg.prices[vehicle.id])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
        </div>
        <p className="bd-tint-comparison-note">Prices cover all windows, including the windshield. VLT values are for the film only; factory glass affects the final reading. Final price confirmed at the branch.</p>
      </div>
    </section>
  )
}
