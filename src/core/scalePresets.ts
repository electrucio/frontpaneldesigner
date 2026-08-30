import type { ScaleObj } from './types'

/**
 * Presets de escala, sacados de las fotos de referencia.
 *
 * Son el punto de partida: se instancian y se ajustan por parámetros. Cubren
 * los cuatro dibujos habituales en un panel de amplificador más la variante
 * segmentada.
 */

export type ScaleSettings = Omit<ScaleObj, keyof import('./types').ObjBase | 'type'>

const BASE: ScaleSettings = {
  radiusMm: 12,
  startAngleDeg: -135,
  endAngleDeg: 135,
  arc: {
    mode: 'none',
    radiusMm: 12,
    bandWidthMm: 1.2,
    startAngleDeg: -135,
    endAngleDeg: 135,
    segmentCount: 8,
    segmentGapDeg: 6,
  },
  majorTicks: {
    enabled: true,
    count: 6,
    lengthMm: 1.6,
    direction: 'outward',
    radiusMm: 12,
    shape: 'line',
    markerSizeMm: 0.8,
  },
  minorTicks: {
    enabled: false,
    count: 5,
    lengthMm: 0.9,
    direction: 'outward',
    radiusMm: 12,
    shape: 'line',
    markerSizeMm: 0.5,
  },
  labels: {
    mode: 'major',
    min: 0,
    max: 10,
    decimals: 0,
    prefix: '',
    suffix: '',
    values: null,
    radiusMm: 16,
    orientation: 'upright',
    fontId: 'hershey-sans',
    mode2: 'centerline',
    capHeightMm: 2.2,
  },
  caption: {
    enabled: true,
    text: 'GAIN',
    position: 'bottom',
    offsetMm: 10,
    fontId: 'hershey-sans',
    mode: 'centerline',
    capHeightMm: 2.6,
  },
  centerHoleDiameterMm: 9,
}

export interface ScalePreset {
  id: string
  label: string
  description: string
  settings: ScaleSettings
}

export const SCALE_PRESETS: ScalePreset[] = [
  {
    id: 'marshall',
    label: 'Números verticales',
    description: 'Marcas cortas y números siempre horizontales, sin arco. El clásico 0–10 de un amplificador.',
    settings: BASE,
  },
  {
    id: 'ticks-radial-numbers',
    label: 'Marcas y números girados',
    description: 'Arco fino, marcas mayores y menores, y números girados con el radio.',
    settings: {
      ...BASE,
      arc: { ...BASE.arc, mode: 'line' },
      majorTicks: { ...BASE.majorTicks, count: 10, lengthMm: 2 },
      minorTicks: { ...BASE.minorTicks, enabled: true, count: 5 },
      labels: {
        ...BASE.labels, min: 1, max: 10, orientation: 'radial', radiusMm: 17,
      },
    },
  },
  {
    id: 'arc-endpoints',
    label: 'Arco con extremos',
    description: 'Banda gruesa y solo dos etiquetas, una en cada extremo. Para un filtro: «200Hz» y «30Hz».',
    settings: {
      ...BASE,
      arc: {
        ...BASE.arc, mode: 'band', bandWidthMm: 1.4,
        startAngleDeg: -120, endAngleDeg: 120, radiusMm: 13,
      },
      majorTicks: { ...BASE.majorTicks, enabled: false },
      minorTicks: { ...BASE.minorTicks, enabled: false },
      labels: {
        ...BASE.labels, mode: 'endpoints', values: ['200Hz', '30Hz'], radiusMm: 17,
      },
      caption: { ...BASE.caption, text: 'LOW PASS', position: 'top', offsetMm: 8 },
    },
  },
  {
    id: 'dots',
    label: 'Puntos',
    description: 'Puntos en vez de marcas, sin números. Discreto y muy rápido de mecanizar.',
    settings: {
      ...BASE,
      majorTicks: { ...BASE.majorTicks, count: 11, shape: 'dot', markerSizeMm: 0.9, radiusMm: 13.5 },
      minorTicks: { ...BASE.minorTicks, enabled: false },
      labels: { ...BASE.labels, mode: 'none' },
    },
  },
  {
    id: 'segmented-band',
    label: 'Banda segmentada',
    description: 'La banda partida en tramos con hueco entre ellos.',
    settings: {
      ...BASE,
      arc: { ...BASE.arc, mode: 'segments', bandWidthMm: 1.8, radiusMm: 13.5, segmentCount: 9, segmentGapDeg: 5 },
      majorTicks: { ...BASE.majorTicks, enabled: false },
      minorTicks: { ...BASE.minorTicks, enabled: false },
      labels: { ...BASE.labels, mode: 'endpoints', values: ['MIN', 'MAX'], radiusMm: 18 },
    },
  },
]

export const DEFAULT_SCALE_PRESET = SCALE_PRESETS[0]

export const scalePreset = (id: string): ScalePreset | undefined =>
  SCALE_PRESETS.find((p) => p.id === id)
