importScripts('/awp/assets/js/workbox-sw.js');
importScripts('/awp/assets/js/umd.min.js');
importScripts('/awp/idb-manager.js');
importScripts('/awp/assets/js/firebase-app-compat.js');
importScripts('/awp/assets/js/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDzxc7E9i4ALVLgkKnETGFSa7CnY0r2trg",
    authDomain: "examen-23-94c14.firebaseapp.com",
    projectId: "examen-23-94c14",
    storageBucket: "examen-23-94c14.firebasestorage.app",
    messagingSenderId: "171878299396",
    appId: "1:171878299396:web:84313cb2a3c76de8144251",
    measurementId: "G-47YCQ4B5PF"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);


// Initialize Firebase Cloud Messaging and get a reference to the service
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Mensaje recibido en segundo plano. ', payload);

//   const notificationTitle = payload.notification.title;
//   const notificationOptions = {
//     body: payload.notification.body,
//     icon: payload.notification.icon || '/awp/images/icons/icon-72x72.png'
//   };

//   self.registration.showNotification(notificationTitle, notificationOptions);
});

if (workbox) {
    console.log(`Workbox está cargado 🎉`);
    workbox.setConfig({ debug: false });

    // 2. ESTRATEGIA DE PRE-CACHING
    // No necesitamos precachear la CDN de idb.js, el navegador la manejará.
    const PRECACHE_ASSETS = [
        '/awp/index.html',
        '/awp/panel.html',
        '/awp/login.html',
        '/awp/examenes.html',
        '/awp/assets/css/main.css',
        '/awp/assets/css/fontawesome-all.min.css',
        '/awp/assets/js/jquery.min.js',
        '/awp/assets/js/browser.min.js',
        '/awp/assets/js/breakpoints.min.js',
        '/awp/assets/js/firebase-app-compat.js',
        '/awp/assets/js/firebase-messaging-compat.js',
        '/awp/assets/js/umd.min.js',
        '/awp/assets/js/util.js',
        '/awp/assets/js/main.js',
        '/awp/app.js',
        '/awp/idb-manager.js',
        '/awp/examenes-logic.js' // Es buena idea cachear también este script
    ];
    workbox.precaching.precacheAndRoute(PRECACHE_ASSETS.map(url => ({ url, revision: null })));

    // 3. ESTRATEGIAS DE RUNTIME CACHING
    workbox.routing.registerRoute(
        ({url}) => url.pathname.startsWith('/awp/assets/webfonts/'),
        new workbox.strategies.CacheFirst({ cacheName: 'webfonts' })
    );
    workbox.routing.registerRoute(
        ({request}) => request.destination === 'image',
        new workbox.strategies.StaleWhileRevalidate({ cacheName: 'images' })
    );
    // Usamos StaleWhileRevalidate para la API pública, así carga rápido
    workbox.routing.registerRoute(
        ({url, request}) => url.pathname === '/awp/api/sync.php' && request.method === 'GET',
        new workbox.strategies.StaleWhileRevalidate({ cacheName: 'api-data-public' })
    );

    // =================================================================
    // 4. SINCRONIZACIÓN EN SEGUNDO PLANO - PANEL DE ADMINISTRACIÓN
    // =================================================================
    const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('api-sync-queue', {
        maxRetentionTime: 24 * 60,
        onSync: async ({queue}) => {
            let entry;
            while (entry = await queue.shiftRequest()) {
                try {
                    const response = await fetch(entry.request.clone());
                    if (!response.ok) throw new Error('Respuesta del servidor no fue OK');
                    
                    if (response.status !== 204) {
                        const responseData = await response.json();
                        console.log('SW (Admin Sync): Petición de la cola sincronizada:', responseData);
                        self.clients.matchAll().then(clients => {
                            clients.forEach(client => client.postMessage({ type: 'SYNC_SUCCESS', data: responseData }));
                        });
                    } else {
                        console.log('SW (Admin Sync): Petición DELETE de la cola sincronizada.');
                    }
                } catch (error) {
                    console.error('SW (Admin Sync): Fallo al reintentar, devolviendo a la cola:', error);
                    await queue.unshiftRequest(entry);
                    throw new Error('Re-queueing failed.'); 
                }
            }
        }
    });

    // =================================================================
    // 5. SINCRONIZACIÓN EN SEGUNDO PLANO - ENVÍO DE EXÁMENES DEL CLIENTE
    // =================================================================
    const processSubmissionQueue = async () => {
        try {
            const pendingSubmissions = await self.dbManager.getFromDB('pending_submissions');
            if (pendingSubmissions.length === 0) return;

            console.log(`SW (Client Sync): Procesando ${pendingSubmissions.length} envíos pendientes.`);

            for (const submission of pendingSubmissions) {
                const response = await fetch('/awp/api/sync.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'submit_examen', payload: submission })
                });

                if (response.ok) {
                    console.log(`SW (Client Sync): Envío ID ${submission.id} exitoso.`);
                    await self.dbManager.deleteItemFromDB('pending_submissions', submission.id);
                } else {
                    console.error(`SW (Client Sync): Fallo en envío ID ${submission.id}. Se reintentará.`);
                    throw new Error('Server returned an error');
                }
            }
        } catch (error) {
            console.error('SW (Client Sync): Proceso de sincronización falló. Se reintentará en el próximo sync.', error);
            // Lanzamos el error para que Workbox sepa que la sincronización falló y debe reintentar
            throw error;
        }
    };

    self.addEventListener('sync', (event) => {
        if (event.tag === 'sync-exam-submissions') {
            event.waitUntil(processSubmissionQueue());
        }
    });

    // =================================================================
    // 6. MANEJADOR DE MENSAJES UNIFICADO
    // =================================================================
    self.addEventListener('message', (event) => {
        // --- Lógica para SKIP_WAITING ---
        if (event.data && event.data.type === 'SKIP_WAITING') {
            self.skipWaiting();
        }

        // --- Lógica para la cola del Panel de Administración ---
        if (event.data && event.data.type === 'QUEUE_SYNC_REQUEST') {
            const { type, payload } = event.data.payload;
            const request = new Request('/awp/api/sync.php', {
                method: type.endsWith('_delete') ? 'DELETE' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(type.endsWith('_delete') 
                    ? { type: type.replace('_delete', ''), server_id: payload.server_id } 
                    : { type, payload })
            });
            const handler = new workbox.strategies.NetworkOnly({ plugins: [bgSyncPlugin] });
            const promise = handler.handle({ event, request });

            promise.then(async (response) => {
                if (response && response.ok && response.status !== 204) {
                    const responseData = await response.json();
                    self.clients.matchAll().then(clients => {
                        clients.forEach(client => client.postMessage({ type: 'SYNC_SUCCESS', data: responseData }));
                    });
                }
            }).catch(() => {
                console.log('SW: Petición inicial falló y fue encolada por el plugin.');
            });
        }
    });

} else {
    console.log(`Workbox no se pudo cargar.`);
}