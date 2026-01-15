import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'

const MNEMONIC_WORDS_SPLIT_REGEX = /\s+/

const createWalletSchema = z.object({
  mnemonic: z.string().refine(
    (val) => {
      const words = val.trim().split(MNEMONIC_WORDS_SPLIT_REGEX)
      return words.length === 12 || words.length === 24
    },
    { message: 'mnemonic must be 12 or 24 words' }
  )
})

const execAsync = promisify(exec)
const app = new Hono()

app.use('*', cors())

app.get('/api/v1/wallet', async (c) => {
  try {
    const { stdout } = await execAsync(
      'docker exec bark find /root/.bark -type f 2>/dev/null | head -n 1'
    )

    const exists = stdout.trim().length > 0

    return c.json({ exists })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500)
  }
})

app.post('/api/v1/wallet', async (c) => {
  try {
    // TODO: Receive arguments in the future (--signet, --ark, --esplora, etc.)
    const body = await c.req.json()
    const result = createWalletSchema.safeParse(body)

    if (!result.success) {
      return c.json({ error: 'Invalid mnemonic' }, 400)
    }

    const { mnemonic } = result.data

    const { stdout } = await execAsync(
      `docker exec bark ./bark create --signet --ark ark.signet.2nd.dev --esplora esplora.signet.2nd.dev --mnemonic "${mnemonic}"`
    )

    await execAsync('docker restart barkd')

    return c.json({ output: stdout })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500)
  }
})

app.delete('/api/v1/wallet', async (c) => {
  try {
    await execAsync('docker stop barkd')

    await execAsync('docker exec bark find /root/.bark -mindepth 1 -delete')

    await execAsync('docker start barkd')

    return c.json({ message: 'Wallet deleted' })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500)
  }
})

const port = 5174
console.log(`Proxy server running on port ${port}`)
serve({ fetch: app.fetch, port })
