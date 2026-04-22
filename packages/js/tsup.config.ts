import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm', 'cjs'],
  dts: {
    entry: { index: 'src/index.ts' },
  },
  clean: true,
  sourcemap: false,
  target: 'node20',
  splitting: false,
  shims: false,
  loader: { '.txt': 'text' },
});
