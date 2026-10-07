import seal from '../../assets/tint-finder/seal.png'
import './TintCertification.css'

const VERIFIED_FILMS = ['HC35 NANO', 'HC25 NANO', 'HC15 NANO', 'HC05 NANO']

/** Scope the seal to the film models listed by the Foundation. */
export default function TintCertification({ packageName }) {
  return (
    <aside className="tint-certification" id="tint-certification" aria-labelledby="cert-title">
      <div className="cert-card">
        <div className="cert-seal">
          <img src={seal} alt="The Skin Cancer Foundation Seal of Recommendation: effective sun protection" width="160" height="290" loading="lazy" />
        </div>
        <div className="cert-body">
          <p className="cert-label">ClearPro Nano Ceramic Series</p>
          <h3 id="cert-title">UV protection.<br /><em>Recognized.</em></h3>
          <p className="cert-copy">ClearPro’s Nano Ceramic Series window films have earned The Skin Cancer Foundation’s Seal of Recommendation for effective sun protection.</p>
          <div className="cert-fact">
            <strong>99% or more</strong>
            <span>UVA and UVB blockage required by the Foundation’s window-film criteria.</span>
          </div>
          <div className="cert-films">
            <p>Verified films in our {packageName} package</p>
            <ul>{VERIFIED_FILMS.map(film => <li key={film}>{film}</li>)}</ul>
          </div>
          <div className="cert-links">
            <a className="bd-btn bd-btn-primary" href="https://www.skincancer.org/recommended-products/" target="_blank" rel="noopener noreferrer">
              View Foundation listing <span aria-hidden="true">↗</span>
            </a>
            <a className="cert-source" href="https://www.clearpro.com/project/window-film-certified-by-the-skincancerfoundation-for-ultimate-uv-protection/" target="_blank" rel="noopener noreferrer">
              Read ClearPro’s announcement <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </div>
    </aside>
  )
}
