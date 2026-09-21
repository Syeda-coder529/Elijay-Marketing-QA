"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, motion, animate } from "framer-motion";

export default function CountUp({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(0, value, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v))
    });
    return () => controls.stop();
  }, [isInView, value]);

  return (
    <motion.span ref={ref}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </motion.span>
  );
}
