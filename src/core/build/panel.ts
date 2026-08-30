import type { PanelSpec } from '../types'
import type { Primitive } from '../primitives'
import { translation } from '../geometry/mat'
import { roundedRectContour } from './shapes'

/** Identificador reservado del contorno del panel; no es un objeto del documento. */
export const PANEL_OBJECT_ID = '__panel__'

/** Contorno exterior del panel, centrado en su propio rectángulo. */
export function buildPanelOutline(panel: PanelSpec): Primitive[] {
  const m = translation(panel.w / 2, panel.h / 2)
  const contour = roundedRectContour(m, panel.w, panel.h, panel.cornerRadiusMm)
  const base = {
    objectId: PANEL_OBJECT_ID,
    layer: 'panel' as const,
    style: 'centerline' as const,
    depthMm: 0,
  }
  if (contour.segs.every((s) => s.kind === 'line')) {
    return [{
      kind: 'polyline',
      ...base,
      pts: [contour.start, ...contour.segs.map((s) => s.to)],
      closed: true,
    }]
  }
  return [{ kind: 'contour', ...base, contour }]
}
