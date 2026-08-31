"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseScanPlaybackOptions {
  nTimeBins: number;
  speed?: number; // ms per step
  onStepChange?: (step: number) => void;
}

interface UseScanPlaybackReturn {
  currentStep: number;
  isPlaying: boolean;
  /** 0 to nTimeBins, float — for sub-step interpolation */
  scanProgress: number;
  play: () => void;
  pause: () => void;
  reset: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  setSpeed: (ms: number) => void;
  setStep: (step: number) => void;
}

export function useScanPlayback({
  nTimeBins,
  speed = 100,
  onStepChange,
}: UseScanPlaybackOptions): UseScanPlaybackReturn {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const speedRef = useRef(speed);
  const nTimeBinsRef = useRef(nTimeBins);
  const rafIdRef = useRef(0);
  const lastTickTimeRef = useRef(0);
  const accumulatorRef = useRef(0);
  const stepRef = useRef(0);
  const onStepChangeRef = useRef(onStepChange);
  const tickRef = useRef<(now: number) => void>(() => {});

  // Keep refs current via effects, not during render
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    nTimeBinsRef.current = nTimeBins;
  }, [nTimeBins]);

  useEffect(() => {
    onStepChangeRef.current = onStepChange;
  });

  useEffect(() => {
    tickRef.current = (now: number) => {
      if (!lastTickTimeRef.current) {
        lastTickTimeRef.current = now;
        accumulatorRef.current = 0;
      }

      const delta = now - lastTickTimeRef.current;
      lastTickTimeRef.current = now;
      accumulatorRef.current += delta;

      const msPerStep = speedRef.current;

      // Sub-step interpolation
      const fractional = accumulatorRef.current / msPerStep;
      const baseStep = stepRef.current;
      const interpolatedProgress = baseStep + Math.min(fractional, 1);
      setScanProgress(Math.min(interpolatedProgress, nTimeBinsRef.current));

      // Advance discrete steps when accumulator has enough
      while (accumulatorRef.current >= msPerStep) {
        accumulatorRef.current -= msPerStep;
        const next = stepRef.current + 1;
        if (next >= nTimeBinsRef.current) {
          setIsPlaying(false);
          setScanProgress(nTimeBinsRef.current);
          return;
        }
        stepRef.current = next;
        setCurrentStep(next);
        setScanProgress(next);
        onStepChangeRef.current?.(next);
      }

      rafIdRef.current = requestAnimationFrame((n) => tickRef.current(n));
    };
  });

  const play = useCallback(() => {
    if (stepRef.current >= nTimeBinsRef.current - 1) {
      stepRef.current = 0;
      setCurrentStep(0);
      setScanProgress(0);
      onStepChangeRef.current?.(0);
    }
    lastTickTimeRef.current = 0;
    accumulatorRef.current = 0;
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
    cancelAnimationFrame(rafIdRef.current);
  }, []);

  const reset = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current);
    stepRef.current = 0;
    setCurrentStep(0);
    setScanProgress(0);
    setIsPlaying(false);
    onStepChangeRef.current?.(0);
  }, []);

  const stepForward = useCallback(() => {
    if (stepRef.current >= nTimeBinsRef.current - 1) return;
    const next = stepRef.current + 1;
    stepRef.current = next;
    setCurrentStep(next);
    setScanProgress(next);
    onStepChangeRef.current?.(next);
  }, []);

  const stepBackward = useCallback(() => {
    if (stepRef.current <= 0) return;
    const prev = stepRef.current - 1;
    stepRef.current = prev;
    setCurrentStep(prev);
    setScanProgress(prev);
    onStepChangeRef.current?.(prev);
  }, []);

  const setSpeed = useCallback((ms: number) => {
    speedRef.current = ms;
  }, []);

  const setStep = useCallback((step: number) => {
    const clamped = Math.max(0, Math.min(nTimeBinsRef.current - 1, step));
    stepRef.current = clamped;
    setCurrentStep(clamped);
    setScanProgress(clamped);
    onStepChangeRef.current?.(clamped);
  }, []);

  // RAF loop management
  useEffect(() => {
    if (isPlaying) {
      rafIdRef.current = requestAnimationFrame((n) => tickRef.current(n));
    } else {
      cancelAnimationFrame(rafIdRef.current);
    }
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [isPlaying]);

  // Reset when nTimeBins changes — inline to avoid setState-in-effect lint error
  const prevNTimeBinsRef = useRef(nTimeBins);
  useEffect(() => {
    if (prevNTimeBinsRef.current !== nTimeBins) {
      prevNTimeBinsRef.current = nTimeBins;
      cancelAnimationFrame(rafIdRef.current);
      stepRef.current = 0;
      setCurrentStep(0);
      setScanProgress(0);
      setIsPlaying(false);
      onStepChangeRef.current?.(0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    currentStep,
    isPlaying,
    scanProgress,
    play,
    pause,
    reset,
    stepForward,
    stepBackward,
    setSpeed,
    setStep,
  };
}
