import { OBJECT_FACTORIES } from '../core/doc'
import type { Obj, ObjType } from '../core/types'
import { useDoc, useStore } from '../state/store'
import { TYPE_LABELS } from './schema'

const ADDABLE: ObjType[] = ['scale', 'text', 'line', 'rect', 'circle', 'arc', 'hole']

export function ObjectTree() {
  const doc = useDoc()
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const addObject = useStore((s) => s.addObject)
  const deleteObject = useStore((s) => s.deleteObject)
  const patchObject = useStore((s) => s.patchObject)
  const update = useStore((s) => s.update)

  const move = (id: string, delta: number) => {
    update((d) => {
      const i = d.objects.findIndex((o) => o.id === id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= d.objects.length) return d
      const objects = [...d.objects]
      ;[objects[i], objects[j]] = [objects[j], objects[i]]
      return { ...d, objects }
    })
  }

  return (
    <aside className="panel objects">
      <h2>Objetos</h2>

      <div className="add-row">
        {ADDABLE.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              const factory = OBJECT_FACTORIES[type]
              if (factory) addObject(factory(doc.panel.w / 2, doc.panel.h / 2))
            }}
          >
            + {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {doc.objects.length === 0 && (
        <p className="empty">
          Sin objetos todavía. Todo se define por parámetros: se añade aquí y se ajusta con números
          en el inspector.
        </p>
      )}

      <ul className="tree">
        {doc.objects.map((obj, i) => (
          <li
            key={obj.id}
            className={selection.includes(obj.id) ? 'selected' : ''}
            onClick={() => select([obj.id])}
          >
            <button
              type="button"
              className="eye"
              title={obj.visible ? 'Ocultar' : 'Mostrar'}
              onClick={(e) => { e.stopPropagation(); patchObject(obj.id, { visible: !obj.visible }) }}
            >
              {obj.visible ? '●' : '○'}
            </button>
            <span className="tree-name">{label(obj)}</span>
            <span className="tree-type">{TYPE_LABELS[obj.type]}</span>
            <span className="tree-actions">
              <button type="button" title="Subir" disabled={i === 0}
                onClick={(e) => { e.stopPropagation(); move(obj.id, -1) }}>↑</button>
              <button type="button" title="Bajar" disabled={i === doc.objects.length - 1}
                onClick={(e) => { e.stopPropagation(); move(obj.id, 1) }}>↓</button>
              <button type="button" title="Eliminar"
                onClick={(e) => { e.stopPropagation(); deleteObject(obj.id) }}>✕</button>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  )
}

const label = (obj: Obj): string => obj.name?.trim() || TYPE_LABELS[obj.type]
