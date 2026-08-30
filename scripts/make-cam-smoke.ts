/**
 * Genera el fichero de la prueba de humo de CAM (criterio de salida de M0).
 *
 * Contiene deliberadamente poco y de cotas redondas: una línea de 10 mm, un
 * círculo de Ø20 mm y un taladro de Ø9 mm, cada uno en su capa, con su id, su
 * `inkscape:label` y su color. Sirve para averiguar QUÉ entiende de verdad la
 * CAM antes de construir nada encima:
 *
 *   - ¿respeta las cotas en mm?
 *   - ¿distingue los grupos?  ¿lee `inkscape:label`?
 *   - ¿o solo permite seleccionar por color?
 *   - ¿trata la línea abierta como trazo a seguir y el círculo como región?
 *
 * Las respuestas fijan las convenciones definitivas del serializador.
 *
 *   npm run cam-smoke
 */
import { writeFileSync } from 'node:fs'
import { buildDocument } from '../src/core/build'
import { createDefaultDoc, createCircle, createHole, createLine } from '../src/core/doc'
import { toSvg } from '../src/core/render/toSvg'
import type { Doc } from '../src/core/types'

const doc: Doc = {
  ...createDefaultDoc('CAM smoke test'),
  panel: { ...createDefaultDoc().panel, w: 100, h: 60, cornerRadiusMm: 0 },
}

doc.objects = [
  // Línea horizontal de 10.0000 mm exactos, de (20,20) a (30,20).
  { ...createLine(20, 20), name: 'Linea 10 mm', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
  // Círculo grabado de Ø20 mm centrado en (50,35).
  { ...createCircle(50, 35), name: 'Circulo D20', diameterMm: 20 },
  // Taladro de Ø9 mm centrado en (80,20).
  { ...createHole(80, 20), name: 'Taladro D9', diameterMm: 9 },
]

const out = 'test/cam-smoke/cam-smoke.svg'
writeFileSync(out, toSvg(doc, buildDocument(doc)))

// Variante con Y invertida, para comparar cuál de las dos interpreta bien la CAM.
const outFlipped = 'test/cam-smoke/cam-smoke-flipY.svg'
writeFileSync(outFlipped, toSvg(doc, buildDocument(doc), { flipY: true }))

// Variante con taladros como punto central, para el mismo contraste.
const outPoints = 'test/cam-smoke/cam-smoke-drill-points.svg'
writeFileSync(outPoints, toSvg(doc, buildDocument(doc), { drillMode: 'point' }))

console.log(`Escritos:\n  ${out}\n  ${outFlipped}\n  ${outPoints}`)
