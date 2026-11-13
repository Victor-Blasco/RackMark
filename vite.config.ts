import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'GymApp - Panel PPL', short_name: 'GymApp', lang: 'es',
        description: 'Rendimiento PPL y antropometria',
        theme_color: '#090D16', background_color: '#090D16', display: 'standalone', start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg}'] }
    })
  ],
  test: { include: ['tests/**/*.test.ts'] }
} as any);
