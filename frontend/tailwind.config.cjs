/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        brand: {
          50: "#f0f9ee",
          100: "#dcefd8",
          200: "#b8deb2",
          300: "#8ec98a",
          400: "#5aa958",
          500: "#3b9234",
          600: "#327a2c",
          700: "#285f24",
          800: "#204b1d",
          900: "#193b17"
        },
        accentBlue: {
          50: "#ebf6ff",
          100: "#cfe9ff",
          200: "#9fd3ff",
          300: "#66b7ff",
          400: "#2f95f0",
          500: "#015292",
          600: "#014a82",
          700: "#013f6f",
          800: "#01355e",
          900: "#012a4a"
        },
        neutral: {
          950: "#0b1120"
        },
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          700: "#15803d"
        },
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          700: "#b45309"
        },
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#ef4444",
          700: "#b91c1c"
        }
      },
      boxShadow: {
        soft: "0 8px 26px rgba(15, 23, 42, 0.08)",
        card: "0 12px 36px rgba(15, 23, 42, 0.12)"
      },
      animation: {
        "pulse-soft": "pulse-soft 1.5s ease-in-out infinite",
        "fade-in": "fade-in 180ms ease-out",
        "slide-up": "slide-up 220ms ease-out"
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "0.85" },
          "50%": { opacity: "0.45" }
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        "slide-up": {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        }
      }
    }
  },
  plugins: []
};
