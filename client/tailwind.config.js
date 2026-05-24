export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  corePlugins: {
    preflight: false, // Prevents tailwind from breaking existing vanilla CSS
  },
  theme: {
    extend: {},
  },
  plugins: [],
}
