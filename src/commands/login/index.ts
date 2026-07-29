import type { Command } from '../../commands.js'
import { isAuthenticated } from '../../utils/auth.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

export default () =>
  ({
    type: 'local-jsx',
    name: 'login',
    description: 'Connect to mAI Account',
    isEnabled: () =>
      !isEnvTruthy(process.env.DISABLE_LOGIN_COMMAND) && !isAuthenticated(),
    load: () => import('./login.js'),
  }) satisfies Command
