"use client";

import StatCard from "./StatCard";
import { CallRecord } from "@/lib/types";

export default function StatsRow({ calls }: { calls: CallRecord[] }) {
  const total = calls.length;
  const sales = calls.filter((c) => c.qaResult === "SALE").length;
  const callbacks = calls.filter((c) => c.qaResult === "CALLBACK").length;
  const issues = calls.filter((c) => ["NOT INTERESTED", "AGENT MISTAKE", "CUSTOMER MISBEHAVE", "WRONG INTENT"].includes(c.qaResult)).length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Calls"
        value={total}
        icon={<span>📞</span>}
        gradient="linear-gradient(135deg, rgba(124,58,237,0.6), rgba(59,130,246,0.6))"
      />
      <StatCard
        label="Sale"
        value={sales}
        icon={<span>💰</span>}
        gradient="linear-gradient(135deg, #00C853, #B2FF59)"
      />
      <StatCard
        label="Callback"
        value={callbacks}
        icon={<span>⏰</span>}
        gradient="linear-gradient(135deg, #2563eb, #60a5fa)"
      />
      <StatCard
        label="Not Interested / Issues"
        value={issues}
        icon={<span>⚠️</span>}
        gradient="linear-gradient(135deg, #f59e0b, #ef4444)"
      />
    </div>
  );
}
