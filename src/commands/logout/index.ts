import type { Command } from '../../commands.js'
import { isAuthenticated } from '../../utils/auth.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

export default {
  type: 'local-jsx',
  name: 'logout',
  description: 'Sign out from your configured account',
  isEnabled: () =>
    !isEnvTruthy(process.env.DISABLE_LOGOUT_COMMAND) && isAuthenticated(),
  load: () => import('./logout.js'),
} satisfies Command
