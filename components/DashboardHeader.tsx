"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import Logo from "./Logo";
import { motion } from "framer-motion";

export default function DashboardHeader({ role, id }: { role: string; id: string }) {
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-base-950/60 px-6 py-4 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Logo size="sm" />
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-white/40">{role}</p>
            <p className="text-sm font-medium text-white">{id}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={logout}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10"
          >
            <LogOut size={13} /> Logout
          </motion.button>
        </div>
      </div>
    </header>
  );
}
