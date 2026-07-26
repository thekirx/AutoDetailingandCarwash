/** Compact demo account chips for ops / customer login — never in production builds. */
export default function DemoAccountChips({ accounts, onPick, title = 'Demo accounts' }) {
  if (!import.meta.env.DEV) return null
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
            onClick={() => onPick(a)}
            title={`${a.email}${a.password ? ` · ${a.password}` : ''}`}
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
