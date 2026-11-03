// Só push e clique na notificação. shortcut: sem cache/modo offline, ver na v1.1 se fizer falta.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim?.()));

self.addEventListener('push', (e) => {
  const { titulo, corpo, url } = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(titulo ?? 'InstaManager', {
      body: corpo,
      icon: '/icones/icon-192.png',
      badge: '/icones/icon-192.png',
      data: { url: url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (janelas) => {
      const j = janelas[0];
      if (!j) return self.clients.openWindow(url);
      await j.focus();
      return j.navigate(url);
    }),
  );
});
