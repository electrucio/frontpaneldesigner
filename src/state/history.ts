/**
 * Historial de deshacer/rehacer con coalescencia por transacción.
 *
 * Sin coalescencia, teclear "12.5" en un campo numérico generaría cuatro
 * entradas de historial y el undo sería inútil. Los cambios que comparten
 * `txKey` (mismo campo del mismo objeto) dentro de una ventana corta se funden
 * en una sola entrada; cualquier otra acción, un `blur` o un cambio de
 * selección cierran la transacción.
 */

export const COALESCE_WINDOW_MS = 500
export const HISTORY_LIMIT = 200

export interface History<T> {
  past: T[]
  present: T
  future: T[]
  /** Transacción abierta: clave del campo y momento del último cambio. */
  tx: { key: string; at: number } | null
}

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], tx: null }
}

export interface CommitOptions {
  /** Identifica el campo que se está editando; `null` = cambio atómico. */
  txKey?: string | null
  now?: number
  windowMs?: number
}

export function commit<T>(h: History<T>, next: T, opts: CommitOptions = {}): History<T> {
  const { txKey = null, now = Date.now(), windowMs = COALESCE_WINDOW_MS } = opts

  const continues =
    txKey !== null && h.tx !== null && h.tx.key === txKey && now - h.tx.at < windowMs

  if (continues) {
    // La entrada de historial ya se creó al primer cambio de esta transacción.
    return { past: h.past, present: next, future: [], tx: { key: txKey, at: now } }
  }

  const past = [...h.past, h.present]
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
    present: next,
    future: [],
    tx: txKey === null ? null : { key: txKey, at: now },
  }
}

/** Cierra la transacción abierta sin tocar el documento (blur, cambio de selección). */
export function endTransaction<T>(h: History<T>): History<T> {
  return h.tx === null ? h : { ...h, tx: null }
}

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h
  const present = h.past[h.past.length - 1]
  return {
    past: h.past.slice(0, -1),
    present,
    future: [h.present, ...h.future],
    tx: null,
  }
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h
  const [present, ...future] = h.future
  return { past: [...h.past, h.present], present, future, tx: null }
}
