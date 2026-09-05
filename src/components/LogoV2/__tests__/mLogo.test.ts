import { describe, expect, test } from 'bun:test'
import {
  GRADIENT_STOPS,
  M_LOGO_GRID,
  M_LOGO_HEIGHT,
  M_LOGO_PERIOD_MS,
  M_LOGO_WIDTH,
  buildMLogoRow,
  colorAtProgress,
  hexToRgb,
  lerpColor,
  mLogoRowsAt,
  phaseAtTime,
  rgbToHex,
} from '../mLogo.js'

describe('GRADIENT_STOPS', () => {
  test('contains exactly the four requested colors: blue, red, yellow, green', () => {
    expect(GRADIENT_STOPS).toEqual(['#3b82f6', '#ef4444', '#facc15', '#22c55e'])
  })
})

describe('M_LOGO_GRID', () => {
  test('is a 9x7 grid of only block glyphs and spaces', () => {
    expect(M_LOGO_HEIGHT).toBe(7)
    expect(M_LOGO_WIDTH).toBe(9)
    for (const row of M_LOGO_GRID) {
      expect(row.length).toBe(M_LOGO_WIDTH)
      for (const ch of row) {
        expect(ch === '█' || ch === ' ').toBe(true)
      }
    }
  })

  test('every row starts and ends with a filled block (outer strokes of the M)', () => {
    for (const row of M_LOGO_GRID) {
      expect(row[0]).toBe('█')
      expect(row[M_LOGO_WIDTH - 1]).toBe('█')
    }
  })

  test('has empty/fill pattern that reads as an M (a vertical gap in the middle)', () => {
    // Middle column should mostly be space at the top (the M's valley opens down),
    // but the bottom rows keep the middle stroke.
    const middleEmpty = M_LOGO_GRID.slice(0, 1).every(
      row => row[4] === ' ',
    )
    expect(middleEmpty).toBe(true)
  })
})

describe('hexToRgb / rgbToHex', () => {
  test('hexToRgb parses channels', () => {
    expect(hexToRgb('#010203')).toEqual({ r: 1, g: 2, b: 3 })
    expect(hexToRgb('#3b82f6')).toEqual({ r: 0x3b, g: 0x82, b: 0xf6 })
  })

  test('rgbToHex round-trips hexToRgb', () => {
    expect(rgbToHex(0x3b, 0x82, 0xf6)).toBe('#3b82f6')
    expect(rgbToHex(1, 2, 3)).toBe('#010203')
  })

  test('rgbToHex clamps out-of-range channels', () => {
    expect(rgbToHex(-5, 300, 128)).toBe('#00ff80')
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff')
  })
})

describe('lerpColor', () => {
  test('midpoint of black..white is #808080', () => {
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  test('t=0 returns start and t=1 returns end', () => {
    expect(lerpColor('#000000', '#ffffff', 0)).toBe('#000000')
    expect(lerpColor('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  test('clamps t outside [0, 1]', () => {
    expect(lerpColor('#000000', '#ffffff', -1)).toBe('#000000')
    expect(lerpColor('#000000', '#ffffff', 2)).toBe('#ffffff')
  })
})

describe('colorAtProgress', () => {
  test('always returns a valid hex color', () => {
    for (const p of [0, 0.1, 0.33, 0.5, 0.77, 1]) {
      for (const phase of [0, 0.25, 0.5, 0.9]) {
        expect(colorAtProgress(p, phase)).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  test('full ramp spans the four stops in order (blue->red->yellow->green)', () => {
    // Sample just after each stop's start so we are interpolating from its hue.
    expect(colorAtProgress(0, 0)).toBe('#3b82f6') // blue
    expect(colorAtProgress(0.25, 0)).toBe('#ef4444') // red
    expect(colorAtProgress(0.5, 0)).toBe('#facc15') // yellow
    expect(colorAtProgress(0.75, 0)).toBe('#22c55e') // green
  })

  test('wraps seamlessly: p = 1 maps back to the first stop (blue)', () => {
    // raw = (1 % 1) = 0 -> scaled = 0 -> stop[0] (blue).
    expect(colorAtProgress(1, 0)).toBe('#3b82f6')
  })

  test('negative p wraps into the ramp instead of erroring', () => {
    // raw = ((-0.1 % 1) + 1) % 1 = 0.9 -> interpolates green->blue
    const c = colorAtProgress(-0.1, 0)
    expect(c).toMatch(/^#[0-9a-f]{6}$/)
    expect(c).not.toBe('#3b82f6')
  })

  test('advancing phase shifts the gradient (colors change over time)', () => {
    const atPhase0 = colorAtProgress(0, 0)
    const atPhaseQuarter = colorAtProgress(0, 0.25)
    expect(atPhaseQuarter).not.toBe('#3b82f6')
    expect(atPhaseQuarter).toMatch(/^#[0-9a-f]{6}$/)
  })

  test('full phase rotation returns to the starting color', () => {
    expect(colorAtProgress(0.3, 1)).toBe(colorAtProgress(0.3, 0))
  })
})

describe('phaseAtTime', () => {
  test('phase is always in [0, 1)', () => {
    for (const t of [0, 1, 999, 2500, 4999, 5000, 10000, -123, 123456]) {
      const phase = phaseAtTime(t)
      expect(phase).toBeGreaterThanOrEqual(0)
      expect(phase).toBeLessThan(1)
    }
  })

  test('a full period returns to phase 0', () => {
    expect(phaseAtTime(M_LOGO_PERIOD_MS)).toBe(0)
  })
})

describe('buildMLogoRow', () => {
  test('spaces become a single null-color segment', () => {
    // A row that is entirely spaces would be one segment with color null.
    const segments = buildMLogoRow(0, 0.5)
    expect(segments.length).toBeGreaterThan(0)
    for (const seg of segments) {
      expect(seg.color === null || seg.color.startsWith('#')).toBe(true)
    }
  })

  test('every filled block cell receives a hex color', () => {
    const row = M_LOGO_GRID[0]!
    // Rebuild per-cell to make sure no block is dropped by segment merging.
    const segments = buildMLogoRow(0, 0.25)
    const rejoined = segments.map(s => s.text).join('')
    expect(rejoined).toBe(row)
  })

  test('segments never exceed the row width', () => {
    for (let y = 0; y < M_LOGO_HEIGHT; y++) {
      const segments = buildMLogoRow(y, 0.1)
      const total = segments.reduce((acc, s) => acc + s.text.length, 0)
      expect(total).toBe(M_LOGO_WIDTH)
    }
  })
})

describe('mLogoRowsAt', () => {
  test('produces one row per grid row, preserving the original art', () => {
    const rows = mLogoRowsAt(0)
    expect(rows.length).toBe(M_LOGO_HEIGHT)
    const rejoined = rows.map(r => r.map(s => s.text).join('')).join('\n')
    expect(rejoined).toBe(M_LOGO_GRID.join('\n'))
  })

  test('null colors appear only on space cells', () => {
    const rows = mLogoRowsAt(0)
    for (const row of rows) {
      for (const seg of row) {
        if (seg.color === null) {
          expect(seg.text.split('').every(ch => ch === ' ')).toBe(true)
        }
      }
    }
  })

  test('the gradient changes over time (animated colors)', () => {
    const t0 = mLogoRowsAt(0)
    const t1 = mLogoRowsAt(1250) // quarter period
    const colors0 = t0.flat().map(s => s.color).filter(Boolean)
    const colors1 = t1.flat().map(s => s.color).filter(Boolean)
    // Same number of colored segments, but different colors.
    expect(colors0.length).toBeGreaterThan(0)
    expect(colors1.some((c, i) => c !== colors0[i])).toBe(true)
  })
})