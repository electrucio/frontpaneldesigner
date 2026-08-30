import type { Vec2 } from '../geometry/vec'
import data from '../../assets/fonts/hershey.json'

/**
 * Fuentes Hershey: trazos de línea única, que es lo que quiere una V-bit fina.
 * Un texto de 2 mm grabado con una fuente de contornos sale con doble trazo y
 * la letra se cierra; con Hershey el surco ES la letra.
 *
 * Los datos los genera `scripts/build-hershey.ts` a partir del port
 * `hersheytext` (MIT) de las fuentes de dominio público de A. V. Hershey.
 */

export interface HersheyMetrics {
  /** Y de la línea base en unidades Hershey (el eje Y crece hacia abajo). */
  baseline: number
  capHeight: number
  xHeight: number
  ascender: number
  descender: number
  spaceAdvance: number
}

export interface HersheyGlyphData {
  d: string
  /** Centro horizontal del glifo. El avance es `2 * o`; ver `glyphAdvance`. */
  o: number
}

export interface HersheyFont {
  id: string
  label: string
  sourceName: string
  firstCharCode: number
  metrics: HersheyMetrics
  glyphs: HersheyGlyphData[]
}

const DATA = data as {
  fonts: Record<string, HersheyFont>
  fallbackFonts: Record<string, HersheyFont>
}

const FONTS = DATA.fonts

export const listHersheyFonts = (): { id: string; label: string }[] =>
  Object.values(FONTS).map((f) => ({ id: f.id, label: f.label }))

export const getHersheyFont = (id: string): HersheyFont | null => FONTS[id] ?? null

export const isHersheyFont = (id: string): boolean => id in FONTS

/**
 * Familias de reserva, no ofrecidas al usuario: aportan los caracteres que las
 * latinas no tienen. Ver `symbols.ts`.
 */
export const getFallbackFont = (id: string): HersheyFont | null =>
  DATA.fallbackFonts[id] ?? null

/**
 * Avance del glifo en unidades Hershey.
 *
 * `o` es el **centro** de la caja del glifo, no su anchura: la 'H' tiene o=11 y
 * ocupa de x=4 a x=18 (4 unidades de margen a cada lado dentro de una caja de
 * 22). De ahí que el avance sea `2·o` y que el glifo ya venga colocado dentro
 * de una caja que empieza en x=0, lista para desplazar.
 */
export const glyphAdvance = (g: HersheyGlyphData): number => 2 * g.o

export interface Glyph {
  /** Trazos abiertos, en unidades Hershey y con la línea base sin trasladar. */
  strokes: Vec2[][]
  advance: number
}

/**
 * Interpreta el `d` de un glifo Hershey. Solo aparecen `M` y `L`, con
 * repetición implícita de coordenadas: `L 4,1 13,1 16,2` son tres puntos del
 * mismo trazo. Cada `M` abre un trazo nuevo.
 */
export function parseGlyphPath(d: string): Vec2[][] {
  const strokes: Vec2[][] = []
  let current: Vec2[] | null = null

  for (const m of d.matchAll(/([ML])|(-?[\d.]+),(-?[\d.]+)/g)) {
    if (m[1] === 'M') {
      current = []
      strokes.push(current)
    } else if (m[1] === 'L') {
      // Continúa el trazo abierto; un `L` sin `M` previo sería un dato corrupto.
      if (!current) { current = []; strokes.push(current) }
    } else if (m[2] !== undefined) {
      if (!current) { current = []; strokes.push(current) }
      current.push({ x: Number(m[2]), y: Number(m[3]) })
    }
  }

  return strokes.filter((s) => s.length > 0)
}

/**
 * Glifo tal cual está en la familia, sin reservas ni composición.
 * Para la resolución completa, usar `getGlyph` de `glyphs.ts`.
 */
export function getBaseGlyph(font: HersheyFont, char: string): Glyph | null {
  if (char === ' ') return { strokes: [], advance: font.metrics.spaceAdvance }

  const index = char.charCodeAt(0) - font.firstCharCode
  const data = font.glyphs[index]
  if (index < 0 || !data) return null

  return { strokes: parseGlyphPath(data.d), advance: glyphAdvance(data) }
}
