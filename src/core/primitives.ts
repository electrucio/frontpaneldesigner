import type { Deg, EngraveStyle, LayerId, Mm } from './types'
import type { Vec2 } from './geometry/vec'

/**
 * Primitivas: la salida de los constructores y la entrada de la vista previa,
 * la exportación y el DRC. Coordenadas absolutas en mm, ya horneadas (ninguna
 * primitiva lleva transformaciones pendientes).
 *
 * Arcos y círculos se conservan como tales hasta el serializador; solo el DRC
 * los aplana, y con su propia tolerancia.
 */

export interface PrimBase {
  /** Objeto del documento que la generó: selección y enlace de avisos DRC. */
  objectId: string
  layer: LayerId
  style: EngraveStyle
  /** Profundidad efectiva ya resuelta (propia del objeto o heredada). */
  depthMm: Mm
}

/** Segmento de contorno. El punto de partida lo aporta el contorno. */
export type Seg =
  | { kind: 'line'; to: Vec2 }
  | { kind: 'arc'; to: Vec2; r: Mm; largeArc: boolean; sweep: boolean }
  | { kind: 'cubic'; c1: Vec2; c2: Vec2; to: Vec2 }

/** Contorno geométrico sin estilo: sirve tanto de trazo como de borde de región. */
export interface Contour {
  start: Vec2
  segs: Seg[]
  closed: boolean
}

export interface PolylinePrim extends PrimBase {
  kind: 'polyline'
  pts: Vec2[]
  closed: boolean
}

export interface CirclePrim extends PrimBase {
  kind: 'circle'
  c: Vec2
  r: Mm
}

/** Arco recorrido de `startAngleDeg` a `endAngleDeg` en sentido horario. */
export interface ArcPrim extends PrimBase {
  kind: 'arc'
  c: Vec2
  r: Mm
  startAngleDeg: Deg
  endAngleDeg: Deg
}

export interface ContourPrim extends PrimBase {
  kind: 'contour'
  contour: Contour
}

/**
 * Región rellena. Sus contornos ya vienen unidos booleanamente y sin solapes,
 * de modo que el resultado no depende de `fill-rule` (ver `boolean/union.ts`).
 */
export interface RegionPrim extends PrimBase {
  kind: 'region'
  contours: Contour[]
}

export type Primitive = PolylinePrim | CirclePrim | ArcPrim | ContourPrim | RegionPrim

export const isFilled = (p: Primitive): boolean => p.kind === 'region' || p.style === 'fill'

/** Contorno cerrado a partir de una lista de vértices. */
export function contourFromPoints(pts: Vec2[], closed = true): Contour {
  const [first, ...rest] = pts
  return {
    start: first,
    segs: rest.map((to) => ({ kind: 'line', to }) as Seg),
    closed,
  }
}
