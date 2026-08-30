# Prueba de humo de CAM

**Criterio de salida de M0.** El riesgo mayor del proyecto no es la geometría: es que la CAM
no lea el SVG como esperamos. Que Inkscape mida bien en mm no prueba nada sobre Carbide Create.

Estos ficheros se regeneran con:

```bash
npm run cam-smoke
```

## Contenido

Cotas redondas y deliberadamente escasas, para que cualquier desviación salte a la vista:

| Elemento | Cota | Posición del centro | Capa |
|---|---|---|---|
| Línea horizontal | 10.0000 mm de largo | de (20, 20) a (30, 20) | `engrave-lines` |
| Círculo grabado | Ø 20.0000 mm | (50, 35) | `engrave-lines` |
| Taladro | Ø 9.0000 mm | (80, 20) | `drill` |
| Contorno del panel | 100 × 60 mm | — | `panel-outline` |

Tres variantes para contrastar convenciones:

- `cam-smoke.svg` — origen arriba-izquierda, taladro como círculo de diámetro real.
- `cam-smoke-flipY.svg` — origen abajo-izquierda, Y hacia arriba.
- `cam-smoke-drill-points.svg` — taladro como punto central (círculo degenerado).

## Checklist

Abrir `cam-smoke.svg` en la CAM real y anotar las respuestas. **Las respuestas fijan las
convenciones definitivas del serializador**; si algo falla se corrige ahora y no al final.

- [ ] ¿La línea mide 10 mm y el círculo 20 mm de diámetro? (si no: la CAM ignora `width`/`height`
      en mm y asume px o pulgadas → habrá que revisar el `viewBox`)
- [ ] ¿Distingue los cuatro grupos como entidades separadas?
- [ ] ¿Muestra los nombres de `inkscape:label`, o solo los `id`, o ninguno?
- [ ] Si no distingue grupos, ¿permite seleccionar por color? (es la razón de que cada capa
      lleve el suyo)
- [ ] ¿Trata la línea abierta como trazo a seguir (grabado centerline) y el círculo cerrado
      como contorno/región?
- [ ] ¿Respeta el `stroke-width`, o lo ignora? (debe ignorarlo: el ancho real lo da la
      profundidad)
- [ ] ¿La posición vertical es la esperada, o hace falta `cam-smoke-flipY.svg`?
- [ ] Para el taladro, ¿prefiere el círculo de Ø9 o el punto central?
- [ ] ¿Sobrevive el comentario de cabecera, o hay que moverlo a un `<desc>`?

## Resultados

> Rellenar tras la prueba. Anotar programa y versión.

- CAM y versión:
- Fecha:
- Notas:
