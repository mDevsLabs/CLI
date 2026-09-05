import type { Command } from '../../commands.js'

function isSupportedPlatform(): boolean {
  if (process.platform === 'darwin') {
    return true
  }
  if (process.platform === 'win32' && process.arch === 'x64') {
    return true
  }
  return false
}

const desktop = {
  type: 'local-jsx',
  name: 'desktop',
  aliases: ['app'],
  description: 'Continue the current session in mAI Desktop',
  availability: ['claude-ai'],
  isEnabled: isSupportedPlatform,
  isHidden: true,
  load: () => import('./desktop.js'),
} satisfies Command

export default desktop
