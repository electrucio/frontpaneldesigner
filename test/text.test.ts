import { describe, expect, it } from 'vitest'
import { getGlyph, getHersheyFont, listHersheyFonts, parseGlyphPath } from '../src/core/text/hershey'
import { layoutHersheyText, type TextStyle } from '../src/core/text/layout'
import type { Vec2 } from '../src/core/geometry/vec'

const style = (patch: Partial<TextStyle> = {}): TextStyle => ({
  fontId: 'hershey-sans',
  capHeightMm: 3,
  trackingMm: 0,
  lineGapMm: 0,
  align: 'left',
  vAlign: 'baseline',
  arc: null,
  ...patch,
})

function bbox(strokes: Vec2[][]) {
  const pts = strokes.flat()
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  }
}

describe('datos Hershey', () => {
  it('empaqueta las seis familias con métricas medidas', () => {
    const ids = listHersheyFonts().map((f) => f.id)
    expect(ids).toContain('hershey-sans')
    expect(ids).toHaveLength(6)
    for (const { id } of listHersheyFonts()) {
      const m = getHersheyFont(id)!.metrics
      expect(m.capHeight).toBeGreaterThan(0)
      expect(m.baseline).toBeGreaterThan(m.capHeight)
      expect(m.spaceAdvance).toBeGreaterThan(0)
    }
  })

  it('interpreta la repetición implícita de coordenadas tras un comando', () => {
    // 'L 4,1 13,1 16,2' son tres puntos del MISMO trazo, no tres comandos.
    const strokes = parseGlyphPath('M4,1 L4,22 M4,1 L13,1 16,2 17,3')
    expect(strokes).toHaveLength(2)
    expect(strokes[0]).toEqual([{ x: 4, y: 1 }, { x: 4, y: 22 }])
    expect(strokes[1]).toHaveLength(4)
  })

  it('el avance es el doble de `o`, que es el centro del glifo', () => {
    const font = getHersheyFont('hershey-sans')!
    const H = getGlyph(font, 'H')!
    // La 'H' tiene o=11 y ocupa de x=4 a x=18: centrada en 11 dentro de una
    // caja de 22 con 4 unidades de margen a cada lado.
    expect(H.advance).toBe(22)
    const xs = H.strokes.flat().map((p) => p.x)
    expect(Math.min(...xs)).toBe(4)
    expect(Math.max(...xs)).toBe(18)
  })

  it('el espacio no tiene trazos pero sí avance', () => {
    const font = getHersheyFont('hershey-sans')!
    const sp = getGlyph(font, ' ')!
    expect(sp.strokes).toEqual([])
    expect(sp.advance).toBe(font.metrics.spaceAdvance)
  })
})

describe('maquetación', () => {
  it('la altura de mayúscula en mm es exacta, y en todas las familias', () => {
    for (const { id } of listHersheyFonts()) {
      const out = layoutHersheyText('H', style({ fontId: id, capHeightMm: 3 }))
      const b = bbox(out.strokes)
      // Línea base en y=0 y mayúsculas hacia arriba (Y crece hacia abajo).
      expect(b.maxY).toBeCloseTo(0, 9)
      expect(b.minY).toBeCloseTo(-3, 9)
    }
  })

  it('respeta un tamaño distinto', () => {
    const b = bbox(layoutHersheyText('H', style({ capHeightMm: 8 })).strokes)
    expect(b.minY).toBeCloseTo(-8, 9)
  })

  it('el interletraje solo va ENTRE letras', () => {
    const sin = layoutHersheyText('AB', style()).widthMm
    const con = layoutHersheyText('AB', style({ trackingMm: 1 })).widthMm
    expect(con - sin).toBeCloseTo(1, 9)   // una separación, no dos
    expect(layoutHersheyText('A', style({ trackingMm: 1 })).widthMm)
      .toBeCloseTo(layoutHersheyText('A', style()).widthMm, 9)
  })

  it('alinea horizontalmente respecto al origen', () => {
    const w = layoutHersheyText('HOLA', style()).widthMm
    const left = bbox(layoutHersheyText('HOLA', style({ align: 'left' })).strokes)
    const center = bbox(layoutHersheyText('HOLA', style({ align: 'center' })).strokes)
    const right = bbox(layoutHersheyText('HOLA', style({ align: 'right' })).strokes)

    expect(center.minX).toBeCloseTo(left.minX - w / 2, 9)
    expect(right.minX).toBeCloseTo(left.minX - w, 9)
  })

  it('alinea verticalmente sobre la caja de mayúsculas', () => {
    const top = bbox(layoutHersheyText('H', style({ vAlign: 'top' })).strokes)
    const middle = bbox(layoutHersheyText('H', style({ vAlign: 'middle' })).strokes)
    const baseline = bbox(layoutHersheyText('H', style({ vAlign: 'baseline' })).strokes)

    expect(top.minY).toBeCloseTo(0, 9)          // alto de mayúscula en y=0
    expect(baseline.maxY).toBeCloseTo(0, 9)     // línea base en y=0
    expect(middle.minY).toBeCloseTo(-1.5, 9)    // centrada en la caja de 3 mm
    expect(middle.maxY).toBeCloseTo(1.5, 9)
  })

  it('apila varias líneas hacia abajo y mide la más ancha', () => {
    const out = layoutHersheyText('A\nBBBB', style())
    expect(out.lineWidths).toHaveLength(2)
    expect(out.widthMm).toBe(Math.max(...out.lineWidths))
    expect(out.lineWidths[1]).toBeGreaterThan(out.lineWidths[0])
    expect(bbox(out.strokes).maxY).toBeGreaterThan(0)  // la segunda línea baja
  })

  it('informa de los caracteres que la familia no tiene, en vez de tragárselos', () => {
    // Hershey es ASCII imprimible: en un panel hacen falta 'Ω' y '°'.
    const out = layoutHersheyText('50Ω 20°', style())
    expect(out.missing).toEqual(['Ω', '°'])
    expect(out.strokes.length).toBeGreaterThan(0)  // el resto sí se compone
  })

  it('devuelve vacío sin romperse ante entradas degeneradas', () => {
    expect(layoutHersheyText('', style()).strokes).toEqual([])
    expect(layoutHersheyText('X', style({ fontId: 'no-existe' })).strokes).toEqual([])
  })
})

describe('texto sobre arco', () => {
  it('curva el texto manteniendo la altura de letra', () => {
    const recto = layoutHersheyText('HHHHH', style({ align: 'center' }))
    const curvo = layoutHersheyText('HHHHH', style({
      align: 'center', arc: { radiusMm: 20, direction: 'convex' },
    }))
    // Mismo número de trazos: curvar no añade ni quita geometría.
    expect(curvo.strokes.length).toBe(recto.strokes.length)
    // Los extremos caen por debajo del vértice del arco (Y crece hacia abajo).
    const b = bbox(curvo.strokes)
    expect(b.maxY).toBeGreaterThan(bbox(recto.strokes).maxY)
  })

  it('un radio enorme se aproxima al texto recto', () => {
    const recto = layoutHersheyText('ABC', style({ align: 'center' }))
    const casiRecto = layoutHersheyText('ABC', style({
      align: 'center', arc: { radiusMm: 100000, direction: 'convex' },
    }))
    const a = bbox(recto.strokes)
    const b = bbox(casiRecto.strokes)
    expect(b.minX).toBeCloseTo(a.minX, 2)
    expect(b.minY).toBeCloseTo(a.minY, 2)
    expect(b.maxY).toBeCloseTo(a.maxY, 2)
  })

  it('es simétrico y pone el vértice arriba en convexo', () => {
    const pts = layoutHersheyText('AAAAAAAAA', style({
      capHeightMm: 5, align: 'center', arc: { radiusMm: 35, direction: 'convex' },
    })).strokes.flat()

    const byX = [...pts].sort((a, b) => a.x - b.x)
    const izq = byX[0]
    const der = byX[byX.length - 1]
    const centro = pts.reduce((best, p) => (Math.abs(p.x) < Math.abs(best.x) ? p : best), pts[0])

    // Espejo perfecto respecto al vértice.
    expect(Math.abs(izq.x)).toBeCloseTo(Math.abs(der.x), 9)
    expect(izq.y).toBeCloseTo(der.y, 9)
    // Arco de arcoíris: el centro queda por encima de los extremos (Y baja).
    expect(centro.y).toBeLessThan(izq.y)
  })

  it('el cóncavo pone el texto del revés respecto al convexo', () => {
    const convex = bbox(layoutHersheyText('H', style({
      align: 'center', arc: { radiusMm: 20, direction: 'convex' },
    })).strokes)
    const concave = bbox(layoutHersheyText('H', style({
      align: 'center', arc: { radiusMm: 20, direction: 'concave' },
    })).strokes)
    // En convexo las mayúsculas suben desde la línea base; en cóncavo bajan.
    expect(convex.minY).toBeLessThan(0)
    expect(concave.maxY).toBeGreaterThan(0)
  })
})
