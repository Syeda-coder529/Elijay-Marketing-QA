"use client";

import { CallRecord } from "@/lib/types";
import ResultBadge from "./ResultBadge";
import AudioPlayer from "./AudioPlayer";
import { motion } from "framer-motion";

export default function DataTable({
  calls,
  showPublisher = true,
  showBuyer = true
}: {
  calls: CallRecord[];
  showPublisher?: boolean;
  showBuyer?: boolean;
}) {
  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-white/40">
        <span className="text-3xl">📭</span>
        <p>No calls found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.04] text-left text-xs uppercase tracking-wider text-white/50">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Campaign</th>
            {showPublisher && <th className="px-4 py-3">Publisher</th>}
            {showBuyer && <th className="px-4 py-3">Target</th>}
            <th className="px-4 py-3">Caller ID</th>
            <th className="px-4 py-3">Duration</th>
            <th className="px-4 py-3">Payout</th>
            <th className="px-4 py-3">Recording</th>
            <th className="px-4 py-3">QA Result</th>
            <th className="px-4 py-3">Score</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c, i) => (
            <motion.tr
              key={c.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.4) }}
              className="border-b border-white/5 transition hover:bg-white/[0.05]"
              title={c.qaTranscript ? `${c.qaReason}\n\n${c.qaTranscript}` : c.qaReason || undefined}
            >
              <td className="px-4 py-3 whitespace-nowrap text-white/70">{c.callDate}</td>
              <td className="px-4 py-3 text-white/80">{c.campaign}</td>
              {showPublisher && <td className="px-4 py-3 text-white/60">{c.publisher}</td>}
              {showBuyer && <td className="px-4 py-3 text-white/60">{c.target}</td>}
              <td className="px-4 py-3 text-white/60">{c.callerId}</td>
              <td className="px-4 py-3 text-white/60">{c.duration}</td>
              <td className="px-4 py-3 text-white/60">${c.payout?.toFixed(2)}</td>
              <td className="px-4 py-3">
                <AudioPlayer src={c.recording} />
              </td>
              <td className="px-4 py-3">
                <ResultBadge result={c.qaResult} />
              </td>
              <td className="px-4 py-3 text-white/60">{c.qaScore ?? "—"}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
