import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': '/src',
      '@game': '/src/game',
      '@components': '/src/components',
      '@pages': '/src/pages',
      '@stores': '/src/stores',
      '@services': '/src/services',
      '@hooks': '/src/hooks',
      '@types': '/src/types',
      '@configs': '/src/configs',
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          if (id.includes('node_modules/react')) return 'react';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
});
