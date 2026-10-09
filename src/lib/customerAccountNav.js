import { CUSTOMER_QUEUE_PATH } from './liveQueuePath.js'

export const CUSTOMER_BOOK_PATH = '/account/book'
export const CUSTOMER_LOYALTY_PATH = '/account/loyalty'
export const CUSTOMER_MORE_PATH = '/account/more'
export const CUSTOMER_VISIT_PATH = '/account/visit'

/** Persistent customer app tabs (5-tab floating dock). Blog and Events live under Me. */
export function getCustomerAccountTabs() {
  return [
    { id: 'home', label: 'Home', to: '/account', end: true },
    { id: 'queue', label: 'Queue', to: CUSTOMER_QUEUE_PATH },
    { id: 'book', label: 'Book', to: CUSTOMER_BOOK_PATH },
    { id: 'rewards', label: 'Rewards', to: CUSTOMER_LOYALTY_PATH },
    { id: 'me', label: 'Me', to: CUSTOMER_MORE_PATH },
  ]
}

export function customerAccountTabId(pathname = '') {
  if (pathname.startsWith('/account/book')) return 'book'
  if (pathname.startsWith('/account/queue') || pathname.startsWith('/queue')) return 'queue'
  if (pathname.startsWith('/account/loyalty')) return 'rewards'
  if (pathname.startsWith('/account/visit')) return 'home'
  if (pathname.startsWith('/account/more') || pathname.startsWith('/account/events') || pathname.startsWith('/account/blog')) {
    return 'me'
  }
  if (pathname === '/account' || pathname === '/account/') return 'home'
  return ''
}

/** How deep a screen sits: tab screens are 0, anything opened from one (a sub-tab, events, a visit) is 1. */
export function customerScreenDepth(pathname = '', search = '') {
  const path = String(pathname || '').replace(/\/+$/, '') || '/'
  if (path === '/account/more') return new URLSearchParams(search).get('tab') ? 1 : 0
  if (['/account', '/account/queue', '/account/book', '/account/loyalty'].includes(path)) return 0
  if (path.startsWith('/account/')) return 1
  return 0
}

export function customerVisitPath(id) {
  return id ? `${CUSTOMER_VISIT_PATH}/${encodeURIComponent(id)}` : CUSTOMER_VISIT_PATH
}
