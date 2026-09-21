/** In-app customer queue. Public kiosk/TV stay on /queue/:slug. */
export const CUSTOMER_QUEUE_PATH = '/account/queue'

/** Poll safe public_queue_* views only. Never Realtime WAL on bookings (PII). */
export const PUBLIC_QUEUE_POLL_MS = 8_000
/** Shop TV polls the public floor view faster — still no bookings WAL. */
export const PUBLIC_TV_POLL_MS = 2_000

/** Prefer branch slug when set; otherwise public branch picker. */
export function liveQueuePath(branchSlug) {
  const slug = String(branchSlug || '').trim()
  return slug ? `/queue/${encodeURIComponent(slug)}` : '/queue'
}

/** In-store landscape TV. Same slug as live queue — no per-branch page to provision. */
export function shopTvPath(branchSlug) {
  const slug = String(branchSlug || '').trim()
  return slug ? `/queue/${encodeURIComponent(slug)}/tv` : '/queue'
}

export function absolutePublicUrl(path, origin = '') {
  const next = String(path || '')
  if (/^https?:\/\//i.test(next)) return next
  const p = next.startsWith('/') ? next : `/${next}`
  const base = String(origin || '').replace(/\/$/, '')
  return base ? `${base}${p}` : p
}

/** Checklist after Super Admin creates a site. TV + customer queue exist the moment the slug does. */
export function branchLaunchGuide({ slug, name, status } = {}) {
  const id = String(slug || '').trim()
  const label = String(name || id || 'New branch').trim()
  const live = status === 'active'
  const customerPath = liveQueuePath(id)
  const tvPath = shopTvPath(id)
  return {
    slug: id,
    name: label,
    live,
    title: live ? `${label} is on the floor` : `${label} is coming soon`,
    lead: live
      ? 'This slug already drives live queue, bookings, and shop TV. No extra page to build — pin the TV link on the display and assign crew.'
      : 'Coming soon stays off customer bookings until you Activate. The shop TV and live-queue URLs already exist for this slug.',
    customerPath,
    tvPath,
    steps: [
      {
        id: 'slug',
        ready: true,
        title: 'Slug is the switch',
        body: id
          ? `Queue, bookings, and shop TV all key off ${id}. Nothing else to provision.`
          : 'Queue, bookings, and shop TV all key off the branch slug.',
      },
      {
        id: 'tv',
        ready: live,
        title: 'Shop TV',
        body: live
          ? 'Landscape board for the shop wall. No sign-in. Waiting, in progress, ready for payment.'
          : 'URL works now as a preview. Activate before putting it on the shop display.',
        href: tvPath,
        linkLabel: 'Open shop TV',
        copyPath: tvPath,
      },
      {
        id: 'customer',
        ready: live,
        title: 'Customer live queue',
        body: 'Public counts-only page. Listed automatically on /queue once the site is active and public.',
        href: customerPath,
        linkLabel: 'Open customer queue',
        copyPath: customerPath,
      },
      {
        id: 'people',
        ready: false,
        title: 'Assign a Team Lead and crew',
        body: 'People → set branch scope. Until then tickets have no crew names on TV.',
        href: '/operations/people',
        linkLabel: 'Open People',
      },
      {
        id: 'hours',
        ready: true,
        title: 'Hours are saved',
        body: 'Public /branches uses this week. Edit anytime on this page.',
      },
      {
        id: 'book',
        ready: live,
        title: 'Take bookings',
        body: live
          ? 'Walk-ins and bookings store this slug. Shop TV fills when the first car is waiting.'
          : 'Activate first, then the floor board and bookings accept cars.',
        href: live ? '/operations/queue' : null,
        linkLabel: live ? 'Open floor queue' : null,
      },
    ],
  }
}

export function customerQueuePath(branchSlug) {
  const slug = String(branchSlug || '').trim()
  return slug ? `${CUSTOMER_QUEUE_PATH}?branch=${encodeURIComponent(slug)}` : CUSTOMER_QUEUE_PATH
}

export function queueCountsFromRow(row) {
  return {
    waiting: Number(row?.waiting_count || 0),
    in_progress: Number(row?.in_progress_count || 0),
    final_checking: Number(row?.final_checking_count || 0),
    total: Number(row?.total_active_count || 0),
  }
}

/** Homepage cards show every vehicle currently in the active service flow. */
export function branchQueueTotal(row) {
  return queueCountsFromRow(row).total
}
