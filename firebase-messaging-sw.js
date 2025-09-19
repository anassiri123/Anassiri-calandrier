// firebase-messaging-sw.js

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data.json(); } catch(e){ data = {title:'Rappel', body:String(event.data)}; }

  const title = data.title || 'Rappel médical';
  const options = {
    body: data.body || 'Il est l’heure de prendre votre médicament.',
    icon: '/logoalarm-192.png',
    badge: '/logoalarm-192.png',
    data: { url: data.url || '/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url.includes(url) && 'focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
