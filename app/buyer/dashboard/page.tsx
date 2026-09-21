"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import StatsRow from "@/components/StatsRow";
import Filters from "@/components/Filters";
import DataTable from "@/components/DataTable";
import GlassCard from "@/components/GlassCard";
import { CallRecord } from "@/lib/types";

export default function BuyerDashboard() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("ALL");

  useEffect(() => {
    fetch("/api/calls")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setCalls(data.calls);
          setId(data.id);
        }
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    return calls.filter((c) => {
      const matchesActive = active === "ALL" || c.qaResult === active;
      const s = search.toLowerCase();
      const matchesSearch =
        !s ||
        c.callerId?.toLowerCase().includes(s) ||
        c.campaign?.toLowerCase().includes(s);
      return matchesActive && matchesSearch;
    });
  }, [calls, active, search]);

  return (
    <div className="min-h-screen pb-16">
      <DashboardHeader role="Buyer / Target" id={id || "..."} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <StatsRow calls={calls} />
        <GlassCard className="space-y-5 p-6">
          <Filters search={search} onSearch={setSearch} active={active} onActive={setActive} />
          {loading ? (
            <p className="py-10 text-center text-white/40">Loading calls...</p>
          ) : (
            <DataTable calls={filtered} showBuyer={false} />
          )}
        </GlassCard>
      </main>
    </div>
  );
}
