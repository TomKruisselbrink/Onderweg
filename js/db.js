// Kleine IndexedDB-wrapper — alles blijft lokaal op het toestel, werkt zonder internet.
const VakantieDB = (() => {
  const DB_NAME = 'vakantiedagboek';
  const STORE = 'entries';
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function put(entry) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAll() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result.sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function mergeMany(entries) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      let added = 0, skipped = 0;
      let pending = entries.length;
      if (pending === 0) return resolve({ added, skipped });
      entries.forEach((entry) => {
        const getReq = store.get(entry.id);
        getReq.onsuccess = () => {
          if (getReq.result) {
            skipped++;
          } else {
            store.put(entry);
            added++;
          }
          pending--;
          if (pending === 0) resolve({ added, skipped });
        };
        getReq.onerror = () => {
          pending--;
          if (pending === 0) resolve({ added, skipped });
        };
      });
      tx.onerror = () => reject(tx.error);
    });
  }

  return { put, getAll, remove, mergeMany };
})();
