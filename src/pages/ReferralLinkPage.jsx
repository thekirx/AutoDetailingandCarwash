import { Navigate, useParams } from 'react-router-dom'
import { rememberReferralCode } from '@/lib/referral'

/** /r/:code — keep the friend's referral code for sign-up, then open sign-up. A bad code just goes to sign-up. */
export default function ReferralLinkPage() {
  const { code } = useParams()
  rememberReferralCode(code)
  return <Navigate to="/signup" replace />
}
