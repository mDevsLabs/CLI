import * as pty from 'node-pty'
import { app } from 'electron'
import { resolveMaiCommand, type MaiLaunchConfig } from './cli.js'

export interface PtyInstance {
  id: string
  pty: pty.IPty
  config: MaiLaunchConfig
}

const ptys = new Map<string, PtyInstance>()

function getDefaultCwd(): string {
  try {
    return app.getPath('home')
  } catch {
    return process.cwd()
  }
}

export function createPty(id: string, cols: number, rows: number, cwd?: string): PtyInstance {
  if (ptys.has(id)) {
    try {
      ptys.get(id)!.pty.kill()
    } catch {}
    ptys.delete(id)
  }

  const resolvedCwd = cwd || getDefaultCwd()
  const cfg = resolveMaiCommand(resolvedCwd)

  // node-pty expects env as Record<string,string> (no undefined)
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(cfg.env)) {
    if (typeof v === 'string') env[k] = v
  }

  const ptyProcess = pty.spawn(cfg.command, cfg.args, {
    name: 'xterm-256color',
    cols: Math.max(cols, 20),
    rows: Math.max(rows, 8),
    cwd: resolvedCwd,
    env
  })

  const instance: PtyInstance = { id, pty: ptyProcess, config: cfg }
  ptys.set(id, instance)
  return instance
}

export function getPty(id: string): PtyInstance | undefined {
  return ptys.get(id)
}

export function writePty(id: string, data: string): void {
  const inst = ptys.get(id)
  if (inst) inst.pty.write(data)
}

export function resizePty(id: string, cols: number, rows: number): void {
  const inst = ptys.get(id)
  if (inst) {
    try {
      inst.pty.resize(Math.max(cols, 20), Math.max(rows, 8))
    } catch {}
  }
}

export function killPty(id: string): void {
  const inst = ptys.get(id)
  if (inst) {
    try {
      inst.pty.kill()
    } catch {}
    ptys.delete(id)
  }
}

export function killAllPtys(): void {
  for (const id of [...ptys.keys()]) killPty(id)
}

export function listPtyIds(): string[] {
  return [...ptys.keys()]
}
