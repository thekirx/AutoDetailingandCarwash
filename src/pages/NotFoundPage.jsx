import { usePageMeta } from '@/lib/pageMeta'
import StatusBayPage from '@/components/StatusBayPage'

export default function NotFoundPage() {
  usePageMeta({
    title: 'Page not found',
    description: 'That Hakum Auto Care page does not exist. Head home or book a service.',
    path: '/404',
  })

  return (
    <StatusBayPage
      code="404"
      titleLine1="This lane"
      titleLine2="is empty."
      message="The page you asked for is not on our site map. Pick a path below to keep moving."
      primary={{ to: '/', label: 'Back home' }}
      secondary={[
        { to: '/book', label: 'Book a service' },
        { to: '/queue', label: 'Live queue' },
        { to: '/contact', label: 'Contact' },
        { to: '/terms', label: 'Terms' },
      ]}
    />
  )
}
