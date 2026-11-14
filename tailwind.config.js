/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gov: {
          navy: '#0B1F3A',
          blue: '#1E3A8A',
          accent: '#2563EB',
          surface: '#F8FAFC',
        }
      }
    },
  },
  plugins: [],
};
