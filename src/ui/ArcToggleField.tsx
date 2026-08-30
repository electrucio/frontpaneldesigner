import type { Mm } from '../core/types'
import { BooleanField, NumberField, Row, SelectField } from './fields'

export interface TextArc {
  radiusMm: Mm
  direction: 'convex' | 'concave'
}

const DEFAULT_ARC: TextArc = { radiusMm: 20, direction: 'convex' }

/** Curvado de texto: `null` = recto. Se activa con la casilla. */
export function ArcToggleField({ label, help, value, onChange, onCommit }: {
  label: string
  help?: string
  value: TextArc | null
  onChange: (value: TextArc | null) => void
  onCommit: () => void
}) {
  return (
    <>
      <Row label={label} help={help}>
        <BooleanField
          value={value !== null}
          onChange={(on) => { onChange(on ? DEFAULT_ARC : null); onCommit() }}
        />
      </Row>
      {value && (
        <>
          <Row label="Radio del arco">
            <NumberField
              value={value.radiusMm} unit="mm" min={0.1} step={1}
              onChange={(radiusMm) => onChange({ ...value, radiusMm })}
              onCommit={onCommit}
            />
          </Row>
          <Row label="Sentido" help="Convexo arquea el texto hacia arriba; cóncavo lo pone del revés, para leerlo desde dentro.">
            <SelectField
              value={value.direction}
              options={[
                { value: 'convex', label: 'Convexo (hacia arriba)' },
                { value: 'concave', label: 'Cóncavo (hacia abajo)' },
              ]}
              onChange={(direction) => { onChange({ ...value, direction: direction as TextArc['direction'] }); onCommit() }}
            />
          </Row>
        </>
      )}
    </>
  )
}
