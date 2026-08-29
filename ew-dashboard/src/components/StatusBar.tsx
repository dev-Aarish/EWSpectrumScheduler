"use client";

import { Radio, Activity, Clock } from "lucide-react";

interface StatusBarProps {
  systemMode: "live" | "replay" | "training";
  currentConfig: string;
  scanProgress: number;
  activeBands: number;
  totalBands: number;
}

export default function StatusBar({
  systemMode,
  currentConfig,
  scanProgress,
  activeBands,
  totalBands,
}: StatusBarProps) {
  const modeColors = {
    live: "bg-[#5E8C6A]",
    replay: "bg-[#D98E33]",
    training: "bg-[#9BA3AD]",
  };

  return (
    <header className="h-10 bg-[#12151A] border-b border-[#22262D] flex items-center px-3 gap-4 text-[11px] font-mono">
      {/* System status indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`status-dot ${modeColors[systemMode]} ${
            systemMode === "live" ? "pulse-indicator" : ""
          }`}
        />
        <span className="text-[#E8EAED] uppercase tracking-wider font-medium">
          {systemMode}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-[#22262D]" />

      {/* Config info */}
      <div className="flex items-center gap-2 text-[#9BA3AD]">
        <Radio size={12} className="text-[#5C636D]" />
        <span>{currentConfig}</span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-[#22262D]" />

      {/* Scan progress */}
      <div className="flex items-center gap-2">
        <Activity size={12} className="text-[#5C636D]" />
        <span className="text-[#9BA3AD]">Scan:</span>
        <span className="text-[#D98E33] tabular-nums">
          {scanProgress.toFixed(1)}%
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-[#22262D]" />

      {/* Active bands */}
      <div className="flex items-center gap-2 text-[#9BA3AD]">
        <span>Bands:</span>
        <span className="text-[#E8EAED] tabular-nums">
          {activeBands}
        </span>
        <span className="text-[#5C636D]">/</span>
        <span className="tabular-nums">{totalBands}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Timestamp */}
      <div className="flex items-center gap-2 text-[#5C636D]">
        <Clock size={12} />
        <span className="tabular-nums">
          {new Date().toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>
    </header>
  );
}
