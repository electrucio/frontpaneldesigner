import type { Doc, Mm } from '../types'
import type { Primitive } from '../primitives'
import { widthAtDepth } from '../tool'
import { esc, escComment, fmt } from './format'
import {
  flippedFrame, IDENTITY_FRAME, primitiveShape, type Frame,
} from './pathData'
import {
  EXPORT_GROUPS, EXPORT_GROUP_ORDER, groupOfPrimitive,
  type ExportGroupId,
} from './layers'

export interface ExportOptions {
  /** Origen abajo-izquierda con Y invertida, por si la CAM lo prefiere. */
  flipY: boolean
  /**
   * Cómo se materializa un taladro: círculo del diámetro real (lo que espera
   * una CAM que calcula la trayectoria) o punto central (lo que espera una que
   * solo quiere la posición). Cada programa espera una cosa.
   */
  drillMode: 'circle' | 'point'
  /** Subconjunto de grupos a emitir; `null` = todos. Para exportar por capas. */
  groups: ExportGroupId[] | null
  includeHeaderComment: boolean
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  flipY: false,
  drillMode: 'circle',
  groups: null,
  includeHeaderComment: true,
}

/** Radio del círculo degenerado que representa un taladro en modo `point`. */
const DRILL_POINT_RADIUS_MM = 0.001

function makeFrame(doc: Doc, opts: ExportOptions): Frame {
  return opts.flipY ? flippedFrame(doc.panel.h) : IDENTITY_FRAME
}

// ---------------------------------------------------------------------------
// Primitiva → elemento
// ---------------------------------------------------------------------------

function primitiveToElement(p: Primitive, doc: Doc, opts: ExportOptions, f: Frame): string | null {
  const group = EXPORT_GROUPS[groupOfPrimitive(p)]
  const paint = group.filled
    ? `fill="${group.color}" fill-rule="nonzero" stroke="none"`
    : `fill="none" stroke="${group.color}" stroke-width="${fmt(strokeWidthFor(p, doc))}"`

  // Un taladro en modo punto se reduce a un circulo degenerado.
  const prim: Primitive =
    p.kind === 'circle' && p.layer === 'drill' && opts.drillMode === 'point'
      ? { ...p, r: DRILL_POINT_RADIUS_MM }
      : p

  // Nunca `<circle>`: ver `ShapeOptions.circlesAsPaths`.
  const shape = primitiveShape(prim, f, { circlesAsPaths: true })
  if (!shape || shape.as !== 'path') return null

  return `<path d="${shape.d}" ${paint}/>`
}

/**
 * Grosor de trazo del SVG. Es **nominal**: el ancho real del surco lo fija la
 * profundidad de corte en la CAM. Se emite el ancho que corresponde a la
 * profundidad del objeto para que el fichero se vea como quedará la pieza.
 */
export function strokeWidthFor(p: Primitive, doc: Doc): Mm {
  if (p.layer !== 'engrave') return 0.1
  return widthAtDepth(doc.tool, p.depthMm)
}

// ---------------------------------------------------------------------------
// Documento → SVG
// ---------------------------------------------------------------------------

function headerComment(doc: Doc, opts: ExportOptions): string {
  const t = doc.tool
  const lines = [
    `Front Panel Designer - ${doc.name}`,
    `Unidades: 1 unidad de usuario = 1 mm. Panel ${fmt(doc.panel.w)} x ${fmt(doc.panel.h)} mm.`,
    `Origen: ${opts.flipY ? 'abajo-izquierda, Y hacia arriba' : 'arriba-izquierda, Y hacia abajo'}.`,
    `V-bit: ${fmt(t.includedAngleDeg)} grados TOTALES incluidos, punta ${fmt(t.tipMm)} mm` +
      (t.calibration
        ? `, calibrada (${fmt(t.calibration.tipEffMm)} mm + ${fmt(t.calibration.kPerMm)} mm/mm)`
        : ' (sin calibrar)'),
    `Profundidad por defecto ${fmt(t.defaultDepthMm)} mm; maxima ${fmt(t.maxDepthMm)} mm.`,
    'IMPORTANTE: en engrave-lines el stroke-width es solo indicativo; el ancho real',
    'del surco lo determina la profundidad de corte que se programe en la CAM.',
    `Taladros: ${opts.drillMode === 'circle' ? 'circulos del diametro real' : 'puntos centrales'}.`,
    'Las coordenadas de cut y drill son la LINEA NOMINAL, no el borde acabado:',
    'la CAM debe aplicar el offset del radio de herramienta.',
    'Capas:',
    ...EXPORT_GROUP_ORDER.map((id) => `  ${EXPORT_GROUPS[id].id} (${EXPORT_GROUPS[id].color}): ${EXPORT_GROUPS[id].note}`),
  ]
  return `<!--\n${lines.map((l) => `  ${escComment(l)}`).join('\n')}\n-->`
}

export function toSvg(
  doc: Doc,
  primitives: Primitive[],
  options: Partial<ExportOptions> = {},
): string {
  const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options }
  const f = makeFrame(doc, opts)

  const buckets = new Map<ExportGroupId, string[]>()
  for (const p of primitives) {
    const gid = groupOfPrimitive(p)
    if (opts.groups && !opts.groups.includes(gid)) continue
    const el = primitiveToElement(p, doc, opts, f)
    if (!el) continue
    const list = buckets.get(gid)
    if (list) list.push(el)
    else buckets.set(gid, [el])
  }

  const body = EXPORT_GROUP_ORDER.flatMap((gid) => {
    const els = buckets.get(gid)
    if (!els || els.length === 0) return []
    const g = EXPORT_GROUPS[gid]
    // Los atributos se repiten en grupo y elemento: el grupo describe la capa
    // para quien lea el SVG, y el elemento es autosuficiente para las CAM que
    // no propagan atributos de presentacion.
    const attrs = g.filled
      ? `fill="${g.color}" stroke="none"`
      : `fill="none" stroke="${g.color}"`
    return [
      `  <g id="${g.id}" inkscape:groupmode="layer" inkscape:label="${esc(g.label)}" ${attrs}>`,
      ...els.map((e) => `    ${e}`),
      '  </g>',
    ]
  })

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    ...(opts.includeHeaderComment ? [headerComment(doc, opts)] : []),
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"`,
    `     width="${fmt(doc.panel.w)}mm" height="${fmt(doc.panel.h)}mm"`,
    `     viewBox="0 0 ${fmt(doc.panel.w)} ${fmt(doc.panel.h)}" version="1.1">`,
    ...body,
    '</svg>',
    '',
  ].join('\n')
}
