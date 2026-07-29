/**
 * Assets ASCII pour l'étoile du logo (LogoV2 / CondensedLogo / WelcomeV2).
 *
 * Design « étoile polaire / compass » : un cœur (★, orange claude) entouré de
 * rayons (✦/✧/angles, bleu claude animé). Chaque pose fait exactement 3 lignes
 * × 9 colonnes — contrainte de layout (AnimatedStar STAR_HEIGHT=3, test
 * challenger2_empirical) et de largeur (CondensedLogo compte ~11 colonnes pour
 * l'étoile + gap + padding).
 *
 * La coloration se fait par rôle de glyphe (voir {@link STAR_GLYPH_ROLE}) puis
 * est découpée en segments contigus par {@link rowToStarSegments}.
 */

export type StarPose = 'default' | 'flare' | 'spin-45' | 'sparkle-burst'

export type StarSegments = {
  row1: string
  row2: string
  row3: string
}

/**
 * Poses de l'étoile — 3 lignes × 9 colonnes.
 *
 * - default       : étoile compass (★ verticale + ★★★ horizontale, ✦ aux bouts).
 * - flare         : étoile pleine brillante (losange épais).
 * - spin-45       : étoile en rotation (angles ◤◥◣◢ suggèrent le mouvement).
 * - sparkle-burst  : étoile + éclats diagonaux ✦.
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
 * Variante Apple Terminal — mêmes formes. Conservée pour la parité avec
 * l'ancien rendu qui différenciait les terminaux Apple.
 */
export const APPLE_STAR_POSES: Record<StarPose, StarSegments> = {
  default: STAR_POSES.default,
  flare: STAR_POSES.flare,
  'spin-45': STAR_POSES['spin-45'],
  'sparkle-burst': STAR_POSES['sparkle-burst'],
}

/**
 * Rôle de couleur par glyphe.
 * - 'core' : cœur de l'étoile → couleur orange `claude` (statique).
 * - 'ray'  : rayons/éclats → couleur animée (claudeBlue via intensityToColor).
 * - 'none' : espaces et glyphes non listés → pas de couleur (fond terminal).
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
 * Découpe une ligne de pose en segments contigus par rôle de couleur.
 * Préserve la largeur exacte : les espaces forment des segments 'none' qui
 * seront rendus sans couleur (Text sans prop color).
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
