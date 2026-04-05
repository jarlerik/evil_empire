import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/theme/tokens.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  external: ['react', 'react-native', 'nativewind'],
  clean: true,
});
