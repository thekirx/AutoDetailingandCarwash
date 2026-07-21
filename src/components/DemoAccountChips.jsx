/** Compact demo account chips for ops / customer login. */
export default function DemoAccountChips({ accounts, onPick, title = 'Demo accounts' }) {
  if (!accounts?.length) return null
  return (
    <div className="hakum-demo">
      <p className="hakum-demo-label">{title}</p>
      <div className="hakum-demo-chips">
        {accounts.map((a) => (
          <button key={a.id || a.email} type="button" className="hakum-demo-chip" onClick={() => onPick(a)} title={a.hint || a.email}>
            <span>{a.label}</span>
            {a.hint ? <small>{a.hint}</small> : null}
          </button>
        ))}
      </div>
    </div>
  )
}
