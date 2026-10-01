/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "rgb(var(--color-cream) / <alpha-value>)",
        ivory: "rgb(var(--color-ivory) / <alpha-value>)",
        blush: "rgb(var(--color-blush) / <alpha-value>)",
        rose: "rgb(var(--color-rose) / <alpha-value>)",
        lavender: "rgb(var(--color-lavender) / <alpha-value>)",
        plum: {
          DEFAULT: "rgb(var(--color-plum) / <alpha-value>)",
          light: "rgb(var(--color-plum-light) / <alpha-value>)",
          dark: "rgb(var(--color-plum-dark) / <alpha-value>)",
        },
        gold: "rgb(var(--color-gold) / <alpha-value>)",
      },
      fontFamily: {
        display: ["'Cormorant Garamond'", "serif"],
        body: ["'Poppins'", "sans-serif"],
        handwritten: ["'Caveat'", "cursive"],
        // Main Home hero heading ONLY. "Script MT Bold" is a licensed desktop font with no
        // legal web-embeddable version, so the stack lists it first (used if the visitor's OS
        // happens to have it) and falls back to Pacifico - a free, bold flowing script loaded
        // via Google Fonts (index.html) that reads the same way - then a generic cursive
        // fallback so the page never breaks if fonts fail to load.
        hero: ["'Script MT Bold'", "'Segoe Script'", "'Pacifico'", "cursive"],
        // "SubhRa Crafts" / "Handmade with Love" branding ONLY - never the whole navbar.
        // Vivaldi has no free web version either; Yellowtail is a free, legible brush script
        // that stays readable at small navbar sizes, which an ornate script often isn't.
        brand: ["'Vivaldi'", "'Yellowtail'", "cursive"],
        // Section headings (Featured Categories, Sales & Offers, Customer Reviews, etc).
        // Copperplate Gothic Bold has no free web version; Cinzel is a free, engraved-look
        // serif with a similar elegant/geometric-caps presence.
        section: ["'Copperplate Gothic Bold'", "'Copperplate'", "'Cinzel'", "serif"],
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(74, 33, 64, 0.18)",
        card: "0 4px 20px -6px rgba(74, 33, 64, 0.12)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
