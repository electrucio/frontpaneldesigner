import type { CalibrationSample, Doc, Mm, Obj, ToolProfile } from './types'

/**
 * Modelo de la V-bit.
 *
 * El surco que deja una fresa en V a profundidad `d` tiene ancho
 *
 *     w(d) = tip + 2·d·tan(θ/2)
 *
 * donde θ es el ángulo TOTAL incluido. Con θ = 30° el factor `k = 2·tan(15°)`
 * vale 0.536 mm de ancho por mm de profundidad; si la fresa fuera de 30° por
 * lado (θ = 60°) valdría 1.155, más del doble. De ahí que el campo se llame
 * `includedAngleDeg` y que la UI lo etiquete sin ambigüedad.
 *
 * Cuando hay calibración empírica se usan sus coeficientes en lugar de los
 * nominales: absorben el ángulo real, el desgaste y una punta que casi nunca
 * mide exactamente lo que dice el fabricante.
 */

/** Ancho que gana el surco por milímetro de profundidad. */
export function widthPerMm(tool: ToolProfile): number {
  if (tool.calibration) return tool.calibration.kPerMm
  return 2 * Math.tan((tool.includedAngleDeg * Math.PI) / 360)
}

/** Ancho efectivo de la punta (calibrado si lo hay, nominal si no). */
export function effectiveTip(tool: ToolProfile): Mm {
  return tool.calibration ? tool.calibration.tipEffMm : tool.tipMm
}

export function widthAtDepth(tool: ToolProfile, depthMm: Mm): Mm {
  return effectiveTip(tool) + widthPerMm(tool) * Math.max(0, depthMm)
}

/**
 * Profundidad necesaria para un ancho dado. Devuelve 0 si el ancho pedido es
 * menor o igual que la punta: por debajo de eso la fresa no puede afinar más.
 */
export function depthForWidth(tool: ToolProfile, widthMm: Mm): Mm {
  const k = widthPerMm(tool)
  if (k <= 0) return 0
  return Math.max(0, (widthMm - effectiveTip(tool)) / k)
}

/** Ancho máximo de un solo surco a la profundidad máxima admitida. */
export function maxWidth(tool: ToolProfile): Mm {
  return widthAtDepth(tool, tool.maxDepthMm)
}

/** Profundidad efectiva de un objeto: la suya si la tiene, si no la del documento. */
export function depthForObject(tool: ToolProfile, obj: Pick<Obj, 'depthMm'>): Mm {
  return obj.depthMm ?? tool.defaultDepthMm
}

export function docDepthForObject(doc: Doc, obj: Pick<Obj, 'depthMm'>): Mm {
  return depthForObject(doc.tool, obj)
}

// ---------------------------------------------------------------------------
// Calibración
// ---------------------------------------------------------------------------

export interface CalibrationFit {
  tipEffMm: Mm
  kPerMm: number
  /** Error máximo absoluto del ajuste frente a las medidas, en mm. */
  maxResidualMm: Mm
  /** R², para avisar de medidas incoherentes. */
  r2: number
}

/**
 * Ajuste por mínimos cuadrados de `w = tipEff + k·d` sobre surcos medidos.
 * Necesita al menos dos profundidades distintas.
 */
export function fitCalibration(samples: CalibrationSample[]): CalibrationFit | null {
  const pts = samples.filter((s) => Number.isFinite(s.depthMm) && Number.isFinite(s.widthMm))
  if (pts.length < 2) return null

  const n = pts.length
  const sumD = pts.reduce((acc, s) => acc + s.depthMm, 0)
  const sumW = pts.reduce((acc, s) => acc + s.widthMm, 0)
  const sumDD = pts.reduce((acc, s) => acc + s.depthMm * s.depthMm, 0)
  const sumDW = pts.reduce((acc, s) => acc + s.depthMm * s.widthMm, 0)

  const denom = n * sumDD - sumD * sumD
  // Todas las medidas a la misma profundidad: la pendiente es indeterminada.
  if (Math.abs(denom) < 1e-12) return null

  const kPerMm = (n * sumDW - sumD * sumW) / denom
  const tipEffMm = (sumW - kPerMm * sumD) / n

  let maxResidualMm = 0
  let ssRes = 0
  const meanW = sumW / n
  let ssTot = 0
  for (const s of pts) {
    const predicted = tipEffMm + kPerMm * s.depthMm
    const residual = s.widthMm - predicted
    maxResidualMm = Math.max(maxResidualMm, Math.abs(residual))
    ssRes += residual * residual
    ssTot += (s.widthMm - meanW) ** 2
  }

  return {
    tipEffMm,
    kPerMm,
    maxResidualMm,
    r2: ssTot < 1e-12 ? 1 : 1 - ssRes / ssTot,
  }
}

/** Ángulo incluido implícito en una pendiente medida. Útil para avisar de fresas mal etiquetadas. */
export function impliedIncludedAngleDeg(kPerMm: number): number {
  return (2 * Math.atan(kPerMm / 2) * 180) / Math.PI
}

/** Profundidades del asistente de calibración: tres surcos que el usuario mide con calibre. */
export const CALIBRATION_DEPTHS_MM: readonly Mm[] = [0.2, 0.4, 0.6]
