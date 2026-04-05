/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        tactical: {
          bg: '#0D0D0D',
          card: '#1A1A1A',
          elevated: '#222222',
          input: '#262626',
          border: '#2A2A2A',
          'border-focus': '#c65d24',
          primary: '#c65d24',
          'primary-fg': '#FFFFFF',
          'primary-muted': '#A04D1E',
          success: '#22C55E',
          'success-muted': '#166534',
          destructive: '#EF4444',
          'destructive-muted': '#991B1B',
          warning: '#F59E0B',
          text: '#FFFFFF',
          'text-secondary': '#9BA1A6',
          'text-muted': '#666666',
        },
      },
      fontFamily: {
        mono: ['monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
};
