const config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,md}',
    './components/**/*.{js,ts,jsx,tsx,md}',
    './lib/**/*.{js,ts,jsx,tsx,md}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Changa', 'sans-serif'],
      },
      colors: {
        navy: '#071B35',
        burgundy: '#6F1029',
        cream: '#F4EFE3',
        gold: '#D9A441',
      },
    },
  },
  plugins: [],
};

export default config;
