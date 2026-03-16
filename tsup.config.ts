import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/google.ts',
    'src/apple.ts',
    'src/oidc.ts',
    'src/test-accounts.ts',
    'src/role-store.ts',
    'src/api-keys.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
});
