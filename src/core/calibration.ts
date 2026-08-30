import type { Doc, LineObj, TextObj, ToolProfile } from './types'
import { createDefaultDoc, newId } from './doc'
import { CALIBRATION_DEPTHS_MM } from './tool'

/**
 * Documento de calibración: tres surcos rectos a profundidades conocidas, cada
 * uno rotulado con la suya.
 *
 * Se graba, se miden los tres anchos con calibre y el ajuste por mínimos
 * cuadrados de `tool.ts` devuelve la punta y la pendiente reales. Eso absorbe de
 * golpe el ángulo verdadero de la fresa, su desgaste y una punta que casi nunca
 * mide lo que dice el fabricante.
 *
 * Cada surco lleva su profundidad en el rótulo porque hay que mecanizarlos en
 * pasadas distintas, y confundir cuál es cuál invalida la medida entera.
 */

const GROOVE_LENGTH_MM = 30
const MARGIN_MM = 10
const ROW_PITCH_MM = 10
const LABEL_CAP_HEIGHT_MM = 3

export function createCalibrationDoc(tool: ToolProfile): Doc {
  const doc = createDefaultDoc('Calibracion V-bit')
  const rows = CALIBRATION_DEPTHS_MM.length

  doc.panel = {
    ...doc.panel,
    w: MARGIN_MM * 2 + GROOVE_LENGTH_MM + 25,
    h: MARGIN_MM * 2 + (rows - 1) * ROW_PITCH_MM + 10,
    cornerRadiusMm: 0,
  }
  doc.tool = { ...tool }

  const objects: (LineObj | TextObj)[] = []

  objects.push(label('CALIBRACION V-BIT', MARGIN_MM, MARGIN_MM - 4, 'left', 2.5))

  CALIBRATION_DEPTHS_MM.forEach((depthMm, i) => {
    const y = MARGIN_MM + 4 + i * ROW_PITCH_MM

    objects.push({
      id: newId('l'),
      type: 'line',
      name: `Surco ${depthMm} mm`,
      visible: true,
      locked: false,
      layer: 'engrave',
      anchor: 'topLeft',
      x: MARGIN_MM,
      y,
      rotationDeg: 0,
      // Cada surco lleva SU profundidad: es el punto de todo el ejercicio.
      depthMm,
      points: [{ x: 0, y: 0 }, { x: GROOVE_LENGTH_MM, y: 0 }],
      closed: false,
    })

    objects.push(label(`${depthMm} mm`, MARGIN_MM + GROOVE_LENGTH_MM + 4, y, 'left', LABEL_CAP_HEIGHT_MM))
  })

  doc.objects = objects
  return doc
}

function label(
  text: string, x: number, y: number, align: TextObj['align'], capHeightMm: number,
): TextObj {
  return {
    id: newId('t'),
    type: 'text',
    name: text,
    visible: true,
    locked: false,
    layer: 'engrave',
    anchor: 'topLeft',
    x, y,
    rotationDeg: 0,
    depthMm: null,
    text,
    fontId: 'hershey-sans',
    mode: 'centerline',
    capHeightMm,
    trackingMm: 0.2,
    lineGapMm: 1,
    align,
    vAlign: 'middle',
    arc: null,
  }
}
