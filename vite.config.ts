import { defineConfig } from 'vite';
import { resolve } from 'path';
import compression from 'vite-plugin-compression';
import { createHtmlPlugin } from 'vite-plugin-html';

export default defineConfig(({ command, mode }) => ({
  // Use '/sstoy/' for production (GitHub Pages), '/' for development
  base: command === 'build' ? '/sstoy/' : '/',

  plugins: [
    // HTML processing plugin for better template support
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          title: 'Stella Sora Tools',
          description: 'Stella Sora character builder, database, and resource calculator',
        }
      }
    }),

    // Brotli compression for production builds
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024, // Only compress files > 1KB
      deleteOriginFile: false
    }),

    // Gzip compression for broader compatibility
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
      deleteOriginFile: false
    })
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@types': resolve(__dirname, 'src/types')
    }
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        characterdb: resolve(__dirname, 'characterdb.html'),
        discdb: resolve(__dirname, 'discdb.html'),
        resources: resolve(__dirname, 'resources.html'),
        tasks: resolve(__dirname, 'tasks.html'),
        dmgcalc: resolve(__dirname, 'dmgcalc.html')
      },
      output: {
        manualChunks: {
          'vendor': ['fuse.js', 'lz-string'],
          'charts': ['chart.js'] // Separate chunk for Chart.js
        }
      }
    },
    minify: 'esbuild',
    target: 'es2020',
    cssCodeSplit: true, // Split CSS per entry point
    chunkSizeWarningLimit: 1000 // Warn for chunks > 1MB
  },

  server: {
    port: 3000,
    open: true
  },

  preview: {
    port: 4173,
    // Also use base path for preview since it simulates production
  }
}));
