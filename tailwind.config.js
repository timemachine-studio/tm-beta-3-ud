/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'sans-serif'],
        display: ['SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Montserrat', 'sans-serif'],
      },
      colors: {
        glass: {
          white: 'rgba(255, 255, 255, 0.05)',
          light: 'rgba(255, 255, 255, 0.08)',
          DEFAULT: 'rgba(255, 255, 255, 0.1)',
          dark: 'rgba(255, 255, 255, 0.15)',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glass: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'glass-hover': '0 8px 16px -4px rgba(0, 0, 0, 0.1), 0 4px 8px -2px rgba(0, 0, 0, 0.06)',
        'glass-active': '0 1px 2px rgba(0, 0, 0, 0.1)',
      },
      keyframes: {
        gradient: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
      },
      animation: {
        gradient: "gradient var(--animation-duration, 8s) linear infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      typography: {
        DEFAULT: {
          css: {
            color: 'rgba(255, 255, 255, 0.7)',
            maxWidth: 'none',
            hr: {
              borderColor: 'rgba(255, 255, 255, 0.1)',
              marginTop: '2rem',
              marginBottom: '2rem',
            },
            'h1, h2, h3, h4': {
              color: 'rgba(255, 255, 255, 0.95)',
              fontWeight: '600',
              letterSpacing: '-0.02em',
            },
            strong: {
              color: 'rgba(255, 255, 255, 0.95)',
              fontWeight: '600',
            },
            a: {
              color: '#A855F7',
              textDecoration: 'none',
              transition: 'color 0.2s ease',
              '&:hover': {
                color: '#9333EA',
              },
            },
            code: {
              color: 'rgba(255, 255, 255, 0.9)',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '0.375rem',
              padding: '0.25rem 0.5rem',
              fontFamily: 'SF Mono, ui-monospace, monospace',
              fontSize: '0.875em',
            },
            pre: {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '0.5rem',
              padding: '1rem',
              code: {
                backgroundColor: 'transparent',
                padding: 0,
                color: 'rgba(255, 255, 255, 0.9)',
              },
            },
            blockquote: {
              borderLeftColor: 'rgba(168, 85, 247, 0.4)',
              color: 'rgba(255, 255, 255, 0.8)',
              fontStyle: 'normal',
              paddingLeft: '1.5rem',
            },
            'ul > li::before': {
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              width: '0.375rem',
              height: '0.375rem',
              borderRadius: '50%',
            },
            'ol > li::before': {
              color: 'rgba(255, 255, 255, 0.7)',
              fontWeight: '500',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};