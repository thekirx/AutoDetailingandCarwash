import { AlertTriangle, ArrowRight, Inbox, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export function SectionContainer({ as: Tag = 'section', className = '', children, ...props }) {
  return <Tag className={`ui-section ${className}`} {...props}><div className="public-shell">{children}</div></Tag>
}

export function SectionHeading({ eyebrow, title, description, light = false, align = 'left', className = '' }) {
  return <header className={`ui-section-heading ui-align-${align} ${light ? 'is-light' : ''} ${className}`}>
    {eyebrow && <p className="eyebrow">{eyebrow}</p>}
    <h2>{title}</h2>
    {description && <p className="ui-heading-copy">{description}</p>}
  </header>
}

export function HeroHeading({ eyebrow, children, description, className = '' }) {
  return <div className={`ui-hero-heading ${className}`}>
    {eyebrow && <p className="eyebrow eyebrow-light">{eyebrow}</p>}
    <h1>{children}</h1>
    {description && <p>{description}</p>}
  </div>
}

function ButtonBase({ to, href, children, className, icon = true, ...props }) {
  const content = <>{children}{icon && <ArrowRight size={16}/>}</>
  if (to) return <Link to={to} className={className} {...props}>{content}</Link>
  if (href) return <a href={href} className={className} {...props}>{content}</a>
  return <button className={className} {...props}>{content}</button>
}

export function PrimaryButton({ className = '', ...props }) {
  return <ButtonBase className={`ui-button ui-button-primary ${className}`} {...props}/>
}

export function SecondaryButton({ className = '', ...props }) {
  return <ButtonBase className={`ui-button ui-button-secondary ${className}`} {...props}/>
}

export function StatCard({ value, label, detail, className = '' }) {
  return <article className={`ui-stat-card ${className}`}><strong>{value}</strong><div><span>{label}</span>{detail && <small>{detail}</small>}</div></article>
}

export function ServiceCard({ number, icon: Icon, title, description, to = '/services' }) {
  return <article className="ui-service-card"><div className="ui-card-meta"><span>{number}</span>{Icon && <Icon/>}</div><h3>{title}</h3><p>{description}</p><Link to={to}>Explore service <ArrowRight/></Link></article>
}

export function PackageCard({ eyebrow = 'Protection package', title, description, features = [], actionLabel = 'Choose package', to = '/book', featured = false }) {
  return <article className={`ui-package-card ${featured ? 'is-featured' : ''}`}><p className="eyebrow">{eyebrow}</p><h3>{title}</h3><p>{description}</p><ul>{features.map((feature) => <li key={feature}>{feature}</li>)}</ul><PrimaryButton to={to}>{actionLabel}</PrimaryButton></article>
}

export function BranchCard({ name, address, note, queueTo, bookingTo = '/book' }) {
  return <article className="ui-branch-card"><div className="ui-branch-visual"><span>HAKUM</span><strong>{name}</strong></div><div className="ui-branch-content"><p className="eyebrow">Hakum Auto Care</p><h3>{name}</h3><p>{address}</p>{note && <small>{note}</small>}<div><PrimaryButton to={bookingTo}>Book branch</PrimaryButton>{queueTo && <SecondaryButton to={queueTo}>Live queue</SecondaryButton>}</div></div></article>
}

const statusLabels = { pending: 'Pending', accepted: 'Accepted', confirmed: 'Confirmed', rejected: 'Rejected', queued: 'In queue', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' }
export function StatusBadge({ status = 'pending', label }) {
  return <span className={`ui-status-badge status-${status}`}><i/>{label || statusLabels[status] || status.replaceAll('_', ' ')}</span>
}

export function BookingFormField({ label, error, hint, as = 'input', options = [], className = '', ...props }) {
  const id = props.id || props.name
  const controlProps = { ...props, id, 'aria-invalid': Boolean(error), 'aria-describedby': error || hint ? `${id}-message` : undefined }
  return <label className={`ui-form-field ${error ? 'has-error' : ''} ${className}`} htmlFor={id}><span>{label}</span>
    {as === 'select' ? <select {...controlProps}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : as === 'textarea' ? <textarea {...controlProps}/> : <input {...controlProps}/>} 
    {(error || hint) && <small id={`${id}-message`}>{error || hint}</small>}
  </label>
}

export function AdminMetricCard({ label, value, detail, icon: Icon, trend, tone = 'blue' }) {
  return <article className={`ui-admin-metric tone-${tone}`}><div><p>{label}</p>{Icon && <Icon/>}</div><strong>{value}</strong>{detail && <small>{detail}</small>}{trend && <span>{trend}</span>}</article>
}

export function AdminTable({ columns, rows, rowKey = 'id', emptyMessage = 'No records found.', onRowClick }) {
  if (!rows?.length) return <EmptyState title="Nothing here yet" message={emptyMessage}/>
  return <div className="ui-table-wrap"><table className="ui-admin-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row[rowKey] ?? index} onClick={onRowClick ? () => onRowClick(row) : undefined} className={onRowClick ? 'is-clickable' : ''}>{columns.map((column) => <td key={column.key} data-label={column.label}>{column.render ? column.render(row[column.key], row) : row[column.key] ?? '—'}</td>)}</tr>)}</tbody></table></div>
}

export function LoadingState({ label = 'Loading…', compact = false }) {
  return <div className={`ui-state ui-loading-state ${compact ? 'is-compact' : ''}`} role="status"><LoaderCircle/><p>{label}</p></div>
}

export function EmptyState({ title = 'No results', message = 'There is nothing to show yet.', action }) {
  return <div className="ui-state"><Inbox/><h3>{title}</h3><p>{message}</p>{action}</div>
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return <div className="ui-state ui-error-state" role="alert"><AlertTriangle/><h3>{title}</h3>{message && <p>{message}</p>}{onRetry && <SecondaryButton onClick={onRetry} icon={false}>Try again</SecondaryButton>}</div>
}
