import { usePageMeta } from '@/lib/pageMeta'
import StatusBayPage from '@/components/StatusBayPage'

export default function ForbiddenPage() {
  usePageMeta({
    title: 'Access denied',
    description: 'You do not have access to that Hakum Auto Care page.',
    path: '/403',
  })

  return (
    <StatusBayPage
      code="403"
      titleLine1="This bay"
      titleLine2="is restricted."
      message="Your account cannot open this page. Sign in with the right role, or continue browsing as a guest."
      primary={{ to: '/', label: 'Back home' }}
      secondary={[
        { to: '/signin', label: 'Customer sign in' },
        { to: '/operations/login', label: 'Team portal' },
        { to: '/contact', label: 'Contact' },
      ]}
    />
  )
}
