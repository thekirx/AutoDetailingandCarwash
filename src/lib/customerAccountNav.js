import { CUSTOMER_QUEUE_PATH } from './liveQueuePath.js'

export const CUSTOMER_BOOK_PATH = '/account/book'
export const CUSTOMER_LOYALTY_PATH = '/account/loyalty'
export const CUSTOMER_MORE_PATH = '/account/more'

/** Persistent customer app tabs (5-tab dock). Events + Loyalty are secondary screens. */
export function getCustomerAccountTabs() {
  return [
    { id: 'home', label: 'Home', to: '/account', end: true },
    { id: 'book', label: 'Book', to: CUSTOMER_BOOK_PATH },
    { id: 'queue', label: 'Queue', to: CUSTOMER_QUEUE_PATH },
    { id: 'blog', label: 'Blog', to: '/account/blog' },
    { id: 'more', label: 'More', to: CUSTOMER_MORE_PATH },
  ]
}

export function customerAccountTabId(pathname = '') {
  if (pathname.startsWith('/account/blog')) return 'blog'
  if (pathname.startsWith('/account/book')) return 'book'
  if (pathname.startsWith('/account/queue') || pathname.startsWith('/queue')) return 'queue'
  if (pathname.startsWith('/account/more') || pathname.startsWith('/account/events') || pathname.startsWith('/account/loyalty')) {
    return 'more'
  }
  if (pathname === '/account' || pathname === '/account/') return 'home'
  return ''
}
