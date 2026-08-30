import type { Doc, Obj } from './types'
import { layoutHersheyText } from './text/layout'
import { isHersheyFont } from './text/hershey'
import { styleOf } from './build/text'
import { widthAtDepth } from './tool'
import { depthForObject } from './tool'

/**
 * Avisos por objeto.
 *
 * Semilla del DRC: hoy solo cubre lo que puede fallar en silencio con lo que
 * hay implementado, y crecerá con las comprobaciones de fabricabilidad
 * (separación entre surcos, rasgos por debajo de la punta, geometría fuera del
 * panel) sin cambiar de forma.
 */

export type WarningLevel = 'error' | 'warning' | 'info'

export interface Warning {
  objectId: string
  level: WarningLevel
  message: string
}

/** Altura por debajo de la cual una letra Hershey deja de leerse bien. */
export const MIN_LEGIBLE_CAP_HEIGHT_MM = 1.8

export function warningsForObject(doc: Doc, obj: Obj): Warning[] {
  const out: Warning[] = []
  const warn = (level: WarningLevel, message: string) =>
    out.push({ objectId: obj.id, level, message })

  if (obj.type === 'text') {
    if (!isHersheyFont(obj.fontId)) {
      warn('error', `La fuente «${obj.fontId}» no está disponible.`)
    } else {
      const { missing } = layoutHersheyText(obj.text, styleOf(obj))
      if (missing.length > 0) {
        // Es justo lo que hace falta en un panel: 50Ω, 20°, µF.
        warn('error',
          `Esta fuente no tiene ${missing.map((c) => `«${c}»`).join(', ')}: ` +
          'esos caracteres no se grabarán. Las Hershey solo cubren ASCII.')
      }
    }

    if (obj.capHeightMm < MIN_LEGIBLE_CAP_HEIGHT_MM) {
      warn('warning',
        `Con ${obj.capHeightMm} mm de altura la letra queda por debajo de los ` +
        `${MIN_LEGIBLE_CAP_HEIGHT_MM} mm recomendados y se lee mal.`)
    }

    // Una letra cuyo trazo es tan ancho como la propia letra se emborrona.
    if (obj.layer === 'engrave') {
      const stroke = widthAtDepth(doc.tool, depthForObject(doc.tool, obj))
      if (stroke > obj.capHeightMm / 4) {
        warn('warning',
          `El surco mide ${round(stroke)} mm para una letra de ${obj.capHeightMm} mm: ` +
          'demasiado grueso, sube la letra o baja la profundidad.')
      }
    }
  }

  return out
}

export function warningsForDoc(doc: Doc): Warning[] {
  const out: Warning[] = []
  const visit = (objects: Obj[]) => {
    for (const obj of objects) {
      out.push(...warningsForObject(doc, obj))
      if (obj.type === 'group') visit(obj.children)
    }
  }
  visit(doc.objects)
  return out
}

const round = (n: number): number => Math.round(n * 1000) / 1000
