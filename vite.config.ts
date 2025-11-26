import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import compression from 'vite-plugin-compression';
import { createHtmlPlugin } from 'vite-plugin-html';

// __dirname replacement for ESM
const __dirname = dirname(fileURLToPath(import.meta.url));

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
    }),

    // Copy preset builds and patch notes into the dist root so fetchJSON works in production
    {
      name: 'copy-preset-builds',
      closeBundle() {
        const filesToCopy = ['PresetBuilds.json', 'patchnotes.json'];
        filesToCopy.forEach((file) => {
          const src = resolve(__dirname, file);
          const dest = resolve(__dirname, 'dist', file);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
          }
        });
      }
    }
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@types': resolve(__dirname, 'src/types')
    }
  },

  build: {
    outDir: 'dist',
    // Disable source maps in production for smaller bundle size
    sourcemap: mode === 'development',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        characterdb: resolve(__dirname, 'characterdb.html'),
        discdb: resolve(__dirname, 'discdb.html'),
        resources: resolve(__dirname, 'resources.html'),
        tasks: resolve(__dirname, 'tasks.html')
      },
      output: {
        // More aggressive code splitting
        manualChunks: (id) => {
          // Vendor libraries
          if (id.includes('node_modules')) {
            if (id.includes('fuse.js')) return 'vendor-fuse';
            if (id.includes('lz-string')) return 'vendor-lz';
            if (id.includes('chart.js')) return 'vendor-charts';
            return 'vendor-other';
          }

          // Shared utilities
          if (id.includes('/src/shared/')) {
            return 'shared';
          }

          // Module-specific chunks
          if (id.includes('/src/modules/')) {
            if (id.includes('app-char')) return 'module-char';
            if (id.includes('app-disc')) return 'module-disc';
            if (id.includes('app-saveload')) return 'module-saveload';
            if (id.includes('app-summary')) return 'module-summary';
            if (id.includes('app-preset')) return 'module-preset';
          }
        },
        // Optimize chunk and asset file names for better caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') ?? [];
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext ?? '')) {
            return `assets/img/[name]-[hash][extname]`;
          } else if (/woff|woff2/.test(ext ?? '')) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[ext]/[name]-[hash][extname]`;
        }
      }
    },
    // Use terser for better minification
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove console.log in production
        drop_console: mode === 'production',
        drop_debugger: true,
        pure_funcs: mode === 'production' ? ['console.log', 'console.debug'] : [],
        passes: 2, // Run compression twice for better results
      },
      mangle: {
        safari10: true, // Fix Safari 10/11 bugs
      },
      format: {
        comments: false, // Remove all comments
      }
    },
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 500, // Warn for chunks > 500KB (more aggressive)
    // Optimize asset inlining
    assetsInlineLimit: 4096, // Inline assets < 4KB as base64
  },

  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: ['fuse.js', 'lz-string', 'chart.js'],
    exclude: [],
  },

  // Enable build cache
  cacheDir: 'node_modules/.vite',

  server: {
    port: 3000,
    open: true
  },

  preview: {
    port: 4173,
    // Also use base path for preview since it simulates production
  }
}));
