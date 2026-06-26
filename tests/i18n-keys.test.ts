import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const TEST_DIR = import.meta.dirname
const REPO_ROOT = dirname(TEST_DIR)
const SRC_DIR = join(REPO_ROOT, 'src')
const EN_PATH = join(SRC_DIR, 'i18n', 'locales', 'en.json')

const TRANSLATION_CALL_REGEX = /(?:\bt|\bi18n\.t)\(\s*['"]([\w.-]+)['"]/gu
const ALLOWED_EXTS = new Set(['.ts', '.tsx'])
const PLURAL_SUFFIXES = ['_one', '_other', '_zero', '_two', '_few', '_many']

function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') {
    return [prefix]
  }
  const out: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix === '' ? key : `${prefix}.${key}`
    out.push(...flattenKeys(value, next))
  }
  return out
}

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      collectSourceFiles(fullPath, acc)
      continue
    }
    if (
      ALLOWED_EXTS.has(extname(fullPath)) &&
      !fullPath.endsWith('.test.ts') &&
      !fullPath.endsWith('.test.tsx')
    ) {
      acc.push(fullPath)
    }
  }
  return acc
}

function extractKeys(source: string): string[] {
  const out: string[] = []
  const matches = source.matchAll(TRANSLATION_CALL_REGEX)
  for (const match of matches) {
    out.push(match[1])
  }
  return out
}

function isKeyAvailable(key: string, available: Set<string>): boolean {
  if (available.has(key)) {
    return true
  }
  for (const suffix of PLURAL_SUFFIXES) {
    if (available.has(`${key}${suffix}`)) {
      return true
    }
  }
  return false
}

const enJson = JSON.parse(readFileSync(EN_PATH, 'utf-8')) as unknown
const availableKeys = new Set(flattenKeys(enJson))

const sourceFiles = collectSourceFiles(SRC_DIR)
const usedKeys = new Set<string>()
for (const file of sourceFiles) {
  for (const key of extractKeys(readFileSync(file, 'utf-8'))) {
    usedKeys.add(key)
  }
}

describe('i18n key coverage', () => {
  it('every static translation key used in source has a definition in en.json', () => {
    const missing: string[] = []
    for (const key of usedKeys) {
      if (!isKeyAvailable(key, availableKeys)) {
        missing.push(key)
      }
    }
    expect(missing).toStrictEqual([])
  })
})
