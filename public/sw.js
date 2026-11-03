// Service worker so para NOTIFICACOES: nao guarda paginas nem intercepta pedidos (assim ninguem fica vendo versao antiga).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch { /* sem dados */ }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Ordem de Produção', { body: d.corpo || '', icon: '/icon-192.png', tag: d.tag, data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    for (const c of l) if ('focus' in c) return c.focus();
    return self.clients.openWindow(e.notification.data.url);
  }));
});
