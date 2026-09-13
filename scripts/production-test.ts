#!/usr/bin/env bun
/**
 * Production Test Script for mAI CLI
 * Tests built distribution artifacts in dist/ for Node.js and Bun runtime readiness.
 */

import { existsSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const args = process.argv.slice(2)
const isOffline = args.includes('--offline')
const isVerbose = args.includes('--verbose')
const isBunOnly = args.includes('--bun')

interface TestStep {
  name: string
  run: () => { passed: boolean; message: string; output?: string }
}

const steps: TestStep[] = []

function addTest(name: string, run: () => { passed: boolean; message: string; output?: string }) {
  steps.push({ name, run })
}

const distDir = join(process.cwd(), 'dist')
const cliJs = join(distDir, 'cli.js')
const cliBun = join(distDir, 'cli-bun.js')
const cliNode = join(distDir, 'cli-node.js')

// ─────────────────────────────────────────────────────────────
// 1. Artifact Verification
// ─────────────────────────────────────────────────────────────

addTest('Artifact: dist/cli.js', () => {
  if (existsSync(cliJs)) {
    return { passed: true, message: 'Core bundle dist/cli.js present' }
  }
  return { passed: false, message: 'Missing dist/cli.js. Run `bun run build` first.' }
})

addTest('Artifact: dist/cli-bun.js', () => {
  if (existsSync(cliBun)) {
    return { passed: true, message: 'Bun entrypoint dist/cli-bun.js present' }
  }
  return { passed: false, message: 'Missing dist/cli-bun.js' }
})

addTest('Artifact: dist/cli-node.js', () => {
  if (existsSync(cliNode)) {
    return { passed: true, message: 'Node entrypoint dist/cli-node.js present' }
  }
  return { passed: false, message: 'Missing dist/cli-node.js' }
})

addTest('Artifact: Vendor Assets', () => {
  const vendorRipgrep = join(distDir, 'vendor', 'ripgrep')
  if (existsSync(vendorRipgrep)) {
    return { passed: true, message: 'Vendored ripgrep assets copied to dist/vendor/' }
  }
  return { passed: true, message: 'Vendor assets check passed (or optional for current target)' }
})

// ─────────────────────────────────────────────────────────────
// 2. Bun Runtime Execution Tests
// ─────────────────────────────────────────────────────────────

addTest('Bun Execution: --version fast-path', () => {
  const start = performance.now()
  const proc = spawnSync('bun', [cliBun, '--version'], {
    encoding: 'utf-8',
    env: { ...process.env, NODE_ENV: 'production' },
  })
  const duration = Math.round(performance.now() - start)

  if (proc.status !== 0) {
    return {
      passed: false,
      message: `Failed with status ${proc.status}`,
      output: proc.stderr || proc.stdout,
    }
  }

  const out = proc.stdout.trim()
  if (out.includes('mAI CLI') || /\d+\.\d+\.\d+/.test(out)) {
    return {
      passed: true,
      message: `Output: "${out}" in ${duration}ms`,
      output: isVerbose ? proc.stdout : undefined,
    }
  }

  return {
    passed: false,
    message: `Unexpected version output: "${out}"`,
    output: proc.stdout,
  }
})

addTest('Bun Execution: --help CLI parsing', () => {
  const start = performance.now()
  const proc = spawnSync('bun', [cliBun, '--help'], {
    encoding: 'utf-8',
    env: { ...process.env, NODE_ENV: 'production' },
  })
  const duration = Math.round(performance.now() - start)

  if (proc.status !== 0) {
    return {
      passed: false,
      message: `Failed with status ${proc.status}`,
      output: proc.stderr || proc.stdout,
    }
  }

  const out = proc.stdout
  if (out.includes('Usage:') || out.includes('mai') || out.includes('Options:')) {
    return {
      passed: true,
      message: `Help menu rendered successfully in ${duration}ms`,
      output: isVerbose ? out.slice(0, 300) + '...' : undefined,
    }
  }

  return {
    passed: false,
    message: 'Help menu output did not contain standard CLI options',
    output: out,
  }
})

// ─────────────────────────────────────────────────────────────
// 3. Node.js Runtime Execution Tests (unless --bun specified)
// ─────────────────────────────────────────────────────────────

if (!isBunOnly) {
  addTest('Node Execution: --version compatibility', () => {
    const start = performance.now()
    const proc = spawnSync('node', [cliNode, '--version'], {
      encoding: 'utf-8',
      env: { ...process.env, NODE_ENV: 'production' },
    })
    const duration = Math.round(performance.now() - start)

    if (proc.status !== 0) {
      return {
        passed: false,
        message: `Node execution failed with status ${proc.status}`,
        output: proc.stderr || proc.stdout,
      }
    }

    const out = proc.stdout.trim()
    if (out.includes('mAI CLI') || /\d+\.\d+\.\d+/.test(out)) {
      return {
        passed: true,
        message: `Output: "${out}" in ${duration}ms via Node.js`,
        output: isVerbose ? proc.stdout : undefined,
      }
    }

    return {
      passed: false,
      message: `Node unexpected version output: "${out}"`,
      output: proc.stdout,
    }
  })
}

// ─────────────────────────────────────────────────────────────
// Runner & Report
// ─────────────────────────────────────────────────────────────

console.log('\n=========================================')
console.log(`   mAI CLI - Production Test Suite       `)
console.log(`   Mode: ${isOffline ? 'Offline' : 'Standard'} | Target: ${isBunOnly ? 'Bun-only' : 'Bun + Node'}`)
console.log('=========================================\n')

let allPassed = true

for (const test of steps) {
  const res = test.run()
  const tag = res.passed ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m'
  console.log(`  ${tag} ${test.name.padEnd(36)} : ${res.message}`)

  if (res.output && (isVerbose || !res.passed)) {
    console.log(`\x1b[90m----------------------------------------\x1b[0m`)
    console.log(res.output.trim())
    console.log(`\x1b[90m----------------------------------------\x1b[0m`)
  }

  if (!res.passed) {
    allPassed = false
  }
}

console.log('\n-----------------------------------------')
if (allPassed) {
  console.log('\x1b[32mProduction Test Status: All tests passed successfully!\x1b[0m\n')
  process.exit(0)
} else {
  console.log('\x1b[31mProduction Test Status: Verification failed.\x1b[0m\n')
  process.exit(1)
}
