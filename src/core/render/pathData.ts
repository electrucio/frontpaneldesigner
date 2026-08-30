import type { Mm } from '../types'
import type { Contour, Primitive, Seg } from '../primitives'
import type { Vec2 } from '../geometry/vec'
import { polar, sweepCW } from '../geometry/polar'
import { fmt } from './format'

/**
 * Geometría → atributo `d`.
 *
 * Lo usan tanto el serializador como la vista previa: es la garantía material
 * de que lo que se ve en pantalla es exactamente lo que se exporta.
 */

export interface Frame {
  /** Documento → coordenadas de salida. */
  p(v: Vec2): Vec2
  /** ¿La transformación invierte la orientación? Afecta a los flags de barrido. */
  mirrored: boolean
}

export const IDENTITY_FRAME: Frame = { p: (v) => v, mirrored: false }

/** Origen abajo-izquierda con Y hacia arriba, por si la CAM lo prefiere. */
export const flippedFrame = (panelHeight: Mm): Frame => ({
  p: (v) => ({ x: v.x, y: panelHeight - v.y }),
  mirrored: true,
})

export function segToD(seg: Seg, f: Frame): string {
  switch (seg.kind) {
    case 'line': {
      const t = f.p(seg.to)
      return `L ${fmt(t.x)} ${fmt(t.y)}`
    }
    case 'arc': {
      const t = f.p(seg.to)
      const sweep = f.mirrored ? !seg.sweep : seg.sweep
      return `A ${fmt(seg.r)} ${fmt(seg.r)} 0 ${seg.largeArc ? 1 : 0} ${sweep ? 1 : 0} ${fmt(t.x)} ${fmt(t.y)}`
    }
    case 'cubic': {
      const c1 = f.p(seg.c1)
      const c2 = f.p(seg.c2)
      const t = f.p(seg.to)
      return `C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(t.x)} ${fmt(t.y)}`
    }
  }
}

export function contourToD(c: Contour, f: Frame = IDENTITY_FRAME): string {
  const s = f.p(c.start)
  const parts = [`M ${fmt(s.x)} ${fmt(s.y)}`, ...c.segs.map((seg) => segToD(seg, f))]
  if (c.closed) parts.push('Z')
  return parts.join(' ')
}

export function polylineToD(pts: Vec2[], closed: boolean, f: Frame = IDENTITY_FRAME): string {
  if (pts.length === 0) return ''
  const [first, ...rest] = pts.map((p) => f.p(p))
  const parts = [`M ${fmt(first.x)} ${fmt(first.y)}`, ...rest.map((p) => `L ${fmt(p.x)} ${fmt(p.y)}`)]
  if (closed) parts.push('Z')
  return parts.join(' ')
}

/**
 * Arco de la convención de la app (horario de `start` a `end`) a `d` de SVG.
 * Un barrido de 360° se emite como dos semiarcos: `A` no puede cerrar un
 * círculo completo porque origen y destino coincidirían.
 */
export function arcToD(
  c: Vec2, r: Mm, startDeg: number, endDeg: number, f: Frame = IDENTITY_FRAME,
): string {
  const sweepDeg = sweepCW(startDeg, endDeg)
  const sweepFlag = f.mirrored ? 0 : 1
  const a = f.p(polar(c, r, startDeg))

  if (sweepDeg >= 360) {
    const mid = f.p(polar(c, r, startDeg + 180))
    return `M ${fmt(a.x)} ${fmt(a.y)} ` +
      `A ${fmt(r)} ${fmt(r)} 0 0 ${sweepFlag} ${fmt(mid.x)} ${fmt(mid.y)} ` +
      `A ${fmt(r)} ${fmt(r)} 0 0 ${sweepFlag} ${fmt(a.x)} ${fmt(a.y)}`
  }

  const b = f.p(polar(c, r, endDeg))
  const largeArc = sweepDeg > 180 ? 1 : 0
  return `M ${fmt(a.x)} ${fmt(a.y)} A ${fmt(r)} ${fmt(r)} 0 ${largeArc} ${sweepFlag} ${fmt(b.x)} ${fmt(b.y)}`
}

/** Círculo completo como `d`: dos semiarcos, porque `A` no puede cerrarse solo. */
export function circleToD(c: Vec2, r: Mm, f: Frame = IDENTITY_FRAME): string {
  return arcToD(c, r, 0, 0, f)
}

/**
 * Forma de dibujo de una primitiva, independiente de estilo y destino.
 * Un círculo se conserva como tal en vez de aproximarse con arcos.
 */
export type Shape =
  | { as: 'circle'; cx: number; cy: number; r: number }
  | { as: 'path'; d: string }

export interface ShapeOptions {
  /**
   * Emitir los círculos como `<path>` en vez de como `<circle>`.
   *
   * Lo exige la exportación: un CAM de aislamiento de PCB procesó el fichero de
   * prueba ignorando por completo los elementos `<circle>`, y el círculo de Ø20
   * y el taladro de Ø9 desaparecieron del G-code sin un solo aviso. El lienzo,
   * en cambio, prefiere el elemento nativo.
   */
  circlesAsPaths?: boolean
}

export function primitiveShape(
  p: Primitive, f: Frame = IDENTITY_FRAME, opts: ShapeOptions = {},
): Shape | null {
  switch (p.kind) {
    case 'circle': {
      if (p.r <= 0) return null
      if (opts.circlesAsPaths) return { as: 'path', d: circleToD(p.c, p.r, f) }
      const c = f.p(p.c)
      return { as: 'circle', cx: c.x, cy: c.y, r: p.r }
    }
    case 'polyline':
      return p.pts.length < 2 ? null : { as: 'path', d: polylineToD(p.pts, p.closed, f) }
    case 'arc':
      return p.r <= 0 ? null : { as: 'path', d: arcToD(p.c, p.r, p.startAngleDeg, p.endAngleDeg, f) }
    case 'contour':
      return { as: 'path', d: contourToD(p.contour, f) }
    case 'region':
      return p.contours.length === 0
        ? null
        : { as: 'path', d: p.contours.map((c) => contourToD(c, f)).join(' ') }
  }
}
