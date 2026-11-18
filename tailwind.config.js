export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'], mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'] },
      colors: {
        bgDark: '#090D16',
        navDark: '#0B101B',
        embedDark: '#0D1320',
        floatDark: '#0E1525',
        modalDark: '#0F1624',
        cardDark: '#111827',
        dragDark: '#121A2B',
        borderDark: '#1F2937',
        electricBlue: '#3B82F6',
        emeraldGreen: '#10B981',
        coralRed: '#F43F5E',
        amberGold: '#F59E0B',
      },
    },
  },
  safelist: [{ pattern: /(text|bg|border)-(emeraldGreen|electricBlue|coralRed|amberGold|gray-400)(\/\d+)?/ }],
  plugins: [],
};
