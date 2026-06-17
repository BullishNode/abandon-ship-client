// Rasterizes public/favicon.svg (dark tile + white logo) into PNG fallbacks.
// Run: node scripts/gen-favicon.mjs
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'public/favicon.svg')

const targets = [
  { out: 'public/favicon.png', size: 32 },
  { out: 'public/favicon-180.png', size: 180 },
]

for (const { out, size } of targets) {
  await sharp(source, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(resolve(root, out))
  console.log(`wrote ${out} (${size}x${size})`)
}
