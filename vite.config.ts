import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(pkg.version)
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    force: true
  },
  server: {
    hmr: {
      overlay: false,
      timeout: 30000
    },
    watch: {
      usePolling: true,
      interval: 1000
    },
    host: true,
    strictPort: true
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'EMPTY_BUNDLE') return;
        warn(warning);
      }
    }
  }
});