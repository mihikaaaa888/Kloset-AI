/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Palette ──────────────────────────────────────────────────────
        // Every colour is a CSS variable (see :root / .dark in globals.css),
        // so one class works in both light and dark mode.
        // Token names are historical: 'dark-purple'/'deep-purple' hold the
        // cream base and 'butter-yellow'/'soft-butter' the forest-green
        // accent. In dark mode the base turns black with cream text, keeping
        // every pairing (e.g. bg-dark-purple + text-butter-yellow) readable.
        'dark-purple': 'rgb(var(--c-dark-purple) / <alpha-value>)',
        'deep-purple': 'rgb(var(--c-deep-purple) / <alpha-value>)',
        'butter-yellow': 'rgb(var(--c-butter-yellow) / <alpha-value>)',
        'soft-butter': 'rgb(var(--c-soft-butter) / <alpha-value>)',
        'warm-cream': 'rgb(var(--c-warm-cream) / <alpha-value>)',
        'text-primary': 'rgb(var(--c-text-primary) / <alpha-value>)',
        'text-muted': 'rgb(var(--c-text-muted) / <alpha-value>)',
        // Cards, inputs and sheets that sit on the page background.
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        // Backdrop behind a clothing photo or placeholder glyph.
        tile: 'rgb(var(--c-tile) / <alpha-value>)',
        // Modal/menu backdrops — always dark, whatever the theme.
        scrim: 'rgb(var(--c-scrim) / <alpha-value>)',
        purple: {
          950: '#2B173F',
          900: '#3A2154',
          800: '#4D2D6B',
          700: '#613A84',
          400: '#A47BC0',
          300: '#C4A8D8',
        },
        // ── Legacy palette (kept for existing components during migration) ─
        cream: {
          50: 'rgb(var(--c-cream-50) / <alpha-value>)',
          100: 'rgb(var(--c-cream-100) / <alpha-value>)',
          200: 'rgb(var(--c-cream-200) / <alpha-value>)',
          300: 'rgb(var(--c-cream-300) / <alpha-value>)',
        },
        charcoal: {
          900: 'rgb(var(--c-charcoal-900) / <alpha-value>)',
          800: 'rgb(var(--c-charcoal-800) / <alpha-value>)',
          700: 'rgb(var(--c-charcoal-700) / <alpha-value>)',
          600: 'rgb(var(--c-charcoal-600) / <alpha-value>)',
          500: 'rgb(var(--c-charcoal-500) / <alpha-value>)',
          400: 'rgb(var(--c-charcoal-400) / <alpha-value>)',
          300: 'rgb(var(--c-charcoal-300) / <alpha-value>)',
        },
        stone: {
          warm: '#8C7B6E',
          light: '#B8A99A',
          muted: '#D4C9BE',
        },
        gold: {
          DEFAULT: '#C9A96E',
          light: '#E8D5B0',
          muted: 'rgb(var(--c-gold-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
        // Headings — an editorial high-contrast serif with a true italic.
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        // Just for the "Kloset" wordmark. The personal-use build of Mutalis swaps
        // every digit for a "PERSONAL USE ONLY" watermark, so never use it on
        // text that can contain numbers.
        brand: ['"Mutalis Fashion"', '"Times New Roman"', 'serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      letterSpacing: {
        widest: '0.25em',
        'ultra-wide': '0.35em',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': 'var(--shadow-soft)',
        'medium': 'var(--shadow-medium)',
        'lifted': 'var(--shadow-lifted)',
        'card': 'var(--shadow-card)',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-in-right': 'slideInRight 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'scroll-cue': 'scrollCue 2.2s cubic-bezier(0.65, 0, 0.35, 1) infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        // A hairline that draws downward, then slips away below — "keep going".
        scrollCue: {
          '0%': { transform: 'scaleY(0)', transformOrigin: 'top' },
          '45%': { transform: 'scaleY(1)', transformOrigin: 'top' },
          '55%': { transform: 'scaleY(1)', transformOrigin: 'bottom' },
          '100%': { transform: 'scaleY(0)', transformOrigin: 'bottom' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      transitionTimingFunction: {
        'ease-editorial': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      },
    },
  },
  plugins: [],
}
