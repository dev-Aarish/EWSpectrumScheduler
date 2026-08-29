"use client";

import { useEffect, useState } from "react";

interface MetricData {
  label: string;
  value: number;
  unit: string;
  trend: number[];
  color: string;
}

interface MetricsPanelProps {
  scanProgress: number;
  totalPulses: number;
  nEmitters: number;
  nBands: number;
}

export default function MetricsPanel({
  scanProgress,
  totalPulses,
  nEmitters,
  nBands,
}: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<MetricData[]>([
    { label: "Pd", value: 0.0, unit: "", trend: [], color: "#D98E33" },
    { label: "Pfa", value: 0.0, unit: "", trend: [], color: "#C4523B" },
    { label: "Avg Intercept", value: 0.0, unit: "ms", trend: [], color: "#5E8C6A" },
    { label: "Reward", value: 0.0, unit: "", trend: [], color: "#D98E33" },
    { label: "Correct Pred.", value: 0.0, unit: "%", trend: [], color: "#5E8C6A" },
  ]);

  // Simulate live metric updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) =>
        prev.map((m) => {
          const delta = (Math.random() - 0.5) * 0.1;
          let newValue = m.value + delta;

          // Clamp values
          if (m.label === "Pd" || m.label === "Correct Pred.") {
            newValue = Math.max(0, Math.min(100, m.label === "Pd" ? newValue : newValue));
          } else if (m.label === "Pfa") {
            newValue = Math.max(0, Math.min(1, newValue));
          } else if (m.label === "Reward") {
            newValue = Math.max(-2, Math.min(3, newValue));
          } else {
            newValue = Math.max(0, Math.min(500, newValue));
          }

          // Keep trend history (last 20 points)
          const newTrend = [...m.trend, newValue].slice(-20);

          return {
            ...m,
            value: newValue,
            trend: newTrend,
          };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#12151A] border-l border-[#22262D] w-64 flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#22262D]">
        <span className="section-label">Performance Metrics</span>
      </div>

      {/* Metrics list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-[#0E1013] border border-[#22262D] p-2 rounded"
          >
            {/* Label */}
            <div className="text-[10px] font-mono text-[#5C636D] uppercase tracking-wider">
              {metric.label}
            </div>

            {/* Value */}
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className="text-[18px] font-mono font-medium tabular-nums"
                style={{ color: metric.color }}
              >
                {metric.value.toFixed(metric.label === "Pfa" ? 4 : metric.label === "Avg Intercept" ? 1 : 2)}
              </span>
              <span className="text-[10px] font-mono text-[#5C636D]">
                {metric.unit}
              </span>
            </div>

            {/* Sparkline */}
            {metric.trend.length > 1 && (
              <div className="mt-1 h-4">
                <svg
                  viewBox={`0 0 ${metric.trend.length * 4} 16`}
                  className="w-full h-full"
                  preserveAspectRatio="none"
                >
                  <polyline
                    points={metric.trend
                      .map(
                        (v, i) =>
                          `${i * 4},${16 - ((v + 2) / 5) * 16}`
                      )
                      .join(" ")}
                    fill="none"
                    stroke={metric.color}
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>
        ))}

        {/* Dataset info */}
        <div className="mt-2 pt-2 border-t border-[#22262D]">
          <div className="section-label mb-2">Dataset Info</div>
          <div className="space-y-1 text-[11px] font-mono">
            <div className="flex justify-between text-[#9BA3AD]">
              <span>Pulses</span>
              <span className="text-[#E8EAED] tabular-nums">
                {totalPulses.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-[#9BA3AD]">
              <span>Emitters</span>
              <span className="text-[#E8EAED] tabular-nums">{nEmitters}</span>
            </div>
            <div className="flex justify-between text-[#9BA3AD]">
              <span>Bands</span>
              <span className="text-[#E8EAED] tabular-nums">{nBands}</span>
            </div>
            <div className="flex justify-between text-[#9BA3AD]">
              <span>Progress</span>
              <span className="text-[#D98E33] tabular-nums">
                {scanProgress.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
