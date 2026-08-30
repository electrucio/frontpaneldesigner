import { describe, expect, it } from 'vitest'
import { angleOf, distribute, norm360, polar, sweepCW } from '../src/core/geometry/polar'
import { apply, multiply, rotation, rotationOf, translation, uniformScale } from '../src/core/geometry/mat'

const C = { x: 100, y: 100 }

describe('convencion angular: 0 grados arriba, positivo horario', () => {
  it('coloca los puntos cardinales donde corresponde con Y hacia abajo', () => {
    expect(polar(C, 10, 0)).toMatchObject({ x: expect.closeTo(100, 9), y: expect.closeTo(90, 9) })
    expect(polar(C, 10, 90)).toMatchObject({ x: expect.closeTo(110, 9), y: expect.closeTo(100, 9) })
    expect(polar(C, 10, 180)).toMatchObject({ x: expect.closeTo(100, 9), y: expect.closeTo(110, 9) })
    expect(polar(C, 10, 270)).toMatchObject({ x: expect.closeTo(90, 9), y: expect.closeTo(100, 9) })
  })

  it('angleOf es la inversa de polar', () => {
    for (const a of [-170, -90, 0, 37, 90, 179]) {
      expect(norm360(angleOf(C, polar(C, 25, a)))).toBeCloseTo(norm360(a), 9)
    }
  })

  it('sweepCW mide el recorrido horario, y start==end es vuelta completa', () => {
    expect(sweepCW(150, 210)).toBe(60)
    expect(sweepCW(210, 150)).toBe(300)
    expect(sweepCW(-135, 135)).toBe(270)
    expect(sweepCW(0, 0)).toBe(360)
  })

  it('distribute reparte incluyendo los dos extremos', () => {
    expect(distribute(-135, 135, 6)).toEqual([-135, -81, -27, 27, 81, 135])
    expect(distribute(0, 90, 1)).toEqual([0])
    expect(distribute(0, 90, 0)).toEqual([])
  })
})

describe('matrices', () => {
  it('compone traslacion y rotacion en el orden esperado', () => {
    // Rotar 90 grados y luego trasladar: el eje X local acaba apuntando a +Y.
    const m = multiply(translation(10, 5), rotation(90))
    expect(apply(m, { x: 1, y: 0 })).toMatchObject({ x: expect.closeTo(10, 9), y: expect.closeTo(6, 9) })
    expect(rotationOf(m)).toBeCloseTo(90, 9)
    expect(uniformScale(m)).toBeCloseTo(1, 9)
  })

  it('la rotacion positiva es horaria en pantalla', () => {
    // (0,-1) es "arriba"; girado 90 grados en horario debe quedar a la derecha.
    expect(apply(rotation(90), { x: 0, y: -1 })).toMatchObject({
      x: expect.closeTo(1, 9), y: expect.closeTo(0, 9),
    })
  })
})
