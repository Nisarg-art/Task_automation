// Service Worker for Daily Scrum Task Automation Web Push Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {
    title: '⏰ Daily Status Task Reminder',
    body: 'Please submit or update your daily status report before the 6:15 PM cutoff.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    url: '/submit',
    tag: 'daily-scrum-reminder'
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = Object.assign(data, parsed);
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    data: {
      url: data.url || '/submit'
    },
    tag: data.tag || 'daily-task-alert',
    renotify: true,
    vibrate: [200, 100, 200],
    actions: data.actions || [
      { action: 'open', title: 'Open Portal' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open with the app, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(targetUrl) || client.url.endsWith('/')) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
