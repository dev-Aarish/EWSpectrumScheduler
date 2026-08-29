"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";

interface BandStats {
  band_id: number;
  dwell_centre_mhz: number;
  pulse_count: number;
  n_emitters: number;
  mean_amplitude: number;
  frequency_range: number[];
}

interface AmplitudeDistributionProps {
  bandStats: BandStats[];
  selectedBand: number | null;
}

export default function AmplitudeDistribution({
  bandStats,
  selectedBand,
}: AmplitudeDistributionProps) {
  // Create amplitude histogram data
  const data = useMemo(() => {
    const amplitudes = bandStats
      .filter((b) => b.pulse_count > 0)
      .map((b) => Math.abs(b.mean_amplitude));

    if (amplitudes.length === 0) return [];

    const min = Math.floor(Math.min(...amplitudes) / 5) * 5;
    const max = Math.ceil(Math.max(...amplitudes) / 5) * 5;
    const binSize = 5;
    const bins: { range: string; count: number; min: number }[] = [];

    for (let i = min; i < max; i += binSize) {
      const count = amplitudes.filter(
        (a) => a >= i && a < i + binSize
      ).length;
      bins.push({
        range: `${i}`,
        count,
        min: i,
      });
    }

    return bins;
  }, [bandStats]);

  const selectedAmplitude = selectedBand !== null
    ? Math.abs(bandStats[selectedBand]?.mean_amplitude || 0)
    : null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-[#181C22] border border-[#343A42] px-3 py-2 text-[11px] font-mono">
          <div className="text-[#E8EAED]">
            {d.min}-{d.min + 5} dB
          </div>
          <div className="text-[#D98E33] tabular-nums">
            {d.count} band{d.count !== 1 ? "s" : ""}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#22262D] flex items-center justify-between">
        <span className="section-label">Amplitude Distribution</span>
        {selectedAmplitude !== null && (
          <span className="text-[10px] font-mono text-[#D98E33] tabular-nums">
            Selected: {selectedAmplitude.toFixed(1)} dB
          </span>
        )}
      </div>
      <div className="flex-1 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#22262D"
              vertical={false}
            />
            <XAxis
              dataKey="range"
              tick={{ fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" }}
              stroke="#22262D"
              label={{
                value: "dB",
                position: "insideBottomRight",
                offset: -5,
                style: { fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" },
              }}
            />
            <YAxis
              tick={{ fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" }}
              stroke="#22262D"
              width={30}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#D98E33"
              fill="#D98E33"
              fillOpacity={0.15}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
