// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { contoursBounds, pathToContours } from '../src/core/logo/pathToContours'
import { parsePoints, shapeToPathData } from '../src/core/logo/shapes'
import { importSvgLogo, LogoImportError } from '../src/core/logo/import'
import { buildDocument } from '../src/core/build'
import { createDefaultDoc, createLogo } from '../src/core/doc'
import type { LogoObj } from '../src/core/types'

const attrsOf = (obj: Record<string, string>) => (name: string) => obj[name] ?? null

const svg = (body: string, root = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ${root}>${body}</svg>`

describe('d de SVG → contornos', () => {
  it('reconoce comandos absolutos, relativos y abreviados', () => {
    const c = pathToContours('m 10 10 h 10 v 10 z')
    expect(c).toHaveLength(1)
    expect(c[0].closed).toBe(true)
    expect(c[0].start).toEqual({ x: 10, y: 10 })
    expect(c[0].segs.map((s) => s.kind)).toEqual(['line', 'line'])
    expect(c[0].segs[0].to).toEqual({ x: 20, y: 10 })
    expect(c[0].segs[1].to).toEqual({ x: 20, y: 20 })
  })

  it('separa los subcaminos en contornos distintos', () => {
    const c = pathToContours('M0 0 L5 0 M10 10 L15 10 L15 15 Z')
    expect(c).toHaveLength(2)
    expect(c[0].closed).toBe(false)
    expect(c[1].closed).toBe(true)
  })

  it('convierte la cuadrática en cúbica exacta, no aproximada', () => {
    const [c] = pathToContours('M0 0 Q 30 0 30 30')
    const seg = c.segs[0]
    expect(seg.kind).toBe('cubic')
    if (seg.kind !== 'cubic') throw new Error('esperaba una cúbica')
    // Los controles caen a dos tercios del camino hacia el control cuadrático.
    expect(seg.c1).toEqual({ x: 20, y: 0 })
    expect(seg.c2).toEqual({ x: 30, y: 10 })
    expect(seg.to).toEqual({ x: 30, y: 30 })
  })

  it('desarrolla los arcos elípticos en cúbicas', () => {
    const [c] = pathToContours('M0 0 A 10 10 0 0 1 20 0')
    expect(c.segs.every((s) => s.kind === 'cubic')).toBe(true)
    expect(c.segs.length).toBeGreaterThan(0)
  })

  it('mide la caja envolvente', () => {
    const b = contoursBounds(pathToContours('M10 20 L40 20 L40 60 Z'))
    expect(b).toMatchObject({ minX: 10, minY: 20, maxX: 40, maxY: 60, width: 30, height: 40 })
  })
})

describe('formas básicas → d', () => {
  it('rectángulo con esquinas vivas y redondeadas', () => {
    expect(shapeToPathData('rect', attrsOf({ x: '0', y: '0', width: '10', height: '5' })))
      .toBe('M0 0H10V5H0Z')
    const rounded = shapeToPathData('rect', attrsOf({ width: '10', height: '10', rx: '2' }))!
    expect(rounded).toContain('A2 2')
  })

  it('recorta el radio a la mitad del lado', () => {
    const d = shapeToPathData('rect', attrsOf({ width: '10', height: '4', rx: '99' }))!
    expect(d).toContain('A5 2')
  })

  it('círculo y elipse salen como dos semiarcos cerrados', () => {
    const circle = pathToContours(shapeToPathData('circle', attrsOf({ cx: '5', cy: '5', r: '5' }))!)
    const b = contoursBounds(circle)
    expect(b.width).toBeCloseTo(10, 6)
    expect(b.height).toBeCloseTo(10, 6)
    expect(circle[0].closed).toBe(true)
  })

  it('polilínea abierta y polígono cerrado', () => {
    expect(shapeToPathData('polyline', attrsOf({ points: '0,0 5,5' }))).toBe('M0 0L5 5')
    expect(shapeToPathData('polygon', attrsOf({ points: '0,0 5,5' }))).toBe('M0 0L5 5Z')
  })

  it('admite comas, espacios o ambos como separadores de puntos', () => {
    expect(parsePoints('0,0 5,5')).toEqual([[0, 0], [5, 5]])
    expect(parsePoints('0 0 5 5')).toEqual([[0, 0], [5, 5]])
    expect(parsePoints('0, 0, 5, 5')).toEqual([[0, 0], [5, 5]])
    expect(parsePoints(null)).toEqual([])
  })

  it('descarta formas degeneradas', () => {
    expect(shapeToPathData('rect', attrsOf({ width: '0', height: '5' }))).toBeNull()
    expect(shapeToPathData('circle', attrsOf({ r: '0' }))).toBeNull()
  })
})

describe('importación', () => {
  it('normaliza el origen contra el dibujo, no contra el viewBox', () => {
    // El lienzo es 100x100 pero la tinta ocupa 20x10 en la esquina inferior.
    const r = importSvgLogo(svg('<rect x="70" y="80" width="20" height="10"/>'))
    expect(r.width).toBe(20)
    expect(r.height).toBe(10)
    const b = contoursBounds(r.paths.flatMap((p) => pathToContours(p.d)))
    expect(b.minX).toBeCloseTo(0, 6)
    expect(b.minY).toBeCloseTo(0, 6)
  })

  it('aplana las transformaciones de los ancestros', () => {
    const r = importSvgLogo(svg(
      '<g transform="translate(100,0)"><g transform="scale(2)">' +
      '<rect x="0" y="0" width="10" height="10"/></g></g>',
    ))
    expect(r.width).toBeCloseTo(20, 6)
    expect(r.height).toBeCloseTo(20, 6)
  })

  it('el relleno por defecto de SVG es negro, así que una forma pelada está rellena', () => {
    expect(importSvgLogo(svg('<rect width="10" height="10"/>')).filledCount).toBe(1)
  })

  it('detecta el trazo puro por atributo, por estilo y por herencia', () => {
    expect(importSvgLogo(svg('<rect width="10" height="10" fill="none"/>')).strokedCount).toBe(1)
    expect(importSvgLogo(svg('<rect width="10" height="10" style="fill:none"/>')).strokedCount).toBe(1)
    expect(importSvgLogo(svg('<g fill="none"><rect width="10" height="10"/></g>')).strokedCount).toBe(1)
  })

  it('ignora lo que está oculto', () => {
    const r = importSvgLogo(svg(
      '<rect width="10" height="10"/><rect x="50" y="50" width="10" height="10" display="none"/>',
    ))
    expect(r.paths).toHaveLength(1)
    expect(r.width).toBe(10)
  })

  it('rechaza lo que cambiaría la geometría en silencio', () => {
    for (const tag of ['clipPath', 'mask', 'use', 'text']) {
      const body = `<rect width="10" height="10"/><${tag}></${tag}>`
      expect(() => importSvgLogo(svg(body)), tag).toThrow(LogoImportError)
      expect(() => importSvgLogo(svg(body)), tag).toThrow(new RegExp(tag))
    }
  })

  it('avisa de las hojas de estilo en vez de rechazarlas', () => {
    // Rechazarlas dejaría fuera casi todo lo que exporta Illustrator.
    const r = importSvgLogo(svg('<style>.a{fill:none}</style><rect class="a" width="10" height="10"/>'))
    expect(r.paths).toHaveLength(1)
    expect(r.warnings.join(' ')).toMatch(/hojas de estilo/)
  })

  it('falla con un mensaje útil si no hay geometría', () => {
    expect(() => importSvgLogo(svg(''))).toThrow(/No se ha encontrado geometría/)
    expect(() => importSvgLogo('no soy un svg')).toThrow(LogoImportError)
  })
})

describe('construcción', () => {
  const logoDoc = (patch: Partial<LogoObj> = {}) => {
    const imported = importSvgLogo(svg('<rect width="20" height="10"/>'))
    const doc = createDefaultDoc('logo')
    doc.objects = [{ ...createLogo(imported, 'test', 0, 0), ...patch }]
    return buildDocument(doc).slice(1)
  }

  it('escala al ancho pedido y conserva la proporción', () => {
    const prims = logoDoc({ widthMm: 40, keepAspect: true })
    expect(prims).toHaveLength(1)
    const region = prims[0]
    if (region.kind !== 'region') throw new Error('esperaba una región')
    const b = contoursBounds(region.contours)
    expect(b.width).toBeCloseTo(40, 6)
    expect(b.height).toBeCloseTo(20, 6)   // 20x10 escalado x2
  })

  it('permite deformar cuando se desactiva la proporción', () => {
    const prims = logoDoc({ widthMm: 40, keepAspect: false, heightMm: 5 })
    const region = prims[0]
    if (region.kind !== 'region') throw new Error('esperaba una región')
    const b = contoursBounds(region.contours)
    expect(b.width).toBeCloseTo(40, 6)
    expect(b.height).toBeCloseTo(5, 6)
  })

  it('el modo de grabado manda sobre lo que dijera el fichero', () => {
    expect(logoDoc({ renderMode: 'as-authored' })[0].kind).toBe('region')
    expect(logoDoc({ renderMode: 'all-centerline' })[0].kind).toBe('contour')
    expect(logoDoc({ renderMode: 'all-filled' })[0].kind).toBe('region')
    expect(logoDoc({ renderMode: 'all-centerline' })[0].style).toBe('centerline')
  })
})
