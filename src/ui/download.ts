import type { Doc } from '../core/types'
import { buildDocument } from '../core/build'
import { toSvg, type ExportOptions } from '../core/render/toSvg'
import { EXPORT_GROUPS, EXPORT_GROUP_ORDER, groupOfPrimitive } from '../core/render/layers'

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // Revocar en el siguiente tick: Safari necesita que la URL siga viva al hacer clic.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const slug = (s: string): string =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'panel'

export function exportSvg(doc: Doc, options: ExportOptions) {
  download(`${slug(doc.name)}.svg`, toSvg(doc, buildDocument(doc), options), 'image/svg+xml')
}

/** Un fichero por capa, para asignar herramienta y profundidad por separado. */
export function exportSvgPerLayer(doc: Doc, options: ExportOptions) {
  const prims = buildDocument(doc)
  const present = new Set(prims.map(groupOfPrimitive))
  for (const gid of EXPORT_GROUP_ORDER) {
    if (!present.has(gid)) continue
    download(
      `${slug(doc.name)}-${EXPORT_GROUPS[gid].id}.svg`,
      toSvg(doc, prims, { ...options, groups: [gid] }),
      'image/svg+xml',
    )
  }
}

export function exportProject(doc: Doc) {
  download(`${slug(doc.name)}.fpd.json`, JSON.stringify(doc, null, 2), 'application/json')
}

export function pickProjectFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error('No se eligió ningún fichero'))
      file.text().then((text) => {
        try { resolve(JSON.parse(text)) } catch { reject(new Error('El fichero no es JSON válido')) }
      }, reject)
    }
    input.click()
  })
}
