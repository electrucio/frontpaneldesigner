import { describe, expect, it } from 'vitest'
import {
  cloneObject, createScale, createText, duplicateObject, DUPLICATE_OFFSET_MM,
  newId, nextName, uniqueName,
} from '../src/core/doc'
import type { GroupObj, Obj, ScaleObj } from '../src/core/types'

const group = (children: Obj[]): GroupObj => ({
  id: newId('g'), type: 'group', name: 'Estacion', visible: true, locked: false,
  layer: 'engrave', anchor: 'topLeft', x: 10, y: 10, rotationDeg: 0, depthMm: null,
  children,
})

const ids = (objects: Obj[]): string[] =>
  objects.flatMap((o) => [o.id, ...(o.type === 'group' ? ids(o.children) : [])])

describe('nombre de la copia', () => {
  it('incrementa el número final si lo hay', () => {
    expect(nextName('GAIN')).toBe('GAIN 2')
    expect(nextName('GAIN 2')).toBe('GAIN 3')
    expect(nextName('Reverb 12')).toBe('Reverb 13')
    expect(nextName('Canal 09')).toBe('Canal 10')
  })

  it('deja en blanco lo que estaba en blanco', () => {
    expect(nextName('')).toBe('')
    expect(nextName('   ')).toBe('')
  })

  it('salta los nombres ya ocupados en vez de repetirlos', () => {
    expect(uniqueName('GAIN', new Set(['GAIN']))).toBe('GAIN 2')
    expect(uniqueName('GAIN', new Set(['GAIN', 'GAIN 2']))).toBe('GAIN 3')
    expect(uniqueName('GAIN', new Set(['GAIN', 'GAIN 2', 'GAIN 3']))).toBe('GAIN 4')
    // Sin nombre no hay serie que recorrer, y no debe quedarse dando vueltas.
    expect(uniqueName('', new Set([''])))
      .toBe('')
  })
})

describe('clonar', () => {
  it('da identificadores nuevos y no comparte estructuras con el original', () => {
    const original = createScale(30, 30)
    const copy = cloneObject(original) as ScaleObj

    expect(copy.id).not.toBe(original.id)
    expect(copy.majorTicks).not.toBe(original.majorTicks)
    expect(copy.labels).not.toBe(original.labels)

    // Cambiar la copia no toca al original: es el fallo clásico de copiar en
    // superficie un objeto con subestructuras.
    copy.majorTicks.count = 99
    copy.caption.text = 'OTRO'
    expect(original.majorTicks.count).not.toBe(99)
    expect(original.caption.text).not.toBe('OTRO')
  })

  it('conserva todos los parámetros salvo el identificador', () => {
    const original: ScaleObj = {
      ...createScale(30, 30),
      radiusMm: 17.5,
      startAngleDeg: -150,
      majorTicks: { ...createScale().majorTicks, count: 11, shape: 'dot' },
      labels: { ...createScale().labels, values: ['MIN', 'MAX'], capHeightMm: 1.9 },
    }
    const copy = cloneObject(original) as ScaleObj

    expect({ ...copy, id: original.id }).toEqual(original)
  })

  it('renueva también los identificadores de los hijos de un grupo', () => {
    const original = group([createScale(0, 0), createText(0, 10)])
    const copy = cloneObject(original) as GroupObj

    const before = ids([original])
    const after = ids([copy])
    expect(after).toHaveLength(before.length)
    expect(after.some((id) => before.includes(id))).toBe(false)
  })
})

describe('duplicar dentro del documento', () => {
  it('inserta la copia justo detrás del original', () => {
    const a = { ...createScale(10, 10), name: 'GAIN' }
    const b = { ...createScale(50, 10), name: 'BASS' }
    const { objects, newId: created } = duplicateObject([a, b], a.id)

    expect(objects.map((o) => o.name)).toEqual(['GAIN', 'GAIN 2', 'BASS'])
    expect(objects[1].id).toBe(created)
    expect(objects[0]).toBe(a)   // el original no se toca
  })

  it('no repite un nombre que ya existe en el documento', () => {
    const a = { ...createScale(10, 10), name: 'GAIN' }
    const b = { ...createScale(50, 10), name: 'GAIN 2' }
    const { objects } = duplicateObject([a, b], a.id)
    expect(objects.map((o) => o.name)).toEqual(['GAIN', 'GAIN 3', 'GAIN 2'])
  })

  it('desplaza la copia para que no tape al original', () => {
    const a = { ...createScale(10, 20), name: 'GAIN' }
    const { objects } = duplicateObject([a], a.id)

    expect(objects[1].x).toBe(10 + DUPLICATE_OFFSET_MM.x)
    expect(objects[1].y).toBe(20 + DUPLICATE_OFFSET_MM.y)
  })

  it('admite un desplazamiento propio, para repartir mandos por el panel', () => {
    const a = { ...createScale(10, 20), name: 'GAIN' }
    const { objects } = duplicateObject([a], a.id, { x: 38, y: 0 })
    expect(objects[1].x).toBe(48)
    expect(objects[1].y).toBe(20)
  })

  it('duplica dentro del grupo al que pertenece el objeto, no en la raíz', () => {
    const inner = createText(0, 0)
    const g = group([inner])
    const otro = createScale(0, 0)
    const { objects } = duplicateObject([g, otro], inner.id)

    expect(objects).toHaveLength(2)               // la raíz no crece
    const grupo = objects[0] as GroupObj
    expect(grupo.children).toHaveLength(2)
    expect(grupo.children[1].type).toBe('text')
  })

  it('duplicar el grupo entero copia a sus hijos', () => {
    const g = group([createScale(0, 0), createText(0, 10)])
    const { objects } = duplicateObject([g], g.id)

    expect(objects).toHaveLength(2)
    const copia = objects[1] as GroupObj
    expect(copia.children).toHaveLength(2)
    expect(ids([copia]).some((id) => ids([g]).includes(id))).toBe(false)
  })

  it('con un identificador desconocido no cambia nada', () => {
    const a = createScale(10, 10)
    const { objects, newId: created } = duplicateObject([a], 'no-existe')
    expect(created).toBeNull()
    expect(objects.map((o) => o.id)).toEqual([a.id])
  })
})
