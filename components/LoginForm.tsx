"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, User, ShieldCheck, Loader2 } from "lucide-react";
import GlassCard from "./GlassCard";
import Logo from "./Logo";

export default function LoginForm({
  role,
  title,
  subtitle,
  redirectTo,
  idLabel
}: {
  role: "admin" | "publisher" | "buyer";
  title: string;
  subtitle: string;
  redirectTo: string;
  idLabel: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, username, password })
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }
      router.push(redirectTo);
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <GlassCard className="w-full max-w-md p-8">
        <div className="mb-6 flex justify-center">
          <Logo size="md" />
        </div>

        <h1 className="text-center text-xl font-semibold text-white">{title}</h1>
        <p className="mt-1 text-center text-sm text-white/50">{subtitle}</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/60">{idLabel}</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white outline-none transition focus:border-purple-400/70 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.25)]"
                placeholder={role === "admin" ? "Username" : idLabel}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-white/60">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white outline-none transition focus:border-purple-400/70 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.25)]"
                placeholder="Password"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-300/80">
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            >
              <ShieldCheck size={14} />
            </motion.span>
            Secure Login — Encrypted Session
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 via-blue-500 to-teal-400 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:shadow-purple-500/40 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Verifying...
              </>
            ) : (
              "Enter Portal"
            )}
          </motion.button>
        </form>
      </GlassCard>
    </div>
  );
}
