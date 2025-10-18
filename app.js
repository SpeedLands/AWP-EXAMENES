// /awp/app.js

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

messaging.onMessage((payload) => {
  console.log('Message received. ', payload);
  if (Notification.permission === 'granted') {
    const options = {
        body: 'Verifica la aplicación para más detalles.',
        icon: '/awp/images/icons/icon-512x512.png' // Usa un ícono de tu manifest
    };
    navigator.serviceWorker.ready.then(registration => {
        registration.showNotification('Se han realizado cambios en el servidor', options);
    });
  }
});

// --- INICIALIZACIÓN Y REGISTRO DEL SERVICE WORKER ---
window.addEventListener('load', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/awp/service-worker.js', { scope: '/awp/' })
            .then(registration => console.log('Service Worker registrado con éxito:', registration.scope))
            .catch(error => console.log('Error al registrar el Service Worker:', error));
    }
    initApp();
});

const isIndexPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '/awp/';
// No hace falta poner installButton.style.display = "none" aquí, ya está en el HTML

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  
  
  // 1. Mostrar el botón
  if (isIndexPage) {
    const installButton = document.getElementById("install");
  installButton.style.visibility = "initial"; 
  } // Solo mostrar en la landing page
  
});

if (isIndexPage) {
    const installButton = document.getElementById("install");
    installButton.addEventListener("click", async () => {
  if (!installPrompt) {
    return;
  }
  
  // 2. Ocultar el botón
  installButton.style.visibility = "hidden";

  const result = await installPrompt.prompt();
  console.log(`Install prompt was: ${result.outcome}`);
  installPrompt = null;
});
}

// --- GESTIÓN DEL ESTADO DE CONEXIÓN ---
function updateOnlineStatus() {
    const statusIndicator = document.getElementById('status-indicator');
    if (!statusIndicator) return;
    statusIndicator.textContent = navigator.onLine ? 'Online' : 'Offline';
    statusIndicator.style.color = navigator.onLine ? 'lightgreen' : 'lightcoral';
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// --- LÓGICA PRINCIPAL DE LA APLICACIÓN ---
async function initApp() {
    console.log("Inicializando app...");
    updateOnlineStatus();

    // --- PASO CRUCIAL: ASEGURAR QUE LA BD ESTÉ LISTA ---
    try {
        await window.dbManager.initDB();
        console.log("Base de datos lista para usar.");
    } catch (error) {
        console.error("Error fatal al inicializar la base de datos:", error);
        // Opcional: Mostrar un mensaje de error al usuario en la UI
        return; // Detenemos la ejecución si la BD no funciona
    }

    const isPanelPage = window.location.pathname.includes('/panel.html');
    const isLoginPage = window.location.pathname.includes('/login.html');

    // --- GUARDIA DE RUTA ---
    if (isPanelPage) {
        const session = await getSingleItemFromDB('session', 'user-session');
        if (!session) {
            console.log("No hay sesión activa. Redirigiendo a login.");
            window.location.href = 'login.html';
            return;
        }
    }

    // --- INICIALIZACIÓN DE LA PÁGINA ACTUAL ---
    if (isPanelPage) {
        console.log("Estamos en el Panel de Administración. Inicializando lógica del panel...");
        initializePanel();
    } else if (isLoginPage) {
        console.log("Estamos en la página de Login.");
        initializeLoginPage();
    } else {
        console.log("Estamos en la Landing Page.");
    }
}

function initializeLoginPage() {
    const loginForm = document.getElementById('login-form');
    const errorP = document.getElementById('login-error');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorP.style.display = 'none';
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/awp/api/login.php', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (response.ok) {
                // Guardar el "artefacto de sesión" en IndexedDB (Sección V.A)
                await saveSingleItemToDB('session', {
                    id: 'user-session',
                    ...data.session_artifact
                });
                const fcmToken = await getFCMToken();
                if (fcmToken) {
                    // Esperamos a que se envíe el token al servidor
                    await sendTokenToServer(fcmToken); 
                    console.log("Token FCM obtenido en login:", fcmToken);
                    // await sendTestNotification(); 
                }
                
                window.location.href = 'panel.html';
            } else {
                errorP.textContent = data.message;
                errorP.style.display = 'block';
            }
        } catch (error) {
            errorP.textContent = 'Error de conexión. Inténtalo más tarde.';
            errorP.style.display = 'block';
        }
    });
}

async function sendTestNotification() {
    console.log("Solicitando notificación de prueba de bienvenida...");
    try {
        // Llamamos a un nuevo endpoint que se encarga de la lógica de envío
        const response = await fetch('/awp/api/send_test_notification.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
            // No necesitamos body, el servidor usa la sesión de PHP
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log('✅ Solicitud de notificación de prueba enviada al servidor.');
        } else {
            console.error('❌ Error al solicitar la notificación de prueba:', data.error || 'Fallo desconocido.');
        }

    } catch (error) {
        console.error('Error de red al intentar solicitar la notificación:', error);
    }
}

async function getFCMToken() {
        console.log('Intentando obtener el token de FCM...');
        try {
            // *** NO NECESITAS LLAMAR A register() AQUÍ DE NUEVO ***

            // 1. Esperamos a que el SW esté READY
            const registration = await navigator.serviceWorker.ready;
            console.log('Service Worker activo para FCM:', registration.scope);

            // 2. Solicitamos permiso
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                const vapidKey = 'BNUn2NgqPJ-PkialAZF4dmV1h1ncZel-cumo68aH08CrhL6D2D1JcjKuraopzfIZZ-Ez-4AlqavY-pE_TD0wE4E';

                const currentToken = await messaging.getToken({ 
                    vapidKey: vapidKey,
                    serviceWorkerRegistration: registration // Usamos el registro obtenido
                });

                if (currentToken) {
                    return currentToken;
                }
            }
        } catch (err) {
            console.error('Error al obtener el token de FCM:', err);
        }
        return null; 
    }

async function sendTokenToServer(token) {
    try {
        const response = await fetch('/awp/api/sync.php', { // Apuntando a sync.php
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'fcm_token',
                payload: {
                    token: token // El valor del token
                }
            })
        });

        if (response.ok) {
            console.log('Token FCM enviado y guardado con éxito.');
        } else {
            console.error('Error al guardar el token en el servidor.');
        }
    } catch (e) {
        console.error('Fallo de red al enviar el token:', e);
    }
}

/**
 * Encapsula TODA la lógica y funciones relacionadas con el panel de administración.
 */
function initializePanel() {
    // --- REFERENCIAS A ELEMENTOS DE LA UI ---
    const examenesView = document.getElementById('examenes-view');
    const preguntasView = document.getElementById('preguntas-view');
    const respuestasView = document.getElementById('respuestas-view');
    const examenesTableBody = document.getElementById('examenes-table-body');
    const preguntasTableBody = document.getElementById('preguntas-table-body');
    const respuestasTableBody = document.getElementById('respuestas-table-body');
    const preguntasViewTitle = document.getElementById('preguntas-view-title');
    const respuestasViewTitle = document.getElementById('respuestas-view-title');
    const modalOverlay = document.getElementById('modal-overlay');
    
    // Modal de Exámenes
    const examenModal = document.getElementById('examen-modal');
    const examenForm = document.getElementById('examen-form');
    const examenModalTitle = document.getElementById('modal-title');
    const examenLocalIdInput = document.getElementById('examen-local-id');
    const examenNombreInput = document.getElementById('examen-nombre');
    const examenDescripcionInput = document.getElementById('examen-descripcion');

    // Modal de Preguntas
    const preguntaModal = document.getElementById('pregunta-modal');
    const preguntaForm = document.getElementById('pregunta-form');
    const preguntaModalTitle = document.getElementById('pregunta-modal-title');
    const preguntaLocalIdInput = document.getElementById('pregunta-local-id');
    const preguntaExamenIdRefInput = document.getElementById('pregunta-examen-id-ref');
    const preguntaTextoInput = document.getElementById('pregunta-texto');
    const preguntaValorInput = document.getElementById('pregunta-valor');

    const respuestaModal = document.getElementById('respuesta-modal');
    const respuestaForm = document.getElementById('respuesta-form');
    const respuestaModalTitle = document.getElementById('respuesta-modal-title');
    const respuestaLocalIdInput = document.getElementById('respuesta-local-id');
    const respuestaPreguntaIdRefInput = document.getElementById('respuesta-pregunta-id-ref');
    const respuestaTextoInput = document.getElementById('respuesta-texto');
    const respuestaCorrectaInput = document.getElementById('respuesta-correcta');

    const llenadosView = document.getElementById('llenados-view');
    const llenadosTableBody = document.getElementById('llenados-table-body');
    const llenadosViewTitle = document.getElementById('llenados-view-title');
    const llenadoModal = document.getElementById('llenado-modal');
    const llenadoForm = document.getElementById('llenado-form');
    const llenadoLocalIdInput = document.getElementById('llenado-local-id');
    const llenadoExamenIdRefInput = document.getElementById('llenado-examen-id-ref');
    const llenadoClaveInput = document.getElementById('llenado-clave');
    const llenadoRespuestaIdInput = document.getElementById('llenado-respuesta-id');

    const forceSyncBtn = document.getElementById('force-sync-btn');

    if (forceSyncBtn) {
        forceSyncBtn.addEventListener('click', async () => {
            if (!navigator.onLine) {
                alert("No tienes conexión a internet.");
                return;
            }

            console.log("Forzando sincronización bidireccional...");
            forceSyncBtn.disabled = true;
            forceSyncBtn.textContent = "Sincronizando...";

            try {
                // 1. Forzar el envío de la cola local al servidor (Local -> Server)
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'FORCE_SYNC_REPLAY' });
                    console.log("Solicitud de re-ejecución de cola enviada al SW.");
                }

                // 2. Esperar un momento (opcional) y luego traer los datos del servidor (Server -> Local)
                // Usamos syncServerToLocal para la reconciliación.
                // await syncServerToLocal(); 

                alert("Sincronización completada.");
            } catch (error) {
                console.error("Error durante la sincronización forzada:", error);
                alert("Error durante la sincronización. Revisa la consola.");
            } finally {
                forceSyncBtn.disabled = false;
                forceSyncBtn.textContent = "Forzar Sincronización";
            }
        });
    }

    let currentExamenId = null;
    let currentPreguntaId = null;

    // --- GESTIÓN DE VISTAS ---
    function showView(viewName) {
        examenesView.style.display = 'none';
        preguntasView.style.display = 'none';
        respuestasView.style.display = 'none';
        llenadosView.style.display = 'none';
        if (viewName === 'examenes') examenesView.style.display = 'block';
        else if (viewName === 'preguntas') preguntasView.style.display = 'block';
        else if (viewName === 'respuestas') respuestasView.style.display = 'block';
        else if (viewName === 'llenados') llenadosView.style.display = 'block';
    }

    // --- MANEJO DE EVENTOS ---
    document.getElementById('create-examen-btn').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openExamenModalForCreate(); });
    document.getElementById('cancel-examen-btn').addEventListener('click', closeExamenModal);
    examenForm.addEventListener('submit', handleExamenFormSubmit);
    examenesTableBody.addEventListener('click', handleExamenesTableClick);
    
    document.getElementById('back-to-examenes-btn').addEventListener('click', () => showView('examenes'));
    document.getElementById('create-pregunta-btn').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openPreguntaModalForCreate(); });
    document.getElementById('cancel-pregunta-btn').addEventListener('click', closePreguntaModal);
    preguntaForm.addEventListener('submit', handlePreguntaFormSubmit);
    preguntasTableBody.addEventListener('click', handlePreguntasTableClick);

    document.getElementById('back-to-preguntas-btn').addEventListener('click', () => navigateToPreguntas(currentExamenId));
    document.getElementById('create-respuesta-btn').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openRespuestaModalForCreate(); });
    document.getElementById('cancel-respuesta-btn').addEventListener('click', closeRespuestaModal);
    respuestaForm.addEventListener('submit', handleRespuestaFormSubmit);
    respuestasTableBody.addEventListener('click', handleRespuestasTableClick);

    document.getElementById('back-to-examenes-from-llenados-btn').addEventListener('click', () => showView('examenes'));
    llenadosTableBody.addEventListener('click', handleLlenadosTableClick);
    document.getElementById('cancel-llenado-btn').addEventListener('click', closeLlenadoModal);
    llenadoForm.addEventListener('submit', handleLlenadoFormSubmit);
    document.getElementById('create-llenado-btn').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openLlenadoModalForCreate(); });

    document.getElementById('notification-bell').addEventListener('click', (e) => { 
        e.preventDefault(); 
        openNotificationsModal(); 
    });
    document.getElementById('close-notifications-btn').addEventListener('click', closeNotificationsModal);

    modalOverlay.addEventListener('click', () => { closeExamenModal(); closePreguntaModal(); closeRespuestaModal(); closeLlenadoModal(); closeNotificationsModal(); });

    navigator.serviceWorker.addEventListener('message', event => {
        console.log('Mensaje recibido del Service Worker:', event.data);
        if (event.data && event.data.type === 'SYNC_SUCCESS') {
            console.log('Sincronización en segundo plano completada para un registro.');
            // Ahora esta llamada es válida porque está dentro del mismo ámbito
            updateLocalRecordWithServerData(event.data.data);

            // Esto era para enviar notificación local

            // if (Notification.permission === 'granted') {
            //     const options = {
            //         body: 'Tus cambios se han guardado en el servidor.',
            //         icon: '/awp/images/icons/icon-512x512.png' // Usa un ícono de tu manifest
            //     };
            //     navigator.serviceWorker.ready.then(registration => {
            //         registration.showNotification('¡Sincronización Completa!', options);
            //     });
            // }
            sendTestNotification();
        }
    });

    function formatNotificationDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    async function fetchAndRenderNotifications() {
        const notificationsList = document.getElementById('notifications-list');
        notificationsList.innerHTML = '<p style="text-align: center; color: #aaa;">Cargando historial...</p>';

        try {
            const response = await fetch('/awp/api/sync.php?scope=notificaciones');
            if (!response.ok) {
                throw new Error('Fallo al obtener notificaciones.');
            }
            const notifications = await response.json();

            if (notifications.length === 0) {
                notificationsList.innerHTML = '<p style="text-align: center; color: #aaa;">No hay notificaciones registradas.</p>';
                return;
            }

            notificationsList.innerHTML = '';
            notifications.forEach(note => {
                const dateStr = formatNotificationDate(note.fecha_envio);
                const statusColor = note.estado_envio === 'ENVIADO' ? 'lightgreen' : 'lightcoral';
                
                const div = document.createElement('div');
                div.style.padding = '10px';
                div.style.marginBottom = '10px';
                div.style.borderLeft = `5px solid ${note.estado_envio === 'ENVIADO' ? '#3c8dbc' : '#c74444'}`;

                div.innerHTML = `
                    <strong>${note.titulo}</strong>
                    <p style="margin: 0; font-size: 0.9em; color: #555;">${note.cuerpo}</p>
                    <small style="display: block; margin-top: 5px;">
                        Estado: <span style="color: ${statusColor};">${note.estado_envio}</span> | 
                        Fecha: ${dateStr}
                    </small>
                `;
                notificationsList.appendChild(div);
            });

        } catch (error) {
            console.error('Error fetching notifications:', error);
            notificationsList.innerHTML = '<p style="text-align: center; color: red;">Error al cargar: ' + error.message + '</p>';
        }
    }

    function openNotificationsModal() {
        modalOverlay.style.display = 'block';
        document.getElementById('notifications-modal').style.display = 'block';
        fetchAndRenderNotifications(); // Cargar y mostrar los datos
    }

    function closeNotificationsModal() {
        modalOverlay.style.display = 'none';
        document.getElementById('notifications-modal').style.display = 'none';
    }

    // --- LÓGICA DE NAVEGACIÓN Y RENDERIZADO ---
    async function navigateToPreguntas(examenId) {
        currentExamenId = examenId;
        const examen = await getSingleItemFromDB('examenes', examenId);
        if (!examen) return;
        preguntasViewTitle.textContent = examen.nombre;
        await renderPreguntas();
        showView('preguntas');
    }

    async function navigateToRespuestas(preguntaId) {
        currentPreguntaId = preguntaId;
        const pregunta = await getSingleItemFromDB('preguntas', preguntaId);
        if (!pregunta) return;
        respuestasViewTitle.textContent = `"${pregunta.pregunta}"`;
        await renderRespuestas();
        showView('respuestas');
    }

    async function renderExamenes() {
        const examenes = await getFromDB('examenes');
        examenesTableBody.innerHTML = '';
        if (examenes.length === 0) {
            examenesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No hay exámenes. ¡Crea uno nuevo!</td></tr>';
            return;
        }
        examenes.forEach(examen => {
            const tr = document.createElement('tr');
            tr.dataset.localId = examen.local_id;
            tr.style.cursor = 'pointer';
            const statusText = !examen.server_id ? 'Pendiente' : 'Sincronizado';
            const statusColor = !examen.server_id ? 'lightcoral' : 'lightgreen';
            tr.innerHTML = `
                <td>${examen.nombre}</td>
                <td>${examen.descripcion}</td>
                <td><span style="color: ${statusColor};">${statusText}</span></td>
                <td>
                    <button class="button small edit-btn" data-local-id="${examen.local_id}">Editar</button>
                    <button class="button small delete-btn" data-local-id="${examen.local_id}" style="background-color: #c74444;">Eliminar</button>
                    <button class="button small view-llenados-btn" data-local-id="${examen.local_id}" style="background-color: #5480f1;">Llenados</button>
                </td>
            `;
            examenesTableBody.appendChild(tr);
        });
    }
    
    async function renderPreguntas() {
        if (!currentExamenId) return;
        const todasLasPreguntas = await getFromDB('preguntas');
        const preguntasDelExamen = todasLasPreguntas.filter(p => p.examen_id_ref === currentExamenId);
        
        preguntasTableBody.innerHTML = '';
        if (preguntasDelExamen.length === 0) {
            preguntasTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Este examen no tiene preguntas. ¡Añade una!</td></tr>';
            return;
        }
        preguntasDelExamen.forEach(pregunta => {
            const tr = document.createElement('tr');
            // MODIFICADO: Añadimos data-local-id y cursor a la fila de pregunta
            tr.dataset.localId = pregunta.local_id;
            tr.style.cursor = 'pointer';

            const statusText = !pregunta.server_id ? 'Pendiente' : 'Sincronizado';
            const statusColor = !pregunta.server_id ? 'lightcoral' : 'lightgreen';
            tr.innerHTML = `
                <td>${pregunta.pregunta}</td>
                <td>${pregunta.valor || 'N/A'}</td>
                <td><span style="color: ${statusColor};">${statusText}</span></td>
                <td>
                    <button class="button small edit-pregunta-btn" data-local-id="${pregunta.local_id}">Editar</button>
                    <button class="button small delete-pregunta-btn" data-local-id="${pregunta.local_id}" style="background-color: #c74444;">Eliminar</button>
                </td>
            `;
            // CORRECCIÓN: Añadimos la fila a la tabla
            preguntasTableBody.appendChild(tr);
        });
    }

    async function renderRespuestas() {
        if (!currentPreguntaId) return;
        const todasLasRespuestas = await getFromDB('respuestas');
        const respuestasDeLaPregunta = todasLasRespuestas.filter(r => r.pregunta_id_ref === currentPreguntaId);
        
        respuestasTableBody.innerHTML = '';
        if (respuestasDeLaPregunta.length === 0) {
            respuestasTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Esta pregunta no tiene respuestas. ¡Añade una!</td></tr>';
            return;
        }
        respuestasDeLaPregunta.forEach(respuesta => {
            const tr = document.createElement('tr');
            const statusText = !respuesta.server_id ? 'Pendiente' : 'Sincronizado';
            const statusColor = !respuesta.server_id ? 'lightcoral' : 'lightgreen';
            const esCorrecta = parseInt(respuesta.correcta) === 1 ? 'Sí' : 'No';
            const correctaColor = respuesta.correcta ? 'lightgreen' : 'inherit';

            tr.innerHTML = `
                <td>${respuesta.respuesta}</td>
                <td style="color: ${correctaColor}; font-weight: bold;">${esCorrecta}</td>
                <td><span style="color: ${statusColor};">${statusText}</span></td>
                <td>
                    <button class="button small edit-respuesta-btn" data-local-id="${respuesta.local_id}">Editar</button>
                    <button class="button small delete-respuesta-btn" data-local-id="${respuesta.local_id}" style="background-color: #c74444;">Eliminar</button>
                </td>
            `;
            respuestasTableBody.appendChild(tr);
        });
    }

    async function navigateToLlenados(examenId) {
        currentExamenId = examenId;
        const examen = await getSingleItemFromDB('examenes', examenId);
        if (!examen) return;
        llenadosViewTitle.textContent = examen.nombre;
        await renderLlenados();
        showView('llenados');
    }

    async function renderLlenados() {
        if (!currentExamenId) return;
        const todosLosLlenados = await getFromDB('llenados');
        const llenadosDelExamen = todosLosLlenados.filter(l => l.examen_id_ref === currentExamenId);
        
        llenadosTableBody.innerHTML = '';
        if (llenadosDelExamen.length === 0) {
            llenadosTableBody.innerHTML = '<tr><td colspan="4">No hay llenados para este examen.</td></tr>';
            return;
        }
        llenadosDelExamen.forEach(llenado => {
            const tr = document.createElement('tr');
            // ... lógica para crear la fila de la tabla de llenados ...
            tr.innerHTML = `
                <td>${llenado.Clave}</td>
                <td>${llenado.IdRespuesta}</td>
                <td>${!llenado.server_id ? 'Pendiente' : 'Sincronizado'}</td>
                <td>
                    <button class="button small edit-llenado-btn" data-local-id="${llenado.local_id}">Editar</button>
                    <button class="button small delete-llenado-btn" data-local-id="${llenado.local_id}">Eliminar</button>
                </td>
            `;
            llenadosTableBody.appendChild(tr);
        });
    }

    // --- LÓGICA CRUD (Exámenes) ---
    function openExamenModalForCreate() {
        examenModalTitle.textContent = 'Crear Nuevo Examen';
        examenForm.reset();
        examenLocalIdInput.value = '';
        modalOverlay.style.display = 'block';
        examenModal.style.display = 'block';
    }

    async function openExamenModalForEdit(localId) {
        const examen = await getSingleItemFromDB('examenes', localId);
        if (!examen) return;
        examenModalTitle.textContent = 'Editar Examen';
        examenLocalIdInput.value = examen.local_id;
        examenNombreInput.value = examen.nombre;
        examenDescripcionInput.value = examen.descripcion;
        modalOverlay.style.display = 'block';
        examenModal.style.display = 'block';
    }

    function closeExamenModal() {
        examenModal.style.display = 'none';
        modalOverlay.style.display = 'none';
    }

    async function handleExamenFormSubmit(event) {
        event.preventDefault();
        const localId = examenLocalIdInput.value;
        const isEditing = !!localId;
        let existingExamen = null;
        if (isEditing) {
            existingExamen = await getSingleItemFromDB('examenes', localId);
        }
        const examenData = {
            local_id: isEditing ? localId : generateUUID(),
            server_id: isEditing && existingExamen ? existingExamen.server_id : null,
            nombre: examenNombreInput.value,
            descripcion: examenDescripcionInput.value,
            last_modified: new Date().toISOString()
        };

        // 1. Guardamos localmente y actualizamos la UI (sin cambios)
        await saveSingleItemToDB('examenes', examenData);
        closeExamenModal();
        await renderExamenes();

        // 2. En lugar de fetch, enviamos los datos al Service Worker para que él se encargue.
        queueSync('examen', examenData);
    }

    async function handleExamenDelete(localId) {
        if (!confirm('¿Estás seguro? Esto eliminará también todas sus preguntas.')) return;

        // 1. Obtenemos el registro ANTES de borrarlo para saber su server_id
        const examenToDelete = await getSingleItemFromDB('examenes', localId);

        // 2. Borramos localmente y actualizamos la UI (sin cambios)
        // TODO: Implementar borrado en cascada
        await deleteItemFromDB('examenes', localId);
        await renderExamenes();

        // 3. Si el examen ya estaba en el servidor, le pedimos al SW que se encargue de borrarlo.
        if (examenToDelete && examenToDelete.server_id) {
            queueSync('examen_delete', { server_id: examenToDelete.server_id });
        }
    }

    // --- LÓGICA CRUD (Preguntas) ---
    function openPreguntaModalForCreate() {
        preguntaModalTitle.textContent = 'Añadir Nueva Pregunta';
        preguntaForm.reset();
        preguntaLocalIdInput.value = '';
        preguntaExamenIdRefInput.value = currentExamenId;
        modalOverlay.style.display = 'block';
        preguntaModal.style.display = 'block';
    }

    async function openPreguntaModalForEdit(preguntaId) {
        const pregunta = await getSingleItemFromDB('preguntas', preguntaId);
        if (!pregunta) return;
        preguntaModalTitle.textContent = 'Editar Pregunta';
        preguntaLocalIdInput.value = pregunta.local_id;
        preguntaExamenIdRefInput.value = pregunta.examen_id_ref;
        preguntaTextoInput.value = pregunta.pregunta;
        preguntaValorInput.value = pregunta.valor;
        modalOverlay.style.display = 'block';
        preguntaModal.style.display = 'block';
    }

    function closePreguntaModal() {
        preguntaModal.style.display = 'none';
        modalOverlay.style.display = 'none';
    }

    async function handlePreguntaFormSubmit(event) {
        event.preventDefault();
        const localId = preguntaLocalIdInput.value;
        const isEditing = !!localId;
        let existingPregunta = null;
        if (isEditing) {
            existingPregunta = await getSingleItemFromDB('preguntas', localId);
        }
        const preguntaData = {
            local_id: isEditing ? localId : generateUUID(),
            server_id: isEditing && existingPregunta ? existingPregunta.server_id : null,
            examen_id_ref: preguntaExamenIdRefInput.value,
            pregunta: preguntaTextoInput.value,
            valor: parseFloat(preguntaValorInput.value),
            last_modified: new Date().toISOString()
        };

        // 1. Guardamos localmente y actualizamos la UI (sin cambios)
        await saveSingleItemToDB('preguntas', preguntaData);
        closePreguntaModal();
        await renderPreguntas();

        // 2. Obtenemos el server_id del padre para enviarlo al SW
        const examenPadre = await getSingleItemFromDB('examenes', preguntaData.examen_id_ref);
        const payloadForSync = {
            ...preguntaData,
            examen_server_id_ref: examenPadre ? examenPadre.server_id : null
        };

        // 3. Enviamos los datos al Service Worker para que él se encargue.
        queueSync('pregunta', payloadForSync);
    }

    async function handlePreguntaDelete(preguntaId) {
        if (!confirm('¿Estás seguro de que quieres eliminar esta pregunta?')) return;

        // 1. Obtenemos el registro ANTES de borrarlo para saber su server_id
        const preguntaToDelete = await getSingleItemFromDB('preguntas', preguntaId);

        // 2. Borramos localmente y actualizamos la UI
        // TODO: Implementar borrado en cascada para sus respuestas
        await deleteItemFromDB('preguntas', preguntaId);
        await renderPreguntas();

        // 3. Si la pregunta ya estaba en el servidor, le pedimos al SW que se encargue de borrarla.
        if (preguntaToDelete && preguntaToDelete.server_id) {
            queueSync('pregunta_delete', { server_id: preguntaToDelete.server_id });
        }
    }


    function openRespuestaModalForCreate() {
        respuestaModalTitle.textContent = 'Añadir Nueva Respuesta';
        respuestaForm.reset();
        respuestaLocalIdInput.value = '';
        respuestaPreguntaIdRefInput.value = currentPreguntaId;
        modalOverlay.style.display = 'block';
        respuestaModal.style.display = 'block';
    }

    async function openRespuestaModalForEdit(respuestaId) {
        const respuesta = await getSingleItemFromDB('respuestas', respuestaId);
        if (!respuesta) return;
        respuestaModalTitle.textContent = 'Editar Respuesta';
        respuestaLocalIdInput.value = respuesta.local_id;
        respuestaPreguntaIdRefInput.value = respuesta.pregunta_id_ref;
        respuestaTextoInput.value = respuesta.respuesta;
        respuestaCorrectaInput.checked = parseInt(respuesta.correcta) === 1;
        modalOverlay.style.display = 'block';
        respuestaModal.style.display = 'block';
    }

    function closeRespuestaModal() {
        respuestaModal.style.display = 'none';
        modalOverlay.style.display = 'none';
    }

    async function handleRespuestaFormSubmit(event) {
        event.preventDefault();
        const localId = respuestaLocalIdInput.value;
        const isEditing = !!localId;
        let existingRespuesta = null;
        if (isEditing) {
            existingRespuesta = await getSingleItemFromDB('respuestas', localId);
        }
        const respuestaData = {
            local_id: isEditing ? localId : generateUUID(),
            server_id: isEditing && existingRespuesta ? existingRespuesta.server_id : null,
            pregunta_id_ref: respuestaPreguntaIdRefInput.value,
            respuesta: respuestaTextoInput.value,
            correcta: respuestaCorrectaInput.checked ? 1 : 0,
            last_modified: new Date().toISOString()
        };

        // 1. Guardamos localmente y actualizamos la UI (sin cambios)
        await saveSingleItemToDB('respuestas', respuestaData);
        closeRespuestaModal();
        await renderRespuestas();

        // 2. Obtenemos el server_id del padre para enviarlo al SW
        const preguntaPadre = await getSingleItemFromDB('preguntas', respuestaData.pregunta_id_ref);
        const payloadForSync = {
            ...respuestaData,
            pregunta_server_id_ref: preguntaPadre ? preguntaPadre.server_id : null
        };

        // 3. Enviamos los datos al Service Worker para que él se encargue.
        queueSync('respuesta', payloadForSync);
    }

    async function handleRespuestaDelete(respuestaId) {
        if (!confirm('¿Estás seguro de que quieres eliminar esta respuesta?')) return;

        // 1. Obtenemos el registro ANTES de borrarlo para saber su server_id
        const respuestaToDelete = await getSingleItemFromDB('respuestas', respuestaId);

        // 2. Borramos localmente y actualizamos la UI
        await deleteItemFromDB('respuestas', respuestaId);
        await renderRespuestas();

        // 3. Si la respuesta ya estaba en el servidor, le pedimos al SW que se encargue de borrarla.
        if (respuestaToDelete && respuestaToDelete.server_id) {
            queueSync('respuesta_delete', { server_id: respuestaToDelete.server_id });
        }
    }

    function openLlenadoModalForCreate() {
        document.getElementById('llenado-modal-title').textContent = 'Añadir Nuevo Llenado';
        llenadoForm.reset();
        llenadoLocalIdInput.value = '';
        // Asignamos la referencia al examen actual
        llenadoExamenIdRefInput.value = currentExamenId;
        modalOverlay.style.display = 'block';
        llenadoModal.style.display = 'block';
    }

    async function openLlenadoModalForEdit(localId) {
        const llenado = await getSingleItemFromDB('llenados', localId);
        if (!llenado) return;
        document.getElementById('llenado-modal-title').textContent = 'Editar Llenado';
        llenadoLocalIdInput.value = llenado.local_id;
        llenadoExamenIdRefInput.value = llenado.examen_id_ref;
        llenadoClaveInput.value = llenado.Clave;
        llenadoRespuestaIdInput.value = llenado.IdRespuesta;
        modalOverlay.style.display = 'block';
        llenadoModal.style.display = 'block';
    }

    function closeLlenadoModal() {
        llenadoModal.style.display = 'none';
        modalOverlay.style.display = 'none';
    }

    async function handleLlenadoFormSubmit(event) {
        event.preventDefault();
        const localId = llenadoLocalIdInput.value;
        const isEditing = !!localId;

        let existingLlenado = null;
        if (isEditing) {
            existingLlenado = await getSingleItemFromDB('llenados', localId);
        }

        const llenadoData = {
            local_id: isEditing ? localId : generateUUID(),
            server_id: isEditing ? existingLlenado.server_id : null,
            examen_id_ref: llenadoExamenIdRefInput.value,
            Clave: llenadoClaveInput.value,
            IdRespuesta: parseInt(llenadoRespuestaIdInput.value),
            last_modified: new Date().toISOString()
        };
        await saveSingleItemToDB('llenados', llenadoData);
        closeLlenadoModal();
        await renderLlenados();
        
        // Para la sincronización, necesitamos el server_id del examen padre
        const examenPadre = await getSingleItemFromDB('examenes', llenadoData.examen_id_ref);
        const payloadForSync = {
            ...llenadoData,
            examen_server_id_ref: examenPadre ? examenPadre.server_id : null
        };
        queueSync('llenado', payloadForSync);
    }

    async function handleLlenadoDelete(localId) {
        if (!confirm('¿Estás seguro?')) return;
        const llenadoToDelete = await getSingleItemFromDB('llenados', localId);
        await deleteItemFromDB('llenados', localId);
        await renderLlenados();
        if (llenadoToDelete && llenadoToDelete.server_id) {
            queueSync('llenado_delete', { server_id: llenadoToDelete.server_id });
        }
    }

    // --- MANEJADORES DE CLICS DELEGADOS ---
    function handleExamenesTableClick(e) {
        const button = e.target.closest('.button');
        const row = e.target.closest('tr');
        if (button) {
            e.stopPropagation();
            // CORRECCIÓN: Lógica movida aquí dentro
            if (button.classList.contains('view-llenados-btn')) {
                navigateToLlenados(button.dataset.localId);
            } else if (button.classList.contains('edit-btn')) {
                openExamenModalForEdit(button.dataset.localId);
            } else if (button.classList.contains('delete-btn')) {
                handleExamenDelete(button.dataset.localId);
            }
        } else if (row && row.dataset.localId) {
            navigateToPreguntas(row.dataset.localId);
        }
    }
    
    function handlePreguntasTableClick(e) {
        const button = e.target.closest('.button');
        const row = e.target.closest('tr');
        if (button) {
            e.stopPropagation();
            if (button.classList.contains('edit-pregunta-btn')) openPreguntaModalForEdit(button.dataset.localId);
            if (button.classList.contains('delete-pregunta-btn')) handlePreguntaDelete(button.dataset.localId);
        } else if (row && row.dataset.localId) {
            navigateToRespuestas(row.dataset.localId); // MODIFICADO: Navega a respuestas
        }
    }

    function handleRespuestasTableClick(e) {
            const button = e.target.closest('.button');
            if (!button) return;
            e.stopPropagation();
            if (button.classList.contains('edit-respuesta-btn')) openRespuestaModalForEdit(button.dataset.localId);
            if (button.classList.contains('delete-respuesta-btn')) handleRespuestaDelete(button.dataset.localId);
        }

        function handleLlenadosTableClick(e) {
        const button = e.target.closest('.button');
        if (!button) return; // Si no se hizo clic en un botón, no hacer nada

        e.stopPropagation(); // Detener la propagación del evento

        if (button.classList.contains('edit-llenado-btn')) {
            openLlenadoModalForEdit(button.dataset.localId);
        }
        if (button.classList.contains('delete-llenado-btn')) {
            handleLlenadoDelete(button.dataset.localId);
        }
    }

    // --- SINCRONIZACIÓN CON SERVIDOR ---
    async function syncServerToLocal() {
        if (!navigator.onLine) {
            console.log("Offline. Omitiendo sincronización Server -> Local.");
            return;
        }

        try {
            console.log('Iniciando sincronización Server -> Local...');
            const response = await fetch('/awp/api/sync.php');
            if (!response.ok) throw new Error(`Error en la respuesta del servidor: ${response.statusText}`);
            
            const serverData = await response.json();

            // --- RECONCILIACIÓN DE EXÁMENES ---
            await reconcileData('examenes', serverData.examenes);

            // --- MAPA DE TRADUCCIÓN PARA EXÁMENES ---
            const todosLosExamenesLocales = await getFromDB('examenes');
            const examenServerIdToLocalIdMap = new Map(); // <-- NOMBRE MEJORADO
            todosLosExamenesLocales.forEach(examen => {
                if (examen.server_id) {
                    examenServerIdToLocalIdMap.set(examen.server_id, examen.local_id);
                }
            });

            // --- RECONCILIACIÓN DE PREGUNTAS ---
            const preguntasParaReconciliar = serverData.preguntas.map(pregunta => {
                const localExamenId = examenServerIdToLocalIdMap.get(pregunta.examen_id_ref); // Usamos el nuevo nombre
                if (localExamenId) {
                    return { ...pregunta, examen_id_ref: localExamenId };
                }
                return null;
            }).filter(Boolean);
            await reconcileData('preguntas', preguntasParaReconciliar);

            // --- MAPA DE TRADUCCIÓN PARA PREGUNTAS ---
            const todasLasPreguntasLocales = await getFromDB('preguntas');
            const preguntaServerIdToLocalIdMap = new Map();
            todasLasPreguntasLocales.forEach(pregunta => {
                if (pregunta.server_id) {
                    preguntaServerIdToLocalIdMap.set(pregunta.server_id, pregunta.local_id);
                }
            });

            // --- RECONCILIACIÓN DE RESPUESTAS ---
            const respuestasParaReconciliar = serverData.respuestas.map(respuesta => {
                const localPreguntaId = preguntaServerIdToLocalIdMap.get(respuesta.pregunta_id_ref);
                if (localPreguntaId) {
                    return { ...respuesta, pregunta_id_ref: localPreguntaId };
                }
                return null;
            }).filter(Boolean);
            await reconcileData('respuestas', respuestasParaReconciliar);

            // --- RECONCILIACIÓN DE LLENADOS ---
            const llenadosParaReconciliar = serverData.llenados.map(llenado => {
                const localExamenId = examenServerIdToLocalIdMap.get(llenado.examen_id_ref);
                if (localExamenId) {
                    return { ...llenado, examen_id_ref: localExamenId };
                }
                return null;
            }).filter(Boolean);
            await reconcileData('llenados', llenadosParaReconciliar);

            console.log('Sincronización Server -> Local completada.');
            
            // Refrescar la UI
            if (examenesView.style.display !== 'none') await renderExamenes();
            if (preguntasView.style.display !== 'none') await renderPreguntas();
            if (respuestasView.style.display !== 'none') await renderRespuestas();
            if (llenadosView.style.display !== 'none') await renderLlenados();

        } catch (error) {
            console.error('Error sincronizando datos del servidor:', error);
        }
    }

    async function reconcileData(storeName, serverItems) {
        if (!serverItems || serverItems.length === 0) {
            // console.log(`Reconcile: No hay items del servidor para '${storeName}'.`); // Opcional
            return;
        }

        // Abrimos una única transacción para todas las operaciones en este almacén
        const db = await window.dbManager.initDB();
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.store;
        const serverIdIndex = store.index('server_id'); // Usamos el índice para búsquedas eficientes

        for (const serverItem of serverItems) {
            // Ignoramos items del servidor que por alguna razón no tengan ID
            if (!serverItem.server_id) {
                console.warn(`Reconcile: Item en '${storeName}' sin server_id, ignorado.`, serverItem);
                continue;
            }

            // Buscamos si ya tenemos un registro local con este ID del servidor
            const existingLocalItem = await serverIdIndex.get(serverItem.server_id);

            if (existingLocalItem) {
                // --- CASO 1: El registro ya existe localmente ---
                // Comparamos las fechas para ver si la versión del servidor es más nueva
                const serverDate = new Date(serverItem.last_modified);
                const localDate = new Date(existingLocalItem.last_modified);

                if (serverDate > localDate) {
                    // La versión del servidor es más reciente, así que actualizamos nuestro registro local.
                    // Mantenemos el local_id que ya teníamos.
                    const updatedItem = { ...existingLocalItem, ...serverItem };
                    await store.put(updatedItem);
                }
            } else {
                // --- CASO 2: El registro no existe localmente ---
                // Es un item nuevo (probablemente creado en otro dispositivo). Lo añadimos a nuestra BD local.
                const newItem = {
                    ...serverItem,
                    local_id: window.dbManager.generateUUID() // Le asignamos un nuevo local_id
                };
                await store.put(newItem);
            }
        }

        // Esperamos a que la transacción se complete
        await tx.done;
        console.log(`Reconciliación completada para '${storeName}'.`);
    }

    async function updateLocalRecordWithServerData(serverResponse) {
        if (!serverResponse || !serverResponse.type || !serverResponse.data) {
            console.error("Respuesta de sincronización inválida:", serverResponse);
            return;
        }
        const { type, data } = serverResponse;
        let storeName = '';
        switch (type) {
            case 'examen':
                storeName = 'examenes';
                break;
            case 'pregunta':
                storeName = 'preguntas';
                break;
            case 'respuesta':
                storeName = 'respuestas';
                break;
            case 'llenado':
                storeName = 'llenados';
                break;
            default:
                console.error(`Tipo de objeto desconocido para sincronizar: ${type}`);
                return;
        }
        
        try {
            const localRecord = await getSingleItemFromDB(storeName, data.local_id);
            if (localRecord) {
                localRecord.server_id = data.server_id;
                localRecord.last_modified = data.last_modified;
                await saveSingleItemToDB(storeName, localRecord);
                
                console.log(`Registro local actualizado en '${storeName}' con server_id: ${data.server_id}`);

                if (document.visibilityState === 'visible') {
                    if (storeName === 'examenes') await renderExamenes();
                    else if (storeName === 'preguntas') await renderPreguntas();
                    else if (storeName === 'respuestas') await renderRespuestas();
                    else if (storeName === 'llenados') await renderLlenados();
                }
            }
        } catch (error) {
            console.error(`Error al actualizar el registro local en '${storeName}':`, error);
        }
    }

    async function start() {
        // 1. Renderizar inmediatamente con datos locales
        await renderExamenes();
        
        // 2. Iniciar la sincronización desde el servidor en segundo plano
        syncServerToLocal();

        if (navigator.onLine) {
            console.log('APP: Online al cargar, pidiendo al SW que sincronice la cola.');
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'FORCE_SYNC_REPLAY' });
            }
        }
    }

    function queueSync(type, payload) {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'QUEUE_SYNC_REQUEST',
                payload: { type, payload }
            });
            console.log(`APP: Enviando '${type}' a la cola de sincronización del SW.`);
        } else {
            // Fallback por si el SW no está activo. Intentamos el fetch directamente.
            console.warn("Service Worker no activo. Intentando fetch directo como fallback.");
            fetch('/awp/api/sync.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, payload })
            }).catch(err => console.error("Fetch de fallback también falló.", err));
        }
    }

    // --- EJECUCIÓN INICIAL ---
    start();
}