/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#001e42',
          container: '#003368',
        },
        surface: {
          DEFAULT: '#f7f9fb',
          low: '#f2f4f6',
          lowest: '#ffffff',
          high: '#e6e8ea',
        },
        error: {
          DEFAULT: '#ba1a1a',
        },
        warning: {
          DEFAULT: '#d97706',
        },
        success: {
          DEFAULT: '#0d9488',
        }
      },
      fontFamily: {
        display: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
