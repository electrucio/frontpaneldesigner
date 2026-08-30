import { useState } from 'react'
import { migrateDoc } from '../core/doc'
import { useDoc, useStore } from '../state/store'
import { exportProject, exportSvg, exportSvgPerLayer, pickProjectFile } from './download'
import { NumberField, Row, SelectField } from './fields'
import { VBitCalculator } from './VBitCalculator'
import { CalibrationDialog } from './CalibrationDialog'
import type { CanvasMode } from './Canvas'

export function Toolbar({ mode, setMode }: { mode: CanvasMode; setMode: (m: CanvasMode) => void }) {
  const doc = useDoc()
  const store = useStore()
  const [panelOpen, setPanelOpen] = useState(false)
  const [toolOpen, setToolOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calibrating, setCalibrating] = useState(false)

  const load = async () => {
    try {
      store.replaceDoc(migrateDoc(await pickProjectFile()))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <header className="toolbar">
      <div className="toolbar-row">
        <strong className="brand">Front Panel Designer</strong>

        <input
          className="doc-name"
          value={doc.name}
          onChange={(e) => store.update((d) => ({ ...d, name: e.target.value }), 'doc.name')}
          onBlur={store.endEdit}
        />

        <div className="spacer" />

        <button type="button" onClick={store.undo} disabled={!store.canUndo()} title="Deshacer">↶</button>
        <button type="button" onClick={store.redo} disabled={!store.canRedo()} title="Rehacer">↷</button>

        <button type="button" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
          Panel · {doc.panel.w}×{doc.panel.h} mm
        </button>
        <button type="button" onClick={() => setToolOpen((v) => !v)} aria-expanded={toolOpen}>
          V-bit · {doc.tool.includedAngleDeg}° / {doc.tool.tipMm} mm
        </button>

        <SelectField
          value={mode}
          options={[
            { value: 'appearance', label: 'Vista: apariencia' },
            { value: 'technical', label: 'Vista: técnica' },
          ]}
          onChange={(v) => setMode(v as CanvasMode)}
        />

        <button type="button" onClick={() => exportSvg(doc, store.exportOptions)}>Exportar SVG</button>
        <button type="button" onClick={() => exportSvgPerLayer(doc, store.exportOptions)}>Por capas</button>
        <button type="button" onClick={() => exportProject(doc)}>Guardar</button>
        <button type="button" onClick={load}>Abrir</button>
      </div>

      {error && <p className="error">{error}</p>}

      {panelOpen && (
        <section className="drawer">
          <h3>Panel</h3>
          <div className="grid2">
            <Row label="Ancho">
              <NumberField
                value={doc.panel.w} unit="mm" min={1} step={5}
                onChange={(w) => store.patchPanel({ w }, 'panel.w')} onCommit={store.endEdit}
              />
            </Row>
            <Row label="Alto">
              <NumberField
                value={doc.panel.h} unit="mm" min={1} step={5}
                onChange={(h) => store.patchPanel({ h }, 'panel.h')} onCommit={store.endEdit}
              />
            </Row>
            <Row label="Radio de esquina">
              <NumberField
                value={doc.panel.cornerRadiusMm} unit="mm" min={0} step={1}
                onChange={(cornerRadiusMm) => store.patchPanel({ cornerRadiusMm }, 'panel.r')}
                onCommit={store.endEdit}
              />
            </Row>
            <Row label="Margen al borde" help="Zona en la que el DRC avisará de geometría demasiado cerca del canto.">
              <NumberField
                value={doc.panel.edgeMarginMm} unit="mm" min={0} step={0.5}
                onChange={(edgeMarginMm) => store.patchPanel({ edgeMarginMm }, 'panel.margin')}
                onCommit={store.endEdit}
              />
            </Row>
            <Row label="Color del panel" help="Solo apariencia de la vista previa; no afecta al SVG.">
              <input
                type="color" value={doc.panel.background}
                onChange={(e) => store.patchPanel({ background: e.target.value }, 'panel.bg')}
                onBlur={store.endEdit}
              />
            </Row>
            <Row label="Color del grabado">
              <input
                type="color" value={doc.panel.engraveColor}
                onChange={(e) => store.patchPanel({ engraveColor: e.target.value }, 'panel.fg')}
                onBlur={store.endEdit}
              />
            </Row>
          </div>
        </section>
      )}

      {toolOpen && (
        <section className="drawer">
          <h3>Herramienta</h3>
          <div className="grid2">
            <Row
              label="Ángulo total (incluido)"
              help="El ángulo TOTAL de la punta, no el semiángulo. Algunos fabricantes publican el semiángulo: una fresa 'de 30° por lado' son 60° incluidos y ensancha más del doble."
            >
              <NumberField
                value={doc.tool.includedAngleDeg} unit="°" min={1} max={179} step={5}
                onChange={(includedAngleDeg) => store.patchTool({ includedAngleDeg }, 'tool.angle')}
                onCommit={store.endEdit}
              />
            </Row>
            <Row label="Diámetro de punta">
              <NumberField
                value={doc.tool.tipMm} unit="mm" min={0} step={0.05}
                onChange={(tipMm) => store.patchTool({ tipMm }, 'tool.tip')}
                onCommit={store.endEdit}
              />
            </Row>
            <Row label="Profundidad máxima" help="Límite del material o de la máquina. Alimenta el aviso de V-carve demasiado ancho.">
              <NumberField
                value={doc.tool.maxDepthMm} unit="mm" min={0} step={0.1}
                onChange={(maxDepthMm) => store.patchTool({ maxDepthMm }, 'tool.maxdepth')}
                onCommit={store.endEdit}
              />
            </Row>
          </div>
          <VBitCalculator tool={doc.tool} />
          <p className="hint">
            {doc.tool.calibration
              ? `Calibrada el ${doc.tool.calibration.measuredAt.slice(0, 10)}: punta ${doc.tool.calibration.tipEffMm} mm, pendiente ${doc.tool.calibration.kPerMm}.`
              : 'Sin calibrar: se usan los valores nominales del ángulo y la punta.'}
            {' '}
            <button type="button" className="link" onClick={() => setCalibrating(true)}>
              {doc.tool.calibration ? 'Recalibrar' : 'Calibrar con la máquina'}
            </button>
          </p>
        </section>
      )}

      <ExportOptionsRow />

      {calibrating && (
        <CalibrationDialog tool={doc.tool} onClose={() => setCalibrating(false)} />
      )}
    </header>
  )
}

function ExportOptionsRow() {
  const opts = useStore((s) => s.exportOptions)
  const set = useStore((s) => s.setExportOptions)
  return (
    <div className="toolbar-row subtle">
      <span className="label">Exportación:</span>
      <label>
        <input type="checkbox" checked={opts.flipY} onChange={(e) => set({ flipY: e.target.checked })} />
        Origen abajo-izquierda (Y hacia arriba)
      </label>
      <label>
        Taladros como
        <SelectField
          value={opts.drillMode}
          options={[
            { value: 'circle', label: 'círculo del diámetro real' },
            { value: 'point', label: 'punto central' },
          ]}
          onChange={(drillMode) => set({ drillMode: drillMode as 'circle' | 'point' })}
        />
      </label>
      <span className="hint inline">
        Las coordenadas de corte y taladro son la línea nominal: la CAM aplica el offset de herramienta.
      </span>
    </div>
  )
}
