import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Matches tsup's text loader so .txt imports resolve to string content in tests.
export default defineConfig({
  plugins: [
    {
      name: 'txt-text-loader',
      enforce: 'pre',
      transform(_code, id) {
        if (id.endsWith('.txt')) {
          const content = readFileSync(id, 'utf8');
          return {
            code: `export default ${JSON.stringify(content)};`,
            map: null,
          };
        }
        return null;
      },
    },
  ],
});
