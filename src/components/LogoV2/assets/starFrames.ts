/**
 * ASCII assets for the logo star (LogoV2 / CondensedLogo / WelcomeV2).
 *
 * "North star / compass" design: a core (★, orange claude) surrounded by
 * rays (✦/✧/angles, animated claude blue). Every pose is exactly 3 rows
 * x 9 columns - a layout constraint (AnimatedStar STAR_HEIGHT=3, test
 * challenger2_empirical) and a width constraint (CondensedLogo budgets ~11
 * columns for the star + gap + padding).
 *
 * Coloring is done by glyph role (see {@link STAR_GLYPH_ROLE}) and then split
 * into contiguous segments by {@link rowToStarSegments}.
 */

export type StarPose = 'default' | 'flare' | 'spin-45' | 'sparkle-burst'

export type StarSegments = {
  row1: string
  row2: string
  row3: string
}

/**
 * Star poses - 3 rows x 9 columns.
 *
 * - default       : compass star (vertical ★ + horizontal ★★★, ✦ at the ends).
 * - flare         : full bright star (thick diamond).
 * - spin-45       : rotating star (◤◥◣◢ angles suggest movement).
 * - sparkle-burst  : star with diagonal ✦ sparkles.
 */
export const STAR_POSES: Record<StarPose, StarSegments> = {
  //      0123456789
  default: {
    row1: '  ✧ ✦ ✧  ',
    row2: ' ✦ ★★★ ✦ ',
    row3: '  ✧ ✦ ✧  ',
  },
  flare: {
    row1: '  ✦ ★ ✦  ',
    row2: ' ★★★★★★★ ',
    row3: '  ✦ ★ ✦  ',
  },
  'spin-45': {
    row1: '  ⋰ ✦ ⋱  ',
    row2: ' ✧ ★★★ ✧ ',
    row3: '  ⋱ ✦ ⋰  ',
  },
  'sparkle-burst': {
    row1: '✧ ✹ ★ ✹ ✧',
    row2: '  ✹★★★✹  ',
    row3: '✧ ✹ ★ ✹ ✧',
  },
}

/**
 * Apple Terminal variant - same shapes. Kept for parity with the previous
 * rendering which differentiated Apple terminals.
 */
export const APPLE_STAR_POSES: Record<StarPose, StarSegments> = {
  default: STAR_POSES.default,
  flare: STAR_POSES.flare,
  'spin-45': STAR_POSES['spin-45'],
  'sparkle-burst': STAR_POSES['sparkle-burst'],
}

/**
 * Color role per glyph.
 * - 'core' : star core -> orange `claude` color (static).
 * - 'ray'  : rays/sparkles -> animated color (claudeBlue via intensityToColor).
 * - 'none' : spaces and unlisted glyphs -> no color (terminal background).
 */
export const STAR_GLYPH_ROLE: Record<string, 'core' | 'ray' | 'none'> = {
  '★': 'core',
  '█': 'core',
  '✦': 'ray',
  '✧': 'ray',
  '◤': 'ray',
  '◥': 'ray',
  '◣': 'ray',
  '◢': 'ray',
  '✹': 'ray',
  '⋰': 'ray',
  '⋱': 'ray',
}

export type StarRowSegment = {
  text: string
  role: 'core' | 'ray' | 'none'
}

/**
 * Splits a pose row into contiguous segments by color role.
 * Preserves the exact width: spaces form 'none' segments which are rendered
 * without a color (Text without color prop).
 *
 * @example
 * rowToStarSegments('✦  ★★★  ✦')
 * // → [{text:'✦',role:'ray'},{text:'  ',role:'none'},{text:'★★★',role:'core'},{text:'  ',role:'none'},{text:'✦',role:'ray'}]
 */
export function rowToStarSegments(line: string): StarRowSegment[] {
  const segments: StarRowSegment[] = []
  let buf = ''
  let bufRole: 'core' | 'ray' | 'none' | null = null
  for (const ch of line) {
    const role: 'core' | 'ray' | 'none' = STAR_GLYPH_ROLE[ch] ?? 'none'
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