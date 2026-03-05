module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      screens: {
        'xs': {'max': '639px'}, // Custom xs breakpoint for < 640px
      },
      colors:{
        'calm-blue': '#E6F3FF',
        'calm-green': '#E8F5E8',
      },
      backgroundImage: {
        'calm-blue-gradient': 'linear-gradient(90deg, rgba(73, 96, 140, 1) 0%, rgba(95, 120, 172, 1) 25%, rgba(112, 139, 191, 1) 50%, rgba(134, 160, 204, 1) 75%, rgba(167, 190, 221, 1) 100%)',
        'calm-green-gradient': 'linear-gradient(90deg, rgba(129, 188, 163, 1) 0%, rgba(157, 202, 171, 1) 30%, rgba(179, 215, 187, 1) 60%, rgba(202, 230, 200, 1) 100%)',
        'calm-blue-gradient-25': 'linear-gradient(90deg, rgba(73, 96, 140, 0.25) 0%, rgba(95, 120, 172, 0.25) 25%, rgba(112, 139, 191, 0.25) 50%, rgba(134, 160, 204, 0.25) 75%, rgba(167, 190, 221, 0.25) 100%)',
        'calm-green-gradient-25': 'linear-gradient(90deg, rgba(129, 188, 163, 0.25) 0%, rgba(157, 202, 171, 0.25) 30%, rgba(179, 215, 187, 0.25) 60%, rgba(202, 230, 200, 0.25) 100%)',
        'lava': 'radial-gradient(circle at 20% 30%, #ff4500 0%, transparent 50%), radial-gradient(circle at 80% 70%, #ff8c00 0%, transparent 50%), radial-gradient(circle at 50% 50%, #ff0000 0%, transparent 50%)',
      },
      keyframes: {
        lavaFloat: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(120px, -160px) scale(1.2)' },
        },
        lavaFloatReverse: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-140px, 140px) scale(1.1)' },
        },
        lavaSlow: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '50%': { transform: 'translate(60px, -80px)' },
        },
      },
      animation: {
        lava: 'lavaFloat 22s ease-in-out infinite',
        lavaReverse: 'lavaFloatReverse 28s ease-in-out infinite',
        lavaSlow: 'lavaSlow 35s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

