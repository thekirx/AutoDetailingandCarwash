import { useState } from 'react'
import { CheckCircle2, LoaderCircle, TriangleAlert, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function MatchNote({ match, hasInput }) {
  if (match.status === 'checking') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Checking for an existing account…
      </p>
    )
  }
  if (match.status === 'found') {
    return (
      <p className="flex items-start gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Existing customer: {match.customer.full_name || 'account'}. Details filled in — saving links this ticket to them.
        </span>
      </p>
    )
  }
  if (match.status === 'conflict') {
    return (
      <p className="flex items-start gap-1.5 text-xs font-medium text-destructive" role="alert">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{match.message}</span>
      </p>
    )
  }
  if (match.status === 'error') {
    return (
      <p className="text-xs text-destructive" role="alert">
        Could not check for an existing account. {match.message}
      </p>
    )
  }
  if (match.status === 'new') {
    return (
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground" role="status">
        <UserPlus className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>No account with this number or email yet. Saving creates one.</span>
      </p>
    )
  }
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      {hasInput
        ? 'Enter a mobile number or email to look for an existing account.'
        : 'Mobile number or email finds an existing customer. Leave blank to sell as a guest.'}
    </p>
  )
}

/**
 * Identity fields, unique identifiers first (they drive the lookup), then the name.
 * `onSave` is shown only when a ticket needs its customer saved ahead of payment.
 */
export default function PosTicketCustomer({
  idPrefix = 'pos-cust',
  values,
  onChange,
  match,
  error = '',
  onSave = null,
  saving = false,
  canSave = false,
  disabled = false,
}) {
  const hasInput = Boolean(`${values.phone}${values.email}${values.first}${values.last}`.trim())
  const field = (key) => (event) => onChange(key, event.target.value)
  // Hold the validation message until the cashier leaves a field — not mid-keystroke.
  const [touched, setTouched] = useState(false)
  return (
    <div className="space-y-3" onBlur={() => setTouched(true)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-phone`} className="text-xs text-muted-foreground">
            Mobile number
          </Label>
          <Input
            id={`${idPrefix}-phone`}
            className="min-h-11"
            placeholder="0917 123 4567"
            inputMode="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={field('phone')}
            disabled={disabled}
            aria-invalid={match.status === 'conflict' || undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-email`} className="text-xs text-muted-foreground">
            Email <span className="font-normal">(optional)</span>
          </Label>
          <Input
            id={`${idPrefix}-email`}
            className="min-h-11"
            type="email"
            placeholder="name@email.com"
            autoComplete="email"
            value={values.email}
            onChange={field('email')}
            disabled={disabled}
            aria-invalid={match.status === 'conflict' || undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-first`} className="text-xs text-muted-foreground">
            First name
          </Label>
          <Input
            id={`${idPrefix}-first`}
            className="min-h-11"
            autoComplete="given-name"
            value={values.first}
            onChange={field('first')}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-last`} className="text-xs text-muted-foreground">
            Last name
          </Label>
          <Input
            id={`${idPrefix}-last`}
            className="min-h-11"
            autoComplete="family-name"
            value={values.last}
            onChange={field('last')}
            disabled={disabled}
          />
        </div>
      </div>
      <MatchNote match={match} hasInput={hasInput} />
      {error && touched ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {onSave ? (
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 w-full"
          onClick={onSave}
          disabled={disabled || saving || !canSave}
        >
          {saving ? 'Saving…' : match.status === 'found' ? 'Link customer to this ticket' : 'Save customer'}
        </Button>
      ) : null}
    </div>
  )
}
