import type { Deg, Mm } from '../types'
import type { Vec2 } from './vec'

/**
 * Convención angular de la aplicación: 0° = las 12 en punto, positivo = horario.
 * Es la que usa cualquiera al describir un mando ("de las 7 a las 5"), y con
 * Y hacia abajo el sentido horario en pantalla coincide con el positivo.
 *
 * No confundir con el ángulo matemático estándar (0° = este, positivo
 * antihorario), del que difiere en signo y en origen.
 */
export function polar(center: Vec2, radius: Mm, angleDeg: Deg): Vec2 {
  const r = (angleDeg * Math.PI) / 180
  return {
    x: center.x + radius * Math.sin(r),
    y: center.y - radius * Math.cos(r),
  }
}

/** Ángulo (convención de la app) del vector center→p. */
export function angleOf(center: Vec2, p: Vec2): Deg {
  return (Math.atan2(p.x - center.x, center.y - p.y) * 180) / Math.PI
}

/** Normaliza a [0, 360). */
export function norm360(deg: Deg): Deg {
  const m = deg % 360
  return m < 0 ? m + 360 : m
}

/**
 * Recorrido angular de `start` a `end` en sentido horario, en (0, 360].
 * Un start igual al end se interpreta como vuelta completa, no como cero.
 */
export function sweepCW(start: Deg, end: Deg): Deg {
  const s = norm360(end - start)
  return s === 0 ? 360 : s
}

/** `n` ángulos repartidos uniformemente de `start` a `end` (ambos incluidos). */
export function distribute(start: Deg, end: Deg, n: number): Deg[] {
  if (n <= 0) return []
  if (n === 1) return [start]
  const step = (end - start) / (n - 1)
  return Array.from({ length: n }, (_, i) => start + step * i)
}
