import { defineConfig } from 'oxfmt'
import ultracite from 'ultracite/oxfmt'

export default defineConfig({
  extends: [ultracite],
  ignorePatterns: ['.claude/skills', 'src/components/ui', 'scripts/compose.mjs'],
  semi: false,
  singleQuote: true,
  trailingComma: 'none'
})
