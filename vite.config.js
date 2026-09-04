import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(process.cwd(), 'src/index.ts'),
      name: 'FlowPilot',
      formats: ['es', 'umd'],
      fileName: (format) => `flowpilot.${format}.js`,
    },
    rollupOptions: { output: { exports: 'named' } },
    sourcemap: true,
    minify: 'esbuild',
  },
});
