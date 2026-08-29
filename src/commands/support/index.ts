import type { Command } from '../../types/command.js'

const support: Command = {
  type: 'local',
  name: 'support',
  description: 'Open the mAI CLI support page',
  supportsNonInteractive: true,
  load: () => import('./support.js'),
}

export default support
