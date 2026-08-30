import { depthForWidth, effectiveTip, widthAtDepth, widthPerMm } from '../core/tool'
import type { ToolProfile } from '../core/types'
import { NumberField, Row } from './fields'
import { useStore } from '../state/store'

/**
 * Calculadora ancho ↔ profundidad, **pilotada por el ancho**: el diseñador
 * piensa "quiero un trazo de 0.35 mm", no "quiero 0.28 mm de profundidad".
 * Los dos campos están enlazados y manda el que se toca.
 */
export function VBitCalculator({ tool }: { tool: ToolProfile }) {
  const patchTool = useStore((s) => s.patchTool)
  const endEdit = useStore((s) => s.endEdit)

  const depth = tool.defaultDepthMm
  const width = widthAtDepth(tool, depth)
  const k = widthPerMm(tool)
  const tip = effectiveTip(tool)

  return (
    <div className="vbit">
      <Row
        label="Ancho de trazo"
        help="Ancho del surco que dejará la fresa. Es el campo que se suele querer fijar."
      >
        <NumberField
          value={round(width)}
          unit="mm"
          min={round(tip)}
          step={0.01}
          onChange={(w) => patchTool({ defaultDepthMm: round(depthForWidth(tool, w)) }, 'tool.width')}
          onCommit={endEdit}
        />
      </Row>
      <Row label="Profundidad" help="Se deriva del ancho, y viceversa.">
        <NumberField
          value={round(depth)}
          unit="mm"
          min={0}
          max={tool.maxDepthMm}
          step={0.05}
          onChange={(d) => patchTool({ defaultDepthMm: d }, 'tool.depth')}
          onCommit={endEdit}
        />
      </Row>
      <p className="hint">
        w = {fmt(tip)} + {fmt(k)}·d mm{tool.calibration ? ' (calibrada)' : ' (nominal)'}.
        {' '}A profundidad máxima ({fmt(tool.maxDepthMm)} mm) el surco mide {fmt(widthAtDepth(tool, tool.maxDepthMm))} mm.
      </p>
      {width > widthAtDepth(tool, tool.maxDepthMm) && (
        <p className="warn">El ancho pedido excede lo que da la profundidad máxima.</p>
      )}
    </div>
  )
}

const round = (n: number): number => Math.round(n * 1e4) / 1e4
const fmt = (n: number): string => String(Math.round(n * 1e4) / 1e4)
