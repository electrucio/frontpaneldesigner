import type { Mm, TextHAlign, TextVAlign } from '../types'
import type { Vec2 } from '../geometry/vec'
import { apply, multiply, rotation, translation } from '../geometry/mat'
import { polar } from '../geometry/polar'
import { getGlyph, getHersheyFont, type HersheyFont } from './hershey'

/**
 * Maquetación de texto de línea única.
 *
 * El tamaño se expresa como **altura de mayúscula en milímetros**, no como
 * cuerpo en puntos: en un panel se mide con calibre lo que mide la letra, no un
 * em invisible. La conversión usa la altura de mayúscula real de cada familia,
 * medida en `scripts/build-hershey.ts`, para que 3 mm sean 3 mm en todas.
 *
 * Coordenadas locales al objeto, en mm y con Y hacia abajo como el resto del
 * documento. El origen depende de `align`/`vAlign`.
 */

export interface TextStyle {
  fontId: string
  capHeightMm: Mm
  trackingMm: Mm
  lineGapMm: Mm
  align: TextHAlign
  vAlign: TextVAlign
  arc: { radiusMm: Mm; direction: 'convex' | 'concave' } | null
}

export interface TextLayout {
  strokes: Vec2[][]
  /** Anchura de la línea más ancha. */
  widthMm: Mm
  heightMm: Mm
  lineWidths: Mm[]
  /** Caracteres sin glifo en la familia. Nunca se descartan en silencio. */
  missing: string[]
}

const EMPTY: TextLayout = { strokes: [], widthMm: 0, heightMm: 0, lineWidths: [], missing: [] }

interface PlacedGlyph {
  strokes: Vec2[][]
  /** Desplazamiento del glifo dentro de la línea, en mm. */
  penMm: Mm
  advanceMm: Mm
}

function layoutLine(font: HersheyFont, text: string, scale: number, trackingMm: Mm) {
  const glyphs: PlacedGlyph[] = []
  const missing: string[] = []
  let pen = 0

  for (const char of text) {
    const glyph = getGlyph(font, char)
    if (!glyph) {
      // Hershey solo cubre ASCII imprimible: 'Ω', 'µ', 'ñ' o '°' no existen.
      missing.push(char)
      continue
    }
    const advanceMm = glyph.advance * scale
    glyphs.push({ strokes: glyph.strokes, penMm: pen, advanceMm })
    pen += advanceMm + trackingMm
  }

  // El tracking va entre letras, no después de la última.
  const widthMm = glyphs.length === 0 ? 0 : pen - trackingMm
  return { glyphs, widthMm, missing }
}

export function layoutHersheyText(text: string, style: TextStyle): TextLayout {
  const font = getHersheyFont(style.fontId)
  if (!font || text === '') return EMPTY

  const m = font.metrics
  const scale = style.capHeightMm / m.capHeight
  const lines = text.split('\n')
  const lineAdvance = (m.ascender + m.descender) * scale + style.lineGapMm

  const laid = lines.map((line) => layoutLine(font, line, scale, style.trackingMm))
  const lineWidths = laid.map((l) => l.widthMm)
  const widthMm = Math.max(0, ...lineWidths)
  const blockHeight = (lines.length - 1) * lineAdvance + style.capHeightMm

  const baseline0 = firstBaseline(style.vAlign, style.capHeightMm, blockHeight, lineAdvance, lines.length)

  const strokes: Vec2[][] = []
  const missing = new Set<string>()

  laid.forEach((line, i) => {
    line.missing.forEach((c) => missing.add(c))
    const baselineY = baseline0 + i * lineAdvance
    const x0 = lineStartX(style.align, line.widthMm)

    for (const glyph of line.glyphs) {
      const place = style.arc
        ? arcPlacer(style.arc, glyph, x0, line.widthMm, baselineY, m.baseline, scale)
        : straightPlacer(glyph, x0, baselineY, m.baseline, scale)
      for (const stroke of glyph.strokes) strokes.push(stroke.map(place))
    }
  })

  return {
    strokes,
    widthMm,
    heightMm: blockHeight,
    lineWidths,
    missing: [...missing],
  }
}

/**
 * Y de la línea base de la primera línea.
 *
 * Las referencias son la caja de mayúsculas, no el em: es lo que se ve y lo que
 * se mide. `baseline` alinea la primera línea; `bottom`, la última.
 */
function firstBaseline(
  vAlign: TextVAlign, capHeightMm: Mm, blockHeight: Mm, lineAdvance: Mm, lineCount: number,
): Mm {
  switch (vAlign) {
    case 'top': return capHeightMm
    case 'middle': return capHeightMm - blockHeight / 2
    case 'baseline': return 0
    case 'bottom': return -(lineCount - 1) * lineAdvance
  }
}

function lineStartX(align: TextHAlign, widthMm: Mm): Mm {
  switch (align) {
    case 'left': return 0
    case 'center': return -widthMm / 2
    case 'right': return -widthMm
  }
}

/** Texto recto: el glifo se escala y se traslada, sin más. */
function straightPlacer(
  glyph: PlacedGlyph, x0: Mm, baselineY: Mm, fontBaseline: number, scale: number,
) {
  return (p: Vec2): Vec2 => ({
    x: x0 + glyph.penMm + p.x * scale,
    y: baselineY + (p.y - fontBaseline) * scale,
  })
}

/**
 * Texto sobre un arco.
 *
 * Cada glifo se coloca **rígido**: se rota entero según su posición angular en
 * vez de deformarlo siguiendo la curva. Con radios pequeños la deformación
 * arquea los trazos verticales de forma muy visible, y en un panel se nota.
 *
 * El vértice del arco cae en la x = 0 local, igual que el origen del texto
 * recto, así que `align` sigue significando lo mismo. `convex` pone el centro
 * del círculo debajo y el texto queda arqueado hacia arriba (el «MARSHALL»
 * sobre los mandos); `concave` lo pone encima y el texto se lee desde dentro.
 */
function arcPlacer(
  arc: { radiusMm: Mm; direction: 'convex' | 'concave' },
  glyph: PlacedGlyph, x0: Mm, _lineWidth: Mm, baselineY: Mm, fontBaseline: number, scale: number,
) {
  const radius = Math.max(arc.radiusMm, 1e-6)
  const convex = arc.direction === 'convex'
  const center: Vec2 = { x: 0, y: convex ? radius : -radius }

  // Distancia con signo desde el vértice del arco hasta el centro del glifo,
  // medida sobre la línea base, y el ángulo que le corresponde.
  const s = x0 + glyph.penMm + glyph.advanceMm / 2
  const deg = (s / radius) * (180 / Math.PI)

  // En cóncavo el vértice está a 180° del centro y el texto va invertido.
  const anchorDeg = convex ? deg : 180 - deg
  const spin = anchorDeg
  const anchor = polar(center, radius, anchorDeg)

  const m = multiply(translation(anchor.x, anchor.y), rotation(spin))

  return (p: Vec2): Vec2 => apply(m, {
    // El glifo se centra en su propia caja para poder girar sobre el punto del arco.
    x: p.x * scale - glyph.advanceMm / 2,
    // `baselineY` separa las líneas radialmente, no en vertical.
    y: (p.y - fontBaseline) * scale + baselineY,
  })
}
