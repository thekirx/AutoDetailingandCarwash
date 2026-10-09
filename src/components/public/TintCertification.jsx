import seal from '../../assets/tint-finder/seal.png'
import './TintCertification.css'

/** Every film Hakum installs carries the Foundation's seal (owner-confirmed,
 *  9 Oct 2026), so the card speaks for the series rather than listing films. */
export default function TintCertification() {
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
          <a className="cert-source" href="https://www.skincancer.org/recommended-products/" target="_blank" rel="noopener noreferrer">
            View Foundation listing <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </aside>
  )
}
