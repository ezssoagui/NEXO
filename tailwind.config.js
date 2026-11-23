/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'] },
      colors: {
        navy: { 50:'#eef3fb',100:'#d5e1f3',200:'#a9c0e4',300:'#7698ce',400:'#4a71b3',500:'#2f5494',600:'#223f74',700:'#192f59',800:'#112142',900:'#0b162e',950:'#060d1d' },
        mint: { 50:'#ecfdf7',100:'#d1faec',200:'#a5f3d9',300:'#6ee7c2',400:'#34d3a6',500:'#14b88d',600:'#0a9573',700:'#0a775e',800:'#0c5e4c',900:'#0b4d40' },
      },
      keyframes: { fadeUp: { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'none' } } },
      animation: { fadeUp: 'fadeUp .35s ease-out both' },
    },
  },
  plugins: [],
}
