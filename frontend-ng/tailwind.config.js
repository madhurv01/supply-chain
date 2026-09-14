/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0a0e0d',
          1: '#0f1512',
          2: '#151c18',
          3: '#1c2520',
          border: '#26312b',
        },
        accent: {
          DEFAULT: '#4ade80',
          lime: '#a3e635',
          emerald: '#10b981',
          dim: '#1a2e22',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}
