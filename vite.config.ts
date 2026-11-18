import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'GymApp', short_name: 'GymApp', lang: 'es',
        description: 'Entrenamientos de fuerza, rutinas y progreso físico',
        theme_color: '#090D16', background_color: '#090D16', display: 'standalone', start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'], navigateFallbackDenylist: [/^\/__\//] }
    })
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'firebase-firestore', test: /node_modules[\\/]@?firebase[\\/]firestore/, priority: 30 },
            { name: 'firebase-auth', test: /node_modules[\\/]@?firebase[\\/](auth|app-check|app)/, priority: 20 },
            { name: 'charts', test: /node_modules[\\/](chart\.js|@kurkle)/, priority: 20 },
          ],
        },
      },
    },
  },
  test: { include: ['tests/**/*.test.{ts,tsx}'] }
} as any);
