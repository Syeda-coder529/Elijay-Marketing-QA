"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

// Live moving gradient mesh + grid + floating self-ticking checkmarks.
export default function AnimatedBackground() {
  const particles = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 14 + Math.random() * 14,
        duration: 10 + Math.random() * 10,
        delay: Math.random() * 6
      })),
    []
  );

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-base-950">
      {/* moving mesh gradient */}
      <div className="absolute inset-0 bg-mesh-gradient bg-[length:200%_200%] animate-gradient-move opacity-80" />

      {/* subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }}
      />

      {/* radial glow spots */}
      <div className="absolute top-[-10%] left-[10%] h-[420px] w-[420px] rounded-full bg-purple-600/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[10%] h-[420px] w-[420px] rounded-full bg-teal-500/20 blur-[120px]" />
      <div className="absolute top-[40%] right-[30%] h-[300px] w-[300px] rounded-full bg-blue-500/10 blur-[100px]" />

      {/* floating self-ticking checkmarks */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute select-none"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            fontSize: p.size,
            filter: "drop-shadow(0 0 6px rgba(16,185,129,0.5))"
          }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{
            opacity: [0, 0.55, 0.55, 0],
            scale: [0.6, 1, 1, 0.6],
            y: [0, -60, -120, -180],
            x: [0, 15, -10, 5]
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <motion.span
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: p.delay }}
          >
            ✅
          </motion.span>
        </motion.div>
      ))}

      {/* vignette so foreground content stays readable */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-base-950/80" />
    </div>
  );
}
