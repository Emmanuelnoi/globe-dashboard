import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

export default defineConfig({
  plugins: [
    // Plugin to handle Angular template and style files
    {
      name: 'angular-files',
      load(id) {
        if (id.endsWith('.html')) {
          const content = readFileSync(id, 'utf-8');
          return `export default ${JSON.stringify(content)}`;
        }
        if (id.endsWith('.scss') || id.endsWith('.css')) {
          const content = readFileSync(id, 'utf-8');
          return `export default ${JSON.stringify(content)}`;
        }
        return undefined;
      },
    },
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts', 'src/test-setup/webgl-setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.angular'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test-setup.ts',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        '.angular/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  define: {
    'import.meta.vitest': undefined,
  },
});
