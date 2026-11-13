export default {
  content: ['./index.html', './src/**/*.ts'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] },
      colors: { bgDark: '#090D16', cardDark: '#111827', borderDark: '#1F2937', electricBlue: '#3B82F6', emeraldGreen: '#10B981', coralRed: '#F43F5E', amberGold: '#F59E0B' },
    },
  },
  safelist: [{ pattern: /(text|bg|border)-(emeraldGreen|electricBlue|coralRed|amberGold|gray-400)(\/\d+)?/ }],
  plugins: [],
};
