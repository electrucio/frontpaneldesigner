/**
 * Formato numérico del SVG exportado: 4 decimales, sin ceros de relleno, sin
 * notación científica y sin `-0` (hay CAM que lo leen mal).
 */
export function fmt(n: number, decimals = 4): string {
  if (!Number.isFinite(n)) throw new Error(`Coordenada no finita en la exportación: ${n}`)
  let s = n.toFixed(decimals)
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return s === '-0' ? '0' : s
}

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Los comentarios XML no admiten `--` en su interior. */
export const escComment = (s: string): string => s.replace(/--+/g, '-')
