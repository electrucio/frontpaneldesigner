import type { Deg, Mm, ScaleLabelSpec, ScaleObj, TickSpec } from '../types'
import type { Contour, Primitive, Seg } from '../primitives'
import type { Mat } from '../geometry/mat'
import { apply, multiply, rotation, translation, rotationOf, uniformScale } from '../geometry/mat'
import type { Vec2 } from '../geometry/vec'
import { distribute, polar, sweepCW } from '../geometry/polar'
import { layoutHersheyText } from '../text/layout'
import type { BuildEnv } from './env'

/**
 * Escala circular: el objeto que convierte esta herramienta en algo útil para
 * un amplificador.
 *
 * Todo cuelga de un centro, un radio y un recorrido angular (0° = las 12 en
 * punto, positivo horario; un mando típico va de −135° a +135°). Encima se
 * activan por separado el arco, las marcas mayores y menores, las etiquetas y
 * el rótulo, que es lo que permite que un mismo generador dé desde una escala
 * de dos extremos («200Hz / 30Hz») hasta una numerada de 0 a 10.
 */

const ORIGIN: Vec2 = { x: 0, y: 0 }

export function buildScale(obj: ScaleObj, m: Mat, env: BuildEnv): Primitive[] {
  const base = env.base(obj)
  const center = apply(m, ORIGIN)
  const spin = rotationOf(m)
  const k = uniformScale(m)

  // Todo se calcula en el espacio del objeto y se traslada con la matriz: así
  // rotar la escala entera no descoloca las etiquetas respecto a las marcas.
  const start = obj.startAngleDeg + spin
  const end = obj.endAngleDeg + spin

  const out: Primitive[] = []

  // --- Arco ---------------------------------------------------------------
  out.push(...buildScaleArc(obj, center, k, spin, base))

  // --- Marcas -------------------------------------------------------------
  const majorAngles = tickAngles(obj.majorTicks, start, end, true)
  out.push(...majorAngles.flatMap((a) => tickPrimitives(obj.majorTicks, center, k, a, base)))

  if (obj.minorTicks.enabled && obj.majorTicks.count > 1) {
    for (const a of minorAngles(obj, start, end)) {
      out.push(...tickPrimitives(obj.minorTicks, center, k, a, base))
    }
  }

  // --- Etiquetas ----------------------------------------------------------
  out.push(...buildLabels(obj, center, k, spin, start, end, base))

  // --- Rótulo -------------------------------------------------------------
  if (obj.caption.enabled && obj.caption.text !== '') {
    const top = obj.caption.position === 'top'
    const r = (obj.radiusMm + obj.caption.offsetMm) * k
    const at = polar(center, r, top ? spin : 180 + spin)
    out.push(...textPrimitives(obj.caption.text, {
      fontId: obj.caption.fontId,
      capHeightMm: obj.caption.capHeightMm * k,
      at,
      rotationDeg: spin,
      base,
    }))
  }

  // --- Agujero del eje ----------------------------------------------------
  if (obj.centerHoleDiameterMm !== null && obj.centerHoleDiameterMm > 0) {
    out.push({
      ...base,
      kind: 'circle',
      layer: 'drill',
      depthMm: 0,
      c: center,
      r: (obj.centerHoleDiameterMm / 2) * k,
    })
  }

  return out
}

// ---------------------------------------------------------------------------
// Arco
// ---------------------------------------------------------------------------

function buildScaleArc(
  obj: ScaleObj, center: Vec2, k: number, spin: Deg, base: ReturnType<BuildEnv['base']>,
): Primitive[] {
  const spec = obj.arc
  if (spec.mode === 'none') return []

  const r = spec.radiusMm * k
  const from = spec.startAngleDeg + spin
  const to = spec.endAngleDeg + spin

  if (spec.mode === 'line') {
    return [{ ...base, kind: 'arc', c: center, r, startAngleDeg: from, endAngleDeg: to }]
  }

  const half = (spec.bandWidthMm * k) / 2
  const segments = spec.mode === 'band'
    ? [[from, to] as const]
    : splitIntoSegments(from, to, spec.segmentCount, spec.segmentGapDeg)

  return segments.map(([a, b]) => ({
    ...base,
    kind: 'region' as const,
    style: 'fill' as const,
    contours: [bandContour(center, r - half, r + half, a, b)],
  }))
}

/** Reparte el recorrido en `count` tramos separados por un hueco angular. */
function splitIntoSegments(from: Deg, to: Deg, count: number, gapDeg: Deg): (readonly [Deg, Deg])[] {
  const n = Math.max(1, Math.floor(count))
  const total = sweepCW(from, to)
  // El hueco va entre tramos, no en los extremos.
  const usable = Math.max(0, total - gapDeg * (n - 1))
  const each = usable / n
  return Array.from({ length: n }, (_, i) => {
    const a = from + i * (each + gapDeg)
    return [a, a + each] as const
  })
}

/** Región anular cerrada entre dos radios y dos ángulos. */
function bandContour(center: Vec2, rInner: Mm, rOuter: Mm, from: Deg, to: Deg): Contour {
  const sweep = sweepCW(from, to)
  const large = sweep > 180

  const outerFrom = polar(center, rOuter, from)
  const outerTo = polar(center, rOuter, to)
  const innerTo = polar(center, rInner, to)
  const innerFrom = polar(center, rInner, from)

  const segs: Seg[] = [
    { kind: 'arc', to: outerTo, r: rOuter, largeArc: large, sweep: true },
    { kind: 'line', to: innerTo },
    // De vuelta por dentro, en sentido contrario.
    { kind: 'arc', to: innerFrom, r: rInner, largeArc: large, sweep: false },
    { kind: 'line', to: outerFrom },
  ]

  return { start: outerFrom, segs, closed: true }
}

// ---------------------------------------------------------------------------
// Marcas
// ---------------------------------------------------------------------------

function tickAngles(spec: TickSpec, start: Deg, end: Deg, includeEnds: boolean): Deg[] {
  if (!spec.enabled || spec.count < 1) return []
  return includeEnds ? distribute(start, end, spec.count) : []
}

/** Ángulos de las marcas menores: subdivisiones dentro de cada intervalo mayor. */
function minorAngles(obj: ScaleObj, start: Deg, end: Deg): Deg[] {
  const majors = distribute(start, end, obj.majorTicks.count)
  const subdivisions = Math.max(1, Math.floor(obj.minorTicks.count))
  if (subdivisions < 2) return []

  const out: Deg[] = []
  for (let i = 0; i < majors.length - 1; i++) {
    const step = (majors[i + 1] - majors[i]) / subdivisions
    // Se saltan los extremos: ahí ya hay una marca mayor.
    for (let j = 1; j < subdivisions; j++) out.push(majors[i] + step * j)
  }
  return out
}

function tickPrimitives(
  spec: TickSpec, center: Vec2, k: number, angleDeg: Deg, base: ReturnType<BuildEnv['base']>,
): Primitive[] {
  const r = spec.radiusMm * k
  const len = spec.lengthMm * k

  if (spec.shape === 'dot') {
    return [{ ...base, kind: 'circle', style: 'fill', c: polar(center, r, angleDeg), r: (spec.markerSizeMm * k) / 2 }]
  }

  const [rFrom, rTo] = tickSpan(spec.direction, r, len)

  if (spec.shape === 'triangle') {
    const half = (spec.markerSizeMm * k) / 2
    const tip = polar(center, rTo, angleDeg)
    // La base del triángulo es una cuerda: media anchura a cada lado, convertida
    // a ángulo sobre el radio en el que se apoya.
    const halfDeg = (Math.atan2(half, Math.max(rFrom, 1e-6)) * 180) / Math.PI
    return [{
      ...base,
      kind: 'polyline',
      style: 'fill',
      pts: [tip, polar(center, rFrom, angleDeg - halfDeg), polar(center, rFrom, angleDeg + halfDeg)],
      closed: true,
    }]
  }

  return [{
    ...base,
    kind: 'polyline',
    pts: [polar(center, rFrom, angleDeg), polar(center, rTo, angleDeg)],
    closed: false,
  }]
}

function tickSpan(direction: TickSpec['direction'], r: Mm, len: Mm): [Mm, Mm] {
  switch (direction) {
    case 'outward': return [r, r + len]
    case 'inward': return [r, r - len]
    case 'centered': return [r - len / 2, r + len / 2]
  }
}

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------

function buildLabels(
  obj: ScaleObj, center: Vec2, k: number, spin: Deg, start: Deg, end: Deg,
  base: ReturnType<BuildEnv['base']>,
): Primitive[] {
  const spec = obj.labels
  if (spec.mode === 'none') return []

  const count = spec.mode === 'endpoints' ? 2 : Math.max(2, obj.majorTicks.count)
  const angles = spec.mode === 'endpoints' ? [start, end] : distribute(start, end, count)
  const texts = labelTexts(spec, count)

  return angles.flatMap((angleDeg, i) => {
    const text = texts[i]
    if (!text) return []
    const at = polar(center, spec.radiusMm * k, angleDeg)
    return textPrimitives(text, {
      fontId: spec.fontId,
      capHeightMm: spec.capHeightMm * k,
      at,
      rotationDeg: labelRotation(spec, angleDeg, spin),
      base,
    })
  })
}

/**
 * Orientación de la etiqueta.
 *
 * `upright` la deja siempre horizontal (el 0–10 del panel Marshall), `radial`
 * la gira con el radio para que apunte hacia fuera, y `tangential` la alinea
 * con la tangente.
 */
function labelRotation(spec: ScaleLabelSpec, angleDeg: Deg, spin: Deg): Deg {
  switch (spec.orientation) {
    case 'upright': return spin
    case 'radial': return angleDeg
    case 'tangential': return angleDeg + 90
  }
}

/** Etiquetas: la lista explícita manda sobre el rango numérico. */
function labelTexts(spec: ScaleLabelSpec, count: number): string[] {
  if (spec.values !== null) return spec.values

  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1)
    const value = spec.min + (spec.max - spec.min) * t
    return `${spec.prefix}${value.toFixed(Math.max(0, spec.decimals))}${spec.suffix}`
  })
}

// ---------------------------------------------------------------------------
// Texto auxiliar
// ---------------------------------------------------------------------------

function textPrimitives(text: string, opts: {
  fontId: string
  capHeightMm: Mm
  at: Vec2
  rotationDeg: Deg
  base: ReturnType<BuildEnv['base']>
}): Primitive[] {
  const layout = layoutHersheyText(text, {
    fontId: opts.fontId,
    capHeightMm: opts.capHeightMm,
    trackingMm: 0,
    lineGapMm: 0,
    align: 'center',
    vAlign: 'middle',
    arc: null,
  })

  const m = multiply(translation(opts.at.x, opts.at.y), rotation(opts.rotationDeg))
  return layout.strokes.map((stroke) => ({
    ...opts.base,
    kind: 'polyline',
    pts: stroke.map((p) => apply(m, p)),
    closed: false,
  }))
}
