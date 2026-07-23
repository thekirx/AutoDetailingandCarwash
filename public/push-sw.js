/* global clients, self */
/* Hakum Auto Care — push handlers (imported by vite-plugin-pwa workbox). No secrets. */
self.addEventListener('push', (event) => {
  let data = { title: 'Hakum Auto Care', body: 'You have an update.', url: '/', tag: 'hakum' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Hakum Auto Care', {
      body: data.body,
      icon: data.icon || '/apple-touch-icon.png',
      badge: '/favicon.png',
      tag: data.tag || 'hakum',
      renotify: true,
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification?.data?.url || '/'
  event.waitUntil(
    (async () => {
      const all = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })(),
  )
})
