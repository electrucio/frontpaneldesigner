import { useEffect, useState } from 'react'
import { Canvas, type CanvasMode } from './Canvas'
import { Inspector } from './Inspector'
import { ObjectTree } from './ObjectTree'
import { Toolbar } from './Toolbar'
import { loadCurrentDoc } from '../state/persist'
import { useStore } from '../state/store'

export function App() {
  const [mode, setMode] = useState<CanvasMode>('appearance')
  const replaceDoc = useStore((s) => s.replaceDoc)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const duplicate = useStore((s) => s.duplicateObject)
  const selection = useStore((s) => s.selection)

  // Recupera el autoguardado. Si no hay ninguno, se queda el documento vacío.
  useEffect(() => {
    let cancelled = false
    void loadCurrentDoc().then((doc) => { if (doc && !cancelled) replaceDoc(doc) })
    return () => { cancelled = true }
  }, [replaceDoc])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (key === 'd' && selection.length === 1) {
        // El atajo del navegador es «añadir a marcadores»; aquí estorba.
        e.preventDefault()
        duplicate(selection[0])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, duplicate, selection])

  return (
    <div className="app">
      <Toolbar mode={mode} setMode={setMode} />
      <main className="workspace">
        <ObjectTree />
        <Canvas mode={mode} />
        <Inspector />
      </main>
    </div>
  )
}
