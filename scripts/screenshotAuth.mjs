/** True only when session landed inside ops app, not the login wall. */
export function isOpsAuthedUrl(url) {
  try {
    const u = new URL(url, 'http://local')
    if (!u.pathname.startsWith('/operations')) return false
    if (u.pathname === '/operations/login' || u.pathname.startsWith('/operations/login/')) return false
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
