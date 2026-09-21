"use client";

import { Search } from "lucide-react";
import clsx from "clsx";

const OPTIONS = ["ALL", "SALE", "CALLBACK", "NOT INTERESTED", "WRONG INTENT", "CUSTOMER MISBEHAVE", "AGENT MISTAKE", "SHORT CALL", "PENDING"];

export default function Filters({
  search,
  onSearch,
  active,
  onActive
}: {
  search: string;
  onSearch: (v: string) => void;
  active: string;
  onActive: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="relative w-full max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search caller, number, campaign..."
          className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-purple-400/60 focus:bg-white/10"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => onActive(opt)}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              active === opt
                ? "border-transparent bg-gradient-to-r from-purple-500 to-teal-400 text-white shadow-md"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
