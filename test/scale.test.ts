import { describe, expect, it } from 'vitest'
import { buildDocument } from '../src/core/build'
import { createDefaultDoc, createScale } from '../src/core/doc'
import { SCALE_PRESETS, scalePreset } from '../src/core/scalePresets'
import { angleOf, norm360 } from '../src/core/geometry/polar'
import type { Doc, ScaleObj } from '../src/core/types'
import type { Primitive } from '../src/core/primitives'

const CENTER = { x: 50, y: 40 }

function build(patch: Partial<ScaleObj> = {}): Primitive[] {
  const doc: Doc = createDefaultDoc('escala')
  doc.panel = { ...doc.panel, w: 100, h: 80 }
  doc.objects = [{ ...createScale(CENTER.x, CENTER.y), ...patch } as ScaleObj]
  // Se descarta el contorno del panel, que va primero.
  return buildDocument(doc).slice(1)
}

/** Marcas: polilíneas abiertas de dos puntos en la capa de grabado. */
const ticks = (prims: Primitive[]) =>
  prims.filter((p): p is Extract<Primitive, { kind: 'polyline' }> =>
    p.kind === 'polyline' && !p.closed && p.pts.length === 2 && p.layer === 'engrave')

const radiusOf = (p: { x: number; y: number }) =>
  Math.hypot(p.x - CENTER.x, p.y - CENTER.y)

describe('marcas', () => {
  it('reparte las mayores del ángulo inicial al final, extremos incluidos', () => {
    const prims = build({
      startAngleDeg: -135, endAngleDeg: 135,
      majorTicks: { ...createScale().majorTicks, count: 6 },
      minorTicks: { ...createScale().minorTicks, enabled: false },
      labels: { ...createScale().labels, mode: 'none' as const },
      caption: { ...createScale().caption, enabled: false },
    })
    const t = ticks(prims)
    expect(t).toHaveLength(6)

    const angles = t.map((p) => norm360(angleOf(CENTER, p.pts[0]))).sort((a, b) => a - b)
    // De -135 a 135 con 6 marcas: paso de 54 grados, es decir
    // -135, -81, -27, 27, 81 y 135, que normalizados y ordenados dan:
    expect(angles.map((a) => Math.round(a))).toEqual([27, 81, 135, 225, 279, 333])
  })

  it('coloca las menores entre las mayores, sin pisarlas', () => {
    const s = createScale()
    const prims = build({
      majorTicks: { ...s.majorTicks, count: 6 },
      minorTicks: { ...s.minorTicks, enabled: true, count: 5 },
      labels: { ...s.labels, mode: 'none' as const },
      caption: { ...s.caption, enabled: false },
    })
    // 6 mayores + 5 intervalos x 4 menores = 26
    expect(ticks(prims)).toHaveLength(26)
  })

  it('respeta radio, longitud y dirección', () => {
    const s = createScale()
    const common = {
      majorTicks: { ...s.majorTicks, count: 2, radiusMm: 10, lengthMm: 3 },
      minorTicks: { ...s.minorTicks, enabled: false },
      labels: { ...s.labels, mode: 'none' as const },
      caption: { ...s.caption, enabled: false },
    }

    const out = ticks(build({ ...common, majorTicks: { ...common.majorTicks, direction: 'outward' as const } }))[0]
    expect(radiusOf(out.pts[0])).toBeCloseTo(10, 6)
    expect(radiusOf(out.pts[1])).toBeCloseTo(13, 6)

    const inw = ticks(build({ ...common, majorTicks: { ...common.majorTicks, direction: 'inward' as const } }))[0]
    expect(radiusOf(inw.pts[1])).toBeCloseTo(7, 6)

    const ctr = ticks(build({ ...common, majorTicks: { ...common.majorTicks, direction: 'centered' as const } }))[0]
    expect(radiusOf(ctr.pts[0])).toBeCloseTo(8.5, 6)
    expect(radiusOf(ctr.pts[1])).toBeCloseTo(11.5, 6)
  })

  it('los puntos son círculos rellenos y los triángulos, polilíneas cerradas', () => {
    const s = createScale()
    const base = {
      majorTicks: { ...s.majorTicks, count: 4 },
      minorTicks: { ...s.minorTicks, enabled: false },
      labels: { ...s.labels, mode: 'none' as const },
      caption: { ...s.caption, enabled: false },
    }

    const dots = build({ ...base, majorTicks: { ...base.majorTicks, shape: 'dot' as const, markerSizeMm: 1 } })
      .filter((p) => p.kind === 'circle' && p.layer === 'engrave')
    expect(dots).toHaveLength(4)
    expect(dots[0]).toMatchObject({ style: 'fill', r: 0.5 })

    const tri = build({ ...base, majorTicks: { ...base.majorTicks, shape: 'triangle' as const } })
      .filter((p) => p.kind === 'polyline' && p.closed && p.pts.length === 3)
    expect(tri).toHaveLength(4)
  })
})

describe('arco', () => {
  const only = (mode: 'none' | 'line' | 'band' | 'segments', patch = {}) => {
    const s = createScale()
    return build({
      arc: { ...s.arc, mode, ...patch },
      majorTicks: { ...s.majorTicks, enabled: false },
      minorTicks: { ...s.minorTicks, enabled: false },
      labels: { ...s.labels, mode: 'none' as const },
      caption: { ...s.caption, enabled: false },
      centerHoleDiameterMm: null,
    })
  }

  it('el modo línea da un arco, y ninguno cuando está desactivado', () => {
    expect(only('none')).toHaveLength(0)
    const line = only('line')
    expect(line).toHaveLength(1)
    expect(line[0]).toMatchObject({ kind: 'arc', style: 'centerline' })
  })

  it('la banda es una región cerrada de dos arcos y dos tapas', () => {
    const band = only('band')
    expect(band).toHaveLength(1)
    expect(band[0].kind).toBe('region')
    if (band[0].kind !== 'region') throw new Error('esperaba una región')
    const contour = band[0].contours[0]
    expect(contour.closed).toBe(true)
    expect(contour.segs.map((s) => s.kind)).toEqual(['arc', 'line', 'arc', 'line'])
    // El arco exterior va en horario y el interior vuelve al revés.
    expect(contour.segs[0]).toMatchObject({ sweep: true })
    expect(contour.segs[2]).toMatchObject({ sweep: false })
  })

  it('el modo segmentos produce tantas regiones como tramos', () => {
    const seg = only('segments', { segmentCount: 9, segmentGapDeg: 5 })
    expect(seg).toHaveLength(9)
    expect(seg.every((p) => p.kind === 'region')).toBe(true)
  })

  it('el hueco va entre tramos, no en los extremos', () => {
    const s = createScale()
    const seg = build({
      arc: {
        ...s.arc, mode: 'segments' as const, startAngleDeg: 0, endAngleDeg: 100,
        segmentCount: 3, segmentGapDeg: 10,
      },
      majorTicks: { ...s.majorTicks, enabled: false },
      minorTicks: { ...s.minorTicks, enabled: false },
      labels: { ...s.labels, mode: 'none' as const },
      caption: { ...s.caption, enabled: false },
      centerHoleDiameterMm: null,
    })
    // 100 grados menos 2 huecos de 10 = 80, repartidos en 3 tramos de 26.67.
    const first = seg[0]
    if (first.kind !== 'region') throw new Error('esperaba una región')
    const a0 = norm360(angleOf(CENTER, first.contours[0].start))
    expect(a0).toBeCloseTo(0, 6)
  })
})

describe('etiquetas', () => {
  const withLabels = (patch: object) => {
    const s = createScale()
    return build({
      arc: { ...s.arc, mode: 'none' as const },
      majorTicks: { ...s.majorTicks, enabled: false },
      minorTicks: { ...s.minorTicks, enabled: false },
      caption: { ...s.caption, enabled: false },
      centerHoleDiameterMm: null,
      labels: { ...s.labels, ...patch },
    })
  }

  it('el modo extremos rotula solo el primero y el último', () => {
    const prims = withLabels({ mode: 'endpoints', values: ['200Hz', '30Hz'] })
    // Los trazos de dos etiquetas, y ninguna otra geometría.
    expect(prims.length).toBeGreaterThan(0)
    expect(prims.every((p) => p.kind === 'polyline')).toBe(true)
  })

  it('la lista explícita manda sobre el rango numérico', () => {
    const rango = withLabels({ mode: 'endpoints', values: null, min: 0, max: 10 })
    const lista = withLabels({ mode: 'endpoints', values: ['A', 'B'] })
    // '0'/'10' tienen más trazos que 'A'/'B': la lista se ha usado de verdad.
    expect(rango.length).not.toBe(lista.length)
  })

  it('sin etiquetas no genera nada', () => {
    expect(withLabels({ mode: 'none' })).toHaveLength(0)
  })
})

describe('composición', () => {
  it('el agujero del eje va a la capa de taladro con el radio correcto', () => {
    const hole = build({ centerHoleDiameterMm: 9 })
      .find((p) => p.layer === 'drill')
    expect(hole).toMatchObject({ kind: 'circle', r: 4.5, depthMm: 0 })
    expect(build({ centerHoleDiameterMm: null }).some((p) => p.layer === 'drill')).toBe(false)
  })

  it('rotar la escala gira marcas y etiquetas a la vez', () => {
    const s = createScale()
    const cfg = {
      arc: { ...s.arc, mode: 'none' as const },
      majorTicks: { ...s.majorTicks, count: 2 },
      minorTicks: { ...s.minorTicks, enabled: false },
      labels: { ...s.labels, mode: 'none' as const },
      caption: { ...s.caption, enabled: false },
      centerHoleDiameterMm: null,
    }
    const sin = ticks(build(cfg))
    const con = ticks(build({ ...cfg, rotationDeg: 30 }))

    const a = norm360(angleOf(CENTER, sin[0].pts[0]))
    const b = norm360(angleOf(CENTER, con[0].pts[0]))
    expect(norm360(b - a)).toBeCloseTo(30, 6)
  })

  it('los cinco presets producen geometría y ninguno revienta', () => {
    for (const preset of SCALE_PRESETS) {
      const prims = build(preset.settings as Partial<ScaleObj>)
      expect(prims.length, `preset ${preset.id}`).toBeGreaterThan(0)
      for (const p of prims) {
        const pts = p.kind === 'polyline' ? p.pts : p.kind === 'circle' ? [p.c] : []
        for (const pt of pts) {
          expect(Number.isFinite(pt.x) && Number.isFinite(pt.y), `preset ${preset.id}`).toBe(true)
        }
      }
    }
    expect(scalePreset('marshall')).toBeDefined()
    expect(scalePreset('no-existe')).toBeUndefined()
  })
})
