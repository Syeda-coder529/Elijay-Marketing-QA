"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Volume2 } from "lucide-react";

export default function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mounted, setMounted] = useState(false); // audio tag sirf pehle interaction ke baad banega

  const bars = Array.from({ length: 28 });

  useEffect(() => {
    if (!mounted) return;
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnd);
    };
  }, [src, mounted]);

  const toggle = () => {
    // Pehli baar click par hi <audio> element mount hoga
    if (!mounted) {
      setMounted(true);
      // element abhi DOM mein nahi hai, is render cycle ke baad play karein
      requestAnimationFrame(() => {
        const audio = audioRef.current;
        if (audio) {
          audio.play();
          setPlaying(true);
        }
      });
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
    setPlaying(!playing);
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!src) {
    return <span className="text-xs text-white/40">No recording</span>;
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      {mounted && <audio ref={audioRef} src={src} preload="none" />}
      <button
        onClick={toggle}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-teal-400 text-white shadow-md transition hover:scale-105"
      >
        {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>

      <div className="flex h-6 flex-1 items-center gap-[2px] overflow-hidden">
        {bars.map((_, i) => {
          const active = duration > 0 && i / bars.length < progress / duration;
          return (
            <motion.span
              key={i}
              className={`w-[3px] rounded-full ${active ? "bg-teal-300" : "bg-white/20"}`}
              animate={
                playing
                  ? { height: [4, 14, 6, 18, 4] }
                  : { height: active ? 10 : 6 }
              }
              transition={
                playing
                  ? { duration: 1 + (i % 5) * 0.15, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.2 }
              }
            />
          );
        })}
      </div>

      <span className="w-10 shrink-0 text-right text-[10px] text-white/50">{fmt(progress)}</span>
      <Volume2 size={14} className="shrink-0 text-white/40" />
    </div>
  );
}
