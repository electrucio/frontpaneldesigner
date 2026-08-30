import { openDB, type IDBPDatabase } from 'idb'
import type { Doc } from '../core/types'
import { migrateDoc } from '../core/doc'

/**
 * Autoguardado en IndexedDB, no en localStorage: un logo SVG embebido en el
 * proyecto se come los 5 MB de localStorage enseguida.
 *
 * Todo fallo de almacenamiento se degrada a "no hay autoguardado" en lugar de
 * romper el editor: en ventana privada o con las cookies bloqueadas, IndexedDB
 * puede no estar disponible.
 */

const DB_NAME = 'frontpaneldesigner'
const DB_VERSION = 1
const STORE = 'projects'
const CURRENT_KEY = 'current'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      },
    })
  }
  return dbPromise
}

export async function saveCurrentDoc(doc: Doc): Promise<boolean> {
  try {
    const db = await getDb()
    await db.put(STORE, doc, CURRENT_KEY)
    return true
  } catch (err) {
    console.warn('Autoguardado no disponible:', err)
    return false
  }
}

export async function loadCurrentDoc(): Promise<Doc | null> {
  try {
    const db = await getDb()
    const raw = await db.get(STORE, CURRENT_KEY)
    return raw ? migrateDoc(raw) : null
  } catch (err) {
    console.warn('No se pudo recuperar el proyecto autoguardado:', err)
    return null
  }
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: A) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
