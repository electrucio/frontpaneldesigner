import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildDocument, PANEL_OBJECT_ID } from '../core/build'
import { primitiveShape } from '../core/render/pathData'
import { EXPORT_GROUPS, groupOfPrimitive } from '../core/render/layers'
import { widthAtDepth } from '../core/tool'
import type { Primitive } from '../core/primitives'
import type { Doc } from '../core/types'
import { useDoc, useStore } from '../state/store'

export type CanvasMode = 'appearance' | 'technical'

interface View {
  zoom: number
  tx: number
  ty: number
}

/**
 * Vista previa. Dibuja exactamente las mismas primitivas que exporta el
 * serializador, con el mismo generador de `d`; lo único que añade son la
 * rejilla, el resalte de selección y, en modo apariencia, los colores reales
 * del panel para que se parezca a la pieza acabada.
 *
 * A diferencia del SVG exportado, aquí sí se usa `transform`: es una capa de
 * presentación, no el fichero de mecanizado.
 */
export function Canvas({ mode }: { mode: CanvasMode }) {
  const doc = useDoc()
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)

  const ref = useRef<SVGSVGElement | null>(null)
  const [view, setView] = useState<View>({ zoom: 1, tx: 20, ty: 20 })
  // Se queda en cero hasta que el ResizeObserver mide de verdad: encuadrar
  // contra un tamaño supuesto daba un zoom equivocado en el primer render.
  const [size, setSize] = useState({ w: 0, h: 0 })

  const primitives = useMemo(() => buildDocument(doc), [doc])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fit = useCallback(() => {
    const margin = 40
    const zoom = Math.min(
      (size.w - margin * 2) / doc.panel.w,
      (size.h - margin * 2) / doc.panel.h,
    )
    const z = Math.max(0.2, zoom)
    setView({
      zoom: z,
      tx: (size.w - doc.panel.w * z) / 2,
      ty: (size.h - doc.panel.h * z) / 2,
    })
  }, [doc.panel.w, doc.panel.h, size.w, size.h])

  // Encuadre inicial en cuanto se conoce el tamaño real del lienzo.
  const fitted = useRef(false)
  useEffect(() => {
    if (!fitted.current && size.w > 0 && size.h > 0) { fitted.current = true; fit() }
  }, [fit, size.w])

  const onWheel = (e: React.WheelEvent) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = Math.exp(-e.deltaY * 0.0015)
    const zoom = Math.min(80, Math.max(0.2, view.zoom * factor))
    const k = zoom / view.zoom
    // Mantiene fijo el punto del documento que hay bajo el cursor.
    setView({ zoom, tx: mx - (mx - view.tx) * k, ty: my - (my - view.ty) * k })
  }

  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
    if (d.moved) setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (d?.moved) return
    // Un clic sin arrastre selecciona el objeto que hay debajo.
    const id = (e.target as Element).getAttribute?.('data-object-id')
    select(id && id !== PANEL_OBJECT_ID ? [id] : [])
  }

  const px = 1 / view.zoom // un píxel de pantalla, en mm de documento

  return (
    <div className="canvas-wrap">
      <svg
        ref={ref}
        className="canvas"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.zoom})`}>
          <rect
            x={0} y={0} width={doc.panel.w} height={doc.panel.h}
            rx={doc.panel.cornerRadiusMm}
            fill={mode === 'appearance' ? doc.panel.background : '#ffffff'}
            stroke={mode === 'appearance' ? '#000000' : '#c8c8d0'}
            strokeWidth={px}
          />
          <Grid panel={doc.panel} px={px} zoom={view.zoom} mode={mode} />
          <EdgeMargin panel={doc.panel} px={px} />
          {primitives.filter((p) => visibleIn(p, mode)).map((p, i) => (
            <PrimitiveView
              key={`${p.objectId}-${i}`}
              prim={p}
              doc={doc}
              mode={mode}
              px={px}
              selected={selection.includes(p.objectId)}
            />
          ))}
        </g>
      </svg>

      <div className="canvas-hud">
        <button type="button" onClick={fit}>Encuadrar</button>
        <span className="zoom-readout">{Math.round(view.zoom * 100) / 100}× · 1 mm = {(view.zoom).toFixed(1)} px</span>
      </div>
    </div>
  )
}

/**
 * En modo apariencia el contorno del panel ya lo dibuja el `<rect>` de fondo:
 * repetirlo como primitiva solo añadiría una línea negra sobre fondo negro.
 */
const visibleIn = (p: Primitive, mode: CanvasMode): boolean =>
  !(mode === 'appearance' && p.layer === 'panel')

function Grid({ panel, px, zoom, mode }: {
  panel: Doc['panel']; px: number; zoom: number; mode: CanvasMode
}) {
  const minor = zoom > 6 // la rejilla de 1 mm solo aparece con zoom suficiente
  const color = mode === 'appearance' ? '#ffffff' : '#000000'
  const lines: React.ReactElement[] = []

  const push = (step: number, opacity: number) => {
    for (let x = step; x < panel.w; x += step) {
      lines.push(<line key={`v${step}-${x}`} x1={x} y1={0} x2={x} y2={panel.h}
        stroke={color} strokeWidth={px} opacity={opacity} />)
    }
    for (let y = step; y < panel.h; y += step) {
      lines.push(<line key={`h${step}-${y}`} x1={0} y1={y} x2={panel.w} y2={y}
        stroke={color} strokeWidth={px} opacity={opacity} />)
    }
  }

  if (minor) push(1, 0.06)
  push(10, 0.16)
  return <g className="grid" pointerEvents="none">{lines}</g>
}

/** Margen de seguridad al borde; el DRC avisará de la geometría que lo invada. */
function EdgeMargin({ panel, px }: { panel: Doc['panel']; px: number }) {
  if (panel.edgeMarginMm <= 0) return null
  return (
    <rect
      x={panel.edgeMarginMm} y={panel.edgeMarginMm}
      width={Math.max(0, panel.w - panel.edgeMarginMm * 2)}
      height={Math.max(0, panel.h - panel.edgeMarginMm * 2)}
      fill="none" stroke="#ff9f43" strokeWidth={px} strokeDasharray={`${px * 4} ${px * 4}`}
      opacity={0.5} pointerEvents="none"
    />
  )
}

function PrimitiveView({ prim, doc, mode, px, selected }: {
  prim: Primitive; doc: Doc; mode: CanvasMode; px: number; selected: boolean
}) {
  const shape = primitiveShape(prim)
  if (!shape) return null

  const group = EXPORT_GROUPS[groupOfPrimitive(prim)]
  const filled = group.filled

  // En modo apariencia el grabado se pinta del color real de la pieza y con el
  // ancho de surco que dará la profundidad programada; en modo técnico manda
  // el color de la capa de exportación.
  const color = mode === 'appearance' ? appearanceColor(prim, doc) : group.color
  const realWidth = prim.layer === 'engrave' ? widthAtDepth(doc.tool, prim.depthMm) : 0.15
  // Nunca por debajo de un píxel: si no, con poco zoom el trazo desaparece.
  const strokeWidth = Math.max(realWidth, px)

  const common = {
    'data-object-id': prim.objectId,
    className: selected ? 'prim selected' : 'prim',
  }

  const paint = filled
    ? { fill: color, stroke: 'none' }
    : { fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  const halo = selected
    ? { fill: 'none', stroke: '#4c9aff', strokeWidth: strokeWidth + px * 4, opacity: 0.55 }
    : null

  return (
    <>
      {halo && (shape.as === 'circle'
        ? <circle cx={shape.cx} cy={shape.cy} r={shape.r} pointerEvents="none" {...halo} />
        : <path d={shape.d} pointerEvents="none" {...halo} />)}
      {shape.as === 'circle'
        ? <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...paint} {...common} />
        : <path d={shape.d} {...paint} {...common} />}
    </>
  )
}

function appearanceColor(prim: Primitive, doc: Doc): string {
  switch (prim.layer) {
    case 'engrave': return doc.panel.engraveColor
    case 'drill':
    case 'cut': return '#8a8a8a'
    case 'panel': return '#000000'
  }
}
