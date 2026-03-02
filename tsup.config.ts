import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/google.ts',
    'src/test-accounts.ts',
    'src/role-store.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
});
