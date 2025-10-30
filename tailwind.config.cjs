export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        white: '#E3E6F5',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}