import type { Command } from '../../commands.js'

const theme = {
  type: 'local-jsx',
  name: 'theme',
  description: 'Change the theme',
  immediate: true,
  load: () => import('./theme.js'),
} satisfies Command

export default theme
