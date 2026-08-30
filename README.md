# Front Panel Designer

Aplicación web para diseñar **paramétricamente** paneles frontales de amplificador y exportarlos
como **SVG listo para CAM**, pensada para grabado con fresa en V.

- Nada de ratón: cada objeto se define con números (mm, grados). El lienzo es vista previa y
  selección, no editor por arrastre.
- Pipeline único: `Doc → build/* → Primitive[] → (preview | export | DRC)`. La vista previa dibuja
  exactamente la misma geometría que se exporta, con el mismo generador de `d`.
- La herramienta forma parte del modelo: el perfil real de la V-bit gobierna el ancho de trazo del
  preview, la profundidad de cada objeto y (más adelante) las comprobaciones de fabricabilidad.

```bash
npm install
npm run dev        # editor en http://localhost:5173
npm test           # núcleo geométrico
npm run build      # build de producción
npm run cam-smoke  # regenera los ficheros de la prueba de humo de CAM
```

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| M0 | Esqueleto, esquema, pipeline, exportación, lienzo, historial, persistencia | hecho |
| M1 | Polilínea, rectángulo, círculo, arco, agujero, grupos, inspector por esquema | hecho |
| M2 | Texto Hershey de línea única, avisos, asistente de calibración de la fresa | hecho |
| M2.5 / M3 | Escala circular completa con cinco presets | hecho |
| M2b | Texto de contornos (opentype.js) para rótulos grandes | pendiente |
| M4 | Importación de logotipo SVG | pendiente |
| M5 | DRC completo, plantillas de estación de mando, biblioteca | pendiente |

## CAM: usa EasyShape5000

El SVG exportado está pensado para [EasyShape5000](https://cam.eltryus.design/easyshape5000/), no para
un CAM de aislamiento de PCB. La diferencia importa: pasado por EasyTrace5000 (la aplicación de PCB de
la misma suite), el fichero de prueba salió con **seis contornos de aislamiento alrededor del borde del
panel**, la línea de 10 mm convertida en una pista de atletismo, y el círculo y el taladro
**desaparecidos** — porque aquel importador ignora los elementos `<circle>`.

De ahí dos consecuencias permanentes:

- La exportación **nunca emite `<circle>`** ni ningún otro elemento de forma: todo son `<path>`, y hay
  un test que lo fija. Un círculo sale como dos semiarcos.
- La operación correcta en EasyShape5000 es **Engraving**, que sigue la línea sin offset («the tool
  centre follows the line») y trata igual los caminos abiertos y los cerrados. El `stroke-width` del
  SVG no interviene en la trayectoria: el ancho real del surco lo da la profundidad.

El checklist de [test/cam-smoke/README.md](test/cam-smoke/README.md) sigue sirviendo para comprobar qué
entiende un CAM concreto de nuestro fichero.

## La V-bit

El ancho del surco a profundidad `d` es `w(d) = punta + 2·d·tan(θ/2)`, con **θ = ángulo TOTAL
incluido**. Con 30° incluidos el factor es 0.536 mm/mm; si la fresa fuera de 30° *por lado*
(60° incluidos) sería 1.155, más del doble. De ahí que el campo se llame `includedAngleDeg` y que la
interfaz lo etiquete sin ambigüedad.

| Profundidad | 0.15 mm | 0.30 mm | 0.50 mm | 0.80 mm |
|---|---|---|---|---|
| Ancho de trazo (30° incl., punta 0.2) | 0.28 mm | 0.36 mm | 0.47 mm | 0.63 mm |

La calculadora de la interfaz se pilota **por ancho**: se pide el trazo que se quiere y la
profundidad se deriva. Cuando exista calibración empírica (M2), sus coeficientes sustituyen a los
nominales y absorben el ángulo real, el desgaste y una punta que casi nunca mide lo que dice el
fabricante.

## Convenciones

**Coordenadas.** Origen arriba-izquierda del panel, X a la derecha, Y hacia abajo (como SVG). La
exportación puede invertir Y si la CAM lo pide.

**Ángulos.** 0° = las 12 en punto, positivo en sentido horario. Es la convención natural para
describir un mando; no es el ángulo matemático estándar.

**SVG de salida.** 1 unidad de usuario = 1 mm. Sin `transform`, sin `<text>`, sin `<use>`, sin CSS:
solo `<path>` y `<circle>` con coordenadas absolutas ya horneadas. Grupos de primer nivel con `id`,
`inkscape:label` y **un color propio por capa** — redundancia deliberada, porque el color es el
criterio de selección que respetan casi todas las CAM cuando ignoran los grupos.

| Grupo | Color | Contenido |
|---|---|---|
| `panel-outline` | azul | contorno exterior del panel |
| `engrave-fill` | magenta | regiones cerradas para V-carving |
| `engrave-lines` | negro | trazos abiertos a seguir con la V-bit |
| `cut` | rojo | contornos pasantes |
| `drill` | verde | taladros |

El `stroke-width` del SVG es **nominal**: el ancho real del surco lo fija la profundidad programada
en la CAM. Las coordenadas de `cut` y `drill` son la **línea nominal**, no el borde acabado; la CAM
debe aplicar el offset del radio de herramienta.

## Estructura

```
src/core/      TypeScript puro, sin DOM — todo lo testeable vive aquí
  types.ts     esquema del documento (serializable, versionado)
  tool.ts      modelo de la V-bit: ancho ↔ profundidad, calibración
  geometry/    vectores, matrices, coordenadas polares
  primitives.ts  polyline · circle · arc · contour · region
  text/        fuentes Hershey de línea única y maquetación
  build/       documento → primitivas (formas, texto, escala)
  render/      primitivas → SVG (y el mismo generador de `d` para el lienzo)
  warnings.ts  avisos por objeto; semilla del DRC
src/state/     historial con coalescencia, autoguardado en IndexedDB
src/ui/        lienzo, árbol de objetos, inspector generado por esquema
src/assets/fonts/hershey.json   generado por `npm run build:hershey`
```

## Texto

Las fuentes son **Hershey de línea única**: el surco *es* la letra. Una fuente de contornos a 2 mm
saldría con doble trazo y se cerraría sola. El tamaño se pide como **altura de mayúscula en
milímetros**, que es lo que se mide con el calibre, y la conversión usa la altura real de cada familia
medida en `scripts/build-hershey.ts`, de modo que 3 mm son 3 mm en las seis.

Dos avisos que la interfaz da y conviene conocer: Hershey solo cubre **ASCII imprimible**, así que
«Ω», «µ», «°» o «ñ» no existen y se señalan en vez de perderse en silencio; y un surco demasiado
grueso para el tamaño de letra emborrona el resultado.

Los tests hacen snapshot de `Primitive[]`, no de la cadena SVG: el string es frágil a cambios de
formato y daría rojos falsos. Solo dos snapshots de cadena, y exclusivamente para el serializador.
