import type { ArcObj, CircleObj, HoleObj, LineObj, Mm, RectObj } from '../types'
import type { Contour, Primitive, Seg } from '../primitives'
import { contourFromPoints } from '../primitives'
import type { Mat } from '../geometry/mat'
import { apply, rotationOf, uniformScale } from '../geometry/mat'
import type { Vec2 } from '../geometry/vec'
import type { BuildEnv } from './env'

/**
 * Contorno de rectángulo redondeado centrado en el origen local, recorrido en
 * sentido horario desde el borde superior. Con `r` = 0 degenera en polilínea,
 * que es lo que espera una CAM para un contorno de esquinas vivas.
 */
export function roundedRectContour(m: Mat, w: Mm, h: Mm, r: Mm): Contour {
  const hw = w / 2
  const hh = h / 2
  const rr = Math.max(0, Math.min(r, hw, hh))
  const p = (x: number, y: number): Vec2 => apply(m, { x, y })

  if (rr <= 0) {
    return contourFromPoints([p(-hw, -hh), p(hw, -hh), p(hw, hh), p(-hw, hh)], true)
  }

  const s = uniformScale(m)
  const arc = (to: Vec2): Seg => ({ kind: 'arc', to, r: rr * s, largeArc: false, sweep: true })

  return {
    start: p(-hw + rr, -hh),
    segs: [
      { kind: 'line', to: p(hw - rr, -hh) },
      arc(p(hw, -hh + rr)),
      { kind: 'line', to: p(hw, hh - rr) },
      arc(p(hw - rr, hh)),
      { kind: 'line', to: p(-hw + rr, hh) },
      arc(p(-hw, hh - rr)),
      { kind: 'line', to: p(-hw, -hh + rr) },
      arc(p(-hw + rr, -hh)),
    ],
    closed: true,
  }
}

export function buildLine(obj: LineObj, m: Mat, env: BuildEnv): Primitive[] {
  if (obj.points.length < 2) return []
  return [{
    kind: 'polyline',
    ...env.base(obj),
    pts: obj.points.map((p) => apply(m, p)),
    closed: obj.closed,
  }]
}

export function buildRect(obj: RectObj, m: Mat, env: BuildEnv): Primitive[] {
  const contour = roundedRectContour(m, obj.w, obj.h, obj.cornerRadiusMm)
  const base = env.base(obj)
  if (obj.filled) {
    return [{ kind: 'region', ...base, style: 'fill', contours: [contour] }]
  }
  if (contour.segs.every((s) => s.kind === 'line')) {
    return [{
      kind: 'polyline',
      ...base,
      pts: [contour.start, ...contour.segs.map((s) => s.to)],
      closed: true,
    }]
  }
  return [{ kind: 'contour', ...base, contour }]
}

export function buildCircle(obj: CircleObj, m: Mat, env: BuildEnv): Primitive[] {
  return [{
    kind: 'circle',
    ...env.base(obj),
    style: obj.filled ? 'fill' : env.base(obj).style,
    c: apply(m, { x: 0, y: 0 }),
    r: (obj.diameterMm / 2) * uniformScale(m),
  }]
}

export function buildArc(obj: ArcObj, m: Mat, env: BuildEnv): Primitive[] {
  const spin = rotationOf(m)
  return [{
    kind: 'arc',
    ...env.base(obj),
    c: apply(m, { x: 0, y: 0 }),
    r: obj.radiusMm * uniformScale(m),
    startAngleDeg: obj.startAngleDeg + spin,
    endAngleDeg: obj.endAngleDeg + spin,
  }]
}

/**
 * Agujeros y ventanas. Nunca se graban: viven en `cut` o `drill` y sus
 * coordenadas son la línea nominal, no el borde acabado (la CAM aplica el
 * offset del radio de herramienta).
 */
export function buildHole(obj: HoleObj, m: Mat, env: BuildEnv): Primitive[] {
  const base = { ...env.base(obj), style: 'centerline' as const, depthMm: 0 }
  if (obj.shape === 'circle') {
    return [{
      kind: 'circle',
      ...base,
      c: apply(m, { x: 0, y: 0 }),
      r: (obj.diameterMm / 2) * uniformScale(m),
    }]
  }
  return [{
    kind: 'contour',
    ...base,
    contour: roundedRectContour(m, obj.w, obj.h, obj.cornerRadiusMm),
  }]
}
