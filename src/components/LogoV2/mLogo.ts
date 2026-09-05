/**
 * ASCII "M" logo for LogoV2 / Star.
 *
 * The previous startup logo rendered an animated star. This version renders a
 * bold uppercase M built from block glyphs and paints it with a gradient that
 * cycles through blue, red, yellow and green over time.
 *
 * Everything in this module is a pure function so it can be unit tested
 * deterministically (time / phase are passed in instead of read from globals).
 */

/** Four anchor colors the gradient cycles through: blue, red, yellow, green. */
export const GRADIENT_STOPS: readonly string[] = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#facc15', // yellow
  '#22c55e', // green
]

/** A bold uppercase M, 9 columns wide, 7 rows tall. */
export const M_LOGO_GRID: readonly string[] = [
  '█       █',
  '██     ██',
  '█ █   █ █',
  '█  █ █  █',
  '█   █   █',
  '█   █   █',
  '█   █   █',
]

/** Time in ms to cycle once through the whole gradient. */
export const M_LOGO_PERIOD_MS = 5000

export const M_LOGO_WIDTH = M_LOGO_GRID.length > 0 ? M_LOGO_GRID[0].length : 0
export const M_LOGO_HEIGHT = M_LOGO_GRID.length

export type Rgb = { r: number; g: number; b: number }

/** Parse a #rrggbb hex color into RGB channels. */
export function hexToRgb(hex: string): Rgb {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

/** Convert RGB channels back to a #rrggbb hex string. */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Linear interpolation between two hex colors at t in [0, 1]. */
export function lerpColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const k = t < 0 ? 0 : t > 1 ? 1 : t
  return rgbToHex(
    ca.r + (cb.r - ca.r) * k,
    ca.g + (cb.g - ca.g) * k,
    ca.b + (cb.b - ca.b) * k,
  )
}

/**
 * Maps a gradient progress in [0, 1] plus a phase offset in [0, 1) to a color.
 *
 * The phase shifts which part of the blue -> red -> yellow -> green ramp a
 * given midpoint falls on, so advancing phase makes the colors flow smoothly
 * across the M (a full period returns to the starting hue).
 */
export function colorAtProgress(p: number, phase: number): string {
  const raw = ((p + phase) % 1 + 1) % 1
  const scaled = raw * GRADIENT_STOPS.length
  const i = Math.floor(scaled) % GRADIENT_STOPS.length
  const t = scaled - Math.floor(scaled)
  return lerpColor(
    GRADIENT_STOPS[i]!,
    GRADIENT_STOPS[(i + 1) % GRADIENT_STOPS.length]!,
    t,
  )
}

/** Maps a cell coordinate to a gradient progress in [0, 1] (diagonal sweep). */
function positionToProgress(x: number, y: number): number {
  const w = Math.max(1, M_LOGO_WIDTH - 1)
  const h = Math.max(1, M_LOGO_HEIGHT - 1)
  return (x / w + y / h) / 2
}

/** Phase offset (in [0, 1)) for a given wall-clock time in ms. */
export function phaseAtTime(time: number): number {
  const period = M_LOGO_PERIOD_MS
  return (((time % period) + period) % period) / period
}

export type MLoRowSegment = {
  text: string
  color: string | null
}

/**
 * Builds one row of the M as contiguous segments (merged by color).
 *
 * Spaces become segments with a null color (rendered without a fill), and
 * every `█` cell is colored from the rotating gradient.
 */
export function buildMLogoRow(y: number, phase: number): MLoRowSegment[] {
  const line = M_LOGO_GRID[y] ?? ''
  const segments: MLoRowSegment[] = []
  let buf = ''
  let bufColor: string | null = null
  for (let x = 0; x < line.length; x++) {
    const ch = line[x]!
    const color: string | null =
      ch === '█' ? colorAtProgress(positionToProgress(x, y), phase) : null
    if (color === bufColor) {
      buf += ch
    } else {
      if (buf.length > 0) segments.push({ text: buf, color: bufColor })
      buf = ch
      bufColor = color
    }
  }
  if (buf.length > 0) segments.push({ text: buf, color: bufColor })
  return segments
}

/**
 * Builds every row of the M at a given time.
 * @returns one MLoRowSegment array per row of the grid
 */
export function mLogoRowsAt(time: number): MLoRowSegment[][] {
  const phase = phaseAtTime(time)
  return M_LOGO_GRID.map((_, y) => buildMLogoRow(y, phase))
}