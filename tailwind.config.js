const withAlpha = (varName) => `rgb(var(${varName}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        bgDark: withAlpha('--c-bg'),
        navDark: withAlpha('--c-nav'),
        embedDark: withAlpha('--c-embed'),
        floatDark: withAlpha('--c-float'),
        modalDark: withAlpha('--c-modal'),
        cardDark: withAlpha('--c-card'),
        dragDark: withAlpha('--c-drag'),
        borderDark: withAlpha('--c-border'),
        electricBlue: withAlpha('--c-accent'),
        emeraldGreen: withAlpha('--c-emerald'),
        coralRed: withAlpha('--c-coral'),
        amberGold: withAlpha('--c-amber'),
        gray: {
          50: withAlpha('--c-gray-50'),
          100: withAlpha('--c-gray-100'),
          200: withAlpha('--c-gray-200'),
          300: withAlpha('--c-gray-300'),
          400: withAlpha('--c-gray-400'),
          500: withAlpha('--c-gray-500'),
          600: withAlpha('--c-gray-600'),
          700: withAlpha('--c-gray-700'),
          800: withAlpha('--c-gray-800'),
          900: withAlpha('--c-gray-900'),
          950: withAlpha('--c-gray-950'),
        },
        blue: {
          50: withAlpha('--c-accent-50'),
          100: withAlpha('--c-accent-100'),
          200: withAlpha('--c-accent-200'),
          300: withAlpha('--c-accent-300'),
          400: withAlpha('--c-accent-400'),
          500: withAlpha('--c-accent-500'),
          600: withAlpha('--c-accent-600'),
          700: withAlpha('--c-accent-700'),
          800: withAlpha('--c-accent-800'),
          900: withAlpha('--c-accent-900'),
        },
      },
    },
  },
  safelist: [{ pattern: /(text|bg|border)-(emeraldGreen|electricBlue|coralRed|amberGold|gray-400)(\/\d+)?/ }],
  plugins: [],
};
