/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e6f1fb', 100: '#b5d4f4', 200: '#84b7ed',
          300: '#539ae6', 400: '#377dd9', 500: '#185FA5',
          600: '#0f4f8a', 700: '#0c3f6f', 800: '#082f54',
          900: '#051f39',
        },
        green: {
          50: '#e1f5ee', 500: '#0F6E56', 700: '#0a4f3d',
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
