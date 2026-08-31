"use client";

import { useState, useRef, useEffect } from "react";

/**
 * Returns a smoothly interpolated number that lerps toward `target`
 * over `duration` ms. Useful for animated counters (progress %, band counts).
 */
export function useAnimatedNumber(target: number, duration = 150): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const toRef = useRef(target);
  const startTimeRef = useRef(0);
  const rafIdRef = useRef(0);
  const tickRef = useRef<(now: number) => void>(() => {});

  // Keep tickRef current
  useEffect(() => {
    tickRef.current = (now: number) => {
      if (!startTimeRef.current) startTimeRef.current = now;

      const elapsed = now - startTimeRef.current;
      const t = duration > 0 ? Math.min(elapsed / duration, 1) : 1;
      const eased = 1 - Math.pow(1 - t, 3);
      const value = fromRef.current + (toRef.current - fromRef.current) * eased;

      setDisplay(value);

      if (t < 1) {
        rafIdRef.current = requestAnimationFrame((n) => tickRef.current(n));
      }
    };
  });

  useEffect(() => {
    if (Math.abs(target - toRef.current) < 0.001) return;

    cancelAnimationFrame(rafIdRef.current);

    fromRef.current = display;
    toRef.current = target;
    startTimeRef.current = 0;
    rafIdRef.current = requestAnimationFrame((n) => tickRef.current(n));

    return () => cancelAnimationFrame(rafIdRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}
