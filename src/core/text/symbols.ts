import type { Vec2 } from '../geometry/vec'
import { getBaseGlyph, getFallbackFont, parseGlyphPath, type Glyph, type HersheyFont } from './hershey'

/**
 * Caracteres que las familias latinas de Hershey no tienen.
 *
 * Hershey cubre solo ASCII imprimible, y el vocabulario real de un panel de
 * amplificador se sale de ahí enseguida: «50Ω», «20°», «µF», «Ø9», y en español
 * cualquier palabra con eñe o acento. Se resuelve por tres vías, todas dentro
 * de la línea única — nada de contornos:
 *
 *  1. Las letras griegas salen de la familia `greek`, que Hershey mapea sobre
 *     posiciones ASCII por transliteración fonética (W → Ω, m → µ, p → π).
 *  2. Unos pocos símbolos geométricos se sintetizan o se componen a partir de
 *     glifos de la propia familia, para que hereden su estilo.
 *  3. Las letras acentuadas se componen: glifo base más el trazo del acento,
 *     centrado sobre su caja.
 */

// ---------------------------------------------------------------------------
// Griego
// ---------------------------------------------------------------------------

/**
 * Transliteración de la familia `greek` de Hershey, verificada leyendo los
 * trazos glifo a glifo.
 *
 * Ojo con xi y chi, que son el par que se presta a error: la convención va por
 * la transcripción inglesa, así que **chi es la C** (dos diagonales cruzadas) y
 * **xi es la X** (tres barras horizontales), justo al revés de lo que sugiere
 * el parecido de las formas. Hay un test que fija esa identidad.
 */
export const GREEK_MAP: Record<string, string> = {
  Α: 'A', Β: 'B', Γ: 'G', Δ: 'D', Ε: 'E', Ζ: 'Z', Η: 'H', Θ: 'Q',
  Ι: 'I', Κ: 'K', Λ: 'L', Μ: 'M', Ν: 'N', Ξ: 'X', Ο: 'O', Π: 'P',
  Ρ: 'R', Σ: 'S', Τ: 'T', Υ: 'U', Φ: 'F', Χ: 'C', Ψ: 'Y', Ω: 'W',
  α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'h', θ: 'q',
  ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p',
  ρ: 'r', σ: 's', τ: 't', υ: 'u', φ: 'f', χ: 'c', ψ: 'y', ω: 'w',
  // Unicode tiene puntos de código distintos que se dibujan igual: el «micro»
  // de µF no es la mu griega, y el signo de ohmio no es la omega. Se escriben
  // escapados para que se vea que son otros caracteres y no un duplicado.
  '\u00B5': 'm',  // MICRO SIGN
  '\u2126': 'W',  // OHM SIGN
}

// ---------------------------------------------------------------------------
// Acentos
// ---------------------------------------------------------------------------

type Accent = 'acute' | 'grave' | 'tilde' | 'diaeresis' | 'circumflex' | 'cedilla'

const ACCENTED: Record<string, { base: string; accent: Accent }> = {
  á: { base: 'a', accent: 'acute' }, Á: { base: 'A', accent: 'acute' },
  é: { base: 'e', accent: 'acute' }, É: { base: 'E', accent: 'acute' },
  í: { base: 'i', accent: 'acute' }, Í: { base: 'I', accent: 'acute' },
  ó: { base: 'o', accent: 'acute' }, Ó: { base: 'O', accent: 'acute' },
  ú: { base: 'u', accent: 'acute' }, Ú: { base: 'U', accent: 'acute' },
  à: { base: 'a', accent: 'grave' }, À: { base: 'A', accent: 'grave' },
  è: { base: 'e', accent: 'grave' }, È: { base: 'E', accent: 'grave' },
  ò: { base: 'o', accent: 'grave' }, Ò: { base: 'O', accent: 'grave' },
  ñ: { base: 'n', accent: 'tilde' }, Ñ: { base: 'N', accent: 'tilde' },
  ü: { base: 'u', accent: 'diaeresis' }, Ü: { base: 'U', accent: 'diaeresis' },
  ï: { base: 'i', accent: 'diaeresis' }, Ï: { base: 'I', accent: 'diaeresis' },
  ê: { base: 'e', accent: 'circumflex' }, Ê: { base: 'E', accent: 'circumflex' },
  ç: { base: 'c', accent: 'cedilla' }, Ç: { base: 'C', accent: 'cedilla' },
}

/** Separación entre lo alto del glifo base y lo bajo del acento. */
const ACCENT_GAP = 2

/**
 * Trazos del acento, en unidades Hershey y relativos a un punto de anclaje.
 * El eje Y crece hacia abajo, así que los valores negativos suben.
 */
function accentStrokes(accent: Accent, cx: number, anchorY: number): Vec2[][] {
  const p = (dx: number, dy: number): Vec2 => ({ x: cx + dx, y: anchorY + dy })

  switch (accent) {
    case 'acute':
      return [[p(-1.6, 0), p(1.6, -3.4)]]
    case 'grave':
      return [[p(-1.6, -3.4), p(1.6, 0)]]
    case 'circumflex':
      return [[p(-2.2, 0), p(0, -3.4), p(2.2, 0)]]
    case 'tilde':
      return [[p(-3.2, -0.6), p(-1.9, -2.6), p(-0.6, -2.4), p(0.6, -0.8), p(1.9, -0.6), p(3.2, -2.6)]]
    case 'diaeresis':
      // Dos trazos cortos en vez de dos puntos: un punto de este tamaño queda
      // por debajo del diámetro de la punta y la fresa solo lo picaría.
      return [[p(-1.8, -0.4), p(-1.8, -2.4)], [p(1.8, -0.4), p(1.8, -2.4)]]
    case 'cedilla':
      // Va por debajo de la línea base, no encima.
      return [[p(0, 0), p(0.6, 1.6), p(-1.4, 2.6)]]
  }
}

// ---------------------------------------------------------------------------
// Resolución
// ---------------------------------------------------------------------------

/** Caracteres que este módulo sabe resolver aunque la familia no los tenga. */
export const SUPPORTED_SYMBOLS: string[] = [
  ...Object.keys(GREEK_MAP),
  ...Object.keys(ACCENTED),
  '°', 'Ø', 'ø', '⌀', '±', '×', '÷', '¿', '¡',
]

export function resolveSymbolGlyph(font: HersheyFont, char: string): Glyph | null {
  const greek = GREEK_MAP[char]
  if (greek) return fromGreek(font, greek)

  const accented = ACCENTED[char]
  if (accented) return compose(font, accented.base, accented.accent)

  switch (char) {
    case '°': return degree(font)
    case 'Ø': return slashed(font, 'O')
    case '⌀': return slashed(font, 'O')
    case 'ø': return slashed(font, 'o')
    case '±': return plusMinus(font)
    case '×': return times(font)
    case '÷': return divide(font)
    case '¿': return inverted(font, '?')
    case '¡': return inverted(font, '!')
    default: return null
  }
}

/**
 * Toma el glifo de la familia griega y lo ajusta a las métricas de la familia
 * de destino. Hoy las seis comparten altura de mayúscula, pero escalarlo cuesta
 * lo mismo y evita una sorpresa el día que se añada una que no.
 */
function fromGreek(font: HersheyFont, asciiChar: string): Glyph | null {
  const greekFont = getFallbackFont('greek')
  if (!greekFont) return null

  const index = asciiChar.charCodeAt(0) - greekFont.firstCharCode
  const data = greekFont.glyphs[index]
  if (!data) return null

  const scale = font.metrics.capHeight / greekFont.metrics.capHeight
  const shift = font.metrics.baseline - greekFont.metrics.baseline * scale

  return {
    strokes: parseGlyphPath(data.d).map((stroke) =>
      stroke.map((p) => ({ x: p.x * scale, y: p.y * scale + shift }))),
    advance: 2 * data.o * scale,
  }
}

function compose(font: HersheyFont, baseChar: string, accent: Accent): Glyph | null {
  const base = getBaseGlyph(font, baseChar)
  if (!base) return null

  const box = bounds(base.strokes)
  if (!box) return base

  const cx = (box.minX + box.maxX) / 2
  const anchorY = accent === 'cedilla' ? font.metrics.baseline : box.minY - ACCENT_GAP

  return {
    strokes: [...base.strokes, ...accentStrokes(accent, cx, anchorY)],
    advance: base.advance,
  }
}

/** Círculo pequeño en alto, aproximado por un polígono de doce lados. */
function degree(font: HersheyFont): Glyph {
  const r = font.metrics.capHeight * 0.13
  const cy = font.metrics.baseline - font.metrics.capHeight * 0.78
  const cx = r + 1.5
  const segments = 12

  const stroke = Array.from({ length: segments + 1 }, (_, i) => {
    const a = (i / segments) * Math.PI * 2
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })

  return { strokes: [stroke], advance: 2 * (cx + r) }
}

/** Letra atravesada por una diagonal: el diámetro de toda la vida. */
function slashed(font: HersheyFont, baseChar: string): Glyph | null {
  const base = getBaseGlyph(font, baseChar)
  if (!base) return null
  const box = bounds(base.strokes)
  if (!box) return base

  return {
    strokes: [
      ...base.strokes,
      [{ x: box.minX - 1.5, y: box.maxY + 1.5 }, { x: box.maxX + 1.5, y: box.minY - 1.5 }],
    ],
    advance: base.advance,
  }
}

function plusMinus(font: HersheyFont): Glyph | null {
  const base = getBaseGlyph(font, '+')
  if (!base) return null
  const box = bounds(base.strokes)
  if (!box) return base

  return {
    strokes: [...base.strokes, [{ x: box.minX, y: box.maxY + 2.5 }, { x: box.maxX, y: box.maxY + 2.5 }]],
    advance: base.advance,
  }
}

/** Aspa simétrica, con la caja del signo más para que case de tamaño. */
function times(font: HersheyFont): Glyph | null {
  const plus = getBaseGlyph(font, '+')
  if (!plus) return null
  const box = bounds(plus.strokes)
  if (!box) return plus

  const inset = (box.maxX - box.minX) * 0.15
  return {
    strokes: [
      [{ x: box.minX + inset, y: box.minY + inset }, { x: box.maxX - inset, y: box.maxY - inset }],
      [{ x: box.maxX - inset, y: box.minY + inset }, { x: box.minX + inset, y: box.maxY - inset }],
    ],
    advance: plus.advance,
  }
}

function divide(font: HersheyFont): Glyph | null {
  const plus = getBaseGlyph(font, '+')
  if (!plus) return null
  const box = bounds(plus.strokes)
  if (!box) return plus

  const cx = (box.minX + box.maxX) / 2
  const cy = (box.minY + box.maxY) / 2
  const gap = (box.maxY - box.minY) * 0.3

  return {
    strokes: [
      [{ x: box.minX, y: cy }, { x: box.maxX, y: cy }],
      [{ x: cx, y: cy - gap - 0.6 }, { x: cx, y: cy - gap + 0.6 }],
      [{ x: cx, y: cy + gap - 0.6 }, { x: cx, y: cy + gap + 0.6 }],
    ],
    advance: plus.advance,
  }
}

/**
 * Signo de apertura: el de cierre girado media vuelta sobre su caja y bajado,
 * porque en español desciende por debajo de la línea base.
 */
function inverted(font: HersheyFont, baseChar: string): Glyph | null {
  const base = getBaseGlyph(font, baseChar)
  if (!base) return null
  const box = bounds(base.strokes)
  if (!box) return base

  const cx = (box.minX + box.maxX) / 2
  const cy = (box.minY + box.maxY) / 2
  const drop = font.metrics.capHeight * 0.22

  return {
    strokes: base.strokes.map((stroke) =>
      stroke.map((p) => ({ x: 2 * cx - p.x, y: 2 * cy - p.y + drop }))),
    advance: base.advance,
  }
}

function bounds(strokes: Vec2[][]) {
  const pts = strokes.flat()
  if (pts.length === 0) return null
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  }
}
