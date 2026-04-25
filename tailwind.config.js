/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#07111f',
        surface: '#0b1728',
        panel: '#0d1d33',
        border: '#1a3554',
        muted: '#9db6d4',
        accent: '#38bdf8',
        'accent-soft': '#60a5fa',
        foreground: '#eaf6ff',
        success: '#5eead4',
        warning: '#facc15',
        danger: '#f87171',
      },
      boxShadow: {
        soft: '0 28px 50px -22px rgba(0, 0, 0, 0.85)',
        inset: 'inset 0 1px 0 rgba(56, 189, 248, 0.08)',
        glow: '0 0 0 1px rgba(56,189,248,0.12), 0 0 28px rgba(56,189,248,0.16)',
      },
      backgroundImage: {
        glow:
          'radial-gradient(circle at top, rgba(56,189,248,0.13), transparent 30%), radial-gradient(circle at 82% 14%, rgba(96,165,250,0.11), transparent 22%)',
      },
      fontFamily: {
        display: ['"Manrope"', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
