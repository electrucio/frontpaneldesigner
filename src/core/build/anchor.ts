import type { Anchor, PanelSpec } from '../types'
import type { Vec2 } from '../geometry/vec'

/** Punto del panel al que se refiere un ancla. */
export function anchorPoint(panel: PanelSpec, anchor: Anchor): Vec2 {
  const { w, h } = panel
  switch (anchor) {
    case 'topLeft': return { x: 0, y: 0 }
    case 'top': return { x: w / 2, y: 0 }
    case 'topRight': return { x: w, y: 0 }
    case 'left': return { x: 0, y: h / 2 }
    case 'center': return { x: w / 2, y: h / 2 }
    case 'right': return { x: w, y: h / 2 }
    case 'bottomLeft': return { x: 0, y: h }
    case 'bottom': return { x: w / 2, y: h }
    case 'bottomRight': return { x: w, y: h }
  }
}

export const ANCHORS: Anchor[] = [
  'topLeft', 'top', 'topRight',
  'left', 'center', 'right',
  'bottomLeft', 'bottom', 'bottomRight',
]
