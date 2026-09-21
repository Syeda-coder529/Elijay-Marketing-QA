import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#05050a",
          900: "#0a0a14",
          800: "#12121f"
        }
      },
      backgroundImage: {
        "mesh-gradient":
          "radial-gradient(at 20% 20%, rgba(124,58,237,0.35) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(59,130,246,0.30) 0px, transparent 50%), radial-gradient(at 0% 80%, rgba(20,184,166,0.30) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(139,92,246,0.25) 0px, transparent 50%)"
      },
      animation: {
        "gradient-move": "gradientMove 18s ease infinite",
        float: "float 12s ease-in-out infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite"
      },
      keyframes: {
        gradientMove: {
          "0%,100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" }
        },
        float: {
          "0%,100%": { transform: "translateY(0) translateX(0)" },
          "50%": { transform: "translateY(-40px) translateX(20px)" }
        }
      },
      backdropBlur: { xs: "2px" }
    }
  },
  plugins: []
};
export default config;
