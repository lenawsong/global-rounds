import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef5ff', 100: '#d9e8ff', 200: '#b7d4ff', 300: '#8fb9ff',
          400: '#5b93ff', 500: '#2f6dff', 600: '#1f5be6', 700: '#184aba',
          800: '#133b93', 900: '#0f2f77'
        }
      }
    }
  },
  plugins: []
};

export default config;

