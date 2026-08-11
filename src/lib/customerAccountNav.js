/** Persistent customer app tabs. Blog + Events stay on the bottom nav. */
export function getCustomerAccountTabs(queueHref = '/queue') {
  return [
    { id: 'home', label: 'Home', to: '/account', end: true },
    { id: 'blog', label: 'Blog', to: '/account/blog' },
    { id: 'events', label: 'Events', to: '/account/events' },
    { id: 'queue', label: 'Queue', to: queueHref || '/queue' },
  ]
}

export function customerAccountTabId(pathname = '') {
  if (pathname.startsWith('/account/blog')) return 'blog'
  if (pathname.startsWith('/account/events')) return 'events'
  if (pathname.startsWith('/queue')) return 'queue'
  if (pathname === '/account' || pathname === '/account/') return 'home'
  return ''
}
