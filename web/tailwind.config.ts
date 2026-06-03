import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg:       "var(--bg)",
        raised:   "var(--bg-raised)",
        card:     "var(--bg-card)",
        ink:      "var(--ink)",
        muted:    "var(--muted)",
        faint:    "var(--faint)",
        hairline: "var(--hairline)",
        accent:   "var(--accent)",
        accent2:  "var(--accent2)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body:    ["var(--font-body)"],
        script:  ["var(--font-script)"],
      },
      screens: {
        xs: "480px",
      },
    },
  },
  plugins: [],
};

export default config;
