#!/usr/bin/env node
// Seed ./.auth-dev/ui_password for `npm run dev:*:auth`.
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const DEFAULT_PASSWORD = 'devpassword123'

const authDir = join(import.meta.dirname, '..', '.auth-dev')
const passwordFile = join(authDir, 'ui_password')

await mkdir(authDir, { recursive: true })
try {
  await writeFile(passwordFile, DEFAULT_PASSWORD, { flag: 'wx', mode: 0o600 })
  process.stdout.write(`Seeded ${passwordFile} (password: ${DEFAULT_PASSWORD})\n`)
} catch (error) {
  if (error.code === 'EEXIST') {
    process.stdout.write(`Using existing ${passwordFile}\n`)
  } else {
    throw error
  }
}
