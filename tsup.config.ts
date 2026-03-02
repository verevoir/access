import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/google.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
});
