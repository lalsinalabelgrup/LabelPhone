/**
 * wallpaperService.js
 * Centralizes all wallpaper persistence for the idle home screen so no
 * scattered localStorage/IndexedDB calls exist elsewhere.
 *
 * Preset selection ('default'|'dark'|'gradient'|'corporate'|'custom') is a
 * tiny string, stored in localStorage. The custom image itself is a
 * potentially multi-MB blob, which risks localStorage's ~5-10MB quota if
 * base64-encoded there — so it is stored in IndexedDB instead.
 *
 * No network calls anywhere in this file. The custom image never leaves
 * the browser.
 */

const wallpaperService = (() => {

  const STORAGE_KEY   = 'lp-wallpaper';
  const DB_NAME        = 'labelphone-wallpaper';
  const DB_VERSION     = 1;
  const STORE_NAME     = 'images';
  const IMAGE_KEY       = 'custom';
  const MAX_BYTES      = 5 * 1024 * 1024; // 5 MB

  const PRESETS = ['default', 'dark', 'gradient', 'corporate', 'custom'];

  let _db = null;

  function _openDb() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror   = () => reject(req.error || new Error('IndexedDB open failed'));
    });
  }

  function getSelected() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return PRESETS.includes(saved) ? saved : 'default';
  }

  function setSelected(id) {
    if (!PRESETS.includes(id)) return;
    localStorage.setItem(STORAGE_KEY, id);
  }

  function saveCustomImage(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return Promise.reject(new Error('invalid_type'));
    }
    if (file.size > MAX_BYTES) {
      return Promise.reject(new Error('too_large'));
    }
    return _openDb().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(file, IMAGE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error || new Error('IndexedDB write failed'));
    }));
  }

  function loadCustomImageURL() {
    return _openDb().then(db => new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(IMAGE_KEY);
      req.onsuccess = () => {
        if (!req.result) { resolve(null); return; }
        resolve(URL.createObjectURL(req.result));
      };
      req.onerror = () => reject(req.error || new Error('IndexedDB read failed'));
    }));
  }

  function resetToDefault() {
    setSelected('default');
    return _openDb().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(IMAGE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error || new Error('IndexedDB delete failed'));
    }));
  }

  return {
    getSelected,
    setSelected,
    saveCustomImage,
    loadCustomImageURL,
    resetToDefault,
  };
})();
