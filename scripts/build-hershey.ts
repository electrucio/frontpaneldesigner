/**
 * Genera el subconjunto de fuentes Hershey que empaqueta la aplicación.
 *
 *   npm run build:hershey
 *
 * Las fuentes Hershey son de dominio público (Dr. A. V. Hershey, US National
 * Bureau of Standards, 1967); el port a JSON es `hersheytext` (MIT, James T).
 * Aquí se toma solo lo que usamos y se **calculan las métricas**, que el port
 * original no trae: sin altura de mayúscula por familia, «altura de mayúscula
 * en mm» no cuadraría entre familias ni contra el modo de contornos.
 *
 * `hersheytext` es dependencia SOLO de desarrollo: en el navegador se carga el
 * JSON generado, nunca su librería (que arrastra cheerio).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const SOURCE = require.resolve('hersheytext/hersheytext.min.json')

/** Primer carácter del array de glifos del port: ASCII 33 ('!'). */
const FIRST_CHAR_CODE = 33

/**
 * Avance del espacio, ausente del port (empieza en '!').
 * 16 unidades es el valor del Hershey original, y con una altura de mayúscula
 * de 21 unidades resulta coherente en las seis familias.
 */
const SPACE_ADVANCE_UNITS = 16

/** Familias que empaquetamos. El resto del port (astrología, música…) sobra. */
const FAMILIES: { key: string; id: string; label: string }[] = [
  { key: 'futural', id: 'hershey-sans', label: 'Hershey Sans (1 trazo)' },
  { key: 'futuram', id: 'hershey-sans-bold', label: 'Hershey Sans negrita' },
  { key: 'timesr', id: 'hershey-serif', label: 'Hershey Serif' },
  { key: 'timesrb', id: 'hershey-serif-bold', label: 'Hershey Serif negrita' },
  { key: 'scripts', id: 'hershey-script', label: 'Hershey Script' },
  { key: 'gothiceng', id: 'hershey-gothic', label: 'Hershey Gothic inglesa' },
]

interface SourceGlyph { d: string; o: number }
interface SourceFont { name: string; chars: SourceGlyph[] }

/**
 * Familias que NO se ofrecen al usuario y solo sirven de reserva para
 * caracteres que las latinas no tienen: la griega aporta Ω, µ, π, Δ…
 */
const FALLBACK_FAMILIES: { key: string; id: string }[] = [
  { key: 'greek', id: 'greek' },
]

const source: Record<string, SourceFont> = JSON.parse(readFileSync(SOURCE, 'utf8'))

/** Extrae los puntos de un `d` de Hershey (solo M y L, con repetición implícita). */
function points(d: string): [number, number][] {
  const out: [number, number][] = []
  for (const pair of d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) {
    out.push([Number(pair[1]), Number(pair[2])])
  }
  return out
}

function glyphOf(font: SourceFont, ch: string): SourceGlyph | null {
  return font.chars[ch.charCodeAt(0) - FIRST_CHAR_CODE] ?? null
}

/** Extremo superior (Y menor) e inferior de un carácter concreto. */
function extent(font: SourceFont, ch: string): { top: number; bottom: number } | null {
  const g = glyphOf(font, ch)
  if (!g) return null
  const ys = points(g.d).map(([, y]) => y)
  if (ys.length === 0) return null
  return { top: Math.min(...ys), bottom: Math.max(...ys) }
}

/**
 * Métricas verticales en unidades Hershey.
 *
 * Se miden sobre caracteres de referencia, no sobre el conjunto: la 'H' y la
 * 'x' tienen los remates planos, mientras que 'O' y 'o' sobresalen un poco por
 * arriba y por abajo y falsearían la altura.
 */
function metrics(font: SourceFont) {
  const H = extent(font, 'H')
  const x = extent(font, 'x')
  const p = extent(font, 'p')
  const b = extent(font, 'b')
  if (!H) throw new Error(`La familia ${font.name} no tiene 'H'`)

  const baseline = H.bottom
  return {
    baseline,
    capHeight: baseline - H.top,
    xHeight: x ? baseline - x.top : baseline - H.top,
    ascender: b ? baseline - b.top : baseline - H.top,
    descender: p ? p.bottom - baseline : 0,
    spaceAdvance: SPACE_ADVANCE_UNITS,
  }
}

const fonts = Object.fromEntries(FAMILIES.map(({ key, id, label }) => {
  const font = source[key]
  if (!font) throw new Error(`La familia ${key} no está en ${SOURCE}`)
  return [id, {
    id,
    label,
    sourceKey: key,
    sourceName: font.name,
    firstCharCode: FIRST_CHAR_CODE,
    metrics: metrics(font),
    // `o` NO es el avance sino el CENTRO horizontal del glifo: la 'H' vale 11 y
    // ocupa de x=4 a x=18, la 'W' vale 12 y ocupa de 2 a 22. El avance es 2*o,
    // y el glifo ya viene colocado dentro de esa caja que empieza en x=0.
    // El ejemplo del port original lo toma por el avance y lo compensa con un
    // espaciado manual, que es de donde sale su interletraje irregular.
    glyphs: font.chars.map((g) => ({ d: g.d, o: g.o })),
  }]
}))

const fallbackFonts = Object.fromEntries(FALLBACK_FAMILIES.map(({ key, id }) => {
  const font = source[key]
  if (!font) throw new Error(`La familia de reserva ${key} no está en ${SOURCE}`)
  return [id, {
    id,
    label: font.name,
    sourceKey: key,
    sourceName: font.name,
    firstCharCode: FIRST_CHAR_CODE,
    metrics: metrics(font),
    glyphs: font.chars.map((g) => ({ d: g.d, o: g.o })),
  }]
}))

const out = {
  note: 'Generado por scripts/build-hershey.ts. No editar a mano.',
  provenance: {
    fonts: 'Hershey vector fonts, Dr. A. V. Hershey, US National Bureau of Standards (dominio publico)',
    port: 'hersheytext (MIT) - https://github.com/techninja/hersheytextjs',
  },
  fonts,
  fallbackFonts,
}

const target = 'src/assets/fonts/hershey.json'
writeFileSync(target, JSON.stringify(out))

const kb = (readFileSync(target).length / 1024).toFixed(0)
console.log(`${target}: ${FAMILIES.length} familias + ${FALLBACK_FAMILIES.length} de reserva, ${kb} kB`)
for (const [id, f] of Object.entries(fonts)) {
  const m = (f as { metrics: Record<string, number> }).metrics
  console.log(`  ${id.padEnd(20)} base=${m.baseline} cap=${m.capHeight} x=${m.xHeight} asc=${m.ascender} desc=${m.descender}`)
}
