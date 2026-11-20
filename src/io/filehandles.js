// 记住最近打开的文件句柄（File System Access API + IndexedDB），
// 这样点「最近打开」能直接打开，而不是再弹一次选择框。
// 状态：已实现；不支持句柄的浏览器自动退回文件选择框。

const DB_NAME = 'figcut';
const STORE = 'handles';

function hasIdb() {
  return typeof indexedDB !== 'undefined';
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function handleKey(name, size) {
  return String(name) + '|' + Number(size);
}

export async function saveHandle(name, size, handle) {
  if (!handle || !hasIdb()) return false;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(handle, handleKey(name, size));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch (e) {
    return false;
  }
}

export async function loadHandle(name, size) {
  if (!hasIdb()) return null;
  try {
    const db = await openDb();
    const handle = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(handleKey(name, size));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch (e) {
    return null;
  }
}

// 直接打开最近文件：拿到句柄就读，权限被拒就返回 null 让调用方退回选择框
export async function reopenRecent(entry) {
  const handle = await loadHandle(entry.name, entry.size);
  if (!handle) return null;
  try {
    const perm = handle.queryPermission ? await handle.queryPermission({ mode: 'read' }) : 'granted';
    if (perm !== 'granted') {
      const asked = handle.requestPermission ? await handle.requestPermission({ mode: 'read' }) : 'denied';
      if (asked !== 'granted') return null;
    }
    const file = await handle.getFile();
    if (!file) return null;
    return file;
  } catch (e) {
    return null;
  }
}

export function hasPickHandle() {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
}

export async function pickWithHandle() {
  if (!hasPickHandle()) return null;
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
      multiple: false,
    });
    if (!handle) return null;
    const file = await handle.getFile();
    return { file, handle };
  } catch (e) {
    return null; // 用户取消
  }
}
