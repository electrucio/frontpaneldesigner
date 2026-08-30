import { getBaseGlyph, type Glyph, type HersheyFont } from './hershey'
import { resolveSymbolGlyph } from './symbols'

/**
 * Resolución completa de un carácter: primero la familia, y si no lo tiene, las
 * reservas de `symbols.ts` (griego, símbolos y letras acentuadas).
 *
 * Vive aparte de `hershey.ts` para que los datos no dependan de la composición
 * y no haya ciclo de importación entre ambos.
 */

const cache = new Map<string, Glyph | null>()

export function getGlyph(font: HersheyFont, char: string): Glyph | null {
  const key = `${font.id}:${char}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  const glyph = getBaseGlyph(font, char) ?? resolveSymbolGlyph(font, char)
  cache.set(key, glyph)
  return glyph
}

export { SUPPORTED_SYMBOLS } from './symbols'
