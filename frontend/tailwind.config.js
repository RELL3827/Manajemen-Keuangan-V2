/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fintech: {
          bg: '#0A0D14',
          card: '#101522',
          cardHover: '#161E30',
          border: '#1E2638',
          subtle: '#2A344A',
          text: '#F8FAFC',
          muted: '#94A3B8',
          primary: '#2563EB',
          primaryHover: '#1D4ED8',
          success: '#10B981',
          danger: '#F43F5E',
          warning: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'fintech': '0 2px 10px 0 rgba(0, 0, 0, 0.4), 0 1px 3px 0 rgba(0, 0, 0, 0.3)',
        'fintech-subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.25)',
        'fintech-card': '0 4px 20px -2px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
      }
    },
  },
  plugins: [],
}
