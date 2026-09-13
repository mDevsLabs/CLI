#!/usr/bin/env bun
/**
 * Health Check Script for mAI CLI
 * Validates development environment, dependencies, runtimes, and essential tools.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

interface CheckResult {
  category: string
  name: string
  status: 'ok' | 'warn' | 'error'
  message: string
  details?: string
}

const results: CheckResult[] = []

function check(
  category: string,
  name: string,
  fn: () => { status: 'ok' | 'warn' | 'error'; message: string; details?: string },
) {
  try {
    const res = fn()
    results.push({ category, name, ...res })
  } catch (err: unknown) {
    results.push({
      category,
      name,
      status: 'error',
      message: 'Exception during check',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}

// ─────────────────────────────────────────────────────────────
// 1. Runtime & OS Checks
// ─────────────────────────────────────────────────────────────

check('Runtime', 'Bun Version', () => {
  const bunVer = process.versions.bun
  if (!bunVer) {
    return { status: 'error', message: 'Not running under Bun!' }
  }
  const [major, minor] = bunVer.split('.').map(Number)
  if (major > 1 || (major === 1 && minor >= 3)) {
    return { status: 'ok', message: `v${bunVer} (meets >= 1.3.0 requirement)` }
  }
  return {
    status: 'warn',
    message: `v${bunVer} (recommended >= 1.3.0 for full compatibility)`,
  }
})

check('Runtime', 'Node.js Availability', () => {
  const nodeProc = spawnSync('node', ['--version'], { encoding: 'utf-8', shell: true })
  if (nodeProc.status === 0) {
    return { status: 'ok', message: nodeProc.stdout.trim() }
  }
  return {
    status: 'warn',
    message: 'Node.js not detected in PATH (needed for dist/cli-node.js fallback)',
  }
})

check('Runtime', 'Operating System', () => {
  const platform = process.platform
  const arch = process.arch
  return {
    status: 'ok',
    message: `${platform} (${arch})`,
    details: `Node API platform: ${platform}`,
  }
})

check('Runtime', 'Git Tool', () => {
  const gitProc = spawnSync('git', ['--version'], { encoding: 'utf-8', shell: true })
  if (gitProc.status === 0) {
    return { status: 'ok', message: gitProc.stdout.trim() }
  }
  return {
    status: 'error',
    message: 'Git is not installed or not in PATH',
  }
})

// ─────────────────────────────────────────────────────────────
// 2. Shell & Utilities Checks
// ─────────────────────────────────────────────────────────────

check('Utilities', 'Shell Execution', () => {
  if (process.platform === 'win32') {
    const pwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
      encoding: 'utf-8',
      shell: true,
    })
    if (pwsh.status === 0) {
      return { status: 'ok', message: `PowerShell Core (pwsh) v${pwsh.stdout.trim()}` }
    }
    const winPs = spawnSync('powershell', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
      encoding: 'utf-8',
      shell: true,
    })
    if (winPs.status === 0) {
      return { status: 'ok', message: `Windows PowerShell v${winPs.stdout.trim()}` }
    }
    return { status: 'error', message: 'Neither pwsh nor powershell.exe found in PATH' }
  }

  const bashProc = spawnSync('bash', ['--version'], { encoding: 'utf-8' })
  if (bashProc.status === 0) {
    return { status: 'ok', message: bashProc.stdout.split('\n')[0] }
  }
  return { status: 'warn', message: 'bash not found' }
})

check('Utilities', 'Ripgrep (rg)', () => {
  // Check vendored or system ripgrep
  const systemRg = spawnSync('rg', ['--version'], { encoding: 'utf-8', shell: true })
  if (systemRg.status === 0) {
    return { status: 'ok', message: `System: ${systemRg.stdout.split('\n')[0]}` }
  }

  const vendorRgWin = join(process.cwd(), 'src/utils/vendor/ripgrep/x64-win32/rg.exe')
  if (existsSync(vendorRgWin)) {
    return { status: 'ok', message: 'Vendored rg.exe present (x64-win32)' }
  }

  return {
    status: 'warn',
    message: 'Ripgrep not found in PATH (vendored binary will be used when built)',
  }
})

// ─────────────────────────────────────────────────────────────
// 3. Project Structure & Workspaces
// ─────────────────────────────────────────────────────────────

check('Structure', 'Node Modules', () => {
  const nmPath = join(process.cwd(), 'node_modules')
  if (existsSync(nmPath)) {
    return { status: 'ok', message: 'node_modules directory present' }
  }
  return { status: 'error', message: 'node_modules missing, run `bun install`' }
})

check('Structure', 'Core Workspaces', () => {
  const requiredPkgs = [
    'packages/builtin-tools',
    'packages/@ant/ink',
    'packages/@ant/computer-use-mcp',
  ]
  const missing = requiredPkgs.filter(p => !existsSync(join(process.cwd(), p)))
  if (missing.length === 0) {
    return { status: 'ok', message: 'All critical workspace packages present' }
  }
  return {
    status: 'warn',
    message: `Some workspace packages missing: ${missing.join(', ')}`,
  }
})

check('Structure', 'Build Output (dist/)', () => {
  const distCli = join(process.cwd(), 'dist/cli.js')
  const distBun = join(process.cwd(), 'dist/cli-bun.js')
  const distNode = join(process.cwd(), 'dist/cli-node.js')

  const existsCount = [distCli, distBun, distNode].filter(existsSync).length
  if (existsCount === 3) {
    return { status: 'ok', message: 'Full build artifacts present in dist/' }
  }
  if (existsCount > 0) {
    return { status: 'warn', message: 'Partial build artifacts in dist/ (run `bun run build`)' }
  }
  return { status: 'warn', message: 'dist/ not built yet (run `bun run build`)' }
})

// ─────────────────────────────────────────────────────────────
// 4. Environment & Credentials
// ─────────────────────────────────────────────────────────────

check('Environment', 'Env Configuration', () => {
  const envPath = join(process.cwd(), '.env')
  if (!existsSync(envPath)) {
    return { status: 'warn', message: '.env file not found (defaults will be used)' }
  }
  return { status: 'ok', message: '.env file detected' }
})

check('Environment', 'API Providers Configured', () => {
  const envContent = existsSync('.env') ? readFileSync('.env', 'utf-8') : ''
  const hasKey = (key: string) =>
    Boolean(process.env[key]) || new RegExp(`^\\s*${key}=.+`, 'm').test(envContent)

  const providers: string[] = []
  if (hasKey('MAI_API_KEY') || hasKey('MAI_TOKEN')) providers.push('mAI')
  if (hasKey('ANTHROPIC_API_KEY')) providers.push('Anthropic')
  if (hasKey('OPENAI_API_KEY')) providers.push('OpenAI')
  if (hasKey('GEMINI_API_KEY')) providers.push('Gemini')
  if (hasKey('GROK_API_KEY')) providers.push('Grok')

  if (providers.length > 0) {
    return {
      status: 'ok',
      message: `Configured: ${providers.join(', ')}`,
    }
  }
  return {
    status: 'warn',
    message: 'No external API keys detected in environment (free tier or /login will be required)',
  }
})

// ─────────────────────────────────────────────────────────────
// Output Formatter
// ─────────────────────────────────────────────────────────────

console.log('\n=========================================')
console.log('   mAI CLI - Environment Health Check   ')
console.log('=========================================\n')

let hasError = false
let currentCategory = ''

for (const res of results) {
  if (res.category !== currentCategory) {
    currentCategory = res.category
    console.log(`\n--- [${currentCategory}] ---`)
  }

  const icon =
    res.status === 'ok'
      ? '\x1b[32m[OK]\x1b[0m'
      : res.status === 'warn'
        ? '\x1b[33m[WARN]\x1b[0m'
        : '\x1b[31m[FAIL]\x1b[0m'

  console.log(`  ${icon} ${res.name.padEnd(26)} : ${res.message}`)
  if (res.details) {
    console.log(`         \x1b[90m-> ${res.details}\x1b[0m`)
  }

  if (res.status === 'error') {
    hasError = true
  }
}

console.log('\n-----------------------------------------')
if (hasError) {
  console.log('\x1b[31mHealth Check Status: Critical issues detected.\x1b[0m\n')
  process.exit(1)
} else {
  console.log('\x1b[32mHealth Check Status: All critical checks passed!\x1b[0m\n')
  process.exit(0)
}
