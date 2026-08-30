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

  // Recupera el autoguardado. Si no hay ninguno, se queda el documento vacío.
  useEffect(() => {
    let cancelled = false
    void loadCurrentDoc().then((doc) => { if (doc && !cancelled) replaceDoc(doc) })
    return () => { cancelled = true }
  }, [replaceDoc])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

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
