/**
 * Lectura y escritura por ruta con puntos (`arc.mode`, `majorTicks.count`).
 *
 * El esquema de parámetros describe campos planos, pero objetos como la escala
 * agrupan sus opciones en subestructuras. Con esto el inspector sigue siendo
 * declarativo en vez de necesitar un formulario a medida por objeto anidado.
 */

export function getAtPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, key) => (acc == null ? undefined : (acc as Record<string, unknown>)[key]),
    obj,
  )
}

/** Copia con el valor cambiado. No muta nada por el camino. */
export function withPath<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.')
  const record = obj as unknown as Record<string, unknown>
  return {
    ...record,
    [head]: rest.length === 0 ? value : withPath(record[head] ?? {}, rest.join('.'), value),
  } as T
}
