// Nach dem Abmelden: Seiten-Cache des Service Workers auf diesem Gerät leeren.
if ('caches' in window) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
