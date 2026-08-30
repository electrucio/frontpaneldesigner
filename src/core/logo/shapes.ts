/**
 * Conversión de las formas básicas de SVG a `d`.
 *
 * Un logotipo real trae `rect`, `circle` y `polygon` mezclados con `path`, y el
 * resto de la cadena solo entiende caminos.
 */

type Attrs = (name: string) => string | null

const num = (attrs: Attrs, name: string, fallback = 0): number => {
  const raw = attrs(name)
  if (raw === null) return fallback
  const v = parseFloat(raw)
  return Number.isFinite(v) ? v : fallback
}

export function shapeToPathData(tag: string, attrs: Attrs): string | null {
  switch (tag) {
    case 'path':
      return attrs('d')

    case 'rect': {
      const x = num(attrs, 'x')
      const y = num(attrs, 'y')
      const w = num(attrs, 'width')
      const h = num(attrs, 'height')
      if (w <= 0 || h <= 0) return null

      // rx e ry se sustituyen mutuamente cuando solo viene uno.
      const rxRaw = attrs('rx')
      const ryRaw = attrs('ry')
      let rx = rxRaw !== null ? parseFloat(rxRaw) : ryRaw !== null ? parseFloat(ryRaw) : 0
      let ry = ryRaw !== null ? parseFloat(ryRaw) : rx
      rx = Math.min(Math.max(rx || 0, 0), w / 2)
      ry = Math.min(Math.max(ry || 0, 0), h / 2)

      if (rx === 0 || ry === 0) {
        return `M${x} ${y}H${x + w}V${y + h}H${x}Z`
      }
      return (
        `M${x + rx} ${y}` +
        `H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}` +
        `V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}` +
        `H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}` +
        `V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`
      )
    }

    case 'circle': {
      const r = num(attrs, 'r')
      if (r <= 0) return null
      return ellipsePath(num(attrs, 'cx'), num(attrs, 'cy'), r, r)
    }

    case 'ellipse': {
      const rx = num(attrs, 'rx')
      const ry = num(attrs, 'ry')
      if (rx <= 0 || ry <= 0) return null
      return ellipsePath(num(attrs, 'cx'), num(attrs, 'cy'), rx, ry)
    }

    case 'line':
      return `M${num(attrs, 'x1')} ${num(attrs, 'y1')}L${num(attrs, 'x2')} ${num(attrs, 'y2')}`

    case 'polyline':
    case 'polygon': {
      const points = parsePoints(attrs('points'))
      if (points.length < 2) return null
      const d = `M${points.map(([x, y]) => `${x} ${y}`).join('L')}`
      return tag === 'polygon' ? `${d}Z` : d
    }

    default:
      return null
  }
}

/** Elipse completa: dos semiarcos, porque `A` no puede cerrarse sobre sí mismo. */
const ellipsePath = (cx: number, cy: number, rx: number, ry: number): string =>
  `M${cx - rx} ${cy}` +
  `A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}` +
  `A${rx} ${ry} 0 0 1 ${cx - rx} ${cy}Z`

/** `points` admite comas, espacios o ambos como separadores. */
export function parsePoints(raw: string | null): [number, number][] {
  if (!raw) return []
  const nums = raw.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]])
  return out
}
