/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#080c0e',
        panel: '#101619',
        line: '#283237',
        acid: '#e9ff3f',
        mist: '#9aa6ab',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'], display: ['Arial Black', 'Inter', 'sans-serif'] },
      boxShadow: { glow: '0 0 35px rgba(233, 255, 63, .12)' },
    },
  },
  plugins: [],
}
