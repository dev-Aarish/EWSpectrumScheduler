"use client";

import { useEffect, useRef, useState } from "react";
import {
  Radio,
  Activity,
  Clock,
  Cpu,
  Signal,
  Shield,
  Wifi,
} from "lucide-react";

interface StatusBarProps {
  systemMode: "live" | "replay" | "training";
  currentConfig: string;
  scanProgress: number;
  activeBands: number;
  totalBands: number;
  errorCount?: number;
  onModeChange?: (mode: "live" | "replay" | "training") => void;
}

type HealthStatus = "nominal" | "warning" | "critical";

export default function StatusBar({
  systemMode,
  currentConfig,
  scanProgress,
  activeBands,
  totalBands,
  errorCount = 0,
  onModeChange,
}: StatusBarProps) {
  const [time, setTime] = useState(new Date());
  const [fps, setFps] = useState(0);
  const [memoryMB, setMemoryMB] = useState<number | null>(null);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    if (typeof performance !== "undefined" && "memory" in performance) {
      const mem = (performance as { memory?: { usedJSHeapSize: number } }).memory;
      if (mem) {
        setMemoryMB(Math.round(mem.usedJSHeapSize / 1024 / 1024));
      }
    }
  }, []);

  useEffect(() => {
    if (typeof performance === "undefined" || !("memory" in performance)) return;
    const interval = setInterval(() => {
      const mem = (performance as { memory?: { usedJSHeapSize: number } }).memory;
      if (mem) {
        setMemoryMB(Math.round(mem.usedJSHeapSize / 1024 / 1024));
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const healthStatus: HealthStatus = (() => {
    if (errorCount > 10) return "critical";
    if (errorCount > 0) return "warning";
    if (fps > 0 && fps < 30) return "warning";
    if (memoryMB !== null && memoryMB > 512) return "warning";
    return "nominal";
  })();

  const healthConfig: Record<HealthStatus, { color: string; label: string }> = {
    nominal: { color: "text-[#5E8C6A]", label: "NOMINAL" },
    warning: { color: "text-[#D98E33]", label: "WARNING" },
    critical: { color: "text-[#C44D4D]", label: "CRITICAL" },
  };

  const health = healthConfig[healthStatus];

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let rafId: number;
    const tick = (now: number) => {
      frameCount.current++;
      if (now - lastTime.current >= 1000) {
        setFps(frameCount.current);
        frameCount.current = 0;
        lastTime.current = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const modeConfig = {
    live: { color: "bg-[#5E8C6A]", label: "LIVE", icon: Signal },
    replay: { color: "bg-[#D98E33]", label: "REPLAY", icon: Radio },
    training: { color: "bg-[#9BA3AD]", label: "TRAINING", icon: Cpu },
  };

  const mode = modeConfig[systemMode];

  const cycleMode = () => {
    if (!onModeChange) return;
    const modes: ("live" | "replay" | "training")[] = ["replay", "training", "live"];
    const idx = modes.indexOf(systemMode);
    onModeChange(modes[(idx + 1) % modes.length]);
  };

  return (
    <header className="h-9 bg-[#12151A] border-b border-[#22262D] flex items-center px-3 gap-1 text-[10px] font-mono select-none">
      {/* System mode */}
      <button
        onClick={cycleMode}
        className="flex items-center gap-1.5 px-2 py-1 bg-[#0E1013] border border-[#22262D] rounded hover:border-[#3A3F46] transition-colors cursor-pointer"
        title="Click to switch mode"
      >
        <div className={`w-1.5 h-1.5 rounded-full ${mode.color} ${systemMode === "live" ? "animate-pulse" : ""}`} />
        <span className="text-[#E8EAED] uppercase tracking-widest font-medium text-[9px]">
          {mode.label}
        </span>
      </button>

      <div className="w-px h-4 bg-[#22262D] mx-1" />

      {/* Config */}
      <div className="flex items-center gap-1.5 text-[#9BA3AD] px-1">
        <Radio size={10} className="text-[#5C636D]" />
        <span className="tabular-nums">{currentConfig}</span>
      </div>

      <div className="w-px h-4 bg-[#22262D] mx-1" />

      {/* Scan progress bar */}
      <div className="flex items-center gap-2 px-1">
        <Activity size={10} className="text-[#5C636D]" />
        <div className="w-20 h-1.5 bg-[#0E1013] border border-[#22262D] rounded overflow-hidden">
          <div
            className="h-full bg-[#D98E33] transition-all duration-150"
            style={{ width: `${scanProgress}%` }}
          />
        </div>
        <span className="text-[#D98E33] tabular-nums text-[9px] w-8">
          {scanProgress.toFixed(0)}%
        </span>
      </div>

      <div className="w-px h-4 bg-[#22262D] mx-1" />

      {/* Active bands */}
      <div className="flex items-center gap-1.5 text-[#9BA3AD] px-1">
        <Wifi size={10} className="text-[#5C636D]" />
        <span className="tabular-nums text-[#E8EAED]">{activeBands}</span>
        <span className="text-[#3A3F46]">/</span>
        <span className="tabular-nums">{totalBands}</span>
        <span className="text-[#5C636D]">bands</span>
      </div>

      <div className="w-px h-4 bg-[#22262D] mx-1" />

      {/* System health indicators */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex items-center gap-1">
          <Shield size={9} className={health.color} />
          <span className={`${health.color} text-[9px] uppercase`}>{health.label}</span>
        </div>
        {memoryMB !== null && (
          <>
            <div className="w-px h-3 bg-[#22262D]" />
            <span className="text-[#5C636D] text-[9px] tabular-nums">{memoryMB}MB</span>
          </>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side - timestamp and frame info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-[#5C636D]">
          <Cpu size={9} />
          <span className="tabular-nums text-[9px]">{fps} FPS</span>
        </div>

        <div className="flex items-center gap-1 text-[#9BA3AD] px-2 py-0.5 bg-[#0E1013] border border-[#22262D] rounded">
          <Clock size={10} className="text-[#5C636D]" />
          <span className="tabular-nums text-[10px]">
            {time.toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
          <span className="text-[#3A3F46]">.</span>
          <span className="tabular-nums text-[#5C636D] text-[9px]">
            {time.getMilliseconds().toString().padStart(3, "0")}
          </span>
        </div>
      </div>
    </header>
  );
}
