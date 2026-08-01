import { Link } from 'react-router-dom'

/**
 * Required Terms + Privacy acknowledgment for customer/public forms that collect PII.
 * Uses native `required` so HTML validation blocks submit without extra state.
 */
export default function FormLegalNotice({
  id = 'form-legal-notice',
  className = 'form-legal-notice',
  variant = 'default',
}) {
  const isAuth = variant === 'auth'
  return (
    <label className={isAuth ? 'hakum-auth-terms' : className} htmlFor={id}>
      <input id={id} name="accepted_legal" type="checkbox" required />
      <span>
        I agree to the{' '}
        <Link to="/terms" target="_blank" rel="noopener noreferrer">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link to="/privacy" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </Link>
        .
      </span>
    </label>
  )
}

export function AuthLegalLinks() {
  return (
    <p className="hakum-auth-legal-links">
      <Link to="/terms">Terms</Link>
      {' · '}
      <Link to="/privacy">Privacy</Link>
      {' · '}
      <Link to="/cookies">Cookies</Link>
    </p>
  )
}
