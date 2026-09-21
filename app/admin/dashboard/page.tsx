"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { UploadCloud, Sparkles, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import StatsRow from "@/components/StatsRow";
import Filters from "@/components/Filters";
import DataTable from "@/components/DataTable";
import GlassCard from "@/components/GlassCard";
import { CallRecord } from "@/lib/types";

export default function AdminDashboard() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("ALL");
  const [uploading, setUploading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [message, setMessage] = useState("");
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCalls = () => {
    setLoading(true);
    fetch("/api/calls")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setCalls(data.calls);
          setId(data.id);
          setPersistent(!!data.persistent);
        }
        setLoading(false);
      });
  };

  useEffect(loadCalls, []);

  const filtered = useMemo(() => {
    return calls.filter((c) => {
      const matchesActive = active === "ALL" || c.qaResult === active;
      const s = search.toLowerCase();
      const matchesSearch =
        !s ||
        c.callerId?.toLowerCase().includes(s) ||
        c.campaign?.toLowerCase().includes(s) ||
        c.publisher?.toLowerCase().includes(s) ||
        c.target?.toLowerCase().includes(s);
      return matchesActive && matchesSearch;
    });
  }, [calls, active, search]);

  const pendingCount = calls.filter((c) => c.qaResult === "PENDING").length;

  const onUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage("");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    setUploading(false);
    if (data.ok) {
      setMessage(`Imported ${data.imported} calls. Total: ${data.total}.`);
      loadCalls();
    } else {
      setMessage(data.error || "Upload failed.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  // Runs /api/classify repeatedly until every PENDING call has been
  // classified. Each request only handles a bounded batch server-side (to
  // stay inside serverless time limits), so this loop is what makes one
  // click actually cover *all* calls instead of just the first batch.
  const onClassify = async () => {
    setClassifying(true);
    setMessage("");
    let totalProcessed = 0;
    let safety = 0; // hard stop in case something is stuck, so we never loop forever

    try {
      while (safety < 100) {
        safety += 1;
        const res = await fetch("/api/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        });

        let data: any;
        try {
          data = await res.json();
        } catch {
          setMessage(`Request failed (status ${res.status}). Check Vercel function logs for /api/classify.`);
          break;
        }

        if (!data.ok) {
          setMessage(data.error || `Classification failed (status ${res.status}).`);
          break;
        }

        totalProcessed += data.processed;
        setMessage(`AI QA in progress... ${totalProcessed} call(s) processed so far.`);
        loadCalls();

        if (data.remaining === 0 || data.processed === 0) {
          setMessage(`AI QA complete — ${totalProcessed} call(s) classified.`);
          break;
        }
      }
    } catch (e: any) {
      setMessage(e?.message || "Classification failed — check your network connection.");
    }

    setClassifying(false);
    loadCalls();
  };

  return (
    <div className="min-h-screen pb-16">
      <DashboardHeader role="Admin" id={id || "..."} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {persistent === false && (
          <GlassCard className="flex items-start gap-3 border-yellow-500/30 bg-yellow-500/10 p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-yellow-300" />
            <p className="text-sm text-yellow-100">
              No persistent storage is configured — uploaded calls may disappear between requests
              on Vercel. Connect a Redis (Upstash) integration from your Vercel project's Storage
              tab, then redeploy, to fix this permanently. See the README for exact steps.
            </p>
          </GlassCard>
        )}

        <StatsRow calls={calls} />

        <GlassCard className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white/70 transition hover:border-purple-400/60 hover:bg-white/10">
              <UploadCloud size={16} />
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onUpload} />
              {uploading ? "Uploading..." : "Upload Call CSV"}
              {uploading && <Loader2 size={14} className="animate-spin" />}
            </label>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClassify}
              disabled={classifying || pendingCount === 0}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-teal-400 px-4 py-2.5 text-sm font-medium text-white shadow-md transition disabled:opacity-40"
            >
              {classifying ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {classifying ? "Running AI QA..." : `Run AI QA (${pendingCount} pending)`}
            </motion.button>
          </div>

          {message && (
            <div className="flex items-center gap-2 text-xs text-white/60">
              <CheckCircle2 size={14} className="text-emerald-400" />
              {message}
            </div>
          )}
        </GlassCard>

        <GlassCard className="space-y-5 p-6">
          <Filters search={search} onSearch={setSearch} active={active} onActive={setActive} />
          {loading ? (
            <p className="py-10 text-center text-white/40">Loading calls...</p>
          ) : (
            <DataTable calls={filtered} />
          )}
        </GlassCard>
      </main>
    </div>
  );
}
