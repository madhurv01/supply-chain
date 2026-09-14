/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#f5f6f8',
          1: '#ffffff',
          2: '#f1f3f6',
          3: '#e7eaef',
          border: '#e3e6ec',
        },
        accent: {
          DEFAULT: '#059669',
          lime: '#0d9488',
          emerald: '#047857',
          dim: '#ecfdf5',
        },
        ink: {
          primary: '#0f172a',
          secondary: '#4b5563',
          tertiary: '#6b7280',
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
