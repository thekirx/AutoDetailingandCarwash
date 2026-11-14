import { isDemoLoginEnabled } from '../lib/demoLogin'
import { isDemoLoginVisible } from '../lib/demoSignIn'

/** Compact demo account chips for ops / customer login, only on a device holding a QA key or test hosts. */
export default function DemoAccountChips({ accounts, onPick, title = 'Demo accounts', disabled = false }) {
  if (!isDemoLoginVisible()) return null
  if (!accounts?.length) return null
  return (
    <div className="hakum-demo">
      <p className="hakum-demo-label">{title}</p>
      <div className="hakum-demo-chips">
        {accounts.map((a) => (
          <button
            key={a.id || a.email}
            type="button"
            className="hakum-demo-chip"
            disabled={disabled}
            onClick={() => onPick(a)}
            title={a.email || a.label}
          >
            <span>{a.label}</span>
            {a.hint ? <small>{a.hint}</small> : null}
            {a.email ? <small className="hakum-demo-email">{a.email}</small> : null}
          </button>
        ))}
      </div>
    </div>
  )
}
