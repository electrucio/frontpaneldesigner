import type { Point2 } from '../core/types'
import { NumberField } from './fields'

/** Editor de vértices de una polilínea: coordenadas locales, en milímetros. */
export function PointsField({ label, points, onChange, onCommit }: {
  label: string
  points: Point2[]
  onChange: (points: Point2[]) => void
  onCommit: () => void
}) {
  const setPoint = (i: number, patch: Partial<Point2>) => {
    onChange(points.map((p, j) => (i === j ? { ...p, ...patch } : p)))
  }

  return (
    <div className="points-field">
      <div className="points-head">
        <span className="row-label">{label}</span>
        <button
          type="button"
          onClick={() => {
            const last = points[points.length - 1] ?? { x: 0, y: 0 }
            onChange([...points, { x: last.x + 10, y: last.y }])
            onCommit()
          }}
        >
          + vértice
        </button>
      </div>
      {points.map((p, i) => (
        <div className="point-row" key={i}>
          <span className="idx">{i + 1}</span>
          <NumberField value={p.x} unit="mm" step={0.5}
            onChange={(x) => setPoint(i, { x })} onCommit={onCommit} />
          <NumberField value={p.y} unit="mm" step={0.5}
            onChange={(y) => setPoint(i, { y })} onCommit={onCommit} />
          <button
            type="button" title="Eliminar vértice" disabled={points.length <= 2}
            onClick={() => { onChange(points.filter((_, j) => j !== i)); onCommit() }}
          >✕</button>
        </div>
      ))}
    </div>
  )
}
