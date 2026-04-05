/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0b0f0c',
        surface: '#101512',
        panel: '#0f1a13',
        border: '#1c2a22',
        muted: '#9fbda7',
        accent: '#a3ff12',
        'accent-soft': '#7dff9b',
        foreground: '#e6ffe9',
        success: '#7dff9b',
        warning: '#d0ff6c',
        danger: '#d7ff8b',
      },
      boxShadow: {
        soft: '0 28px 50px -22px rgba(0, 0, 0, 0.85)',
        inset: 'inset 0 1px 0 rgba(163, 255, 18, 0.08)',
        glow: '0 0 0 1px rgba(163,255,18,0.12), 0 0 28px rgba(163,255,18,0.14)',
      },
      backgroundImage: {
        glow:
          'radial-gradient(circle at top, rgba(163,255,18,0.12), transparent 30%), radial-gradient(circle at 82% 14%, rgba(125,255,155,0.10), transparent 22%)',
      },
      fontFamily: {
        display: ['"Manrope"', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
