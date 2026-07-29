/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          0: 'var(--ink-0)', 1: 'var(--ink-1)', 2: 'var(--ink-2)', 3: 'var(--ink-3)',
          4: 'var(--ink-4)', 5: 'var(--ink-5)', 6: 'var(--ink-6)', 7: 'var(--ink-7)',
        },
        paper: 'var(--paper)',
        'paper-raised': 'var(--paper-raised)',
        line: 'var(--line)',
        edge: 'var(--edge)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-line': 'var(--accent-line)',
        caveat: 'var(--caveat)',
        'caveat-soft': 'var(--caveat-soft)',
        'caveat-line': 'var(--caveat-line)',
      },
      /**
       * THE TYPE SCALE. Nine steps, defined once in styles.css. Do not add a
       * `text-[13px]`: if a size is not on this list it does not belong in the
       * design, and six near-identical sizes read as one muddy size.
       */
      fontSize: {
        '2xs': ['var(--fs-2xs)', { lineHeight: '1.45' }],
        xs: ['var(--fs-xs)', { lineHeight: '1.5' }],
        sm: ['var(--fs-sm)', { lineHeight: '1.55' }],
        base: ['var(--fs-base)', { lineHeight: '1.6' }],
        md: ['var(--fs-md)', { lineHeight: '1.5' }],
        lg: ['var(--fs-lg)', { lineHeight: '1.3' }],
        xl: ['var(--fs-xl)', { lineHeight: '1.22' }],
        '2xl': ['var(--fs-2xl)', { lineHeight: '1.15' }],
        '3xl': ['var(--fs-3xl)', { lineHeight: '1.06' }],
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        serif: 'var(--font-serif)',
        mono: 'var(--font-mono)',
      },
      maxWidth: { content: '72rem', measure: '68ch', 'measure-wide': '82ch' },
      spacing: {
        tight: 'var(--space-tight)',
        block: 'var(--space-block)',
        section: 'var(--space-section)',
        'disclaimer-h': 'var(--disclaimer-h)',
        'header-h': 'var(--header-h)',
      },
    },
  },
  plugins: [],
};
