import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Inbox, Mail, Phone, RefreshCw } from 'lucide-react'

import { useAuth } from '@/auth/AuthProvider'
import { canAccessInquiries } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { SITE_TYPE_LABELS, PARTNERSHIP_STATUSES, CONTACT_STATUSES } from '@/lib/partnershipInquiry'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const TABS = [
  { key: 'partnership', label: 'Partnership', table: 'partnership_inquiries' },
  { key: 'contact', label: 'Contact', table: 'contact_inquiries' },
  { key: 'complaints', label: 'Complaints', table: 'complaints' },
]

export const COMPLAINT_STATUSES = ['submitted', 'review', 'resolved', 'closed']

const COLUMNS = {
  partnership: 'id, site_type, name, email, contact_number, city, message, status, created_at',
  contact: 'id, name, phone, email, subject, message, status, created_at',
  complaints: 'id, customer_name, branch, category, description, status, created_at',
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function PartnershipRow({ row, onStatus }) {
  return (
    <>
      <div className="inquiry-row-head">
        <div>
          <strong>{row.name}</strong>
          <Badge variant="secondary">{SITE_TYPE_LABELS[row.site_type] || row.site_type}</Badge>
          {row.status ? <Badge variant="outline">{row.status}</Badge> : null}
        </div>
        <span>{formatDate(row.created_at)}</span>
      </div>
      <p className="inquiry-meta">
        <a href={`mailto:${row.email}`}><Mail size={13} aria-hidden="true" />{row.email}</a>
        <a href={`tel:${row.contact_number}`}><Phone size={13} aria-hidden="true" />{row.contact_number}</a>
        <span>{row.city}</span>
      </p>
      <p className="inquiry-body">{row.message}</p>
      <div className="inquiry-actions">
        {PARTNERSHIP_STATUSES.filter((status) => status !== row.status).map((status) => (
          <button key={status} type="button" onClick={() => onStatus(row.id, status)}>
            Mark {status}
          </button>
        ))}
      </div>
    </>
  )
}

function ContactRow({ row, onStatus }) {
  return (
    <>
      <div className="inquiry-row-head">
        <div>
          <strong>{row.name}</strong>
          <Badge variant="secondary">{row.subject}</Badge>
          {row.status ? <Badge variant="outline">{row.status}</Badge> : null}
        </div>
        <span>{formatDate(row.created_at)}</span>
      </div>
      <p className="inquiry-meta">
        {row.email ? <a href={`mailto:${row.email}`}><Mail size={13} aria-hidden="true" />{row.email}</a> : null}
        {row.phone ? <a href={`tel:${row.phone}`}><Phone size={13} aria-hidden="true" />{row.phone}</a> : null}
      </p>
      <p className="inquiry-body">{row.message}</p>
      <div className="inquiry-actions">
        {CONTACT_STATUSES.filter((status) => status !== row.status).map((status) => (
          <button key={status} type="button" onClick={() => onStatus(row.id, status)}>
            Mark {status}
          </button>
        ))}
      </div>
    </>
  )
}

function ComplaintRow({ row, onStatus, onPromote }) {
  return (
    <>
      <div className="inquiry-row-head">
        <div>
          <strong>{row.customer_name}</strong>
          <Badge variant="secondary">{row.category}</Badge>
          {row.status ? <Badge variant="outline">{row.status}</Badge> : null}
        </div>
        <span>{formatDate(row.created_at)}</span>
      </div>
      <p className="inquiry-meta"><span>{row.branch}</span></p>
      <p className="inquiry-body">{row.description}</p>
      <div className="inquiry-actions">
        {COMPLAINT_STATUSES.filter((status) => status !== row.status).map((status) => (
          <button key={status} type="button" onClick={() => onStatus(row.id, status)}>
            Mark {status}
          </button>
        ))}
        {onPromote ? (
          <button type="button" onClick={() => onPromote(row)}>
            Promote to customer note
          </button>
        ) : null}
      </div>
    </>
  )
}

const ROW_RENDERERS = {
  partnership: PartnershipRow,
  contact: ContactRow,
  complaints: ComplaintRow,
}

export default function InquiriesPage() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('partnership')
  const [statusFilter, setStatusFilter] = useState('all')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const allowed = canAccessInquiries(profile)
  const active = useMemo(() => TABS.find((t) => t.key === tab) || TABS[0], [tab])

  const statusOptions = useMemo(() => {
    if (active.key === 'partnership') return PARTNERSHIP_STATUSES
    if (active.key === 'contact') return CONTACT_STATUSES
    return COMPLAINT_STATUSES
  }, [active.key])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase
      .from(active.table)
      .select(COLUMNS[active.key])
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      setLoadError(error.message)
      setRows([])
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }, [active])

  const setPartnershipStatus = useCallback(async (id, status) => {
    const { error } = await supabase.from('partnership_inquiries').update({ status }).eq('id', id)
    if (error) setLoadError(error.message)
    else load()
  }, [load])

  const setComplaintStatus = useCallback(async (id, status) => {
    const { error } = await supabase.from('complaints').update({ status }).eq('id', id)
    if (error) setLoadError(error.message)
    else load()
  }, [load])

  const promoteComplaintToNote = useCallback(async (row) => {
    const body = String(row.description || '').trim()
    if (!body) {
      setLoadError('Complaint has no description to promote')
      return
    }
    const name = String(row.customer_name || '').trim()
    let customerId = null
    if (name) {
      const { data: hits } = await supabase
        .from('customers')
        .select('id, full_name')
        .ilike('full_name', `%${name}%`)
        .limit(5)
      customerId = hits?.[0]?.id || null
    }
    const { error } = await supabase.from('customer_notes').insert({
      customer_id: customerId,
      note_type: 'complaint',
      body: body.slice(0, 4000),
      complaint_id: row.id,
      created_by: (await supabase.auth.getUser()).data?.user?.id || null,
    })
    if (error) setLoadError(error.message)
    else {
      setLoadError('')
      toast.success(customerId ? 'Promoted to customer note' : 'Promoted note (match customer in CRM if needed)')
    }
  }, [])

  const setContactStatus = useCallback(async (id, status) => {
    const { error } = await supabase.from('contact_inquiries').update({ status }).eq('id', id)
    if (error) setLoadError(error.message)
    else load()
  }, [load])

  useEffect(() => {
    if (allowed) load()
  }, [allowed, load])

  useEffect(() => {
    setStatusFilter('all')
  }, [tab])

  if (!allowed) return <Navigate to="/operations/access-denied" replace />

  const Renderer = ROW_RENDERERS[active.key]
  const filteredRows =
    statusFilter === 'all' ? rows : rows.filter((row) => String(row.status || '') === statusFilter)

  return (
    <div className="inquiries-page">
      <header className="inquiries-head">
        <div>
          <h1>Inquiries</h1>
          <p>Messages submitted from the public website. Visible to Super Admin and Assistant Super Admin only.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="inquiries-refresh">
          <RefreshCw size={14} aria-hidden="true" />
          Refresh
        </button>
      </header>

      <div className="inquiries-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab}
            className={t.key === tab ? 'is-active' : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="inquiries-status-filters" role="group" aria-label="Filter by status">
        <button
          type="button"
          className={statusFilter === 'all' ? 'is-active' : undefined}
          onClick={() => setStatusFilter('all')}
        >
          All
        </button>
        {statusOptions.map((status) => (
          <button
            key={status}
            type="button"
            className={statusFilter === status ? 'is-active' : undefined}
            onClick={() => setStatusFilter(status)}
          >
            {status}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {active.label} —{' '}
            {loading
              ? 'loading…'
              : statusFilter === 'all'
                ? `${rows.length} total`
                : `${filteredRows.length} of ${rows.length} · ${statusFilter}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="inquiries-error">
              Could not load {active.label.toLowerCase()} inquiries: {loadError}
            </p>
          ) : loading ? (
            <p className="inquiries-empty">Loading…</p>
          ) : !filteredRows.length ? (
            <div className="inquiries-empty-state">
              <Inbox size={28} aria-hidden="true" />
              <p>
                {rows.length
                  ? `No ${active.label.toLowerCase()} inquiries with status “${statusFilter}”.`
                  : `No ${active.label.toLowerCase()} inquiries yet.`}
              </p>
            </div>
          ) : (
            <ul className="inquiry-list">
              {filteredRows.map((row) => (
                <li key={row.id} className="inquiry-row">
                  <Renderer
                    row={row}
                    onStatus={
                      active.key === 'partnership'
                        ? setPartnershipStatus
                        : active.key === 'complaints'
                          ? setComplaintStatus
                          : setContactStatus
                    }
                    onPromote={active.key === 'complaints' ? promoteComplaintToNote : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
