import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system']
      },
      colors: {
        brand: {
          50: '#f5f8ff',
          100: '#e8efff',
          200: '#c7d7ff',
          300: '#a0b8ff',
          400: '#6f90ff',
          500: '#3d6bff',
          600: '#1f4ee6',
          700: '#163bb4',
          800: '#132f8a',
          900: '#111f5d'
        }
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.08)',
        'soft-lg': '0 20px 50px rgba(15, 23, 42, 0.12)'
      }
    }
  },
  plugins: []
} satisfies Config;