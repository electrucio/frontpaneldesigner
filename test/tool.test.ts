import { describe, expect, it } from 'vitest'
import {
  depthForWidth, effectiveTip, fitCalibration, impliedIncludedAngleDeg,
  maxWidth, widthAtDepth, widthPerMm,
} from '../src/core/tool'
import { DEFAULT_TOOL } from '../src/core/doc'
import type { ToolProfile } from '../src/core/types'

const tool30: ToolProfile = { ...DEFAULT_TOOL }
const tool60: ToolProfile = { ...DEFAULT_TOOL, includedAngleDeg: 60 }

describe('modelo de la V-bit', () => {
  it('interpreta el angulo como TOTAL incluido', () => {
    // 30 grados incluidos => k = 2*tan(15) = 0.5359
    expect(widthPerMm(tool30)).toBeCloseTo(0.53590, 5)
    // Si se confundiera con el semiangulo, k seria el de 60 incluidos: 1.1547.
    expect(widthPerMm(tool60)).toBeCloseTo(1.15470, 5)
    expect(widthPerMm(tool60) / widthPerMm(tool30)).toBeGreaterThan(2)
  })

  it('reproduce la tabla ancho/profundidad del plan', () => {
    expect(widthAtDepth(tool30, 0.15)).toBeCloseTo(0.2804, 4)
    expect(widthAtDepth(tool30, 0.3)).toBeCloseTo(0.3608, 4)
    expect(widthAtDepth(tool30, 0.5)).toBeCloseTo(0.46795, 5)
    expect(widthAtDepth(tool30, 0.8)).toBeCloseTo(0.62872, 5)
  })

  it('convierte ancho y profundidad en los dos sentidos', () => {
    for (const d of [0, 0.1, 0.35, 0.8, 2]) {
      expect(depthForWidth(tool30, widthAtDepth(tool30, d))).toBeCloseTo(d, 9)
    }
  })

  it('no promete anchos por debajo de la punta', () => {
    expect(depthForWidth(tool30, 0.1)).toBe(0)
    expect(widthAtDepth(tool30, 0)).toBeCloseTo(0.2, 9)
    expect(widthAtDepth(tool30, -1)).toBeCloseTo(0.2, 9)
  })

  it('maxWidth usa la profundidad maxima', () => {
    expect(maxWidth(tool30)).toBeCloseTo(widthAtDepth(tool30, tool30.maxDepthMm), 9)
  })
})

describe('calibracion empirica', () => {
  it('recupera exactamente una recta conocida', () => {
    const samples = [0.2, 0.4, 0.6].map((depthMm) => ({ depthMm, widthMm: 0.24 + 0.61 * depthMm }))
    const fit = fitCalibration(samples)!
    expect(fit.tipEffMm).toBeCloseTo(0.24, 9)
    expect(fit.kPerMm).toBeCloseTo(0.61, 9)
    expect(fit.maxResidualMm).toBeLessThan(1e-9)
    expect(fit.r2).toBeCloseTo(1, 9)
  })

  it('la calibracion sustituye a los valores nominales', () => {
    const calibrated: ToolProfile = {
      ...tool30,
      calibration: { tipEffMm: 0.24, kPerMm: 0.61, measuredAt: '2026-01-01T00:00:00Z', samples: [] },
    }
    expect(effectiveTip(calibrated)).toBe(0.24)
    expect(widthPerMm(calibrated)).toBe(0.61)
    expect(widthAtDepth(calibrated, 0.5)).toBeCloseTo(0.545, 9)
  })

  it('rechaza medidas insuficientes o sin variacion de profundidad', () => {
    expect(fitCalibration([])).toBeNull()
    expect(fitCalibration([{ depthMm: 0.3, widthMm: 0.36 }])).toBeNull()
    expect(fitCalibration([
      { depthMm: 0.3, widthMm: 0.36 },
      { depthMm: 0.3, widthMm: 0.37 },
    ])).toBeNull()
  })

  it('deduce el angulo real implicito en la pendiente medida', () => {
    expect(impliedIncludedAngleDeg(2 * Math.tan(Math.PI / 12))).toBeCloseTo(30, 9)
    expect(impliedIncludedAngleDeg(2 * Math.tan(Math.PI / 6))).toBeCloseTo(60, 9)
  })
})
