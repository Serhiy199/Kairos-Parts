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
        primary: '#050505',
        secondary: '#101010',
        accent: '#C89642',
        'accent-hover': '#B37A2E',
        bronze: '#8A5B24',
        silver: '#7D8085',
        gunmetal: '#4C4F54',
        background: '#F5F6F7',
        foreground: '#101010',
        muted: '#4C4F54',
        border: '#D9DEE3',
        card: '#FFFFFF',
        success: '#2E7D4F',
        warning: '#8A5B24',
        danger: '#B42318',
        info: '#2563A6',
        'dark-sidebar': '#050505',
        'button-primary': '#C89642',
        'button-secondary': '#101010',
        'surface-muted': '#F8FAFC',
        'sidebar-active': '#1A1A1A',
        'sidebar-text': '#E8E8E8',
        'sidebar-muted': '#7D8085',
        'technical-white': '#E8E8E8',
        'public-page': 'var(--public-surface-page)',
        'public-section': 'var(--public-surface-section)',
        'public-card': 'var(--public-surface-card)',
        'public-elevated': 'var(--public-surface-elevated)',
        'public-primary': 'var(--public-text-primary)',
        'public-secondary': 'var(--public-text-secondary)',
        'public-muted': 'var(--public-text-muted)',
        'public-subtle': 'var(--public-text-subtle)',
        'public-success': 'var(--public-text-success)',
        'public-danger': 'var(--public-text-danger)',
        'public-border': 'var(--public-border-subtle)',
        'public-border-accent': 'var(--public-border-accent)',
        'public-border-accent-hover': 'var(--public-border-accent-hover)'
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px'
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06)',
        panel: '0 12px 32px rgba(5, 5, 5, 0.14)'
      },
      fontFamily: {
        ui: ['var(--font-ui)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-ui)', 'ui-sans-serif', 'system-ui'],
        brand: ['var(--font-brand)', 'var(--font-display)', 'var(--font-ui)', 'ui-sans-serif', 'system-ui']
      }
    }
  },
  plugins: []
};

export default config;
