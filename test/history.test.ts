import { describe, expect, it } from 'vitest'
import {
  canRedo, canUndo, commit, endTransaction, HISTORY_LIMIT,
  initHistory, redo, undo,
} from '../src/state/history'

describe('coalescencia por transaccion', () => {
  it('funde en una sola entrada las pulsaciones seguidas sobre el mismo campo', () => {
    let h = initHistory('')
    h = commit(h, '1', { txKey: 'obj1.w', now: 1000 })
    h = commit(h, '12', { txKey: 'obj1.w', now: 1100 })
    h = commit(h, '12.', { txKey: 'obj1.w', now: 1200 })
    h = commit(h, '12.5', { txKey: 'obj1.w', now: 1300 })

    expect(h.present).toBe('12.5')
    expect(h.past).toEqual([''])       // una sola entrada, no cuatro
    expect(undo(h).present).toBe('')   // el undo devuelve al estado previo a teclear
  })

  it('abre una entrada nueva al pasar la ventana', () => {
    let h = initHistory('')
    h = commit(h, 'a', { txKey: 'obj1.w', now: 1000 })
    h = commit(h, 'b', { txKey: 'obj1.w', now: 1600 }) // 600 ms > 500 ms
    expect(h.past).toEqual(['', 'a'])
  })

  it('abre una entrada nueva al cambiar de campo', () => {
    let h = initHistory('')
    h = commit(h, 'a', { txKey: 'obj1.w', now: 1000 })
    h = commit(h, 'b', { txKey: 'obj1.h', now: 1050 })
    expect(h.past).toEqual(['', 'a'])
  })

  it('endTransaction fuerza el corte aunque no haya pasado la ventana', () => {
    let h = initHistory('')
    h = commit(h, 'a', { txKey: 'obj1.w', now: 1000 })
    h = endTransaction(h)
    h = commit(h, 'b', { txKey: 'obj1.w', now: 1050 })
    expect(h.past).toEqual(['', 'a'])
  })

  it('los cambios atomicos nunca se funden', () => {
    let h = initHistory('')
    h = commit(h, 'a', { now: 1000 })
    h = commit(h, 'b', { now: 1010 })
    expect(h.past).toEqual(['', 'a'])
  })
})

describe('deshacer y rehacer', () => {
  it('recorre el historial en los dos sentidos', () => {
    let h = initHistory('a')
    h = commit(h, 'b')
    h = commit(h, 'c')

    expect(canUndo(h)).toBe(true)
    expect(canRedo(h)).toBe(false)

    h = undo(h)
    expect(h.present).toBe('b')
    expect(canRedo(h)).toBe(true)

    h = undo(h)
    expect(h.present).toBe('a')
    expect(canUndo(h)).toBe(false)
    expect(undo(h)).toBe(h)

    h = redo(redo(h))
    expect(h.present).toBe('c')
    expect(redo(h)).toBe(h)
  })

  it('un cambio nuevo descarta la rama de rehacer', () => {
    let h = initHistory('a')
    h = commit(h, 'b')
    h = undo(h)
    h = commit(h, 'z')
    expect(h.future).toEqual([])
    expect(h.present).toBe('z')
  })

  it('deshacer cierra la transaccion abierta', () => {
    let h = initHistory('a')
    h = commit(h, 'b', { txKey: 'k', now: 1000 })
    h = undo(h)
    expect(h.tx).toBeNull()
    h = commit(h, 'c', { txKey: 'k', now: 1050 })
    expect(h.past).toEqual(['a'])
  })

  it('acota el historial para no crecer sin limite', () => {
    let h = initHistory(0)
    for (let i = 1; i <= HISTORY_LIMIT + 50; i++) h = commit(h, i)
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    expect(h.present).toBe(HISTORY_LIMIT + 50)
  })
})
