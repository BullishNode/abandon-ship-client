// JSON codec for IndexedDB values in the WASM wallet export. IndexedDB stores
// structured-clone data (typed arrays, Dates, Maps, Blobs...) that plain
// JSON.stringify would corrupt or drop, so every non-JSON value is wrapped in a
// `{ $t, v }` tag. A plain object that itself contains a `$t` key is wrapped as
// `{ $t: 'raw', v }` so the tag namespace can never collide with wallet data.

const BASE64_CHUNK_SIZE = 8192

export type EncodedValue =
  | string
  | number
  | boolean
  | null
  | EncodedValue[]
  | { [key: string]: EncodedValue }

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE)
    binary += String.fromCodePoint(...chunk)
  }
  return btoa(binary)
}

function tag(type: string, value: EncodedValue): EncodedValue {
  return { $t: type, v: value }
}

// Blob.arrayBuffer() is missing in some older engines (and in jsdom); fall
// back to FileReader, which every Blob-supporting environment has.
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return await blob.arrayBuffer()
  }
  // oxlint-disable-next-line promise/avoid-new
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
        return
      }
      reject(new Error('FileReader did not produce an ArrayBuffer'))
    })
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Failed to read blob'))
    })
    // oxlint-disable-next-line unicorn/prefer-blob-reading-methods
    reader.readAsArrayBuffer(blob)
  })
}

function encodeBytes(view: ArrayBufferView, kind: string): EncodedValue {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  return { $t: 'bytes', kind, v: bytesToBase64(bytes) }
}

// Encode one structured-clone value into JSON-safe form. Async because Blob
// content can only be read asynchronously.
export async function encodeValue(value: unknown): Promise<EncodedValue> {
  if (value === undefined) {
    return { $t: 'undefined' }
  }
  if (value === null) {
    return null
  }
  if (typeof value === 'bigint') {
    return tag('bigint', value.toString())
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'object') {
    // The codec is mutually recursive: containers re-enter encodeValue for
    // their elements.
    // oxlint-disable-next-line eslint/no-use-before-define
    return await encodeObject(value)
  }
  throw new Error(`Cannot export value of type ${typeof value}`)
}

async function encodeEntries(value: Map<unknown, unknown>): Promise<EncodedValue> {
  const entries: EncodedValue[] = []
  for (const [entryKey, entryValue] of value) {
    entries.push([await encodeValue(entryKey), await encodeValue(entryValue)])
  }
  return entries
}

async function encodeItems(items: Iterable<unknown>): Promise<EncodedValue[]> {
  const encoded: EncodedValue[] = []
  for (const item of items) {
    encoded.push(await encodeValue(item))
  }
  return encoded
}

async function encodeObject(value: object): Promise<EncodedValue> {
  if (value instanceof Date) {
    return tag('date', value.toISOString())
  }
  if (value instanceof ArrayBuffer) {
    return encodeBytes(new Uint8Array(value), 'ArrayBuffer')
  }
  if (ArrayBuffer.isView(value)) {
    return encodeBytes(value, value.constructor.name)
  }
  if (value instanceof Blob) {
    const bytes = new Uint8Array(await blobToArrayBuffer(value))
    return { $t: 'blob', mime: value.type, v: bytesToBase64(bytes) }
  }
  if (value instanceof Map) {
    return tag('map', await encodeEntries(value))
  }
  if (value instanceof Set) {
    return tag('set', await encodeItems(value))
  }
  if (Array.isArray(value)) {
    return await encodeItems(value)
  }
  const record: Record<string, EncodedValue> = {}
  for (const [entryKey, entryValue] of Object.entries(value)) {
    record[entryKey] = await encodeValue(entryValue)
  }
  return '$t' in record ? tag('raw', record) : record
}
