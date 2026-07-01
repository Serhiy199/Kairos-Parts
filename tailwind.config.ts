import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './features/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#07111F',
        secondary: '#12304A',
        accent: '#F5B800',
        background: '#F4F6F8',
        foreground: '#111827',
        muted: '#6B7280',
        border: '#E2E8F0',
        card: '#FFFFFF',
        success: '#2E7D4F',
        warning: '#B7791F',
        danger: '#B42318',
        info: '#2563A6',
        'dark-sidebar': '#07111F',
        'button-primary': '#F5B800',
        'button-secondary': '#101827',
        'surface-muted': '#F8FAFC',
        'sidebar-active': '#132238',
        'sidebar-text': '#D7DEE8',
        'sidebar-muted': '#8EA0B5'
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px'
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06)',
        panel: '0 12px 32px rgba(7, 17, 31, 0.12)'
      }
    }
  },
  plugins: []
};

export default config;
