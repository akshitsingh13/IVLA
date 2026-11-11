// Native IndexedDB storage layer for IVLA whiteboards.
import { renderAll } from '../board/renderer.js';
import { drawBackground } from '../board/backgrounds.js';

const DB_NAME = 'ivla_db';
const DB_VERSION = 1;
const STORE_NAME = 'whiteboards';

let dbPromise = null;

export function getDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open database'));
  });

  return dbPromise;
}

export async function getAllWhiteboards() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result) ? req.result : [];
        // Sort descending by last modified
        list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to get whiteboards from IndexedDB:', err);
    return [];
  }
}

export async function getWhiteboard(id) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Failed to load whiteboard ${id}:`, err);
    return null;
  }
}

export async function saveWhiteboard(board) {
  if (!board || !board.id) return null;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        ...board,
        updatedAt: Date.now(),
      });
      req.onsuccess = () => resolve(board);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save whiteboard to IndexedDB:', err);
    return null;
  }
}

export async function deleteWhiteboard(id) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Failed to delete whiteboard ${id}:`, err);
    return false;
  }
}

/**
 * Generate a lightweight thumbnail data URL for a board's elements and background.
 */
export function generateThumbnailDataUrl(elements, background = 'white') {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    drawBackground(ctx, canvas.width, canvas.height, background);

    if (elements && elements.length > 0) {
      const vw = Math.max(window.innerWidth || 1200, 800);
      const vh = Math.max(window.innerHeight || 800, 600);
      const scale = Math.min(canvas.width / vw, canvas.height / vh);
      ctx.save();
      ctx.scale(scale, scale);
      renderAll(ctx, elements);
      ctx.restore();
    }
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch (err) {
    console.error('Thumbnail generation failed:', err);
    return null;
  }
}
