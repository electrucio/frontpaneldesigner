/**
 * Esquema del documento (serializable, versionado).
 *
 * Todas las longitudes en milímetros y todos los ángulos en grados.
 *
 * Convención angular (usada por arcos y escalas): 0° = las 12 en punto,
 * positivo = sentido horario. Ver `geometry/polar.ts`.
 *
 * Convención de coordenadas: origen arriba-izquierda del panel, X a la derecha,
 * Y hacia abajo (igual que SVG). La exportación puede invertir Y si la CAM lo pide.
 */

export type Mm = number
export type Deg = number

export const DOC_VERSION = 1 as const

// ---------------------------------------------------------------------------
// Capas
// ---------------------------------------------------------------------------

/**
 * Capa de destino de la geometría. Determina el grupo SVG, el color de export
 * y qué herramienta/operación le asignará la CAM.
 */
export type LayerId = 'panel' | 'engrave' | 'cut' | 'drill'

/**
 * Cómo se mecaniza el trazo:
 *  - `centerline`: path abierto que la V-bit recorre a profundidad constante.
 *    El ancho real lo da la profundidad, no el SVG.
 *  - `fill`: región cerrada que la CAM vacía por V-carving.
 */
export type EngraveStyle = 'centerline' | 'fill'

// ---------------------------------------------------------------------------
// Herramienta
// ---------------------------------------------------------------------------

export interface CalibrationSample {
  depthMm: Mm
  /** Ancho de surco medido con calibre. */
  widthMm: Mm
}

/**
 * Ajuste empírico `w = tipEffMm + kPerMm · d`, obtenido midiendo surcos reales.
 * Sustituye a los valores nominales en preview, DRC y calculadora.
 */
export interface ToolCalibration {
  tipEffMm: Mm
  kPerMm: number
  /** ISO-8601. */
  measuredAt: string
  samples: CalibrationSample[]
}

export interface ToolProfile {
  /**
   * Ángulo TOTAL incluido de la V-bit, no el semiángulo.
   * Una fresa "de 30°" suele ser 30° incluidos (semiángulo 15°), pero algunos
   * fabricantes publican el semiángulo: una "30° por lado" son 60° incluidos y
   * ensancha más del doble por unidad de profundidad.
   */
  includedAngleDeg: Deg
  /** Diámetro de la punta plana. */
  tipMm: Mm
  /** Profundidad por defecto, heredada por los objetos sin `depthMm` propia. */
  defaultDepthMm: Mm
  /** Profundidad máxima alcanzable (material/máquina). Alimenta el DRC de V-carve. */
  maxDepthMm: Mm
  calibration: ToolCalibration | null
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export interface PanelSpec {
  w: Mm
  h: Mm
  cornerRadiusMm: Mm
  /** Margen de seguridad al borde; el DRC avisa de la geometría que lo invade. */
  edgeMarginMm: Mm
  /** Solo apariencia del preview. No afecta al SVG exportado. */
  background: string
  engraveColor: string
}

// ---------------------------------------------------------------------------
// Objetos
// ---------------------------------------------------------------------------

/**
 * Punto del panel al que se refieren las coordenadas del objeto, para que
 * redimensionar el panel no descoloque el diseño.
 */
export type Anchor =
  | 'topLeft' | 'top' | 'topRight'
  | 'left' | 'center' | 'right'
  | 'bottomLeft' | 'bottom' | 'bottomRight'

export interface ObjBase {
  id: string
  name: string
  visible: boolean
  locked: boolean
  layer: LayerId
  anchor: Anchor
  /** Desplazamiento respecto al ancla. */
  x: Mm
  y: Mm
  rotationDeg: Deg
  /** Profundidad propia; `null` hereda de `tool.defaultDepthMm`. */
  depthMm: Mm | null
}

export interface Point2 {
  x: Mm
  y: Mm
}

export type TextHAlign = 'left' | 'center' | 'right'
export type TextVAlign = 'top' | 'middle' | 'baseline' | 'bottom'

export interface TextObj extends ObjBase {
  type: 'text'
  text: string
  /** Id de familia; determina también si es Hershey (centerline) u outline. */
  fontId: string
  mode: EngraveStyle
  /** Tamaño expresado como altura de mayúscula, no como cuerpo en puntos. */
  capHeightMm: Mm
  trackingMm: Mm
  lineGapMm: Mm
  align: TextHAlign
  vAlign: TextVAlign
  /** Texto curvado sobre un arco; `null` = texto recto. */
  arc: { radiusMm: Mm; direction: 'convex' | 'concave' } | null
}

export interface LineObj extends ObjBase {
  type: 'line'
  points: Point2[]
  closed: boolean
}

export interface RectObj extends ObjBase {
  type: 'rect'
  w: Mm
  h: Mm
  cornerRadiusMm: Mm
  filled: boolean
}

export interface CircleObj extends ObjBase {
  type: 'circle'
  diameterMm: Mm
  filled: boolean
}

export interface ArcObj extends ObjBase {
  type: 'arc'
  radiusMm: Mm
  startAngleDeg: Deg
  endAngleDeg: Deg
}

/** Agujero o ventana. Vive en `cut` o `drill`; nunca se graba. */
export interface HoleObj extends ObjBase {
  type: 'hole'
  shape: 'circle' | 'rect'
  diameterMm: Mm
  w: Mm
  h: Mm
  cornerRadiusMm: Mm
}

// --- Escala circular -------------------------------------------------------

export type ScaleArcMode = 'none' | 'line' | 'band' | 'segments'
export type TickDirection = 'outward' | 'inward' | 'centered'
export type TickShape = 'line' | 'dot' | 'triangle'
export type ScaleLabelMode = 'none' | 'endpoints' | 'major'
export type ScaleLabelOrientation = 'upright' | 'radial' | 'tangential'

export interface ScaleArcSpec {
  mode: ScaleArcMode
  radiusMm: Mm
  /** Grosor de banda; ignorado en modo `line`. */
  bandWidthMm: Mm
  /** Extensión angular propia, independiente de la de los ticks. */
  startAngleDeg: Deg
  endAngleDeg: Deg
  segmentCount: number
  segmentGapDeg: Deg
}

export interface TickSpec {
  enabled: boolean
  /** Ticks mayores: número total de marcas. Menores: subdivisiones por intervalo. */
  count: number
  lengthMm: Mm
  direction: TickDirection
  /** Radio de referencia desde el que crece el tick. */
  radiusMm: Mm
  shape: TickShape
  /** Diámetro del punto / lado del triángulo, según `shape`. */
  markerSizeMm: Mm
}

export interface ScaleLabelSpec {
  mode: ScaleLabelMode
  /** Valores generados por rango; ignorado si `values` no es null. */
  min: number
  max: number
  decimals: number
  prefix: string
  suffix: string
  /** Lista explícita de etiquetas; tiene prioridad sobre el rango. */
  values: string[] | null
  radiusMm: Mm
  orientation: ScaleLabelOrientation
  fontId: string
  mode2: EngraveStyle
  capHeightMm: Mm
}

export interface ScaleCaptionSpec {
  enabled: boolean
  text: string
  position: 'top' | 'bottom'
  offsetMm: Mm
  fontId: string
  mode: EngraveStyle
  capHeightMm: Mm
}

export interface ScaleObj extends ObjBase {
  type: 'scale'
  radiusMm: Mm
  startAngleDeg: Deg
  endAngleDeg: Deg
  arc: ScaleArcSpec
  majorTicks: TickSpec
  minorTicks: TickSpec
  labels: ScaleLabelSpec
  caption: ScaleCaptionSpec
  /** Agujero del eje del mando, en capa `drill`. */
  centerHoleDiameterMm: Mm | null
}

// --- Logo ------------------------------------------------------------------

/**
 * Un logo importado se guarda ya normalizado (paths absolutos, sin transforms,
 * en un espacio 0..1) para que el proyecto sea autocontenido y determinista.
 */
export interface LogoObj extends ObjBase {
  type: 'logo'
  /** Paths normalizados: `d` en coordenadas del `viewBox` normalizado. */
  paths: { d: string; filled: boolean }[]
  /** Dimensiones del contenido normalizado, para conservar proporción. */
  sourceW: number
  sourceH: number
  widthMm: Mm
  keepAspect: boolean
  heightMm: Mm
  /**
   * Cómo se graba, decidido explícitamente y nunca en silencio.
   *
   * `as-authored` respeta el relleno que traía cada forma del fichero.
   * `all-filled` vacía todo en V y `all-centerline` sigue todos los contornos
   * con la punta; ambos existen porque un SVG con hojas de estilo puede
   * declarar el relleno de forma que no sepamos leer.
   */
  renderMode: 'as-authored' | 'all-filled' | 'all-centerline'
}

export interface GroupObj extends ObjBase {
  type: 'group'
  children: Obj[]
}

export type Obj =
  | TextObj | LineObj | RectObj | CircleObj | ArcObj
  | HoleObj | ScaleObj | LogoObj | GroupObj

export type ObjType = Obj['type']

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

export interface Doc {
  version: typeof DOC_VERSION
  name: string
  panel: PanelSpec
  tool: ToolProfile
  /** Orden = z-order de dibujo. */
  objects: Obj[]
}
