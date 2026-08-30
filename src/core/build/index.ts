import type { Doc, Obj, PanelSpec } from '../types'
import type { Primitive } from '../primitives'
import type { Mat } from '../geometry/mat'
import { IDENTITY, multiply, rotation, translation } from '../geometry/mat'
import { anchorPoint } from './anchor'
import { makeEnv, type BuildEnv } from './env'
import { buildPanelOutline } from './panel'
import { buildArc, buildCircle, buildHole, buildLine, buildRect } from './shapes'
import { buildText } from './text'
import { buildScale } from './scale'

export { anchorPoint, ANCHORS } from './anchor'
export { PANEL_OBJECT_ID, buildPanelOutline } from './panel'
export { roundedRectContour } from './shapes'

function assertNever(x: never): never {
  throw new Error(`Tipo de objeto no contemplado: ${JSON.stringify(x)}`)
}

/**
 * Matriz local del objeto.
 *
 * El ancla solo se resuelve contra el panel en el nivel superior; dentro de un
 * grupo las coordenadas son relativas al origen del grupo, que es lo que hace
 * que una "estación de mando" se pueda duplicar sin recolocar sus piezas.
 */
function objectMatrix(panel: PanelSpec, obj: Obj, topLevel: boolean): Mat {
  const origin = topLevel ? anchorPoint(panel, obj.anchor) : { x: 0, y: 0 }
  return multiply(
    translation(origin.x + obj.x, origin.y + obj.y),
    rotation(obj.rotationDeg),
  )
}

function buildObject(obj: Obj, parent: Mat, topLevel: boolean, env: BuildEnv): Primitive[] {
  if (!obj.visible) return []
  const m = multiply(parent, objectMatrix(env.doc.panel, obj, topLevel))

  switch (obj.type) {
    case 'line': return buildLine(obj, m, env)
    case 'rect': return buildRect(obj, m, env)
    case 'circle': return buildCircle(obj, m, env)
    case 'arc': return buildArc(obj, m, env)
    case 'hole': return buildHole(obj, m, env)
    case 'group':
      return obj.children.flatMap((child) => buildObject(child, m, false, env))
    case 'text': return buildText(obj, m, env)
    case 'scale': return buildScale(obj, m, env)
    // Pendiente: logo (M4).
    case 'logo': return []
    default: return assertNever(obj)
  }
}

/**
 * Documento → primitivas. Única fuente de geometría: la vista previa, la
 * exportación y el DRC consumen exactamente este resultado.
 */
export function buildDocument(doc: Doc): Primitive[] {
  const env = makeEnv(doc)
  return [
    ...buildPanelOutline(doc.panel),
    ...doc.objects.flatMap((obj) => buildObject(obj, IDENTITY, true, env)),
  ]
}
