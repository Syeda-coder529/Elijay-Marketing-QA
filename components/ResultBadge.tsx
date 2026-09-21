"use client";

import { motion } from "framer-motion";
import { QAResult } from "@/lib/types";

const STYLES: Record<QAResult, { bg: string; text: string; dot: string }> = {
  SALE: { bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400" },
  CALLBACK: { bg: "bg-blue-500/15", text: "text-blue-300", dot: "bg-blue-400" },
  "NOT INTERESTED": { bg: "bg-yellow-500/15", text: "text-yellow-300", dot: "bg-yellow-400" },
  "WRONG INTENT": { bg: "bg-orange-500/15", text: "text-orange-300", dot: "bg-orange-400" },
  "CUSTOMER MISBEHAVE": { bg: "bg-red-500/15", text: "text-red-300", dot: "bg-red-400" },
  "AGENT MISTAKE": { bg: "bg-rose-500/15", text: "text-rose-300", dot: "bg-rose-400" },
  "SHORT CALL": { bg: "bg-slate-500/15", text: "text-slate-300", dot: "bg-slate-400" },
  PENDING: { bg: "bg-white/10", text: "text-white/50", dot: "bg-white/40" }
};

export default function ResultBadge({ result }: { result: QAResult }) {
  const style = STYLES[result] || STYLES.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${style.bg} ${style.text}`}>
      <motion.span
        className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      {result}
    </span>
  );
}
