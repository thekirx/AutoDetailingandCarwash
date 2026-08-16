export default function ContentEmptyState({ eyebrow, title, body }) {
  return (
    <div className="content-empty-state" role="status" data-motion="card">
      <p>{eyebrow}</p>
      <h3>{title}</h3>
      <span>{body}</span>
    </div>
  )
}
