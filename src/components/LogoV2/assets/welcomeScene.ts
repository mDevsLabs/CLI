/**
 * ASCII assets for the welcome scene (WelcomeV2 / onboarding).
 *
 * Design: a large 13x7 "polar" star centered in a 58-column frame
 * (WELCOME_SCENE_WIDTH), surrounded by a diamond-shaped halo of sparkles
 * (✦/✧) and two dotted lines. Coloring is done by glyph role (see
 * {@link WELCOME_GLYPH_ROLE}) then split into segments by
 * {@link rowToWelcomeSegments}.
 *
 * A single scene serves all 4 variants (dark/light x normal/Apple Terminal):
 * only the colors change, never the layout. This removes the duplication
 * of the former inline blocks.
 */

export const WELCOME_SCENE_WIDTH = 58

/**
 * Color role per glyph.
 * - 'core'    : core █████ → orange `claude` (static, pulsing).
 * - 'star'    : ★ mid stars → `claudeShimmer`.
 * - 'ray'     : ✦ rays → animated `claudeBlue` (intensityToColor).
 * - 'sparkle' : ✧ halo → dimColor.
 * - 'dot'     : … lines → dimColor.
 * - 'none'    : spaces → no color.
 */
export const WELCOME_GLYPH_ROLE: Record<
  string,
  'core' | 'star' | 'ray' | 'sparkle' | 'dot' | 'none'
> = {
  '★': 'star',
  '█': 'core',
  '✦': 'ray',
  '✧': 'sparkle',
  '…': 'dot',
}

export type WelcomeSegment = {
  text: string
  role: 'core' | 'star' | 'ray' | 'sparkle' | 'dot' | 'none'
}

// Large 13x7 star, left-aligned (centered later by padLine).
const STAR_ROWS = [
  '      ✦      ', // 6sp + ✦ + 6sp  (pointe haute)
  '    ✦ ★ ✦    ', // 4sp + ✦ sp ★ sp ✦ + 4sp
  '  ✦  ★★★  ✦  ', // 2sp + ✦ + 2sp + ★★★ + 2sp + ✦ + 2sp
  '★★  █████  ★★', // 2★ + 2sp + 5█ + 2sp + 2★  (cœur)
  '  ✦  ★★★  ✦  ',
  '    ✦ ★ ✦    ',
  '      ✦      ',
]

const STAR_W = 13 // star width

/**
 * Diamond-shaped halo around the star. Each entry = [rowIndex, col, glyph].
 * Positions are symmetric around the center (col 28.5 for width 58).
 * - ✦ at the 4 diamond tips (star rows 0 and 6, cols 14 and 43).
 * - ✧ at the side midpoints (rows 1 and 5, cols 18 and 39).
 */
const HALO: Array<{ starRow: number; col: number; glyph: string }> = [
  { starRow: 0, col: 14, glyph: '✦' },
  { starRow: 0, col: 43, glyph: '✦' },
  { starRow: 1, col: 18, glyph: '✧' },
  { starRow: 1, col: 39, glyph: '✧' },
  { starRow: 5, col: 18, glyph: '✧' },
  { starRow: 5, col: 39, glyph: '✧' },
  { starRow: 6, col: 14, glyph: '✦' },
  { starRow: 6, col: 43, glyph: '✦' },
]

/**
 * Builds a single WELCOME_SCENE_WIDTH-wide row from positioned content.
 * Fills the remainder with spaces. Guarantees the exact width.
 */
function padLine(
  width: number,
  placements: Array<{ col: number; text: string }>,
): string {
  const arr = new Array<string>(width).fill(' ')
  for (const p of placements) {
    for (let i = 0; i < p.text.length; i++) {
      const c = p.col + i
      if (c >= 0 && c < width) arr[c] = p.text[i]!
    }
  }
  return arr.join('')
}

/**
 * Builds the 11 scene rows (each WELCOME_SCENE_WIDTH wide).
 * Runs once at module load — the assets are static.
 */
function buildSceneRows(): string[] {
  const W = WELCOME_SCENE_WIDTH
  const leftPad = Math.floor((W - STAR_W) / 2) // 22
  const rows: string[] = []

  // Row 1: dots
  rows.push('…'.repeat(W))
  // Row 2: blank
  rows.push(' '.repeat(W))

  // Rows 3-9: star + halo
  for (let r = 0; r < STAR_ROWS.length; r++) {
    const placements: Array<{ col: number; text: string }> = [
      { col: leftPad, text: STAR_ROWS[r]! },
    ]
    for (const h of HALO) {
      if (h.starRow === r) {
        placements.push({ col: h.col, text: h.glyph })
      }
    }
    rows.push(padLine(W, placements))
  }

  // Row 10: blank
  rows.push(' '.repeat(W))
  // Row 11: dots
  rows.push('…'.repeat(W))

  return rows
}

export const WELCOME_SCENE_ROWS: string[] = buildSceneRows()

/**
 * Splits a scene row into contiguous color-role segments.
 * Preserves the exact width: spaces form 'none' segments.
 */
export function rowToWelcomeSegments(line: string): WelcomeSegment[] {
  const segments: WelcomeSegment[] = []
  let buf = ''
  let bufRole: WelcomeSegment['role'] | null = null
  for (const ch of line) {
    const role: WelcomeSegment['role'] = WELCOME_GLYPH_ROLE[ch] ?? 'none'
    if (role !== bufRole) {
      if (buf.length > 0 && bufRole !== null) {
        segments.push({ text: buf, role: bufRole })
      }
      buf = ch
      bufRole = role
    } else {
      buf += ch
    }
  }
  if (buf.length > 0 && bufRole !== null) {
    segments.push({ text: buf, role: bufRole })
  }
  return segments
}
