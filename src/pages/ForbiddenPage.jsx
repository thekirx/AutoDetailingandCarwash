import { useAuth } from '@/auth/AuthProvider'
import { resolvePostLoginPath } from '@/auth/authRedirect'
import { canUseOperations } from '@/auth/permissions'
import { usePageMeta } from '@/lib/pageMeta'
import StatusBayPage from '@/components/StatusBayPage'

export default function ForbiddenPage() {
  const { user, profile } = useAuth()
  usePageMeta({
    title: 'Access denied',
    description: 'You do not have access to that Hakum Auto Care page.',
    path: '/403',
    noindex: true,
  })

  const isCustomer = Boolean(user) && profile?.role === 'customer'
  const isOps = Boolean(user) && canUseOperations(profile)

  const primary = isCustomer
    ? { to: '/account', label: 'Back to my app' }
    : isOps
      ? { to: resolvePostLoginPath(profile, null), label: 'Go to Ops home' }
      : { to: '/', label: 'Back home' }

  const secondary = isCustomer
    ? [
        { to: '/account/book', label: 'Book a service' },
        { to: '/account/queue', label: 'Live queue' },
        { to: '/contact', label: 'Contact' },
      ]
    : isOps
      ? [
          { to: '/operations/login', label: 'Switch team account' },
          { to: '/contact', label: 'Contact' },
        ]
      : [
          { to: '/signin', label: 'Customer sign in' },
          { to: '/operations/login', label: 'Team portal' },
          { to: '/contact', label: 'Contact' },
        ]

  return (
    <StatusBayPage
      code="403"
      titleLine1="This bay"
      titleLine2="is restricted."
      message="Your account cannot open this page. Head back to your workspace or sign in with the right account."
      primary={primary}
      secondary={secondary}
    />
  )
}
