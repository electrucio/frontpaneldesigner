import svgpath from 'svgpath'
import type { Contour, Seg } from '../primitives'
import type { Vec2 } from '../geometry/vec'

/**
 * `d` de SVG → contornos.
 *
 * `svgpath` normaliza primero: `abs()` pasa todo a absoluto, `unarc()` convierte
 * los arcos elípticos en cúbicas y `unshort()` desarrolla las abreviadas S y T.
 * Después solo quedan M, L, H, V, C, Q y Z, y de esos solo la cuadrática
 * necesita conversión, porque nuestros segmentos son recta, arco circular y
 * cúbica.
 *
 * Los arcos se pierden como tales (pasan a cúbicas) y no se puede evitar: un
 * arco elíptico no es un arco de circunferencia. Solo afecta a la geometría
 * importada, no a la que genera la aplicación.
 */
export function pathToContours(d: string): Contour[] {
  const contours: Contour[] = []
  let start: Vec2 | null = null
  let segs: Seg[] = []
  let closed = false

  const flush = () => {
    if (start && segs.length > 0) contours.push({ start, segs, closed })
    start = null
    segs = []
    closed = false
  }

  const lineTo = (x: number, y: number) => segs.push({ kind: 'line', to: { x, y } })

  svgpath(d).abs().unarc().unshort().iterate((seg, _index, x, y) => {
    switch (seg[0]) {
      case 'M':
        flush()
        start = { x: seg[1], y: seg[2] }
        break
      case 'L':
        lineTo(seg[1], seg[2])
        break
      case 'H':
        lineTo(seg[1], y)
        break
      case 'V':
        lineTo(x, seg[1])
        break
      case 'C':
        segs.push({
          kind: 'cubic',
          c1: { x: seg[1], y: seg[2] },
          c2: { x: seg[3], y: seg[4] },
          to: { x: seg[5], y: seg[6] },
        })
        break
      case 'Q':
        segs.push(quadToCubic({ x, y }, { x: seg[1], y: seg[2] }, { x: seg[3], y: seg[4] }))
        break
      case 'Z':
      case 'z':
        closed = true
        flush()
        break
    }
  })

  flush()
  return contours
}

/**
 * Cuadrática → cúbica. Es exacta, no una aproximación: los puntos de control
 * cúbicos están a dos tercios del camino entre cada extremo y el control
 * cuadrático.
 */
function quadToCubic(p0: Vec2, q: Vec2, p2: Vec2): Seg {
  return {
    kind: 'cubic',
    c1: { x: p0.x + (2 / 3) * (q.x - p0.x), y: p0.y + (2 / 3) * (q.y - p0.y) },
    c2: { x: p2.x + (2 / 3) * (q.x - p2.x), y: p2.y + (2 / 3) * (q.y - p2.y) },
    to: p2,
  }
}

/**
 * Caja envolvente de unos contornos.
 *
 * Los puntos de control de las cúbicas se incluyen en el cálculo, así que la
 * caja puede quedar algo holgada frente a la curva real. Para escalar un
 * logotipo a un ancho en milímetros es más que suficiente, y evita resolver la
 * derivada de cada Bézier.
 */
export function contoursBounds(contours: Contour[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  const add = (p: Vec2) => {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y)
  }

  for (const c of contours) {
    add(c.start)
    for (const s of c.segs) {
      add(s.to)
      if (s.kind === 'cubic') { add(s.c1); add(s.c2) }
    }
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}
