"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useState, useMemo, memo } from "react";

interface BandStats {
  band_id: number;
  dwell_centre_mhz: number;
  pulse_count: number;
  n_emitters: number;
  mean_amplitude: number;
  frequency_range: number[];
}

interface FrequencySpectrumProps {
  bandStats: BandStats[];
  selectedBand: number | null;
  onBandSelect: (bandId: number | null) => void;
}

function FrequencySpectrum({
  bandStats,
  selectedBand,
  onBandSelect,
}: FrequencySpectrumProps) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const data = useMemo(
    () =>
      bandStats.map((b) => ({
        band: b.band_id,
        freq: b.dwell_centre_mhz,
        pulses: b.pulse_count,
        emitters: b.n_emitters,
        amplitude: Math.abs(b.mean_amplitude),
      })),
    [bandStats]
  );

  // Compute max pulse count for intensity normalization
  const maxPulses = useMemo(() => Math.max(...data.map((d) => d.pulses), 1), [data]);

  // Interpolate between base gray and accent based on intensity
  const getIntensityColor = (pulses: number): string => {
    if (pulses === 0) return "#1A1D22";
    const t = Math.min(pulses / maxPulses, 1);
    // Interpolate from #3A3F46 (idle) to #C4523B (hit red)
    const r = Math.round(58 + (196 - 58) * t);
    const g = Math.round(63 + (82 - 63) * t);
    const b = Math.round(70 + (59 - 70) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-[#181C22] border border-[#343A42] px-3 py-2 text-[11px] font-mono">
          <div className="text-[#E8EAED] font-medium">Band {d.band}</div>
          <div className="text-[#9BA3AD] mt-1 space-y-0.5">
            <div>
              Freq: <span className="text-[#E8EAED] tabular-nums">{d.freq.toFixed(0)} MHz</span>
            </div>
            <div>
              Pulses: <span className="text-[#D98E33] tabular-nums">{d.pulses.toLocaleString()}</span>
            </div>
            <div>
              Emitters: <span className="text-[#5E8C6A] tabular-nums">{d.emitters}</span>
            </div>
            <div>
              Mean Amp: <span className="text-[#C4523B] tabular-nums">{d.amplitude.toFixed(1)} dB</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#22262D] flex items-center justify-between">
        <span className="section-label">Band Activity Distribution</span>
        <span className="text-[10px] font-mono text-[#5C636D]">
          {data.filter((d) => d.pulses > 0).length}/{data.length} active
        </span>
      </div>
      <div className="flex-1 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            onClick={(data: any) => {
              if (data && data.activePayload && data.activePayload[0]) {
                const bandId = data.activePayload[0].payload.band;
                onBandSelect(selectedBand === bandId ? null : bandId);
              }
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#22262D"
              vertical={false}
            />
            <XAxis
              dataKey="freq"
              tick={{ fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" }}
              tickFormatter={(v) => `${v}`}
              stroke="#22262D"
            />
            <YAxis
              tick={{ fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" }}
              stroke="#22262D"
              width={45}
            />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar
              dataKey="pulses"
              radius={[2, 2, 0, 0]}
              onMouseEnter={(_, index) => setHoveredBar(index)}
              onMouseLeave={() => setHoveredBar(null)}
            >
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    selectedBand === entry.band
                      ? "#D98E33"
                      : hoveredBar === index
                      ? "#D98E33"
                      : getIntensityColor(entry.pulses)
                  }
                  fillOpacity={hoveredBar === index ? 0.8 : 1}
                  stroke={
                    selectedBand === entry.band ? "#D98E33" : "transparent"
                  }
                  strokeWidth={selectedBand === entry.band ? 1 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(FrequencySpectrum);
