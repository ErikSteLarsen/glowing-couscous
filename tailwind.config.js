/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        slatebrand: {
          50: '#eef3ff',
          100: '#d8e3ff',
          200: '#b4c8ff',
          300: '#86a4ff',
          400: '#5a7cff',
          500: '#3b5af5',
          600: '#2f46d1',
          700: '#293aaa',
          800: '#253388',
          900: '#222e6d',
        },
      },
    },
  },
  plugins: [],
};
