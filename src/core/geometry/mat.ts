import type { Vec2 } from './vec'

/**
 * Matriz afín 2D en el mismo orden que SVG: [a c e; b d f].
 * Se usa solo internamente: la geometría exportada lleva las transformaciones
 * ya horneadas y el SVG de salida no contiene ningún atributo `transform`.
 */
export interface Mat {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export const IDENTITY: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

export const translation = (tx: number, ty: number): Mat => ({ a: 1, b: 0, c: 0, d: 1, e: tx, f: ty })

/** Rotación horaria en pantalla (Y hacia abajo) de `deg` grados. */
export function rotation(deg: number): Mat {
  const r = (deg * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }
}

/** Composición: el resultado aplica primero `m2` y después `m1`. */
export function multiply(m1: Mat, m2: Mat): Mat {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  }
}

export function apply(m: Mat, p: Vec2): Vec2 {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }
}

/**
 * Factor de escala uniforme de la matriz. Como el editor solo compone
 * traslaciones y rotaciones, vale 1; se calcula igualmente para que radios y
 * longitudes sigan siendo correctos si algún día se admite escalado.
 */
export function uniformScale(m: Mat): number {
  return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c))
}

/** Rotación neta en grados que introduce la matriz. */
export function rotationOf(m: Mat): number {
  return (Math.atan2(m.b, m.a) * 180) / Math.PI
}

/** ¿La matriz invierte la orientación? Importa para el sentido de los arcos. */
export const isMirrored = (m: Mat): boolean => m.a * m.d - m.b * m.c < 0
