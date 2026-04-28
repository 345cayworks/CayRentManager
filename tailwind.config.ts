import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0f1e3d',
          success: '#16a34a',
          danger: '#dc2626',
          warning: '#d97706'
        }
      }
    },
  },
  plugins: [],
};

export default config;
