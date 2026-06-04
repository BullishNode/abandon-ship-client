#!/usr/bin/env node
// Use podman if available, otherwise docker. Cross-platform (Windows/macOS/Linux).
import { spawnSync } from 'node:child_process'

const isWindows = process.platform === 'win32'

function hasCommand(cmd) {
  const probe = isWindows ? 'where' : 'command'
  const args = isWindows ? [cmd] : ['-v', cmd]
  const result = spawnSync(probe, args, {
    shell: isWindows,
    stdio: 'ignore'
  })
  return result.status === 0
}

const args = process.argv.slice(2)

let runtime
if (hasCommand('podman')) {
  runtime = 'podman'
} else if (hasCommand('docker')) {
  runtime = 'docker'
} else {
  process.stderr.write('Error: neither podman nor docker found in PATH\n')
  process.exit(1)
}

const child = spawnSync(runtime, ['compose', ...args], {
  shell: isWindows,
  stdio: 'inherit'
})

if (child.error) {
  process.stderr.write(`Error: failed to run ${runtime}: ${child.error.message}\n`)
  process.exit(1)
}

process.exit(child.status ?? 1)
