"use client";

import { motion } from "framer-motion";

// Lightweight custom SVG illustration (undraw/storyset-style) of an analyst
// with a headset reviewing live call graphs — animated with framer-motion.
export default function LoginIllustration() {
  return (
    <div className="relative hidden w-full max-w-md items-center justify-center md:flex">
      <svg viewBox="0 0 420 380" className="w-full drop-shadow-2xl">
        {/* desk */}
        <rect x="40" y="300" width="340" height="14" rx="7" fill="#1e1b3a" />
        {/* monitor */}
        <rect x="120" y="150" width="180" height="120" rx="10" fill="#1a1730" stroke="#7c3aed" strokeWidth="2" />
        <rect x="132" y="162" width="156" height="96" rx="4" fill="#0d0c1b" />

        {/* live bar chart inside monitor */}
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.rect
            key={i}
            x={144 + i * 28}
            width="16"
            rx="3"
            fill="url(#barGrad)"
            initial={{ height: 10, y: 248 }}
            animate={{ height: [10, 60, 30, 70, 20], y: [248, 198, 228, 188, 238] }}
            transition={{ duration: 4, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
          />
        ))}

        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>

        {/* monitor stand */}
        <rect x="198" y="270" width="24" height="20" fill="#1a1730" />
        <rect x="170" y="290" width="80" height="8" rx="4" fill="#1e1b3a" />

        {/* person body */}
        <ellipse cx="210" cy="330" rx="70" ry="18" fill="#0d0c1b" opacity="0.4" />
        <rect x="170" y="255" width="80" height="70" rx="24" fill="#312e81" />
        <circle cx="210" cy="220" r="34" fill="#fcd9b8" />

        {/* headset */}
        <path
          d="M172 210 a38 38 0 0 1 76 0"
          fill="none"
          stroke="#7c3aed"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <rect x="166" y="205" width="12" height="22" rx="6" fill="#7c3aed" />
        <rect x="242" y="205" width="12" height="22" rx="6" fill="#7c3aed" />
        <motion.circle
          cx="248"
          cy="238"
          r="4"
          fill="#5eead4"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />

        {/* floating live pulse dot near monitor = "Live Call Analysis" */}
        <motion.circle
          cx="290"
          cy="150"
          r="6"
          fill="#22c55e"
          animate={{ scale: [1, 1.8, 1], opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />

        {/* floating up-trend arrow */}
        <motion.g
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M330 260 L350 230 L365 245 L390 205" stroke="#5eead4" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M375 205 L392 205 L392 222" stroke="#5eead4" strokeWidth="4" fill="none" strokeLinecap="round" />
        </motion.g>
      </svg>

      <motion.p
        className="absolute bottom-2 text-center text-sm text-white/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        Live Call Quality Analysis
      </motion.p>
    </div>
  );
}
