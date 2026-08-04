import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Raise the warning threshold — single chunk is expected for now
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Split heavy dependencies into separate chunks so the browser can
        // cache them independently and load them in parallel.
        manualChunks: {
          // React core — rarely changes
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // Charts — large, only needed on dashboard/reports
          'vendor-charts': ['recharts'],
          // Animation — large, only needed on a few pages
          'vendor-motion': ['framer-motion'],
          // All Radix UI primitives together
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-popover',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-switch',
            '@radix-ui/react-avatar',
            '@radix-ui/react-accordion',
          ],
          // Icons
          'vendor-icons': ['lucide-react'],
          // Tanstack query
          'vendor-query': ['@tanstack/react-query'],
          // sonner toast
          'vendor-sonner': ['sonner'],
        },
      },
    },
  },
});
