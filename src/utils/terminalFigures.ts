import npmFigures from 'figures'

// ASCII-safe drop-in replacement for the `figures` npm package. The glyphs
// overridden below are Extended_Pictographic characters, which render as
// color emoji on some terminals (Windows Terminal, Ghostty, ...). All other
// glyphs (pointer, arrows, checkbox marks, ellipsis, ...) pass through
// unchanged.
const terminalFigures = {
  ...npmFigures,
  tick: '\u2713', // check mark (was the emoji heavy check mark)
  cross: '\u2717', // ballot X (was the emoji heavy ballot X)
  warning: '!', // exclamation (was the emoji warning sign)
  info: 'i', // letter i (was the emoji information source)
  play: '\u25b8', // small right triangle (was the emoji play button)
  heart: '<3', // ASCII heart (was the emoji heart suit)
  squareSmall: '\u00b7', // middle dot (was the emoji white small square)
  squareSmallFilled: '\u25a0', // black square (was the emoji black medium square)
}

export default terminalFigures
