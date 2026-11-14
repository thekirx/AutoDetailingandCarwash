import { CUSTOMER_QUEUE_PATH } from './liveQueuePath.js'

export const CUSTOMER_BOOK_PATH = '/account/book'
export const CUSTOMER_LOYALTY_PATH = '/account/loyalty'
export const CUSTOMER_REFERRAL_PATH = '/account/referral'
export const CUSTOMER_VOUCHERS_PATH = '/account/vouchers'
export const CUSTOMER_MORE_PATH = '/account/more'
/** Settings (the old Me tab) opens from the gear on Home; it shares the /account/more route. */
export const CUSTOMER_SETTINGS_PATH = CUSTOMER_MORE_PATH
export const CUSTOMER_CARS_PATH = '/account/cars'
export const CUSTOMER_VISIT_PATH = '/account/visit'

/** Persistent customer app tabs (5-tab floating dock). Cars took Me's place; Settings sits behind the gear on Home. */
export function getCustomerAccountTabs() {
  return [
    { id: 'home', label: 'Home', to: '/account', end: true },
    { id: 'queue', label: 'Queue', to: CUSTOMER_QUEUE_PATH },
    { id: 'book', label: 'Book', to: CUSTOMER_BOOK_PATH },
    { id: 'rewards', label: 'Rewards', to: CUSTOMER_LOYALTY_PATH },
    { id: 'cars', label: 'Cars', to: CUSTOMER_CARS_PATH },
  ]
}

export function customerAccountTabId(pathname = '') {
  if (pathname.startsWith('/account/book')) return 'book'
  if (pathname.startsWith('/account/queue') || pathname.startsWith('/queue')) return 'queue'
  if (pathname.startsWith('/account/pickup/') || pathname.startsWith('/account/loyalty') || pathname.startsWith('/account/referral') || pathname.startsWith('/account/vouchers')) {
    return 'rewards'
  }
  if (pathname.startsWith('/account/visit')) return 'home'
  if (pathname.startsWith('/account/cars')) return 'cars'
  // Settings, Events and Blog open from the gear, so no tab lights up.
  if (pathname.startsWith('/account/more') || pathname.startsWith('/account/events') || pathname.startsWith('/account/blog')) {
    return ''
  }
  if (pathname === '/account' || pathname === '/account/') return 'home'
  return ''
}

/** How deep a screen sits: tab screens are 0, anything opened from one (a sub-tab, events, a visit) is 1. */
export function customerScreenDepth(pathname = '', search = '') {
  const path = String(pathname || '').replace(/\/+$/, '') || '/'
  if (path === '/account/cars') return new URLSearchParams(search).get('vehicle') || new URLSearchParams(search).get('add') ? 1 : 0
  if (['/account', '/account/queue', '/account/book', '/account/loyalty'].includes(path)) return 0
  if (path.startsWith('/account/')) return 1
  return 0
}

export function customerVisitPath(id) {
  return id ? `${CUSTOMER_VISIT_PATH}/${encodeURIComponent(id)}` : CUSTOMER_VISIT_PATH
}
