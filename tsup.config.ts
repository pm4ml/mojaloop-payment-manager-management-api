import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['./src/**/*.ts'],
  clean: true,
  sourcemap: true,
  skipNodeModulesBundle: true,
  splitting: false,
  esbuildOptions(options) {
    options.alias = {
      '@app': './src',
    };
  },
});
