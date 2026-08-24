// LoopSquad push notification service worker
// Handles push events and notification clicks

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "LoopSquad";
  const options = {
    body: data.body || "You have a new notification",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: data.url || "/dashboard",
    tag: data.tag || "loopsquad-notification",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data || "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
