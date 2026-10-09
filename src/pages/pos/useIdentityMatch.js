import { useEffect, useRef, useState } from 'react'
import { hasValidEmail, hasValidPhone } from '@/lib/posTicketCustomer'
import { lookupCustomerIdentity } from '@/lib/posTicketCustomerApi'

const IDLE = { status: 'idle', customer: null, message: '' }

/**
 * Phone and email each identify one customer. While the Branch Admin types, ask the server who
 * already owns them and hand the match to `onFound` once per customer so the form fills itself.
 * `scope` changes when a different ticket opens, so the next match can fill again.
 */
export function useIdentityMatch({ phone, email, enabled, scope, onFound }) {
  const [match, setMatch] = useState(IDLE)
  const seq = useRef(0)
  const filledFor = useRef('')
  const found = useRef(onFound)
  found.current = onFound

  useEffect(() => {
    filledFor.current = ''
  }, [scope, enabled])

  useEffect(() => {
    const phoneOk = hasValidPhone(phone)
    const emailOk = hasValidEmail(email)
    if (!enabled || (!phoneOk && !emailOk)) {
      seq.current += 1
      setMatch(IDLE)
      return undefined
    }
    const run = ++seq.current
    setMatch((current) => ({ ...current, status: 'checking' }))
    const timer = window.setTimeout(async () => {
      try {
        const res = await lookupCustomerIdentity({ phone: phoneOk ? phone : '', email: emailOk ? email : '' })
        if (run !== seq.current) return
        if (res.conflict) {
          setMatch({ status: 'conflict', customer: null, message: res.conflict })
        } else if (res.found && res.customer) {
          setMatch({ status: 'found', customer: res.customer, message: '' })
          if (filledFor.current !== res.customer.id) {
            filledFor.current = res.customer.id
            found.current?.(res.customer)
          }
        } else {
          setMatch({ status: 'new', customer: null, message: '' })
        }
      } catch (err) {
        if (run === seq.current) setMatch({ status: 'error', customer: null, message: err.message })
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [phone, email, enabled, scope])

  return match
}
