import { findObject } from '../core/doc'
import { warningsForObject } from '../core/warnings'
import { SCALE_PRESETS } from '../core/scalePresets'
import type { Obj } from '../core/types'
import { useDoc, useStore } from '../state/store'
import {
  BooleanField, InheritNumberField, NumberField, Row, SelectField, TextField,
} from './fields'
import { PointsField } from './PointsField'
import { ArcToggleField, type TextArc } from './ArcToggleField'
import { getAtPath, withPath } from './objectPath'
import { isFieldRelevant, sectionsFor, TYPE_LABELS, type Field } from './schema'

/**
 * Inspector generado a partir del esquema de parámetros. No hay un formulario
 * por tipo de objeto: añadir un tipo nuevo es declarar sus campos en
 * `schema.ts`, y los campos admiten rutas con puntos para llegar a las
 * subestructuras (`arc.mode`, `majorTicks.count`).
 */
export function Inspector() {
  const doc = useDoc()
  const selection = useStore((s) => s.selection)
  const update = useStore((s) => s.update)
  const patchObject = useStore((s) => s.patchObject)
  const endEdit = useStore((s) => s.endEdit)

  const obj = selection.length === 1 ? findObject(doc, selection[0]) : null

  if (!obj) {
    return (
      <aside className="panel inspector">
        <h2>Inspector</h2>
        <p className="empty">
          {selection.length > 1
            ? 'Selección múltiple: la edición por parámetros actúa sobre un objeto cada vez.'
            : 'Selecciona un objeto en la lista o en el panel.'}
        </p>
      </aside>
    )
  }

  const record = obj as unknown as Record<string, unknown>
  const warnings = warningsForObject(doc, obj)

  /** Aplica un cambio por ruta, conservando el resto del objeto. */
  const setPath = (path: string, value: unknown, txKey: string) => {
    if (!path.includes('.')) {
      patchObject(obj.id, { [path]: value } as Partial<Obj>, txKey)
      return
    }
    update((d) => ({
      ...d,
      objects: mapTree(d.objects, obj.id, (o) => withPath(o, path, value)),
    }), txKey)
  }

  return (
    <aside className="panel inspector">
      <h2>{TYPE_LABELS[obj.type]}</h2>
      {warnings.length > 0 && (
        <ul className="warnings">
          {warnings.map((w, i) => (
            <li key={i} className={w.level}>{w.message}</li>
          ))}
        </ul>
      )}
      {sectionsFor(obj.type).map((section) => {
        const fields = section.fields.filter((f) => isFieldRelevant(obj.type, f.key, record))
        if (fields.length === 0) return null
        return (
          <section key={section.title}>
            <h3>{section.title}</h3>
            {fields.map((field) => (
              <FieldView
                key={field.key}
                field={field}
                obj={obj}
                value={readField(record, field.key)}
                inherited={field.key === 'depthMm' ? doc.tool.defaultDepthMm : 0}
                onChange={(value, txKey) => writeField(field.key, value, setPath, txKey)}
                onCommit={endEdit}
              />
            ))}
          </section>
        )
      })}
    </aside>
  )
}

/**
 * Campo virtual: la lista explícita de etiquetas se edita como texto separado
 * por comas, pero se guarda como array (o `null` para usar el rango numérico).
 */
const VALUES_TEXT = 'labels.valuesText'

function readField(record: Record<string, unknown>, key: string): unknown {
  if (key === VALUES_TEXT) {
    const values = getAtPath(record, 'labels.values') as string[] | null
    return values === null || values === undefined ? '' : values.join(', ')
  }
  return getAtPath(record, key)
}

function writeField(
  key: string, value: unknown,
  setPath: (path: string, value: unknown, txKey: string) => void,
  txKey: string,
) {
  if (key === VALUES_TEXT) {
    const text = String(value)
    const values = text.trim() === '' ? null : text.split(',').map((s) => s.trim())
    setPath('labels.values', values, txKey)
    return
  }
  setPath(key, value, txKey)
}

function mapTree(objects: Obj[], id: string, fn: (obj: Obj) => Obj): Obj[] {
  return objects.map((o) => {
    if (o.id === id) return fn(o)
    if (o.type === 'group') return { ...o, children: mapTree(o.children, id, fn) }
    return o
  })
}

interface FieldViewProps {
  field: Field
  obj: Obj
  value: unknown
  inherited: number
  onChange: (value: unknown, txKey: string) => void
  onCommit: () => void
}

function FieldView({ field, obj, value, inherited, onChange, onCommit }: FieldViewProps) {
  // La clave de transacción agrupa las pulsaciones sobre este campo concreto en
  // una sola entrada de deshacer.
  const txKey = `${obj.id}.${field.key}`

  switch (field.kind) {
    case 'number':
      return (
        <Row label={field.label} help={field.help}>
          <NumberField
            value={Number(value) || 0}
            unit={field.unit} min={field.min} max={field.max} step={field.step}
            onChange={(v) => onChange(v, txKey)}
            onCommit={onCommit}
          />
        </Row>
      )
    case 'inherit-number':
      return (
        <Row label={field.label} help={field.help}>
          <InheritNumberField
            value={value === null || value === undefined ? null : Number(value)}
            inheritedValue={inherited}
            inheritLabel={field.inheritLabel}
            unit={field.unit} min={field.min} max={field.max} step={field.step}
            onChange={(v) => onChange(v, txKey)}
            onCommit={onCommit}
          />
        </Row>
      )
    case 'text':
      return (
        <Row label={field.label} help={field.help}>
          <TextField value={String(value ?? '')} onChange={(v) => onChange(v, txKey)} onCommit={onCommit} />
        </Row>
      )
    case 'boolean':
      return (
        <Row label={field.label} help={field.help}>
          <BooleanField value={Boolean(value)} onChange={(v) => onChange(v, txKey)} />
        </Row>
      )
    case 'select':
      return (
        <Row label={field.label} help={field.help}>
          <SelectField
            value={String(value ?? '')}
            options={field.options}
            onChange={(v) => onChange(v, txKey)}
          />
        </Row>
      )
    case 'points':
      return (
        <PointsField
          label={field.label}
          points={(value as { x: number; y: number }[]) ?? []}
          onChange={(v) => onChange(v, txKey)}
          onCommit={onCommit}
        />
      )
    case 'arc-toggle':
      return (
        <ArcToggleField
          label={field.label}
          help={field.help}
          value={(value as TextArc | null) ?? null}
          onChange={(v) => onChange(v, txKey)}
          onCommit={onCommit}
        />
      )
    case 'scale-preset':
      return <ScalePresetField obj={obj} />
  }
}

/**
 * Los presets sustituyen los ajustes de la escala pero conservan su posición,
 * su nombre y su capa: son un punto de partida, no un objeto nuevo.
 */
function ScalePresetField({ obj }: { obj: Obj }) {
  const update = useStore((s) => s.update)

  return (
    <div className="preset-list">
      {SCALE_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          title={preset.description}
          onClick={() => update((d) => ({
            ...d,
            // Solo una escala admite estos ajustes; el guardado estrecha el tipo.
            objects: mapTree(d.objects, obj.id, (o) =>
              (o.type === 'scale' ? { ...o, ...preset.settings } : o)),
          }))}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}
