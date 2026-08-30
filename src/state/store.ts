import { create } from 'zustand'
import type { Doc, Obj, PanelSpec, ToolProfile } from '../core/types'
import {
  createDefaultDoc, duplicateObject as duplicateObj, mapObject,
  removeObject as removeObj,
} from '../core/doc'
import {
  canRedo, canUndo, commit, endTransaction, initHistory,
  redo as redoHistory, undo as undoHistory, type History,
} from './history'
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions } from '../core/render/toSvg'
import { debounce, saveCurrentDoc } from './persist'

interface AppState {
  history: History<Doc>
  selection: string[]
  exportOptions: ExportOptions

  /** Documento actual. Atajo de lectura sobre el historial. */
  doc: () => Doc

  update: (fn: (doc: Doc) => Doc, txKey?: string | null) => void
  replaceDoc: (doc: Doc) => void
  patchPanel: (patch: Partial<PanelSpec>, txKey?: string | null) => void
  patchTool: (patch: Partial<ToolProfile>, txKey?: string | null) => void

  addObject: (obj: Obj) => void
  duplicateObject: (id: string) => void
  patchObject: (id: string, patch: Partial<Obj>, txKey?: string | null) => void
  deleteObject: (id: string) => void

  select: (ids: string[]) => void
  endEdit: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  setExportOptions: (patch: Partial<ExportOptions>) => void
}

const autosave = debounce((doc: Doc) => void saveCurrentDoc(doc), 400)

export const useStore = create<AppState>((set, get) => ({
  history: initHistory(createDefaultDoc()),
  selection: [],
  exportOptions: { ...DEFAULT_EXPORT_OPTIONS },

  doc: () => get().history.present,

  update(fn, txKey = null) {
    set((s) => {
      const next = fn(s.history.present)
      if (next === s.history.present) return s
      autosave(next)
      return { history: commit(s.history, next, { txKey }) }
    })
  },

  replaceDoc(doc) {
    autosave(doc)
    set({ history: initHistory(doc), selection: [] })
  },

  patchPanel(patch, txKey = null) {
    get().update((doc) => ({ ...doc, panel: { ...doc.panel, ...patch } }), txKey)
  },

  patchTool(patch, txKey = null) {
    get().update((doc) => ({ ...doc, tool: { ...doc.tool, ...patch } }), txKey)
  },

  addObject(obj) {
    get().update((doc) => ({ ...doc, objects: [...doc.objects, obj] }))
    set({ selection: [obj.id] })
  },

  /**
   * Duplica un objeto y selecciona la copia: lo normal después de copiar es
   * cambiarle un par de parámetros, no volver a buscarla en la lista.
   */
  duplicateObject(id) {
    let created: string | null = null
    get().update((doc) => {
      const { objects, newId } = duplicateObj(doc.objects, id)
      created = newId
      return newId === null ? doc : { ...doc, objects }
    })
    if (created) set({ selection: [created] })
  },

  patchObject(id, patch, txKey = null) {
    get().update(
      (doc) => ({ ...doc, objects: mapObject(doc.objects, id, (o) => ({ ...o, ...patch }) as Obj) }),
      txKey,
    )
  },

  deleteObject(id) {
    get().update((doc) => ({ ...doc, objects: removeObj(doc.objects, id) }))
    set((s) => ({ selection: s.selection.filter((x) => x !== id) }))
  },

  // Cambiar de selección cierra la transacción de edición en curso, para que el
  // undo no funda el último retoque de un objeto con el primero del siguiente.
  select(ids) {
    set((s) => ({ selection: ids, history: endTransaction(s.history) }))
  },

  endEdit() {
    set((s) => ({ history: endTransaction(s.history) }))
  },

  undo() {
    set((s) => {
      const h = undoHistory(s.history)
      if (h !== s.history) autosave(h.present)
      return { history: h }
    })
  },

  redo() {
    set((s) => {
      const h = redoHistory(s.history)
      if (h !== s.history) autosave(h.present)
      return { history: h }
    })
  },

  canUndo: () => canUndo(get().history),
  canRedo: () => canRedo(get().history),

  setExportOptions(patch) {
    set((s) => ({ exportOptions: { ...s.exportOptions, ...patch } }))
  },
}))

// En desarrollo, el store queda accesible desde la consola del navegador para
// poder inspeccionar el historial sin instrumentar los componentes.
if (import.meta.env.DEV) {
  ;(globalThis as unknown as Record<string, unknown>).__fpd = useStore
}

/** Selector del documento, para componentes que solo necesitan leerlo. */
export const useDoc = (): Doc => useStore((s) => s.history.present)
