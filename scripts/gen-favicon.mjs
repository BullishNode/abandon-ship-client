import { resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'public/favicon.svg')

const targets = [
  { out: 'public/favicon.png', size: 32 },
  { out: 'public/favicon-180.png', size: 180 }
]

for (const { out, size } of targets) {
  await sharp(source, { density: 384 }).resize(size, size).png().toFile(resolve(root, out))
  console.log(`wrote ${out} (${size}x${size})`)
}
