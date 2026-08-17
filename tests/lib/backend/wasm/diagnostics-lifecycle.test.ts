import { beforeEach, describe, expect, it } from 'vitest'
import { createDiagnosticsLog } from '@/lib/backend/wasm/diagnostics-log'
import {
  appendMissingDiagnostics,
  appendPersistedDiagnostics,
  readPersistedDiagnostics
} from '@/lib/backend/wasm/diagnostics-store'

function messagesOf(entries: readonly string[]): (string | undefined)[] {
  return entries.map((entry) => entry.split('] ')[1])
}

// Mirrors the client/worker cycle: the worker appends, the client flushes each
// drain into storage, and an export is storage plus whatever the worker still
// holds. Covers the reload and eviction paths the unit tests cannot see.
describe('end-to-end flush lifecycle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('survives a reload: pre-reload history is exported after a fresh worker', () => {
    const session1 = createDiagnosticsLog(500)
    session1.append('info', 'wallet opened (abc)')
    session1.append('info', 'boardAmount(50000)')
    // flush timer tick
    appendPersistedDiagnostics(session1.drain())

    // reload: worker dies, new log starts empty
    const session2 = createDiagnosticsLog(500)
    session2.append('info', 'wallet opened (abc)')
    appendPersistedDiagnostics(session2.drain())

    const exported = appendMissingDiagnostics(readPersistedDiagnostics(), session2.snapshot())
    const messages = messagesOf(exported)
    expect(messages).toStrictEqual([
      'wallet opened (abc)',
      'boardAmount(50000)',
      'wallet opened (abc)'
    ])
  })

  it('export includes entries appended since the last flush', () => {
    const log = createDiagnosticsLog(500)
    log.append('info', 'flushed')
    appendPersistedDiagnostics(log.drain())
    log.append('error', 'not yet flushed')
    // export flushes first, exactly as the client does
    appendPersistedDiagnostics(log.drain())
    const exported = appendMissingDiagnostics(readPersistedDiagnostics(), log.snapshot())
    expect(messagesOf(exported)).toStrictEqual(['flushed', 'not yet flushed'])
  })

  it('no double-counting across repeated flushes', () => {
    const log = createDiagnosticsLog(500)
    log.append('info', 'once')
    appendPersistedDiagnostics(log.drain())
    appendPersistedDiagnostics(log.drain())
    appendPersistedDiagnostics(log.drain())
    const exported = appendMissingDiagnostics(readPersistedDiagnostics(), log.snapshot())
    expect(exported).toHaveLength(1)
  })

  it('ring eviction: storage keeps history the worker buffer dropped', () => {
    const log = createDiagnosticsLog(2)
    for (const m of ['a', 'b', 'c', 'd']) {
      log.append('info', m)
      appendPersistedDiagnostics(log.drain())
    }
    const exported = appendMissingDiagnostics(readPersistedDiagnostics(), log.snapshot())
    expect(messagesOf(exported)).toStrictEqual(['a', 'b', 'c', 'd'])
  })
})
