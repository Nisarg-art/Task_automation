importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC4oomPx8mrT8PeX-PI3S1CVkT8PQh0lDo",
  authDomain: "test-automation-f9304.firebaseapp.com",
  projectId: "test-automation-f9304",
  storageBucket: "test-automation-f9304.firebasestorage.app",
  messagingSenderId: "208006790340",
  appId: "1:208006790340:web:f0d1b3e5d82eea2ed41d91"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  const title = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || '⏰ Daily Status Task Reminder';
  const body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || 'Please submit or update your daily status report.';
  const url = (payload.data && payload.data.url) || '/submit';
  const tag = (payload.data && payload.data.tag) || 'daily-task-alert';

  const options = {
    body: body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: { url: url },
    tag: tag,
    renotify: true,
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(title, options);
});

// Handle standard WebPush events
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Received push event:', event);
  let data = {
    title: '⏰ Daily Status Task Reminder',
    body: 'Please submit your daily task status report.',
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
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';
  const fullTargetUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) {
          try {
            client.postMessage({
              type: 'TASK_NOTIFICATION_CLICK',
              url: targetUrl,
              data: event.notification.data
            });
          } catch (e) {}
          client.navigate(fullTargetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(fullTargetUrl);
      }
    })
  );
});
