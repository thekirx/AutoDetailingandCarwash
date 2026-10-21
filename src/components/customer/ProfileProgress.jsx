import { Link } from 'react-router-dom'
import { Check, ChevronRight } from 'lucide-react'
import { profileCompletion } from '@/lib/profileCompletion'

/** Approved 2026-10-17: design-mocks/birthday-profile-referral-2026-10-17 board 02. Hidden at 100%. */

/** Home: one card, one next step. */
export function ProfileProgressCard({ profile, vehicles }) {
  const p = profileCompletion(profile, vehicles)
  if (p.complete || !p.next) return null
  return (
    <section className="capp-card capp-span capp-profile-progress" aria-label="Your profile">
      <div className="capp-pp-head">
        <div className="min-w-0">
          <p className="capp-eyebrow">Your profile</p>
          <h2 className="capp-title">{p.percent >= 60 ? 'Almost there.' : 'Finish setting up.'}</h2>
        </div>
        <strong className="capp-pp-pct">{p.percent}%</strong>
      </div>
      <div
        className="capp-pp-bar"
        role="progressbar"
        aria-label="Profile complete"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p.percent}
      >
        <b style={{ width: `${p.percent}%` }} />
      </div>
      <p className="capp-meta">{p.next.nextLine}</p>
      <Link className="capp-btn capp-btn-fill capp-btn-block" to={p.next.to}>
        {p.next.action}
      </Link>
    </section>
  )
}

/** Me: ring + checklist; each undone row links to where it is fixed. */
export function ProfileChecklist({ profile, vehicles }) {
  const p = profileCompletion(profile, vehicles)
  if (p.complete) return null
  const r = 15.5
  const c = 2 * Math.PI * r
  return (
    <section className="capp-card capp-span capp-profile-checklist" aria-label="Finish your profile">
      <div className="capp-pp-ringrow">
        <svg className="capp-pp-ring" viewBox="0 0 36 36" aria-hidden>
          <circle cx="18" cy="18" r={r} className="capp-pp-ring-track" />
          <circle
            cx="18"
            cy="18"
            r={r}
            className="capp-pp-ring-fill"
            strokeDasharray={`${(c * p.percent) / 100} ${c}`}
            transform="rotate(-90 18 18)"
          />
          <text x="18" y="21.5" textAnchor="middle">
            {p.percent}%
          </text>
        </svg>
        <div className="min-w-0">
          <h2 className="capp-title">
            {p.done} of {p.total} done
          </h2>
          <p className="capp-meta">Finish your profile so we can reach you and treat you on your day.</p>
        </div>
      </div>
      <ul className="capp-pp-list">
        {p.steps.map((step) => (
          <li key={step.id} className={step.done ? 'is-done' : ''}>
            <span className="capp-pp-dot" aria-hidden>
              {step.done ? <Check size={12} strokeWidth={3} /> : null}
            </span>
            <span className="capp-pp-copy">
              {step.label}
              {!step.done && step.hint ? <small>{step.hint}</small> : null}
              <span className="sr-only">{step.done ? ' — done' : ' — not done'}</span>
            </span>
            {!step.done && step.action ? (
              <Link className="capp-pp-add" to={step.to} aria-label={step.action}>
                Add <ChevronRight size={14} strokeWidth={2.2} aria-hidden />
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
