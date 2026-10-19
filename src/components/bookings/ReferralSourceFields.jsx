import { useEffect, useState } from 'react'
import { getAccessTokenFresh } from '@/lib/authToken'
import { FRIEND_REFERRAL, REFERRAL_SOURCES, STAFF_REFERRAL } from '@/lib/referralSource'

function EmployeeChoice({ variant, idPrefix, name, staffId, staff, onPick, onType }) {
  const chosen = staff.find((row) => row.id === staffId)
  const typed = chosen ? '' : name
  const selectClass = variant === 'ops'
    ? 'min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground'
    : undefined
  const inputClass = selectClass
  const wrap = variant === 'ops' ? 'flex flex-col gap-2' : variant === 'capp' ? 'capp-field' : 'bk-field'
  return (
    <div className={variant === 'ops' ? wrap : undefined}>
      <label className={wrap}>
        <span className={variant === 'ops' ? 'text-sm font-medium text-foreground' : undefined}>Employee</span>
        <select id={`${idPrefix}-employee`} className={selectClass} value={staffId || ''} onChange={(e) => onPick(e.target.value)}>
          <option value="">Choose an employee</option>
          {staff.map((row) => (
            <option key={row.id} value={row.id}>{row.label || row.full_name}</option>
          ))}
        </select>
      </label>
      <label className={variant === 'ops' ? 'flex flex-col gap-2' : wrap}>
        <span className={variant === 'ops' ? 'text-sm font-medium text-foreground' : undefined}>Or type a name</span>
        <input
          id={`${idPrefix}-name`}
          className={inputClass}
          value={typed}
          autoComplete="off"
          placeholder="Name if they are not in the list"
          onChange={(e) => onType(e.target.value)}
        />
      </label>
      {chosen?.label ? <p className={variant === 'capp' ? 'capp-meta' : 'text-xs text-muted-foreground'}>{chosen.label}</p> : null}
    </div>
  )
}

function FriendCode({ variant, idPrefix, name, onType }) {
  const wrap = variant === 'ops' ? 'flex flex-col gap-2' : variant === 'capp' ? 'capp-field' : 'bk-field'
  const inputClass = variant === 'ops'
    ? 'min-h-11 rounded-md border border-input bg-background px-3 text-sm uppercase text-foreground'
    : undefined
  return (
    <label className={wrap}>
      <span className={variant === 'ops' ? 'text-sm font-medium text-foreground' : undefined}>Friend's referral code</span>
      <input
        id={`${idPrefix}-friend-code`}
        className={inputClass}
        value={name || ''}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="HK and 6 characters"
        onChange={(e) => onType(e.target.value)}
      />
    </label>
  )
}

export function useReferralStaff() {
  const [staff, setStaff] = useState([])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessTokenFresh()
        if (!token || cancelled) return
        const res = await fetch('/api/referral-staff', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const body = res.ok ? await res.json() : { staff: [] }
        if (!cancelled) setStaff(Array.isArray(body.staff) ? body.staff : [])
      } catch {
        if (!cancelled) setStaff([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return staff
}

/**
 * Source dropdown. Hakum staff / crew reveals a name field backed by the crew list.
 * variant: ops | public | capp — matches the form it sits in.
 */
function accountNote(error, variant) {
  if (!error) return null
  if (variant === 'public') return <p className="form-error" role="alert">{error}</p>
  if (variant === 'capp') return <p className="capp-field-error" role="alert">{error}</p>
  return <p className="text-sm text-destructive" role="alert">{error}</p>
}

export default function ReferralSourceFields({
  source,
  name,
  staffId = '',
  onChange,
  staff = [],
  variant = 'ops',
  idPrefix = 'referral',
  accountError = '',
}) {
  const showName = source === STAFF_REFERRAL
  const showCode = source === FRIEND_REFERRAL
  const setSource = (next) => onChange({
    referral_source: next,
    referred_by_name: '',
    referred_by_staff_id: '',
  })
  const pickEmployee = (id) => {
    const row = staff.find((person) => person.id === id)
    onChange({
      referral_source: source,
      referred_by_name: row?.full_name || '',
      referred_by_staff_id: row?.id || '',
    })
  }
  const typeName = (next) => {
    const needle = next.trim().toLowerCase()
    const match = staff.find((row) => {
      const full = row.full_name.toLowerCase()
      const label = String(row.label || '').toLowerCase()
      return full === needle || label === needle
    })
    onChange({
      referral_source: source,
      referred_by_name: match?.full_name || next,
      referred_by_staff_id: match?.id || '',
    })
  }

  if (variant === 'public') {
    return (
      <>
        <label className="bk-field">
          <span>Where did you hear about us?</span>
          <select value={source} onChange={(e) => setSource(e.target.value)} required>
            <option value="">Choose one</option>
            {REFERRAL_SOURCES.map((row) => (
              <option key={row.id} value={row.id}>{row.label}</option>
            ))}
          </select>
        </label>
        {showName ? (
          <EmployeeChoice
            variant="public"
            idPrefix={idPrefix}
            name={name}
            staffId={staffId}
            staff={staff}
            onPick={pickEmployee}
            onType={typeName}
          />
        ) : null}
        {showCode ? <FriendCode variant="public" idPrefix={idPrefix} name={name} onType={(next) => onChange({ referral_source: source, referred_by_name: next, referred_by_staff_id: '' })} /> : null}
        {accountNote(accountError, 'public')}
      </>
    )
  }

  if (variant === 'capp') {
    return (
      <>
        <label className="capp-field">
          <span>Where did you hear about us?</span>
          <select value={source} onChange={(e) => setSource(e.target.value)} required>
            <option value="">Choose one</option>
            {REFERRAL_SOURCES.map((row) => (
              <option key={row.id} value={row.id}>{row.label}</option>
            ))}
          </select>
        </label>
        {showName ? (
          <EmployeeChoice
            variant="capp"
            idPrefix={idPrefix}
            name={name}
            staffId={staffId}
            staff={staff}
            onPick={pickEmployee}
            onType={typeName}
          />
        ) : null}
        {showCode ? <FriendCode variant="capp" idPrefix={idPrefix} name={name} onType={(next) => onChange({ referral_source: source, referred_by_name: next, referred_by_staff_id: '' })} /> : null}
        {accountNote(accountError, 'capp')}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground" htmlFor={`${idPrefix}-source`}>
        Where did you hear about us?
      </label>
      <select
        id={`${idPrefix}-source`}
        required
        value={source}
        onChange={(e) => setSource(e.target.value)}
        className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground"
      >
        <option value="">Choose one</option>
        {REFERRAL_SOURCES.map((row) => (
          <option key={row.id} value={row.id}>{row.label}</option>
        ))}
      </select>
      {showName ? (
        <EmployeeChoice
          variant="ops"
          idPrefix={idPrefix}
          name={name}
          staffId={staffId}
          staff={staff}
          onPick={pickEmployee}
          onType={typeName}
        />
      ) : null}
      {showCode ? <FriendCode variant="ops" idPrefix={idPrefix} name={name} onType={(next) => onChange({ referral_source: source, referred_by_name: next, referred_by_staff_id: '' })} /> : null}
      {accountNote(accountError, 'ops')}
    </div>
  )
}
