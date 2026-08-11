import { CUSTOMER_QUEUE_PATH } from './liveQueuePath.js'

/** Persistent customer app tabs. Queue stays inside /account. */
export function getCustomerAccountTabs() {
  return [
    { id: 'home', label: 'Home', to: '/account', end: true },
    { id: 'blog', label: 'Blog', to: '/account/blog' },
    { id: 'events', label: 'Events', to: '/account/events' },
    { id: 'queue', label: 'Queue', to: CUSTOMER_QUEUE_PATH },
  ]
}

export function customerAccountTabId(pathname = '') {
  if (pathname.startsWith('/account/blog')) return 'blog'
  if (pathname.startsWith('/account/events')) return 'events'
  if (pathname.startsWith('/account/queue') || pathname.startsWith('/queue')) return 'queue'
  if (pathname === '/account' || pathname === '/account/') return 'home'
  return ''
}
