import type { LogoObj } from '../types'
import type { Contour, Primitive, Seg } from '../primitives'
import type { Mat } from '../geometry/mat'
import { apply, multiply } from '../geometry/mat'
import { pathToContours } from '../logo/pathToContours'
import type { BuildEnv } from './env'

/**
 * Logotipo importado.
 *
 * Los caminos vienen ya normalizados del importador (absolutos, sin
 * transformaciones y con origen en su esquina), así que aquí solo hay que
 * escalarlos al tamaño en milímetros y colocarlos.
 *
 * Las formas rellenas van a `engrave-fill` para vaciarse en V; las de solo
 * trazo, a `engrave-lines` para seguirse con la punta. El grosor original del
 * trazo no interviene: como en todo lo demás, el ancho real lo da la
 * profundidad.
 */
export function buildLogo(obj: LogoObj, m: Mat, env: BuildEnv): Primitive[] {
  if (obj.paths.length === 0 || obj.sourceW <= 0 || obj.sourceH <= 0) return []

  const sx = obj.widthMm / obj.sourceW
  const sy = obj.keepAspect ? sx : obj.heightMm / obj.sourceH
  const full = multiply(m, { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 })
  const base = env.base(obj)

  return obj.paths.flatMap((path): Primitive[] => {
    const contours = pathToContours(path.d).map((c) => transformContour(c, full))
    if (contours.length === 0) return []

    const filled = obj.renderMode === 'all-filled' ? true
      : obj.renderMode === 'all-centerline' ? false
        : path.filled

    if (filled) {
      // Los contornos interiores dependen del sentido de bobinado para que los
      // huecos salgan huecos. Cuando llegue la unión booleana dejará de importar.
      return [{ ...base, kind: 'region', style: 'fill', contours }]
    }
    return contours.map((contour) => ({ ...base, kind: 'contour', contour }))
  })
}

function transformContour(c: Contour, m: Mat): Contour {
  return {
    start: apply(m, c.start),
    closed: c.closed,
    segs: c.segs.map((s): Seg => {
      switch (s.kind) {
        case 'line':
          return { kind: 'line', to: apply(m, s.to) }
        case 'cubic':
          return { kind: 'cubic', c1: apply(m, s.c1), c2: apply(m, s.c2), to: apply(m, s.to) }
        case 'arc':
          // El importador convierte los arcos en cúbicas, así que aquí no llegan.
          return { ...s, to: apply(m, s.to) }
      }
    }),
  }
}
