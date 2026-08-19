import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Inbox, Mail, Phone, RefreshCw } from 'lucide-react'

import { useAuth } from '@/auth/AuthProvider'
import { canAccessInquiries } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { SITE_TYPE_LABELS } from '@/lib/partnershipInquiry'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const TABS = [
  { key: 'partnership', label: 'Partnership', table: 'partnership_inquiries' },
  { key: 'contact', label: 'Contact', table: 'contact_inquiries' },
  { key: 'complaints', label: 'Complaints', table: 'complaints' },
]

const COLUMNS = {
  partnership: 'id, site_type, name, email, contact_number, city, message, status, created_at',
  contact: 'id, name, phone, email, subject, message, created_at',
  complaints: 'id, customer_name, branch, category, description, status, created_at',
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function PartnershipRow({ row }) {
  return (
    <>
      <div className="inquiry-row-head">
        <div>
          <strong>{row.name}</strong>
          <Badge variant="secondary">{SITE_TYPE_LABELS[row.site_type] || row.site_type}</Badge>
          {row.status && row.status !== 'new' ? <Badge variant="outline">{row.status}</Badge> : null}
        </div>
        <span>{formatDate(row.created_at)}</span>
      </div>
      <p className="inquiry-meta">
        <a href={`mailto:${row.email}`}><Mail size={13} aria-hidden="true" />{row.email}</a>
        <a href={`tel:${row.contact_number}`}><Phone size={13} aria-hidden="true" />{row.contact_number}</a>
        <span>{row.city}</span>
      </p>
      <p className="inquiry-body">{row.message}</p>
    </>
  )
}

function ContactRow({ row }) {
  return (
    <>
      <div className="inquiry-row-head">
        <div>
          <strong>{row.name}</strong>
          <Badge variant="secondary">{row.subject}</Badge>
        </div>
        <span>{formatDate(row.created_at)}</span>
      </div>
      <p className="inquiry-meta">
        {row.email ? <a href={`mailto:${row.email}`}><Mail size={13} aria-hidden="true" />{row.email}</a> : null}
        {row.phone ? <a href={`tel:${row.phone}`}><Phone size={13} aria-hidden="true" />{row.phone}</a> : null}
      </p>
      <p className="inquiry-body">{row.message}</p>
    </>
  )
}

function ComplaintRow({ row }) {
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
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const allowed = canAccessInquiries(profile)
  const active = useMemo(() => TABS.find((t) => t.key === tab) || TABS[0], [tab])

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

  useEffect(() => {
    if (allowed) load()
  }, [allowed, load])

  if (!allowed) return <Navigate to="/operations/access-denied" replace />

  const Renderer = ROW_RENDERERS[active.key]

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

      <Card>
        <CardHeader>
          <CardTitle>{active.label} — {loading ? 'loading…' : `${rows.length} total`}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="inquiries-error">
              Could not load {active.label.toLowerCase()} inquiries: {loadError}
            </p>
          ) : loading ? (
            <p className="inquiries-empty">Loading…</p>
          ) : !rows.length ? (
            <div className="inquiries-empty-state">
              <Inbox size={28} aria-hidden="true" />
              <p>No {active.label.toLowerCase()} inquiries yet.</p>
            </div>
          ) : (
            <ul className="inquiry-list">
              {rows.map((row) => (
                <li key={row.id} className="inquiry-row">
                  <Renderer row={row} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
