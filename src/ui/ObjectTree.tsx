import { useState } from 'react'
import { createLogo, OBJECT_FACTORIES } from '../core/doc'
import { importSvgLogo, LogoImportError } from '../core/logo/import'
import type { Obj, ObjType } from '../core/types'
import { useDoc, useStore } from '../state/store'
import { TYPE_LABELS } from './schema'

/**
 * La escala va aparte y destacada: es el objeto que da sentido a la
 * herramienta y estaba perdido entre seis botones idénticos.
 */
const PRIMARY: ObjType = 'scale'
const SECONDARY: ObjType[] = ['text', 'line', 'rect', 'circle', 'arc', 'hole']

const HINTS: Partial<Record<ObjType, string>> = {
  scale: 'Un mando completo: marcas, numeración, rótulo y agujero del eje',
  text: 'Rótulo grabado con fuente de línea única',
  line: 'Polilínea de vértices en milímetros',
  rect: 'Rectángulo, con esquinas redondeadas opcionales',
  circle: 'Círculo grabado o relleno',
  arc: 'Arco de circunferencia',
  hole: 'Taladro o ventana, en la capa de corte',
}

export function ObjectTree() {
  const doc = useDoc()
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const addObject = useStore((s) => s.addObject)
  const deleteObject = useStore((s) => s.deleteObject)
  const duplicate = useStore((s) => s.duplicateObject)
  const patchObject = useStore((s) => s.patchObject)
  const update = useStore((s) => s.update)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [logoWarnings, setLogoWarnings] = useState<string[]>([])

  const importLogo = async () => {
    setLogoError(null)
    setLogoWarnings([])
    try {
      const file = await pickSvgFile()
      const result = importSvgLogo(await file.text())
      setLogoWarnings(result.warnings)
      addObject(createLogo(result, file.name.replace(/\.svg$/i, ''), doc.panel.w / 2, doc.panel.h / 2))
    } catch (err) {
      if (err instanceof LogoImportError) setLogoError(err.message)
      else if (err instanceof Error && err.message !== 'cancelado') setLogoError(err.message)
    }
  }

  const add = (type: ObjType) => {
    const factory = OBJECT_FACTORIES[type]
    if (factory) addObject(factory(doc.panel.w / 2, doc.panel.h / 2))
  }

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
        <button
          type="button"
          className="add-primary"
          title={HINTS[PRIMARY]}
          onClick={() => add(PRIMARY)}
        >
          + {TYPE_LABELS[PRIMARY]} para potenciómetro
        </button>
        <div className="add-secondary">
          {SECONDARY.map((type) => (
            <button key={type} type="button" title={HINTS[type]} onClick={() => add(type)}>
              + {TYPE_LABELS[type]}
            </button>
          ))}
          <button type="button" title="Importar un logotipo desde un fichero SVG" onClick={importLogo}>
            + Logotipo…
          </button>
        </div>
      </div>

      {logoError && <p className="error inline">{logoError}</p>}
      {logoWarnings.map((w, i) => (
        <p key={i} className="warn inline">{w}</p>
      ))}

      {doc.objects.length === 0 && (
        <p className="empty">
          Sin objetos todavía. Empieza por una escala: es un mando entero, con sus marcas, su
          numeración, su rótulo y el agujero del eje. Todo se ajusta después con números en el
          inspector, que trae cinco presets de partida.
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
              <button type="button" title="Duplicar (⌘D)"
                onClick={(e) => { e.stopPropagation(); duplicate(obj.id) }}>⧉</button>
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

/** Selector de fichero SVG. Rechaza si el usuario cierra el diálogo. */
function pickSvgFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.svg,image/svg+xml'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) resolve(file)
      else reject(new Error('cancelado'))
    }
    input.click()
  })
}
