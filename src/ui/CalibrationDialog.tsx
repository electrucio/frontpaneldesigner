import { useState } from 'react'
import { createCalibrationDoc } from '../core/calibration'
import {
  CALIBRATION_DEPTHS_MM, fitCalibration, impliedIncludedAngleDeg,
} from '../core/tool'
import type { CalibrationSample, ToolProfile } from '../core/types'
import { exportSvg } from './download'
import { NumberField, Row } from './fields'
import { useStore } from '../state/store'

/**
 * Asistente de calibración de la fresa.
 *
 * El ángulo nominal es la mayor fuente de error del proyecto: una fresa «de
 * 30°» puede ser de 30° totales (factor 0.536) o de 30° por lado (factor
 * 1.155). Medir tres surcos con calibre resuelve la ambigüedad y de paso
 * corrige el desgaste y la punta real.
 */
export function CalibrationDialog({ tool, onClose }: { tool: ToolProfile; onClose: () => void }) {
  const patchTool = useStore((s) => s.patchTool)
  const [widths, setWidths] = useState<(number | null)[]>(CALIBRATION_DEPTHS_MM.map(() => null))

  const samples: CalibrationSample[] = CALIBRATION_DEPTHS_MM
    .map((depthMm, i) => ({ depthMm, widthMm: widths[i] }))
    .filter((s): s is CalibrationSample => s.widthMm !== null && s.widthMm > 0)

  const fit = fitCalibration(samples)
  const impliedAngle = fit ? impliedIncludedAngleDeg(fit.kPerMm) : null
  const angleGap = impliedAngle === null ? 0 : Math.abs(impliedAngle - tool.includedAngleDeg)

  const apply = () => {
    if (!fit) return
    patchTool({
      calibration: {
        tipEffMm: round(fit.tipEffMm),
        kPerMm: round(fit.kPerMm),
        measuredAt: new Date().toISOString(),
        samples,
      },
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Calibrar la fresa</h2>
          <button type="button" onClick={onClose} title="Cerrar">✕</button>
        </header>

        <ol className="steps">
          <li>
            <p>
              Graba este panel de prueba. Son tres surcos rectos, cada uno rotulado con
              la profundidad a la que hay que mecanizarlo: son <strong>tres pasadas
              distintas</strong>, no una.
            </p>
            <button type="button" onClick={() => {
              const doc = createCalibrationDoc(tool)
              exportSvg(doc, {
                flipY: false, drillMode: 'circle', groups: null, includeHeaderComment: true,
              })
            }}>
              Descargar SVG de calibración
            </button>
          </li>

          <li>
            <p>Mide con calibre el ancho de cada surco e introdúcelo aquí.</p>
            {CALIBRATION_DEPTHS_MM.map((depthMm, i) => (
              <Row key={depthMm} label={`Surco a ${depthMm} mm`}>
                <NumberField
                  value={widths[i] ?? 0}
                  unit="mm"
                  min={0}
                  step={0.01}
                  onChange={(v) => setWidths((w) => w.map((x, j) => (j === i ? v : x)))}
                />
              </Row>
            ))}
          </li>

          <li>
            <p>Resultado del ajuste por mínimos cuadrados.</p>
            {!fit && (
              <p className="hint">
                Hacen falta al menos dos surcos medidos, a profundidades distintas.
              </p>
            )}
            {fit && (
              <>
                <dl className="fit">
                  <dt>Punta efectiva</dt><dd>{round(fit.tipEffMm)} mm</dd>
                  <dt>Pendiente</dt><dd>{round(fit.kPerMm)} mm de ancho por mm de profundidad</dd>
                  <dt>Ángulo real implícito</dt><dd>{round(impliedAngle!)}° totales</dd>
                  <dt>Error máximo</dt><dd>{round(fit.maxResidualMm)} mm</dd>
                  <dt>R²</dt><dd>{round(fit.r2)}</dd>
                </dl>

                {angleGap > 5 && (
                  <p className="warn">
                    El ángulo medido ({round(impliedAngle!)}°) se aleja del nominal
                    ({tool.includedAngleDeg}°). Si la diferencia es grande, comprueba que la
                    fresa no sea de {tool.includedAngleDeg}° <em>por lado</em>, que serían{' '}
                    {tool.includedAngleDeg * 2}° totales.
                  </p>
                )}
                {fit.r2 < 0.98 && (
                  <p className="warn">
                    Las tres medidas no caen en una recta (R² = {round(fit.r2)}). Suele
                    significar que el cero de Z no era el mismo en las tres pasadas.
                  </p>
                )}
              </>
            )}
          </li>
        </ol>

        <footer>
          {tool.calibration && (
            <button type="button" onClick={() => { patchTool({ calibration: null }); onClose() }}>
              Borrar calibración
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="button" onClick={apply} disabled={!fit}>Aplicar</button>
        </footer>
      </div>
    </div>
  )
}

const round = (n: number): number => Math.round(n * 1e4) / 1e4
