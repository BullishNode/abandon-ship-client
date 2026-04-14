import { defineConfig } from 'oxfmt'
import ultracite from 'ultracite/oxfmt'

export default defineConfig({
  extends: [ultracite],
  ignorePatterns: ['.claude/skills', 'src/components/ui'],
  semi: false,
  singleQuote: true,
  trailingComma: 'none'
})
