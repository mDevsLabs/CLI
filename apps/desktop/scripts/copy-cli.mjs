#!/usr/bin/env node
// Copie dist/ du CLI vers out/cli pour dev, et vérifie la présence du build
import { cp, mkdir, stat } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../../..')
const src = resolve(root, 'dist')
const dest = resolve(__dirname, '../out/cli')

try {
  await stat(src)
} catch {
  console.warn('[copy-cli] dist/ introuvable — lancez `bun run build` à la racine d\'abord. Skip.')
  process.exit(0)
}

await mkdir(dirname(dest), { recursive: true })
await cp(src, dest, { recursive: true, force: true })
console.log(`[copy-cli] ${src} -> ${dest}`)
