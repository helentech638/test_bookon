import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import cssnano from 'cssnano'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {}
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/assets': path.resolve(__dirname, './src/assets'),
    },
  },
  server: {
    port: 3001,
    host: true,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          forms: ['formik', 'yup', 'react-hook-form'],
          ui: ['framer-motion', 'lucide-react', 'tailwind-merge'],
          utils: ['lodash', 'date-fns', 'uuid'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'stripe',
      '@stripe/stripe-js',
      '@stripe/react-stripe-js',
      'formik',
      'yup',
      'react-hook-form',
      'framer-motion',
      'lucide-react',
      'tailwind-merge',
      'lodash',
      'date-fns',
      'uuid',
    ],
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer,
        cssnano({
          preset: 'default',
        }),
      ],
    },
  },
})
