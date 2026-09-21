"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Logo from "@/components/Logo";
import GlassCard from "@/components/GlassCard";
import { Building2, Users, ShieldCheck } from "lucide-react";

const portals = [
  { href: "/publisher/login", label: "Publisher Portal", icon: Users, desc: "View your traffic performance" },
  { href: "/buyer/login", label: "Buyer / Target Portal", icon: Building2, desc: "View calls routed to you" },
  { href: "/admin-secret-1045-login", label: "Admin", icon: ShieldCheck, desc: "Full access & CSV upload", hidden: true }
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-4 py-16">
      <Logo size="lg" />
      <p className="max-w-xl text-center text-white/50">
        AI-powered Pay-Per-Call Quality Assurance CRM. Upload call data, let Gemini
        classify every call, and give publishers &amp; buyers live visibility into performance.
      </p>

      <div className="grid w-full max-w-3xl gap-5 sm:grid-cols-2">
        {portals
          .filter((p) => !p.hidden)
          .map((p, i) => (
            <Link key={p.href} href={p.href}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <GlassCard hover className="flex h-full flex-col items-center gap-3 p-8 text-center">
                  <p.icon className="text-teal-300" size={28} />
                  <h3 className="font-semibold text-white">{p.label}</h3>
                  <p className="text-xs text-white/50">{p.desc}</p>
                </GlassCard>
              </motion.div>
            </Link>
          ))}
      </div>
    </main>
  );
}
