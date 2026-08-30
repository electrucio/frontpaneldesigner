import { describe, expect, it } from 'vitest'
import { buildDocument } from '../src/core/build'
import { createCircle, createDefaultDoc, createHole, createLine } from '../src/core/doc'
import { toSvg } from '../src/core/render/toSvg'
import { fmt } from '../src/core/render/format'
import { widthAtDepth } from '../src/core/tool'
import type { Doc } from '../src/core/types'

function render(doc: Doc, opts = {}) {
  return toSvg(doc, buildDocument(doc), opts)
}

function sample(): Doc {
  const doc = createDefaultDoc('Prueba')
  doc.objects = [
    { ...createLine(10, 20), points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
    { ...createCircle(50, 30), diameterMm: 20 },
    { ...createHole(100, 30), diameterMm: 9 },
  ]
  return doc
}

describe('formato numerico', () => {
  it('no produce exponentes, ni -0, ni recorta enteros', () => {
    expect(fmt(10)).toBe('10')
    expect(fmt(0.00000001)).toBe('0')
    expect(fmt(-0.000000001)).toBe('0')
    expect(fmt(1e-7)).toBe('0')
    expect(fmt(123456.789)).toBe('123456.789')
    expect(fmt(1 / 3)).toBe('0.3333')
    expect(fmt(100)).toBe('100')
    expect(fmt(-12.5)).toBe('-12.5')
  })
})

describe('convenciones del SVG exportado', () => {
  const svg = render(sample())

  it('declara milimetros y un viewBox 1:1', () => {
    expect(svg).toContain('width="200mm"')
    expect(svg).toContain('height="60mm"')
    expect(svg).toContain('viewBox="0 0 200 60"')
  })

  it('no emite transform, ni text, ni use, ni CSS', () => {
    expect(svg).not.toMatch(/\stransform=/)
    expect(svg).not.toMatch(/<text\b/)
    expect(svg).not.toMatch(/<use\b/)
    expect(svg).not.toMatch(/<style\b/)
    expect(svg).not.toMatch(/\sclass=/)
  })

  it('no emite elementos <circle>: solo paths', () => {
    // EasyTrace5000 proceso el fichero de prueba ignorando los <circle>, y el
    // circulo de D20 y el taladro de D9 desaparecieron del G-code sin aviso.
    expect(svg).not.toMatch(/<circle\b/)
    expect(svg).not.toMatch(/<ellipse\b/)
    expect(svg).not.toMatch(/<rect\b/)
    expect(svg).not.toMatch(/<line\b/)
    expect(svg).not.toMatch(/<poly(line|gon)\b/)
    // El circulo de D20 sigue ahi, como dos semiarcos de radio 10.
    expect(svg).toContain('A 10 10 0 0 1')
  })

  it('agrupa por capa con id, etiqueta de Inkscape y color propio', () => {
    expect(svg).toContain('<g id="panel-outline"')
    expect(svg).toContain('<g id="engrave-lines"')
    expect(svg).toContain('<g id="drill"')
    expect(svg).toContain('inkscape:label="Panel outline"')
    // Un color distinto por capa: criterio de seleccion de reserva en la CAM.
    const colors = [...svg.matchAll(/<g id="([\w-]+)"[^>]*?(?:stroke|fill)="(#[0-9a-f]{6})"/g)]
      .map((m) => m[2])
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('repite los atributos de pintura en el elemento, no solo en el grupo', () => {
    const circle = svg.match(/<path d="M 50 20 A 10 10[^>]*\/>/)![0]
    expect(circle).toContain('stroke="#000000"')
    expect(circle).toContain('fill="none"')
    expect(circle).toContain('stroke-width=')
  })

  it('usa como stroke-width el ancho real de surco a la profundidad del objeto', () => {
    const doc = sample()
    doc.objects[0] = { ...doc.objects[0], depthMm: 0.5 }
    const out = render(doc)
    const expected = fmt(widthAtDepth(doc.tool, 0.5))
    expect(expected).toBe('0.4679')
    expect(out).toContain(`stroke-width="${expected}"`)
  })

  it('documenta en cabecera que ese grosor es indicativo', () => {
    expect(svg).toContain('el ancho real')
    expect(svg).toContain('LINEA NOMINAL')
    expect(svg).toContain('TOTALES incluidos')
  })
})

describe('opciones de exportacion', () => {
  it('flipY refleja las coordenadas respecto a la altura del panel', () => {
    const doc = sample()
    const flipped = render(doc, { flipY: true })
    // La linea esta en y=20; con el origen abajo-izquierda pasa a y=40.
    expect(flipped).toContain('M 10 40 L 20 40')
    expect(render(doc)).toContain('M 10 20 L 20 20')
  })

  it('flipY invierte tambien el sentido de barrido de los arcos', () => {
    const doc = createDefaultDoc()
    doc.panel.cornerRadiusMm = 5
    expect(render(doc)).toMatch(/A 5 5 0 0 1 /)
    expect(render(doc, { flipY: true })).toMatch(/A 5 5 0 0 0 /)
  })

  it('el modo punto reduce el taladro a un circulo degenerado', () => {
    expect(render(sample(), { drillMode: 'point' })).toContain('A 0.001 0.001 0 0 1')
    expect(render(sample(), { drillMode: 'circle' })).toContain('A 4.5 4.5 0 0 1')
  })

  it('permite exportar un subconjunto de capas', () => {
    const only = render(sample(), { groups: ['drill'] })
    expect(only).toContain('<g id="drill"')
    expect(only).not.toContain('<g id="engrave-lines"')
    expect(only).not.toContain('<g id="panel-outline"')
  })
})

describe('serializador (snapshots de cadena, los unicos del proyecto)', () => {
  it('panel vacio', () => {
    expect(render(createDefaultDoc('Vacio'), { includeHeaderComment: false })).toMatchSnapshot()
  })

  it('panel con linea, circulo y taladro', () => {
    expect(render(sample(), { includeHeaderComment: false })).toMatchSnapshot()
  })
})
