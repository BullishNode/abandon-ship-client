import { describe, expect, it } from 'vitest'
import { encodeValue } from '@/lib/backend/wasm/export-codec'

describe('wasm export codec', () => {
  it('passes JSON primitives through unchanged', async () => {
    await expect(encodeValue('hello')).resolves.toBe('hello')
    await expect(encodeValue(42)).resolves.toBe(42)
    await expect(encodeValue(true)).resolves.toBeTruthy()
    await expect(encodeValue(null)).resolves.toBeNull()
  })

  it('tags undefined', async () => {
    // oxlint-disable-next-line unicorn/no-useless-undefined -- undefined IS the value under test
    await expect(encodeValue(undefined)).resolves.toStrictEqual({ $t: 'undefined' })
  })

  it('tags bigints as strings', async () => {
    await expect(encodeValue(123_456_789_012_345_678_901_234_567_890n)).resolves.toStrictEqual({
      $t: 'bigint',
      v: '123456789012345678901234567890'
    })
  })

  it('tags dates as ISO strings', async () => {
    const date = new Date('2026-07-17T12:00:00.000Z')
    await expect(encodeValue(date)).resolves.toStrictEqual({
      $t: 'date',
      v: '2026-07-17T12:00:00.000Z'
    })
  })

  it('encodes typed arrays as base64 with their view kind', async () => {
    const bytes = new Uint8Array([0, 1, 2, 255])
    await expect(encodeValue(bytes)).resolves.toStrictEqual({
      $t: 'bytes',
      kind: 'Uint8Array',
      v: 'AAEC/w=='
    })
  })

  it('encodes ArrayBuffers as base64', async () => {
    const { buffer } = new Uint8Array([104, 105])
    await expect(encodeValue(buffer)).resolves.toStrictEqual({
      $t: 'bytes',
      kind: 'ArrayBuffer',
      v: 'aGk='
    })
  })

  it('respects a typed array view window into a larger buffer', async () => {
    const backing = new Uint8Array([9, 9, 1, 2, 9, 9])
    const view = new Uint8Array(backing.buffer, 2, 2)
    await expect(encodeValue(view)).resolves.toStrictEqual({
      $t: 'bytes',
      kind: 'Uint8Array',
      v: 'AQI='
    })
  })

  it('encodes blobs with their mime type', async () => {
    const blob = new Blob(['hi'], { type: 'text/plain' })
    await expect(encodeValue(blob)).resolves.toStrictEqual({
      $t: 'blob',
      mime: 'text/plain',
      v: 'aGk='
    })
  })

  it('encodes maps and sets recursively', async () => {
    const map = new Map<unknown, unknown>([['k', new Date('2026-01-01T00:00:00.000Z')]])
    await expect(encodeValue(map)).resolves.toStrictEqual({
      $t: 'map',
      v: [['k', { $t: 'date', v: '2026-01-01T00:00:00.000Z' }]]
    })
    await expect(encodeValue(new Set([1, 'a']))).resolves.toStrictEqual({ $t: 'set', v: [1, 'a'] })
  })

  it('recurses through arrays and plain objects', async () => {
    const value = { list: [1, { nested: new Uint8Array([7]) }] }
    await expect(encodeValue(value)).resolves.toStrictEqual({
      list: [1, { nested: { $t: 'bytes', kind: 'Uint8Array', v: 'Bw==' } }]
    })
  })

  it('escapes plain objects that contain a $t key', async () => {
    await expect(encodeValue({ $t: 'sneaky', other: 1 })).resolves.toStrictEqual({
      $t: 'raw',
      v: { $t: 'sneaky', other: 1 }
    })
  })

  it('round-trips large buffers through base64 chunking', async () => {
    const large = new Uint8Array(100_000).map((_, index) => index % 251)
    const encoded = await encodeValue(large)
    if (typeof encoded !== 'object' || encoded === null || Array.isArray(encoded)) {
      throw new Error('expected tagged object')
    }
    if (typeof encoded.v !== 'string') {
      throw new TypeError('expected base64 string payload')
    }
    const decoded = Uint8Array.from(atob(encoded.v), (char) => char.codePointAt(0) ?? 0)
    expect(decoded).toStrictEqual(large)
  })

  it('produces JSON-serializable output for the whole payload', async () => {
    const encoded = await encodeValue({
      buffer: new Uint8Array([1, 2, 3]),
      date: new Date(),
      map: new Map([['a', 1]]),
      missing: undefined
    })
    expect(() => JSON.stringify(encoded)).not.toThrow()
  })
})
