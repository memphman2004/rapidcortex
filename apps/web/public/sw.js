self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "Rapid Cortex", body: "New venue alert" };
  event.waitUntil(
    self.registration.showNotification(data.title || "Rapid Cortex", {
      body: data.body || "",
      icon: "/favicon.ico",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/app/venue"));
});
