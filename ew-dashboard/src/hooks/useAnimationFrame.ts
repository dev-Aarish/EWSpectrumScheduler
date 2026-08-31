"use client";

import { useRef, useCallback, useEffect, useState } from "react";

interface UseAnimationFrameOptions {
  duration: number;
  easing?: (t: number) => number;
  onComplete?: () => void;
}

const linear = (t: number) => t;

export function useAnimationFrame({
  duration,
  easing = linear,
  onComplete,
}: UseAnimationFrameOptions) {
  const [isRunning, setIsRunning] = useState(false);
  const startTimeRef = useRef(0);
  const elapsedRef = useRef<number>(0);
  const rafIdRef = useRef<number>(0);
  const progressRef = useRef<number>(0);
  const subscribersRef = useRef<Set<(progress: number) => void>>(new Set());
  const onCompleteRef = useRef(onComplete);
  const tickRef = useRef<(now: number) => void>(() => {});

  // Keep refs current via effects, not during render
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    tickRef.current = (now: number) => {
      if (!startTimeRef.current) startTimeRef.current = now;

      const rawElapsed = now - startTimeRef.current;
      const clampedElapsed = Math.min(rawElapsed, duration);
      const t = duration > 0 ? clampedElapsed / duration : 1;
      const easedT = easing(t);

      progressRef.current = easedT;
      elapsedRef.current = clampedElapsed;

      subscribersRef.current.forEach((fn) => fn(easedT));

      if (clampedElapsed >= duration) {
        setIsRunning(false);
        onCompleteRef.current?.();
        return;
      }

      rafIdRef.current = requestAnimationFrame((n) => tickRef.current(n));
    };
  });

  const start = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current);
    startTimeRef.current = 0;
    elapsedRef.current = 0;
    setIsRunning(true);
    rafIdRef.current = requestAnimationFrame((n) => tickRef.current(n));
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current);
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current);
    startTimeRef.current = 0;
    elapsedRef.current = 0;
    progressRef.current = 0;
    setIsRunning(false);
    subscribersRef.current.forEach((fn) => fn(0));
  }, []);

  const subscribe = useCallback((fn: (progress: number) => void) => {
    subscribersRef.current.add(fn);
    return () => subscribersRef.current.delete(fn);
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  // Auto-start is handled by the consumer calling start(), not via effect
  // to avoid setState-in-effect lint warnings

  return {
    isRunning,
    progress: progressRef,
    start,
    stop,
    reset,
    subscribe,
  };
}

/** Simple linear interpolation between two numbers */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
