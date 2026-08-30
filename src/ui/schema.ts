import type { ObjType } from '../core/types'
import { listHersheyFonts } from '../core/text/hershey'

/**
 * Descriptor de parámetros por tipo de objeto.
 *
 * El inspector se genera a partir de esto en vez de escribir un formulario por
 * tipo: añadir un objeto nuevo es declarar sus campos, no cablear una pantalla.
 */

export interface FieldBase {
  key: string
  label: string
  help?: string
}

export type Field =
  | (FieldBase & { kind: 'number'; unit?: string; min?: number; max?: number; step?: number })
  | (FieldBase & { kind: 'text' })
  | (FieldBase & { kind: 'boolean' })
  | (FieldBase & { kind: 'select'; options: { value: string; label: string }[] })
  /** Número con opción de heredar del documento (`null`). */
  | (FieldBase & { kind: 'inherit-number'; unit?: string; min?: number; max?: number; step?: number; inheritLabel: string })
  /** Lista de vértices de una polilínea. */
  | (FieldBase & { kind: 'points' })
  /** Curvado de texto: activación, radio y sentido en un bloque. */
  | (FieldBase & { kind: 'arc-toggle' })
  /** Botonera de presets de escala. */
  | (FieldBase & { kind: 'scale-preset' })

export interface Section {
  title: string
  fields: Field[]
}

const ANCHOR_OPTIONS = [
  { value: 'topLeft', label: 'Arriba izquierda' },
  { value: 'top', label: 'Arriba centro' },
  { value: 'topRight', label: 'Arriba derecha' },
  { value: 'left', label: 'Izquierda' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Derecha' },
  { value: 'bottomLeft', label: 'Abajo izquierda' },
  { value: 'bottom', label: 'Abajo centro' },
  { value: 'bottomRight', label: 'Abajo derecha' },
]

const LAYER_OPTIONS = [
  { value: 'engrave', label: 'Grabado' },
  { value: 'cut', label: 'Corte' },
  { value: 'drill', label: 'Taladro' },
]

/** Secciones comunes a todo objeto. */
export const COMMON_SECTIONS: Section[] = [
  {
    title: 'Identidad',
    fields: [
      { kind: 'text', key: 'name', label: 'Nombre' },
      { kind: 'select', key: 'layer', label: 'Capa', options: LAYER_OPTIONS },
    ],
  },
  {
    title: 'Posición',
    fields: [
      {
        kind: 'select', key: 'anchor', label: 'Ancla', options: ANCHOR_OPTIONS,
        help: 'Punto del panel al que se refieren X e Y. Redimensionar el panel no descoloca el objeto.',
      },
      { kind: 'number', key: 'x', label: 'X', unit: 'mm', step: 0.5 },
      { kind: 'number', key: 'y', label: 'Y', unit: 'mm', step: 0.5 },
      { kind: 'number', key: 'rotationDeg', label: 'Rotación', unit: '°', step: 5 },
    ],
  },
  {
    title: 'Mecanizado',
    fields: [
      {
        kind: 'inherit-number', key: 'depthMm', label: 'Profundidad', unit: 'mm',
        min: 0, step: 0.05, inheritLabel: 'Heredar del documento',
        help: 'Determina el ancho real del surco. Solo aplica a la capa de grabado.',
      },
    ],
  },
]

const FONT_OPTIONS = listHersheyFonts().map((f) => ({ value: f.id, label: f.label }))

const tickFields = (prefix: string, withEnabled: boolean): Field[] => [
  ...(withEnabled ? [{ kind: 'boolean', key: `${prefix}.enabled`, label: 'Activadas' } as Field] : []),
  {
    kind: 'number', key: `${prefix}.count`, label: prefix === 'minorTicks' ? 'Subdivisiones' : 'Número de marcas',
    min: 1, step: 1,
    help: prefix === 'minorTicks'
      ? 'En cuántas partes se divide cada intervalo entre marcas mayores.'
      : 'Marcas repartidas del ángulo inicial al final, extremos incluidos.',
  },
  {
    kind: 'select', key: `${prefix}.shape`, label: 'Forma',
    options: [
      { value: 'line', label: 'Raya' },
      { value: 'dot', label: 'Punto' },
      { value: 'triangle', label: 'Triángulo' },
    ],
  },
  { kind: 'number', key: `${prefix}.radiusMm`, label: 'Radio', unit: 'mm', min: 0, step: 0.5 },
  { kind: 'number', key: `${prefix}.lengthMm`, label: 'Longitud', unit: 'mm', min: 0, step: 0.5 },
  {
    kind: 'select', key: `${prefix}.direction`, label: 'Dirección',
    options: [
      { value: 'outward', label: 'Hacia fuera' },
      { value: 'inward', label: 'Hacia dentro' },
      { value: 'centered', label: 'Centrada en el radio' },
    ],
  },
  { kind: 'number', key: `${prefix}.markerSizeMm`, label: 'Tamaño de la marca', unit: 'mm', min: 0, step: 0.1 },
]

const SCALE_SECTIONS: Section[] = [
  {
    title: 'Preset',
    fields: [{ kind: 'scale-preset', key: '__preset', label: 'Partir de' }],
  },
  {
    title: 'Geometría',
    fields: [
      { kind: 'number', key: 'radiusMm', label: 'Radio de referencia', unit: 'mm', min: 0, step: 0.5 },
      {
        kind: 'number', key: 'startAngleDeg', label: 'Ángulo inicial', unit: '°', step: 5,
        help: '0° = las 12 en punto, positivo en sentido horario. Un mando típico va de −135° a 135°.',
      },
      { kind: 'number', key: 'endAngleDeg', label: 'Ángulo final', unit: '°', step: 5 },
      {
        kind: 'number', key: 'centerHoleDiameterMm', label: 'Agujero del eje', unit: 'mm', min: 0, step: 0.5,
        help: 'Va a la capa de taladro. Cero para no perforar.',
      },
    ],
  },
  {
    title: 'Arco',
    fields: [
      {
        kind: 'select', key: 'arc.mode', label: 'Modo',
        options: [
          { value: 'none', label: 'Sin arco' },
          { value: 'line', label: 'Línea' },
          { value: 'band', label: 'Banda rellena' },
          { value: 'segments', label: 'Banda segmentada' },
        ],
      },
      { kind: 'number', key: 'arc.radiusMm', label: 'Radio del arco', unit: 'mm', min: 0, step: 0.5 },
      { kind: 'number', key: 'arc.bandWidthMm', label: 'Grosor de banda', unit: 'mm', min: 0, step: 0.1 },
      {
        kind: 'number', key: 'arc.startAngleDeg', label: 'Ángulo inicial', unit: '°', step: 5,
        help: 'Independiente del de las marcas: el arco puede quedarse corto a propósito.',
      },
      { kind: 'number', key: 'arc.endAngleDeg', label: 'Ángulo final', unit: '°', step: 5 },
      { kind: 'number', key: 'arc.segmentCount', label: 'Número de tramos', min: 1, step: 1 },
      { kind: 'number', key: 'arc.segmentGapDeg', label: 'Hueco entre tramos', unit: '°', min: 0, step: 1 },
    ],
  },
  { title: 'Marcas mayores', fields: tickFields('majorTicks', true) },
  { title: 'Marcas menores', fields: tickFields('minorTicks', true) },
  {
    title: 'Etiquetas',
    fields: [
      {
        kind: 'select', key: 'labels.mode', label: 'Mostrar',
        options: [
          { value: 'none', label: 'Ninguna' },
          { value: 'endpoints', label: 'Solo los extremos' },
          { value: 'major', label: 'Todas las mayores' },
        ],
      },
      {
        kind: 'text', key: 'labels.valuesText', label: 'Lista explícita',
        help: 'Separadas por comas, p. ej. «200Hz, 30Hz». Vacío para usar el rango numérico.',
      },
      { kind: 'number', key: 'labels.min', label: 'Valor inicial', step: 1 },
      { kind: 'number', key: 'labels.max', label: 'Valor final', step: 1 },
      { kind: 'number', key: 'labels.decimals', label: 'Decimales', min: 0, max: 6, step: 1 },
      { kind: 'text', key: 'labels.prefix', label: 'Prefijo' },
      { kind: 'text', key: 'labels.suffix', label: 'Sufijo' },
      { kind: 'number', key: 'labels.radiusMm', label: 'Radio', unit: 'mm', min: 0, step: 0.5 },
      {
        kind: 'select', key: 'labels.orientation', label: 'Orientación',
        options: [
          { value: 'upright', label: 'Siempre horizontal' },
          { value: 'radial', label: 'Girada con el radio' },
          { value: 'tangential', label: 'Tangencial' },
        ],
      },
      { kind: 'select', key: 'labels.fontId', label: 'Fuente', options: FONT_OPTIONS },
      { kind: 'number', key: 'labels.capHeightMm', label: 'Altura de mayúscula', unit: 'mm', min: 0.5, step: 0.2 },
    ],
  },
  {
    title: 'Rótulo',
    fields: [
      { kind: 'boolean', key: 'caption.enabled', label: 'Mostrar rótulo' },
      { kind: 'text', key: 'caption.text', label: 'Texto' },
      {
        kind: 'select', key: 'caption.position', label: 'Posición',
        options: [{ value: 'top', label: 'Arriba' }, { value: 'bottom', label: 'Abajo' }],
      },
      { kind: 'number', key: 'caption.offsetMm', label: 'Separación', unit: 'mm', step: 0.5 },
      { kind: 'select', key: 'caption.fontId', label: 'Fuente', options: FONT_OPTIONS },
      { kind: 'number', key: 'caption.capHeightMm', label: 'Altura de mayúscula', unit: 'mm', min: 0.5, step: 0.2 },
    ],
  },
]


export const TYPE_SECTIONS: Partial<Record<ObjType, Section[]>> = {
  text: [
    {
      title: 'Texto',
      fields: [
        { kind: 'text', key: 'text', label: 'Contenido', help: 'Usa saltos de línea para varias líneas.' },
        { kind: 'select', key: 'fontId', label: 'Fuente', options: FONT_OPTIONS },
        {
          kind: 'number', key: 'capHeightMm', label: 'Altura de mayúscula', unit: 'mm', min: 0.5, step: 0.5,
          help: 'Lo que mide una letra mayúscula con el calibre, no el cuerpo en puntos.',
        },
        { kind: 'number', key: 'trackingMm', label: 'Interletraje', unit: 'mm', step: 0.1 },
        { kind: 'number', key: 'lineGapMm', label: 'Interlineado extra', unit: 'mm', step: 0.5 },
        {
          kind: 'select', key: 'align', label: 'Alineación',
          options: [
            { value: 'left', label: 'Izquierda' },
            { value: 'center', label: 'Centrada' },
            { value: 'right', label: 'Derecha' },
          ],
        },
        {
          kind: 'select', key: 'vAlign', label: 'Alineación vertical',
          options: [
            { value: 'top', label: 'Alto de mayúscula' },
            { value: 'middle', label: 'Centro' },
            { value: 'baseline', label: 'Línea base' },
            { value: 'bottom', label: 'Última línea base' },
          ],
        },
      ],
    },
    {
      title: 'Curvado',
      fields: [
        {
          kind: 'arc-toggle', key: 'arc', label: 'Sobre un arco',
          help: 'Curva el texto sobre un círculo. Cada letra se gira entera, sin deformarse.',
        },
      ],
    },
  ],
  line: [{
    title: 'Polilínea',
    fields: [
      { kind: 'points', key: 'points', label: 'Vértices' },
      { kind: 'boolean', key: 'closed', label: 'Cerrada' },
    ],
  }],
  rect: [{
    title: 'Rectángulo',
    fields: [
      { kind: 'number', key: 'w', label: 'Ancho', unit: 'mm', min: 0, step: 0.5 },
      { kind: 'number', key: 'h', label: 'Alto', unit: 'mm', min: 0, step: 0.5 },
      { kind: 'number', key: 'cornerRadiusMm', label: 'Radio de esquina', unit: 'mm', min: 0, step: 0.5 },
      { kind: 'boolean', key: 'filled', label: 'Relleno (V-carve)' },
    ],
  }],
  circle: [{
    title: 'Círculo',
    fields: [
      { kind: 'number', key: 'diameterMm', label: 'Diámetro', unit: 'mm', min: 0, step: 0.5 },
      { kind: 'boolean', key: 'filled', label: 'Relleno (V-carve)' },
    ],
  }],
  arc: [{
    title: 'Arco',
    fields: [
      { kind: 'number', key: 'radiusMm', label: 'Radio', unit: 'mm', min: 0, step: 0.5 },
      {
        kind: 'number', key: 'startAngleDeg', label: 'Ángulo inicial', unit: '°', step: 5,
        help: '0° = las 12 en punto, positivo en sentido horario.',
      },
      { kind: 'number', key: 'endAngleDeg', label: 'Ángulo final', unit: '°', step: 5 },
    ],
  }],
  hole: [{
    title: 'Agujero',
    fields: [
      {
        kind: 'select', key: 'shape', label: 'Forma',
        options: [{ value: 'circle', label: 'Circular' }, { value: 'rect', label: 'Rectangular' }],
      },
      { kind: 'number', key: 'diameterMm', label: 'Diámetro', unit: 'mm', min: 0, step: 0.5 },
      { kind: 'number', key: 'w', label: 'Ancho', unit: 'mm', min: 0, step: 0.5 },
      { kind: 'number', key: 'h', label: 'Alto', unit: 'mm', min: 0, step: 0.5 },
      { kind: 'number', key: 'cornerRadiusMm', label: 'Radio de esquina', unit: 'mm', min: 0, step: 0.5 },
    ],
  }],
  scale: SCALE_SECTIONS,
  logo: [{
    title: 'Logotipo',
    fields: [
      { kind: 'number', key: 'widthMm', label: 'Ancho', unit: 'mm', min: 0.5, step: 1 },
      {
        kind: 'boolean', key: 'keepAspect', label: 'Mantener proporción',
        help: 'El ancho y el alto se miden sobre el dibujo, no sobre el lienzo del fichero.',
      },
      { kind: 'number', key: 'heightMm', label: 'Alto', unit: 'mm', min: 0.5, step: 1 },
      {
        kind: 'select', key: 'renderMode', label: 'Cómo se graba',
        options: [
          { value: 'as-authored', label: 'Según el fichero' },
          { value: 'all-filled', label: 'Todo relleno (V-carve)' },
          { value: 'all-centerline', label: 'Todo trazo (línea única)' },
        ],
        help: 'Si el SVG trae hojas de estilo, el relleno puede leerse mal; aquí se fuerza.',
      },
    ],
  }],
  group: [],
}

export const TYPE_LABELS: Record<ObjType, string> = {
  text: 'Texto',
  line: 'Polilínea',
  rect: 'Rectángulo',
  circle: 'Círculo',
  arc: 'Arco',
  hole: 'Agujero',
  scale: 'Escala',
  logo: 'Logotipo',
  group: 'Grupo',
}

export function sectionsFor(type: ObjType): Section[] {
  return [...COMMON_SECTIONS, ...(TYPE_SECTIONS[type] ?? [])]
}

/**
 * Campos que solo tienen sentido para ciertos valores de otro campo. Evita
 * enseñar el diámetro de un agujero rectangular.
 */
export function isFieldRelevant(type: ObjType, key: string, obj: Record<string, unknown>): boolean {
  if (type === 'hole') {
    if (key === 'diameterMm') return obj.shape === 'circle'
    if (key === 'w' || key === 'h' || key === 'cornerRadiusMm') return obj.shape === 'rect'
  }

  if (type === 'scale') {
    const arc = obj.arc as { mode?: string } | undefined
    const labels = obj.labels as { mode?: string; values?: unknown } | undefined
    const caption = obj.caption as { enabled?: boolean } | undefined

    if (key.startsWith('arc.') && key !== 'arc.mode') {
      if (arc?.mode === 'none') return false
      const banded = arc?.mode === 'band' || arc?.mode === 'segments'
      if (key === 'arc.bandWidthMm') return banded
      if (key === 'arc.segmentCount' || key === 'arc.segmentGapDeg') return arc?.mode === 'segments'
    }

    if (key.startsWith('labels.') && key !== 'labels.mode') {
      if (labels?.mode === 'none') return false
      // El rango numérico sobra cuando hay lista explícita, y al revés.
      const explicit = labels?.values !== null && labels?.values !== undefined
      const rangeFields = ['labels.min', 'labels.max', 'labels.decimals', 'labels.prefix', 'labels.suffix']
      if (rangeFields.includes(key)) return !explicit
    }

    if (key.startsWith('caption.') && key !== 'caption.enabled') return caption?.enabled === true

    for (const prefix of ['majorTicks', 'minorTicks'] as const) {
      if (key.startsWith(`${prefix}.`) && key !== `${prefix}.enabled`) {
        const ticks = obj[prefix] as { enabled?: boolean; shape?: string } | undefined
        if (!ticks?.enabled) return false
        if (key === `${prefix}.markerSizeMm`) return ticks.shape === 'dot' || ticks.shape === 'triangle'
        if (key === `${prefix}.lengthMm` || key === `${prefix}.direction`) return ticks.shape !== 'dot'
      }
    }
  }

  // El alto lo calcula la proporción salvo que se desactive.
  if (type === 'logo' && key === 'heightMm') return obj.keepAspect === false

  if (key === 'depthMm') return obj.layer === 'engrave'
  return true
}
