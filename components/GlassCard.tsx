"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import clsx from "clsx";

export default function GlassCard({
  children,
  className,
  hover = false
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={hover ? { y: -3, boxShadow: "0 0 30px rgba(124,58,237,0.25)" } : undefined}
      className={clsx(
        "rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-xl",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
