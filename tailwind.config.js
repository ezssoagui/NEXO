/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#eef4ff', 100: '#dbe6fe', 200: '#bfd3fe', 300: '#93b4fd', 400: '#6391fa', 500: '#3b6ef5', 600: '#2556e4', 700: '#1d45c2', 800: '#1d3b9b', 900: '#1c357a', 950: '#14224d' },
        ink: { 50: '#f8f9fb', 100: '#f1f3f6', 200: '#e4e7ec', 300: '#cdd2da', 400: '#9aa3b0', 500: '#667080', 600: '#4b5462', 700: '#363d49', 800: '#232932', 900: '#171b22', 950: '#0f1217' },
      },
      keyframes: { fadeUp: { '0%': { opacity: 0, transform: 'translateY(4px)' }, '100%': { opacity: 1, transform: 'none' } } },
      animation: { fadeUp: 'fadeUp .2s ease-out both' },
    },
  },
  plugins: [],
}
