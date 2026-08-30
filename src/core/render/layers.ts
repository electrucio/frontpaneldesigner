import type { EngraveStyle, LayerId } from '../types'
import type { Primitive } from '../primitives'

/**
 * Grupos de primer nivel del SVG exportado.
 *
 * Cada uno lleva `id`, `inkscape:label` y **un color propio**. El color es
 * redundancia deliberada: es el criterio de selección que respetan casi todas
 * las CAM cuando ignoran los grupos y las etiquetas de Inkscape.
 */
export type ExportGroupId =
  | 'panel-outline'
  | 'engrave-lines'
  | 'engrave-fill'
  | 'cut'
  | 'drill'

export interface ExportGroup {
  id: ExportGroupId
  label: string
  color: string
  filled: boolean
  /** Qué operación de CAM espera esta capa. Va al comentario de cabecera. */
  note: string
}

export const EXPORT_GROUPS: Record<ExportGroupId, ExportGroup> = {
  'panel-outline': {
    id: 'panel-outline',
    label: 'Panel outline',
    color: '#0000ff',
    filled: false,
    note: 'contorno exterior del panel (linea nominal)',
  },
  'engrave-lines': {
    id: 'engrave-lines',
    label: 'Engrave lines',
    color: '#000000',
    filled: false,
    note: 'trazos abiertos a seguir con la V-bit a profundidad constante',
  },
  'engrave-fill': {
    id: 'engrave-fill',
    label: 'Engrave fill',
    color: '#ff00ff',
    filled: true,
    note: 'regiones cerradas sin solapes, para V-carving',
  },
  cut: {
    id: 'cut',
    label: 'Cut',
    color: '#ff0000',
    filled: false,
    note: 'contornos pasantes (linea nominal; aplicar offset de herramienta)',
  },
  drill: {
    id: 'drill',
    label: 'Drill',
    color: '#00a000',
    filled: false,
    note: 'taladros (linea nominal)',
  },
}

export const EXPORT_GROUP_ORDER: ExportGroupId[] = [
  'panel-outline', 'engrave-fill', 'engrave-lines', 'cut', 'drill',
]

export function groupFor(layer: LayerId, style: EngraveStyle): ExportGroupId {
  switch (layer) {
    case 'panel': return 'panel-outline'
    case 'cut': return 'cut'
    case 'drill': return 'drill'
    case 'engrave': return style === 'fill' ? 'engrave-fill' : 'engrave-lines'
  }
}

export const groupOfPrimitive = (p: Primitive): ExportGroupId =>
  groupFor(p.layer, p.kind === 'region' ? 'fill' : p.style)
