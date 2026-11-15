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
        },
        // Guardião Viário · design system do Figma (tema escuro)
        gv: {
          bg: '#0b1220',
          panel: '#111a2e',
          card: '#162036',
          border: '#22304d',
          ink: '#e6edf7',
          muted: '#8a97b0',
          cyan: '#22d3ee',
          cyanink: '#06222a',
          red: '#ef4444',
          green: '#4ade80',
          amber: '#facc15',
          orange: '#fb923c',
          purple: '#a78bfa',
        },
      }
    },
  },
  plugins: [],
};
