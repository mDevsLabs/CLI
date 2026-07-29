/**
 * Assets ASCII pour la scène de bienvenue (WelcomeV2 / onboarding).
 *
 * Design : une grande étoile « polaire » 13×7 centrée dans un cadre de 58
 * colonnes (WELCOME_SCENE_WIDTH), encadrée par un halo en losange de sparkles
 * (✦/✧) et deux lignes de points. La coloration se fait par rôle de glyphe
 * (voir {@link WELCOME_GLYPH_ROLE}) puis découpage en segments par
 * {@link rowToWelcomeSegments}.
 *
 * Une seule scène sert les 4 variantes (dark/light × normal/Apple Terminal) :
 * seules les couleurs changent, jamais la layout. Cela élimine la duplication
 * des anciens blocs inline.
 */

export const WELCOME_SCENE_WIDTH = 58

/**
 * Rôle de couleur par glyphe.
 * - 'core'    : cœur █████ → orange `claude` (statique, pulsant).
 * - 'star'    : ★ moyennes → `claudeShimmer`.
 * - 'ray'     : ✦ rayons → `claudeBlue` animé (intensityToColor).
 * - 'sparkle' : ✧ halo → dimColor.
 * - 'dot'     : … lignes → dimColor.
 * - 'none'    : espaces → pas de couleur.
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

// Grande étoile 13×7, alignée à gauche (sera centrée par padLine).
const STAR_ROWS = [
  '      ✦      ', // 6sp + ✦ + 6sp  (pointe haute)
  '    ✦ ★ ✦    ', // 4sp + ✦ sp ★ sp ✦ + 4sp
  '  ✦  ★★★  ✦  ', // 2sp + ✦ + 2sp + ★★★ + 2sp + ✦ + 2sp
  '★★  █████  ★★', // 2★ + 2sp + 5█ + 2sp + 2★  (cœur)
  '  ✦  ★★★  ✦  ',
  '    ✦ ★ ✦    ',
  '      ✦      ',
]

const STAR_W = 13 // largeur de l'étoile

/**
 * Halo en losange autour de l'étoile. Chaque entrée = [rowIndex, col, glyph].
 * Les positions sont symétriques autour du centre (col 28.5 pour largeur 58).
 * - ✦ aux 4 sommets du losange (lignes 0 et 6 de l'étoile, cols 14 et 43).
 * - ✧ aux milieux des côtés (lignes 1 et 5, cols 18 et 39).
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
 * Construit une ligne de largeur WELCOME_SCENE_WIDTH à partir d'un contenu
 * positionné. Remplit le reste d'espaces. Garantit la largeur exacte.
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
 * Construit les 11 lignes de la scène (largeur WELCOME_SCENE_WIDTH chacune).
 * Lancé une fois au chargement du module — les assets sont statiques.
 */
function buildSceneRows(): string[] {
  const W = WELCOME_SCENE_WIDTH
  const leftPad = Math.floor((W - STAR_W) / 2) // 22
  const rows: string[] = []

  // Ligne 1 : points
  rows.push('…'.repeat(W))
  // Ligne 2 : vide
  rows.push(' '.repeat(W))

  // Lignes 3-9 : étoile + halo
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

  // Ligne 10 : vide
  rows.push(' '.repeat(W))
  // Ligne 11 : points
  rows.push('…'.repeat(W))

  return rows
}

export const WELCOME_SCENE_ROWS: string[] = buildSceneRows()

/**
 * Découpe une ligne de scène en segments contigus par rôle de couleur.
 * Préserve la largeur exacte : les espaces forment des segments 'none'.
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
