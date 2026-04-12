import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const isNativeBuild = process.env.VITE_PLATFORM === 'native';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA disabled for native Capacitor builds (service worker not supported in WebView)
    !isNativeBuild && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['scc-logo.jpg', 'icons/*.png'],
      manifest: {
        name: 'Sangria Cricket Club',
        short_name: 'SCC',
        description: 'Sangria Cricket Club - Member and Fund Management App',
        theme_color: '#10b981',
        background_color: '#064e3b',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache Supabase API calls (network-first with fallback)
            urlPattern: /^https:\/\/zrrmpaatydhlkntfpcmw\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cache Supabase Storage files (images - cache first)
            urlPattern: /^https:\/\/zrrmpaatydhlkntfpcmw\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
          {
            // Cache Google Fonts if any
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — loads first
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // Charts — heavy, only needed on Analytics/Finance/AI pages
          'vendor-charts': ['recharts'],
          // Icons
          'vendor-icons': ['lucide-react'],
        },
      },
    },
    // Raise warning threshold slightly — we have intentional vendor splits
    chunkSizeWarningLimit: 600,
  },
})
