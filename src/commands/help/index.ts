import type { Command } from '../../commands.js'

const help = {
  type: 'local-jsx',
  name: 'help',
  description: 'Show help and available commands',
  immediate: true,
  load: () => import('./help.js'),
} satisfies Command

export default help
