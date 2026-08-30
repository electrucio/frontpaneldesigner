import { DEFAULT_SCALE_PRESET } from './scalePresets'
import {
  DOC_VERSION,
  type Anchor, type ArcObj, type CircleObj, type Doc, type HoleObj,
  type LayerId, type LineObj, type Obj, type ObjType, type PanelSpec,
  type LogoObj, type RectObj, type ScaleObj, type TextObj, type ToolProfile,
} from './types'

let idCounter = 0

/** Id corto y legible; único dentro del proceso, que es cuanto necesita el editor. */
export function newId(prefix = 'o'): string {
  idCounter += 1
  return `${prefix}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export const DEFAULT_TOOL: ToolProfile = {
  includedAngleDeg: 30,
  tipMm: 0.2,
  defaultDepthMm: 0.3,
  maxDepthMm: 0.8,
  calibration: null,
}

export const DEFAULT_PANEL: PanelSpec = {
  w: 200,
  h: 60,
  cornerRadiusMm: 0,
  edgeMarginMm: 3,
  background: '#1c1c1c',
  engraveColor: '#f2f2f2',
}

export function createDefaultDoc(name = 'Panel sin titulo'): Doc {
  return {
    version: DOC_VERSION,
    name,
    panel: { ...DEFAULT_PANEL },
    tool: { ...DEFAULT_TOOL },
    objects: [],
  }
}

// ---------------------------------------------------------------------------
// Fábricas de objetos
// ---------------------------------------------------------------------------

function base(type: ObjType, layer: LayerId, anchor: Anchor = 'topLeft') {
  return {
    id: newId(type[0]),
    name: '',
    visible: true,
    locked: false,
    layer,
    anchor,
    x: 0,
    y: 0,
    rotationDeg: 0,
    depthMm: null,
  }
}

/** Familia por defecto: línea única, que es lo que quiere una V-bit fina. */
export const DEFAULT_FONT_ID = 'hershey-sans'

export function createText(x = 20, y = 20): TextObj {
  return {
    ...base('text', 'engrave'),
    type: 'text',
    name: 'Texto',
    x, y,
    text: 'GAIN',
    fontId: DEFAULT_FONT_ID,
    mode: 'centerline',
    capHeightMm: 3,
    trackingMm: 0.3,
    lineGapMm: 1,
    align: 'center',
    vAlign: 'middle',
    arc: null,
  }
}

export function createScale(x = 30, y = 30): ScaleObj {
  return {
    ...base('scale', 'engrave'),
    type: 'scale',
    name: 'Escala',
    x, y,
    ...DEFAULT_SCALE_PRESET.settings,
  }
}

/**
 * Crea el objeto a partir de lo que devuelve el importador. El ancho por
 * defecto es prudente: un logotipo de panel rara vez pasa de 40 mm.
 */
export function createLogo(
  imported: { paths: { d: string; filled: boolean }[]; width: number; height: number },
  name: string,
  x = 30, y = 20,
): LogoObj {
  const widthMm = Math.min(40, Math.max(5, imported.width))
  return {
    ...base('logo', 'engrave'),
    type: 'logo',
    name,
    x, y,
    paths: imported.paths,
    sourceW: imported.width,
    sourceH: imported.height,
    widthMm,
    keepAspect: true,
    heightMm: (widthMm * imported.height) / imported.width,
    renderMode: 'as-authored',
  }
}

export function createLine(x = 10, y = 10): LineObj {
  return {
    ...base('line', 'engrave'),
    type: 'line',
    name: 'Linea',
    x, y,
    points: [{ x: 0, y: 0 }, { x: 20, y: 0 }],
    closed: false,
  }
}

export function createRect(x = 10, y = 10): RectObj {
  return {
    ...base('rect', 'engrave'),
    type: 'rect',
    name: 'Rectangulo',
    x, y,
    w: 20,
    h: 10,
    cornerRadiusMm: 0,
    filled: false,
  }
}

export function createCircle(x = 20, y = 20): CircleObj {
  return {
    ...base('circle', 'engrave'),
    type: 'circle',
    name: 'Circulo',
    x, y,
    diameterMm: 20,
    filled: false,
  }
}

export function createArc(x = 20, y = 20): ArcObj {
  return {
    ...base('arc', 'engrave'),
    type: 'arc',
    name: 'Arco',
    x, y,
    radiusMm: 12,
    startAngleDeg: -135,
    endAngleDeg: 135,
  }
}

export function createHole(x = 20, y = 20): HoleObj {
  return {
    ...base('hole', 'drill'),
    type: 'hole',
    name: 'Agujero',
    x, y,
    shape: 'circle',
    diameterMm: 9,
    w: 20,
    h: 12,
    cornerRadiusMm: 1,
  }
}

export const OBJECT_FACTORIES: Partial<Record<ObjType, (x?: number, y?: number) => Obj>> = {
  text: createText,
  scale: createScale,
  line: createLine,
  rect: createRect,
  circle: createCircle,
  arc: createArc,
  hole: createHole,
}

// ---------------------------------------------------------------------------
// Recorrido y edición
// ---------------------------------------------------------------------------

/** Recorre el árbol de objetos en profundidad, incluidos los hijos de grupos. */
export function* walk(objects: Obj[]): Generator<Obj> {
  for (const obj of objects) {
    yield obj
    if (obj.type === 'group') yield* walk(obj.children)
  }
}

export function findObject(doc: Doc, id: string): Obj | null {
  for (const obj of walk(doc.objects)) if (obj.id === id) return obj
  return null
}

/** Devuelve un árbol nuevo con `id` reemplazado por `fn(obj)`. No muta nada. */
export function mapObject(objects: Obj[], id: string, fn: (obj: Obj) => Obj): Obj[] {
  return objects.map((obj) => {
    if (obj.id === id) return fn(obj)
    if (obj.type === 'group') {
      const children = mapObject(obj.children, id, fn)
      return children === obj.children ? obj : { ...obj, children }
    }
    return obj
  })
}

/**
 * Copia profunda con identificadores nuevos, también en los hijos de un grupo.
 *
 * El documento es JSON serializable por diseño, así que la ida y vuelta por
 * JSON es una copia profunda correcta y sin sorpresas.
 */
export function cloneObject(obj: Obj): Obj {
  const copy = JSON.parse(JSON.stringify(obj)) as Obj
  return reassignIds(copy)
}

function reassignIds(obj: Obj): Obj {
  obj.id = newId(obj.type[0])
  if (obj.type === 'group') obj.children = obj.children.map(reassignIds)
  return obj
}

/**
 * Siguiente nombre de la serie: incrementa el número final si lo hay, y si no
 * lo añade. Así «GAIN» pasa a «GAIN 2» y «Reverb 12» a «Reverb 13».
 */
export function nextName(name: string): string {
  const trimmed = name.trim()
  if (trimmed === '') return ''
  const match = /^(.*?)(\d+)$/.exec(trimmed)
  return match ? `${match[1]}${Number(match[2]) + 1}` : `${trimmed} 2`
}

/**
 * Primer nombre de la serie que no esté ya en uso.
 *
 * Sin esto, duplicar «GAIN» teniendo ya un «GAIN 2» crea un segundo «GAIN 2» y
 * el árbol acaba con filas indistinguibles.
 */
export function uniqueName(name: string, used: Set<string>): string {
  let candidate = nextName(name)
  // Un nombre vacío no numera, así que no hay serie por la que avanzar.
  while (candidate !== '' && used.has(candidate)) candidate = nextName(candidate)
  return candidate
}

/** Desplazamiento por defecto de una copia, para que no tape al original. */
export const DUPLICATE_OFFSET_MM = { x: 5, y: 0 }

export interface DuplicateResult {
  objects: Obj[]
  /** `null` si no se encontró el objeto. */
  newId: string | null
}

/**
 * Inserta una copia justo detrás del original, dentro de su mismo grupo, para
 * que quede al lado en el árbol y no al final de la lista.
 */
export function duplicateObject(
  objects: Obj[], id: string, offset = DUPLICATE_OFFSET_MM,
): DuplicateResult {
  let newId: string | null = null
  const used = new Set<string>()
  for (const obj of walk(objects)) used.add(obj.name)

  const visit = (list: Obj[]): Obj[] => {
    const out: Obj[] = []
    for (const obj of list) {
      if (obj.id === id) {
        const copy = cloneObject(obj)
        copy.name = uniqueName(obj.name, used)
        copy.x = obj.x + offset.x
        copy.y = obj.y + offset.y
        newId = copy.id
        out.push(obj, copy)
        continue
      }
      out.push(obj.type === 'group' ? { ...obj, children: visit(obj.children) } : obj)
    }
    return out
  }

  return { objects: visit(objects), newId }
}

export function removeObject(objects: Obj[], id: string): Obj[] {
  return objects
    .filter((obj) => obj.id !== id)
    .map((obj) => (obj.type === 'group' ? { ...obj, children: removeObject(obj.children, id) } : obj))
}

// ---------------------------------------------------------------------------
// Migración
// ---------------------------------------------------------------------------

/**
 * Normaliza un documento cargado de disco o de IndexedDB.
 *
 * Existe desde el primer día, aunque hoy solo rellene ausencias: el esquema de
 * `scale` se completa en una fase posterior y los proyectos guardados entretanto
 * tendrán que pasar por aquí.
 */
export function migrateDoc(raw: unknown): Doc {
  if (typeof raw !== 'object' || raw === null) throw new Error('El fichero no contiene un documento')
  const d = raw as Partial<Doc>
  if (typeof d.version !== 'number') throw new Error('Al documento le falta el campo `version`')
  if (d.version > DOC_VERSION) {
    throw new Error(`El documento es de la version ${d.version} y esta app entiende hasta la ${DOC_VERSION}`)
  }
  return {
    version: DOC_VERSION,
    name: d.name ?? 'Panel importado',
    panel: { ...DEFAULT_PANEL, ...(d.panel ?? {}) },
    tool: { ...DEFAULT_TOOL, ...(d.tool ?? {}) },
    objects: Array.isArray(d.objects) ? d.objects : [],
  }
}
