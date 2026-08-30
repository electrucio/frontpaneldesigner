import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Campos del inspector.
 *
 * Los numéricos mantienen el texto en curso en estado local para que se puedan
 * teclear valores intermedios ("-", "12.", "0.0") sin que el documento reciba
 * un NaN, y notifican cada cambio válido con una clave de transacción para que
 * el historial funda las pulsaciones en una sola entrada de deshacer.
 */

interface RowProps {
  label: string
  help?: string
  children: ReactNode
}

export function Row({ label, help, children }: RowProps) {
  return (
    <label className="row" title={help}>
      <span className="row-label">
        {label}
        {help && <span className="row-help" aria-hidden="true">?</span>}
      </span>
      <span className="row-control">{children}</span>
    </label>
  )
}

interface NumberFieldProps {
  value: number
  onChange: (value: number) => void
  onCommit?: () => void
  unit?: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}

export function NumberField({
  value, onChange, onCommit, unit, min, max, step = 1, disabled,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? formatNumber(value)

  // Último valor emitido por este campo. Sin esta distinción, escribir "12."
  // reformatearía el input a "12" en cuanto el documento aceptara el 12, y el
  // siguiente dígito daría "125" en vez de "12.5".
  const emitted = useRef<number | null>(null)

  // El borrador solo se descarta cuando el valor cambia POR FUERA: un deshacer,
  // una carga de proyecto o un recorte por `min`/`max`.
  useEffect(() => {
    if (emitted.current !== null && emitted.current === value) return
    setDraft(null)
  }, [value])

  const emit = (n: number) => {
    emitted.current = n
    onChange(n)
  }

  const clamp = (n: number) => {
    let out = n
    if (min !== undefined) out = Math.max(min, out)
    if (max !== undefined) out = Math.min(max, out)
    return out
  }

  return (
    <span className="number-field">
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        disabled={disabled}
        onChange={(e) => {
          const text = e.target.value
          setDraft(text)
          const parsed = Number(text.replace(',', '.'))
          if (text.trim() !== '' && Number.isFinite(parsed)) emit(clamp(parsed))
        }}
        onBlur={() => { setDraft(null); onCommit?.() }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { setDraft(null); onCommit?.(); (e.target as HTMLInputElement).blur() }
          if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur() }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
            setDraft(null)
            emit(clamp(round(value + delta)))
          }
        }}
      />
      {unit && <span className="unit">{unit}</span>}
    </span>
  )
}

interface InheritNumberFieldProps extends Omit<NumberFieldProps, 'value' | 'onChange'> {
  value: number | null
  inheritedValue: number
  inheritLabel: string
  onChange: (value: number | null) => void
}

/** Número con opción de heredar del documento (`null` = heredado). */
export function InheritNumberField({
  value, inheritedValue, inheritLabel, onChange, onCommit, ...rest
}: InheritNumberFieldProps) {
  const inherited = value === null
  return (
    <span className="inherit-field">
      <NumberField
        {...rest}
        value={inherited ? inheritedValue : value}
        disabled={inherited}
        onChange={onChange}
        onCommit={onCommit}
      />
      <label className="inherit-toggle">
        <input
          type="checkbox"
          checked={inherited}
          onChange={(e) => { onChange(e.target.checked ? null : inheritedValue); onCommit?.() }}
        />
        {inheritLabel}
      </label>
    </span>
  )
}

export function TextField({
  value, onChange, onCommit,
}: { value: string; onChange: (v: string) => void; onCommit?: () => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
    />
  )
}

export function SelectField<T extends string>({
  value, options, onChange,
}: { value: T; options: { value: string; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export function BooleanField({
  value, onChange,
}: { value: boolean; onChange: (v: boolean) => void }) {
  return <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
}

const round = (n: number): number => Math.round(n * 1e6) / 1e6

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return String(round(n))
}
