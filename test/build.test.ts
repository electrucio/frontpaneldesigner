import { describe, expect, it } from 'vitest'
import { buildDocument, PANEL_OBJECT_ID } from '../src/core/build'
import { createCircle, createDefaultDoc, createHole, createLine } from '../src/core/doc'
import type { Doc, GroupObj, LineObj } from '../src/core/types'
import { newId } from '../src/core/doc'

function docWith(objects: Doc['objects'], patch: Partial<Doc> = {}): Doc {
  return { ...createDefaultDoc('test'), objects, ...patch }
}

describe('contorno del panel', () => {
  it('con esquinas vivas es una polilinea cerrada de cuatro vertices', () => {
    const prims = buildDocument(createDefaultDoc())
    expect(prims).toHaveLength(1)
    const p = prims[0]
    expect(p).toMatchObject({ kind: 'polyline', layer: 'panel', objectId: PANEL_OBJECT_ID, closed: true })
    expect(p.kind === 'polyline' && p.pts).toEqual([
      { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 60 }, { x: 0, y: 60 },
    ])
  })

  it('con esquinas redondeadas es un contorno de 8 segmentos alternando linea y arco', () => {
    const doc = createDefaultDoc()
    doc.panel.cornerRadiusMm = 5
    const p = buildDocument(doc)[0]
    expect(p.kind).toBe('contour')
    if (p.kind !== 'contour') throw new Error('unreachable')
    expect(p.contour.closed).toBe(true)
    expect(p.contour.segs.map((s) => s.kind)).toEqual(
      ['line', 'arc', 'line', 'arc', 'line', 'arc', 'line', 'arc'],
    )
    // Los arcos van en horario y ninguno supera media vuelta.
    for (const s of p.contour.segs) {
      if (s.kind === 'arc') expect(s).toMatchObject({ r: 5, sweep: true, largeArc: false })
    }
    expect(p.contour.start).toEqual({ x: 5, y: 0 })
  })

  it('limita el radio a la mitad del lado corto', () => {
    const doc = createDefaultDoc()
    doc.panel.cornerRadiusMm = 999
    const p = buildDocument(doc)[0]
    if (p.kind !== 'contour') throw new Error('esperaba un contorno')
    const arc = p.contour.segs.find((s) => s.kind === 'arc')!
    expect(arc.kind === 'arc' && arc.r).toBe(30) // altura 60 / 2
  })
})

describe('anclas', () => {
  it('desplazan el objeto al redimensionar el panel, sin tocar sus coordenadas', () => {
    const line = { ...createLine(0, 0), anchor: 'bottomRight' as const }
    const doc = docWith([line])
    const before = buildDocument(doc)[1]

    doc.panel.w = 300
    const after = buildDocument(doc)[1]

    if (before.kind !== 'polyline' || after.kind !== 'polyline') throw new Error('esperaba polilineas')
    expect(before.pts[0]).toEqual({ x: 200, y: 60 })
    expect(after.pts[0]).toEqual({ x: 300, y: 60 })
  })
})

describe('profundidad', () => {
  it('se hereda del documento cuando el objeto no la fija', () => {
    const prims = buildDocument(docWith([createLine()]))
    expect(prims[1].depthMm).toBe(0.3)
  })

  it('la propia del objeto gana a la del documento', () => {
    const line = { ...createLine(), depthMm: 0.55 }
    expect(buildDocument(docWith([line]))[1].depthMm).toBe(0.55)
  })

  it('es irrelevante en cut y drill: la decide la CAM', () => {
    const prims = buildDocument(docWith([createHole()]))
    expect(prims[1]).toMatchObject({ layer: 'drill', depthMm: 0, kind: 'circle', r: 4.5 })
  })
})

describe('grupos', () => {
  it('componen transformaciones y sus hijos ignoran el ancla del panel', () => {
    const child: LineObj = {
      ...createLine(0, 0),
      x: 10, y: 0,
      anchor: 'bottomRight', // debe ignorarse dentro del grupo
      points: [{ x: 0, y: 0 }, { x: 5, y: 0 }],
    }
    const group: GroupObj = {
      id: newId('g'), type: 'group', name: 'g', visible: true, locked: false,
      layer: 'engrave', anchor: 'topLeft', x: 100, y: 30, rotationDeg: 90, depthMm: null,
      children: [child],
    }
    const p = buildDocument(docWith([group]))[1]
    if (p.kind !== 'polyline') throw new Error('esperaba una polilinea')
    // El grupo gira 90 grados: el desplazamiento local +X del hijo sale hacia +Y.
    expect(p.pts[0].x).toBeCloseTo(100, 9)
    expect(p.pts[0].y).toBeCloseTo(40, 9)
    expect(p.pts[1].x).toBeCloseTo(100, 9)
    expect(p.pts[1].y).toBeCloseTo(45, 9)
  })
})

describe('visibilidad', () => {
  it('los objetos ocultos no generan geometria', () => {
    const hidden = { ...createCircle(), visible: false }
    expect(buildDocument(docWith([hidden]))).toHaveLength(1) // solo el panel
  })
})
