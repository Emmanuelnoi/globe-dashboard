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
    exclude: ['node_modules', 'dist', '.angular', 'documentation'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,js}'],
      exclude: [
        'node_modules/',
        'documentation/',
        'e2e/',
        'tests/',
        'scripts/',
        'playwright-report/',
        'test-results/',
        '*.mjs',
        '*.js',
        'src/test-setup.ts',
        'src/test-setup/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/types/**',
        '**/models/**',
        'dist/',
        '.angular/',
        'src/main.ts',
        'src/environments/**',
      ],
      thresholds: {
        statements: 30,
        branches: 70,
        functions: 50,
        lines: 30,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      '@env': fileURLToPath(new URL('./src/environments', import.meta.url)),
    },
  },
  define: {
    'import.meta.vitest': undefined,
  },
});
