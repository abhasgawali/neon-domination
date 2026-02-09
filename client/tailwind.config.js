/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          primary: '#00f0ff',
          secondary: '#ff00ff',
          accent: '#ffff00',
        },
      },
    },
  },
  plugins: [],
}
