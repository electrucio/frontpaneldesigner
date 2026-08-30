import svgpath from 'svgpath'
import { contoursBounds, pathToContours } from './pathToContours'
import { shapeToPathData } from './shapes'

/**
 * Importación de logotipos SVG.
 *
 * El resultado se guarda **ya normalizado** dentro del proyecto: caminos
 * absolutos, sin transformaciones pendientes y con el origen en la esquina de su
 * propia caja. Así el `.json` es autocontenido y determinista, y no depende de
 * que el fichero original siga existiendo.
 */

export class LogoImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LogoImportError'
  }
}

export interface ImportedPath {
  d: string
  /**
   * Si la forma se rellena. Decide si el trazo se sigue con la punta
   * (centerline) o si la región se vacía en V.
   */
  filled: boolean
}

export interface LogoImportResult {
  paths: ImportedPath[]
  /** Dimensiones del dibujo, no del lienzo del fichero. */
  width: number
  height: number
  filledCount: number
  strokedCount: number
  warnings: string[]
}

const GEOMETRY_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'])

/**
 * Elementos que **cambian la geometría** y que ignorar en silencio daría una
 * pieza distinta de la que se ve en pantalla. Se rechaza el fichero entero.
 */
const REJECTED: Record<string, string> = {
  clipPath: 'recorta la geometría',
  mask: 'enmascara la geometría',
  use: 'clona geometría de otro elemento',
  text: 'contiene texto sin convertir a trazado',
  tspan: 'contiene texto sin convertir a trazado',
  foreignObject: 'contiene contenido ajeno a SVG',
}

/** Elementos que solo afectan al aspecto: se avisa, pero no se rechaza. */
const WARNED: Record<string, string> = {
  style: 'El fichero usa hojas de estilo, así que el relleno de algunas formas puede leerse mal. ' +
    'Si alguna parte sale como trazo en vez de como relleno (o al revés), cámbialo en el inspector.',
  filter: 'El fichero usa filtros gráficos; se ignoran, porque no se pueden mecanizar.',
  svg: '',
}

export function importSvgLogo(svgText: string): LogoImportResult {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')

  if (doc.querySelector('parsererror')) {
    throw new LogoImportError('El fichero no es un SVG válido.')
  }
  const root = doc.documentElement
  if (!root || root.localName !== 'svg') {
    throw new LogoImportError('El fichero no contiene un elemento <svg> en la raíz.')
  }

  const warnings: string[] = []

  for (const [tag, reason] of Object.entries(REJECTED)) {
    if (root.getElementsByTagName(tag).length > 0) {
      throw new LogoImportError(
        `El SVG contiene <${tag}>, que ${reason}. Aplánalo antes de importarlo: en Inkscape, ` +
        'selecciona todo y usa Trazo → Objeto a trazado, y Edición → Clonar → Desconectar clon.',
      )
    }
  }

  if (root.getElementsByTagName('style').length > 0) warnings.push(WARNED.style)
  if (root.getElementsByTagName('filter').length > 0) warnings.push(WARNED.filter)
  if (root.getElementsByTagName('svg').length > 0) {
    warnings.push('El fichero anida elementos <svg>; sus recortes de vista se ignoran.')
  }

  const raw: ImportedPath[] = []

  for (const el of Array.from(root.querySelectorAll('*'))) {
    const tag = el.localName
    if (!GEOMETRY_TAGS.has(tag)) continue
    // `display:none` y `visibility:hidden` no se mecanizan.
    if (isHidden(el)) continue

    const d = shapeToPathData(tag, (name) => el.getAttribute(name))
    if (!d) continue

    const transformed = applyAncestorTransforms(d, el, root)
    if (!transformed) continue

    raw.push({ d: transformed, filled: isFilled(el) })
  }

  if (raw.length === 0) {
    throw new LogoImportError(
      'No se ha encontrado geometría en el SVG. Si el logotipo es texto, conviértelo a trazado.',
    )
  }

  return normalize(raw, warnings)
}

/**
 * Aplica las transformaciones de dentro hacia fuera: primero la del propio
 * elemento y después las de sus ancestros, que es el orden en que las compone
 * SVG.
 */
function applyAncestorTransforms(d: string, el: Element, root: Element): string | null {
  let path = svgpath(d)
  let node: Element | null = el

  while (node && node !== root.parentElement) {
    const transform = node.getAttribute('transform')
    if (transform) {
      try {
        path = path.transform(transform)
      } catch {
        // Una transformación ilegible invalida la posición de esta forma; es
        // preferible descartarla a colocarla en un sitio equivocado.
        return null
      }
    }
    node = node.parentElement
  }

  return path.abs().unarc().unshort().round(6).toString()
}

/**
 * Relleno efectivo.
 *
 * En SVG el relleno por defecto es negro, así que una forma sin atributo alguno
 * está rellena. Solo se considera trazo cuando alguien pone `fill` en `none`
 * explícitamente, en el elemento o en un ancestro.
 */
function isFilled(el: Element): boolean {
  let node: Element | null = el
  while (node) {
    const fill = styleValue(node, 'fill') ?? node.getAttribute('fill')
    if (fill !== null && fill !== '' && fill !== 'inherit') {
      return fill.trim().toLowerCase() !== 'none'
    }
    node = node.parentElement
  }
  return true
}

function isHidden(el: Element): boolean {
  let node: Element | null = el
  while (node) {
    if (node.getAttribute('display')?.trim() === 'none') return true
    if (styleValue(node, 'display')?.trim() === 'none') return true
    if (styleValue(node, 'visibility')?.trim() === 'hidden') return true
    node = node.parentElement
  }
  return false
}

/** Lee una propiedad del atributo `style` en línea. */
function styleValue(el: Element, property: string): string | null {
  const style = el.getAttribute('style')
  if (!style) return null
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i').exec(style)
  return match ? match[1].trim() : null
}

/**
 * Traslada el conjunto para que su caja empiece en el origen y devuelve sus
 * dimensiones.
 *
 * Se normaliza contra la **caja del dibujo**, no contra el `viewBox`: al pedir
 * «30 mm de ancho» se espera que lo que mida 30 mm sea la tinta, no un lienzo
 * con márgenes arbitrarios.
 */
function normalize(paths: ImportedPath[], warnings: string[]): LogoImportResult {
  const bounds = contoursBounds(paths.flatMap((p) => pathToContours(p.d)))

  if (!Number.isFinite(bounds.width) || bounds.width <= 0 || bounds.height <= 0) {
    throw new LogoImportError('La geometría del SVG está vacía o es degenerada.')
  }

  const moved = paths.map((p) => ({
    ...p,
    d: svgpath(p.d).translate(-bounds.minX, -bounds.minY).round(6).toString(),
  }))

  return {
    paths: moved,
    width: bounds.width,
    height: bounds.height,
    filledCount: moved.filter((p) => p.filled).length,
    strokedCount: moved.filter((p) => !p.filled).length,
    warnings,
  }
}
