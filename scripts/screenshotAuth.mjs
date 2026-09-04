/** True only when session landed inside ops app, not the login wall or denial pages. */
export function isOpsAuthedUrl(url) {
  try {
    const u = new URL(url, 'http://local')
    if (!u.pathname.startsWith('/operations')) return false
    if (u.pathname === '/operations/login' || u.pathname.startsWith('/operations/login/')) return false
    if (u.pathname === '/operations/access-denied' || u.pathname.startsWith('/operations/access-denied/')) return false
    if (u.pathname === '/operations/forbidden' || u.pathname.startsWith('/operations/forbidden/')) return false
    return true
  } catch {
    return false
  }
}

export function isLoginWallUrl(url) {
  try {
    const u = new URL(url, 'http://local')
    return u.pathname === '/operations/login' || u.pathname.startsWith('/operations/login/')
  } catch {
    return /\/operations\/login/.test(String(url || ''))
  }
}
