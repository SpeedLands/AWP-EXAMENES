// /awp/idb-manager.js

const DB_NAME = 'awp-pwa-db';
const DB_VERSION = 4; 
let db; // Variable para mantener la instancia de la BD

/**
 * Initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>} A promise that resolves to the database instance.
 */
async function initDB() {
    if (db) return db;

    db = await idb.openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            console.log(`Actualizando DB de versión ${oldVersion} a ${newVersion}`);

            if (oldVersion < 2) {
                if (!db.objectStoreNames.contains('examenes')) {
                    const examenesStore = db.createObjectStore('examenes', { keyPath: 'local_id' });
                    examenesStore.createIndex('server_id', 'server_id', { unique: true });
                    examenesStore.createIndex('last_modified', 'last_modified');
                }

                if (!db.objectStoreNames.contains('preguntas')) {
                    const preguntasStore = db.createObjectStore('preguntas', { keyPath: 'local_id' });
                    preguntasStore.createIndex('server_id', 'server_id', { unique: true });
                    preguntasStore.createIndex('examen_id_ref', 'examen_id_ref');
                    preguntasStore.createIndex('last_modified', 'last_modified');
                }

                if (!db.objectStoreNames.contains('respuestas')) {
                    const respuestasStore = db.createObjectStore('respuestas', { keyPath: 'local_id' });
                    respuestasStore.createIndex('server_id', 'server_id', { unique: true });
                    respuestasStore.createIndex('pregunta_id_ref', 'pregunta_id_ref');
                    respuestasStore.createIndex('last_modified', 'last_modified');
                }

                if (!db.objectStoreNames.contains('llenados')) {
                    const llenadosStore = db.createObjectStore('llenados', { keyPath: 'local_id' });
                    llenadosStore.createIndex('examen_id_ref', 'examen_id_ref');
                    llenadosStore.createIndex('usuario_id', 'usuario_id'); 
                    llenadosStore.createIndex('last_modified', 'last_modified');
                }

                // 2. AÑADIMOS EL NUEVO OBJECT STORE PARA LA SESIÓN
                if (!db.objectStoreNames.contains('session')) {
                    console.log('Creando Object Store: session');
                    const sessionStore = db.createObjectStore('session', { keyPath: 'id' });
                }
            }

            if (oldVersion < 3) {
                if (!db.objectStoreNames.contains('pending_submissions')) {
                    console.log('Creando Object Store: pending_submissions');
                    // Usamos un ID simple como keyPath y autoIncrement para facilidad
                    const store = db.createObjectStore('pending_submissions', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                }
            }

            if (oldVersion < 4) {
                if (db.objectStoreNames.contains('llenados')) {
                    console.log("Añadiendo índice 'server_id' al almacén 'llenados'.");
                    // Obtenemos una referencia al almacén existente para modificarlo
                    const llenadosStore = transaction.objectStore('llenados');
                    // Creamos el nuevo índice
                    llenadosStore.createIndex('server_id', 'server_id', { unique: true });
                }
            }
            
        },
    });
    console.log('Base de datos IndexedDB inicializada.');
    return db;
}

/**
 * Gets all items from a store.
 * @param {string} storeName The name of the store.
 * @returns {Promise<Array>} A promise that resolves to an array of items.
 */
async function getFromDB(storeName) {
    const db = await initDB();
    return db.getAll(storeName);
}

/**
 * Saves an array of items to a store.
 * @param {string} storeName The name of the store.
 * @param {Array} data The data to save.
 * @returns {Promise<void>} A promise that resolves when the data is saved.
 */
async function saveToDB(storeName, data) {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    await Promise.all(data.map(item => tx.store.put(item)));
    return tx.done;
}

/**
 * Saves a single item to a store.
 * @param {string} storeName The name of the store.
 * @param {object} item The item to save.
 * @returns {Promise<void>} A promise that resolves when the item is saved.
 */
async function saveSingleItemToDB(storeName, item) {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    await tx.store.put(item);
    return tx.done;
}

/**
 * Generates a UUID.
 * @returns {string} A UUID.
 */
function generateUUID() {
    if (crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Gets a single item from a store by key.
 * @param {string} storeName The name of the store.
 * @param {string} key The key of the item to get.
 * @returns {Promise<object>} A promise that resolves to the item.
 */
async function getSingleItemFromDB(storeName, key) {
    const db = await initDB();
    return db.get(storeName, key);
}

/**
 * Deletes an item from a store by key.
 * @param {string} storeName The name of the store.
 * @param {string} key The key of the item to delete.
 * @returns {Promise<void>} A promise that resolves when the item is deleted.
 */
async function deleteItemFromDB(storeName, key) {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    await tx.store.delete(key);
    return tx.done;
}

const dbManager = {
    initDB,
    getFromDB,
    saveToDB,
    saveSingleItemToDB,
    getSingleItemFromDB,
    deleteItemFromDB,
    generateUUID
};

if (typeof self !== 'undefined') {
    // Si 'self' existe, estamos en un Service Worker (o Web Worker).
    // Asignamos el dbManager al objeto global 'self'.
    self.dbManager = dbManager;
}
