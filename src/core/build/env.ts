import type { Doc, ObjBase } from '../types'
import type { PrimBase } from '../primitives'
import { depthForObject } from '../tool'

/**
 * Contexto compartido por los constructores. `base()` resuelve los campos
 * comunes de toda primitiva, en particular la profundidad efectiva (propia del
 * objeto o heredada del documento); cada constructor sobreescribe `style`
 * cuando emite una región rellena.
 */
export interface BuildEnv {
  doc: Doc
  base(obj: ObjBase): PrimBase
}

export function makeEnv(doc: Doc): BuildEnv {
  return {
    doc,
    base(obj: ObjBase): PrimBase {
      return {
        objectId: obj.id,
        layer: obj.layer,
        style: 'centerline',
        // En `cut` y `drill` la profundidad la decide la CAM, no el diseño.
        depthMm: obj.layer === 'engrave' ? depthForObject(doc.tool, obj) : 0,
      }
    },
  }
}
