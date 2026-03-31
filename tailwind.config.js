/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic Tokens
        accent:  { DEFAULT: 'var(--accent)', light: 'var(--accent-light)', dim: 'var(--accent-dim)', border: 'var(--accent-border)' },
        success: { DEFAULT: 'var(--success)', dim: 'var(--success-dim)' },
        danger:  { DEFAULT: 'var(--danger)', dim: 'var(--danger-dim)' },
        info:    { DEFAULT: 'var(--info)', dim: 'var(--info-dim)' },

        // Backgrounds & Surface
        bg:      'var(--bg)',
        surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface2)', 3: 'var(--surface3)' },
        border:  'var(--border)',

        // Text
        text:    'var(--text)',
        text2:   'var(--text2)',
        text3:   'var(--text3)',
      },
      fontFamily: {
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        body:    ['var(--font-body)', 'Inter', 'sans-serif'],
        mono:    ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
