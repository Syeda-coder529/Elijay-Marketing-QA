"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import CountUp from "./CountUp";
import GlassCard from "./GlassCard";

export default function StatCard({
  label,
  value,
  icon,
  gradient,
  prefix = ""
}: {
  label: string;
  value: number;
  icon: ReactNode;
  gradient: string;
  prefix?: string;
}) {
  return (
    <GlassCard hover className="relative overflow-hidden p-5">
      <div
        className="absolute inset-0 opacity-20"
        style={{ background: gradient }}
      />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-white/60">{label}</p>
          <p className="mt-1 text-3xl font-bold text-white">
            <CountUp value={value} prefix={prefix} />
          </p>
        </div>
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
          style={{ background: gradient }}
        >
          {icon}
        </motion.div>
      </div>
    </GlassCard>
  );
}
