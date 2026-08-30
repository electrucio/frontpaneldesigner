import type { TextObj } from '../types'
import type { Primitive } from '../primitives'
import type { Mat } from '../geometry/mat'
import { apply } from '../geometry/mat'
import { layoutHersheyText, type TextStyle } from '../text/layout'
import { isHersheyFont } from '../text/hershey'
import type { BuildEnv } from './env'

export const styleOf = (obj: TextObj): TextStyle => ({
  fontId: obj.fontId,
  capHeightMm: obj.capHeightMm,
  trackingMm: obj.trackingMm,
  lineGapMm: obj.lineGapMm,
  align: obj.align,
  vAlign: obj.vAlign,
  arc: obj.arc,
})

export function buildText(obj: TextObj, m: Mat, env: BuildEnv): Primitive[] {
  // Las familias Hershey son de línea única: no tienen contorno que rellenar,
  // así que ignoran el modo y salen siempre como trazos abiertos.
  if (!isHersheyFont(obj.fontId)) return []

  const layout = layoutHersheyText(obj.text, styleOf(obj))
  const base = env.base(obj)

  return layout.strokes.map((stroke) => ({
    kind: 'polyline',
    ...base,
    pts: stroke.map((p) => apply(m, p)),
    closed: false,
  }))
}
