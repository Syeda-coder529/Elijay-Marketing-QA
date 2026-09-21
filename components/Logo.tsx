"use client";

import { motion } from "framer-motion";

export default function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-14 w-14 text-xl" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  const textSize = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";

  return (
    <div className="flex items-center gap-3">
      <motion.div
        className={`relative flex ${dims} items-center justify-center rounded-2xl font-bold text-white shadow-lg`}
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #3b82f6 50%, #14b8a6 100%)"
        }}
        animate={{ boxShadow: ["0 0 15px rgba(124,58,237,0.4)", "0 0 25px rgba(20,184,166,0.5)", "0 0 15px rgba(124,58,237,0.4)"] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        EM
      </motion.div>
      <span
        className={`font-semibold tracking-tight ${textSize} bg-clip-text text-transparent`}
        style={{
          backgroundImage: "linear-gradient(90deg, #c4b5fd, #93c5fd, #5eead4)"
        }}
      >
        Elijay Marketing Solutions
      </span>
    </div>
  );
}
