import { app } from 'electron'
import { existsSync } from 'fs'
import { join, resolve, dirname } from 'path'

export interface MaiLaunchConfig {
  command: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
  cliPath: string | null
}

/**
 * Résout la commande à lancer dans le PTY pour démarrer mAI.
 *
 * Priorité:
 * 1. MAI_CLI_PATH env var (chemin explicite)
 * 2. ExtraResources `cli/cli.js` (build packagé electron-builder)
 * 3. `../../dist/cli.js` relatif au source (dev `electron-vite dev`)
 * 4. Binaire global `mai` dans le PATH
 */
export function resolveMaiCommand(cwd: string): MaiLaunchConfig {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    FORCE_COLOR: '3',
    TERM_PROGRAM: 'mAI-Desktop'
  }

  // Respect explicit override
  const explicit = process.env.MAI_CLI_PATH
  if (explicit && existsSync(explicit)) {
    return buildNodeLaunch(explicit, cwd, env)
  }

  // Packaged app: extraResources/cli/cli.js
  // process.resourcesPath = .../mAI.app/Contents/Resources  (mac)
  //                      or .../resources                   (win/linux)
  const candidates: string[] = []

  if (app.isPackaged) {
    candidates.push(join(process.resourcesPath, 'cli', 'cli.js'))
    candidates.push(join(process.resourcesPath, 'app.asar.unpacked', 'cli', 'cli.js'))
    // electron-builder extraResources maps to resources/cli
    candidates.push(join(dirname(app.getAppPath()), 'cli', 'cli.js'))
  } else {
    // Dev: apps/desktop -> ../../dist/cli.js
    const devCli = resolve(app.getAppPath(), '../../dist/cli.js')
    candidates.push(devCli)
    candidates.push(resolve(app.getAppPath(), 'dist/cli.js'))
    // Fallback to repo root
    candidates.push(resolve(process.cwd(), 'dist/cli.js'))
  }

  for (const p of candidates) {
    if (existsSync(p)) {
      return buildNodeLaunch(p, cwd, env)
    }
  }

  // Fallback: global `mai` (npm/bun global, or npx)
  // On Windows use `mai.cmd`, on unix `mai`
  const isWin = process.platform === 'win32'
  if (isWin) {
    return {
      command: 'cmd.exe',
      args: ['/c', 'mai'],
      cwd,
      env,
      cliPath: null
    }
  }

  return {
    command: 'mai',
    args: [],
    cwd,
    env,
    cliPath: null
  }
}

function buildNodeLaunch(cliPath: string, cwd: string, env: NodeJS.ProcessEnv): MaiLaunchConfig {
  // On utilise Electron lui-même en mode Node (`ELECTRON_RUN_AS_NODE=1`) pour
  // exécuter `cli.js` → pas besoin que `node` soit installé sur la machine.
  // Fallback possible: si ELECTRON_RUN_AS_NODE échoue, le PTY affichera l'erreur
  // et l'utilisateur pourra installer Node ou utiliser `mai` global.
  return {
    command: process.execPath,
    args: [cliPath],
    cwd,
    env: {
      ...env,
      ELECTRON_RUN_AS_NODE: '1'
    },
    cliPath
  }
}

/**
 * Vérifie si la commande `mai` est résolvable (fallback check)
 */
export function isMaiAvailable(): boolean {
  const cfg = resolveMaiCommand(app.getPath('home'))
  if (cfg.cliPath && existsSync(cfg.cliPath)) return true
  // Si on fallback sur `mai` global, on considère disponible — le PTY affichera l'erreur
  return true
}
