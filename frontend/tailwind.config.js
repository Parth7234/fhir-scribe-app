/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary — Matcha Green
        "primary": "#56642b",
        "on-primary": "#ffffff",
        "primary-container": "#8a9a5b",
        "on-primary-container": "#253000",
        "primary-fixed": "#d9eaa3",
        "primary-fixed-dim": "#bdce89",
        "on-primary-fixed": "#161f00",
        "on-primary-fixed-variant": "#3e4c16",
        "inverse-primary": "#bdce89",
        "surface-tint": "#56642b",

        // Secondary — Soft Peach
        "secondary": "#7c5637",
        "on-secondary": "#ffffff",
        "secondary-container": "#fecaa3",
        "on-secondary-container": "#795334",
        "secondary-fixed": "#ffdcc3",
        "secondary-fixed-dim": "#efbc96",
        "on-secondary-fixed": "#2f1500",
        "on-secondary-fixed-variant": "#623f22",

        // Tertiary — Sage
        "tertiary": "#506354",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#849887",
        "on-tertiary-container": "#1e3023",
        "tertiary-fixed": "#d3e8d5",
        "tertiary-fixed-dim": "#b7ccb9",
        "on-tertiary-fixed": "#0e1f13",
        "on-tertiary-fixed-variant": "#394b3d",

        // Neutral Surfaces
        "surface": "#f9f9f9",
        "surface-dim": "#dadada",
        "surface-bright": "#f9f9f9",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f3f3f3",
        "surface-container": "#eeeeee",
        "surface-container-high": "#e8e8e8",
        "surface-container-highest": "#e2e2e2",
        "on-surface": "#1a1c1c",
        "on-surface-variant": "#46483c",
        "surface-variant": "#e2e2e2",
        "inverse-surface": "#2f3131",
        "inverse-on-surface": "#f0f1f1",

        // Outline
        "outline": "#76786b",
        "outline-variant": "#c6c8b8",

        // Error
        "error": "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",

        // Background
        "background": "#f9f9f9",
        "on-background": "#1a1c1c",
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-lg-mobile": ["28px", { lineHeight: "36px", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "500" }],
        "label-sm": ["12px", { lineHeight: "16px", fontWeight: "600" }],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.5rem",
      },
      spacing: {
        "gutter": "16px",
        "container-padding": "24px",
        "unit": "8px",
        "stack-sm": "8px",
        "stack-md": "16px",
        "stack-lg": "32px",
      },
      boxShadow: {
        "glass": "0px 4px 20px rgba(138, 154, 91, 0.08)",
        "glass-hover": "0px 8px 32px rgba(138, 154, 91, 0.12)",
        "btn-primary": "0px 4px 20px rgba(86, 100, 43, 0.2)",
        "btn-primary-hover": "0px 8px 32px rgba(86, 100, 43, 0.3)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        "recording-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(186, 26, 26, 0.3), 0 0 60px rgba(186, 26, 26, 0.08)" },
          "50%": { boxShadow: "0 0 40px rgba(186, 26, 26, 0.5), 0 0 80px rgba(186, 26, 26, 0.15)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "feed-slide-in": {
          "0%": { opacity: "0", transform: "translateX(-12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
        "pulse-ring": "pulse-ring 2s ease-out infinite",
        "recording-glow": "recording-glow 2s ease-in-out infinite",
        shimmer: "shimmer 1.8s ease-in-out infinite",
        "feed-slide-in": "feed-slide-in 0.4s ease-out forwards",
      },
    },
  },
  plugins: [],
}
