/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#10141a',
        surface: '#10141a',
        'surface-container-lowest': '#0a0e14',
        'surface-container-low': '#181c22',
        'surface-container': '#1c2026',
        'surface-container-high': '#262a31',
        'surface-container-highest': '#31353c',
        'surface-bright': '#353940',
        'surface-variant': '#31353c',
        'on-background': '#dfe2eb',
        'on-surface': '#dfe2eb',
        'on-surface-variant': '#c1c6d6',
        outline: '#8b909f',
        'outline-variant': '#414754',
        primary: '#acc7ff',
        'primary-container': '#498fff',
        'on-primary': '#002f68',
        'on-primary-container': '#00285b',
        secondary: '#f1c04c',
        'on-secondary': '#3f2e00',
        tertiary: '#7bdb80',
        'on-tertiary': '#00390e',
        error: '#ffb4ab',
        'error-container': '#93000a',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Geist', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      maxWidth: {
        'container-max': '1200px',
      },
      spacing: {
        gutter: '16px',
      },
      boxShadow: {
        ring: '0 0 0 1px rgba(255,255,255,0.08)',
      },
    },
  },
  plugins: [],
};
