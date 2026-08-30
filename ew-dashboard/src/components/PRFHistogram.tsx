"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useMemo, memo } from "react";

interface PRFBin {
  range: string;
  count: number;
  min: number;
  binSize: number;
}

interface EmitterPRF {
  label: string;
  color: string;
  data: PRFBin[];
}

interface PRFData {
  overall: PRFBin[];
  per_emitter: EmitterPRF[];
  toi_range: number[];
}

interface PRFHistogramProps {
  prfData: PRFData;
  selectedBand: number | null;
}

function PRFHistogram({ prfData, selectedBand }: PRFHistogramProps) {
  const chartData = useMemo(() => {
    if (!prfData.overall.length) return [];
    // Merge overall + per-emitter data into a single array for stacked/grouped bars
    return prfData.overall.map((bin, i) => {
      const row: Record<string, string | number> = {
        range: bin.range,
        Overall: bin.count,
        min: bin.min,
        binSize: bin.binSize,
      };
      for (const emitter of prfData.per_emitter) {
        row[emitter.label] = emitter.data[i]?.count ?? 0;
      }
      return row;
    });
  }, [prfData]);

  const totalPulses = useMemo(
    () => prfData.overall.reduce((s, b) => s + b.count, 0),
    [prfData.overall]
  );

  const peakPRF = useMemo(() => {
    if (!prfData.overall.length) return null;
    let maxBin = prfData.overall[0];
    for (const b of prfData.overall) {
      if (b.count > maxBin.count) maxBin = b;
    }
    return maxBin.min + maxBin.binSize / 2;
  }, [prfData.overall]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const rangeEnd = d.min + d.binSize;
    return (
      <div className="bg-[#181C22] border border-[#343A42] px-3 py-2 text-[11px] font-mono leading-relaxed">
        <div className="text-[#E8EAED]">
          PRF: <span className="tabular-nums">{d.range}-{rangeEnd.toFixed(0)} Hz</span>
        </div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color }} className="tabular-nums">
            {p.dataKey}: <span>{p.value}</span> pulse{p.value !== 1 ? "s" : ""}
          </div>
        ))}
      </div>
    );
  };

  const emitterLegend = prfData.per_emitter.map((e) => ({
    label: e.label,
    color: e.color,
  }));

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#22262D] flex items-center justify-between">
        <span className="section-label">PRF Histogram</span>
        <div className="flex items-center gap-2">
          {peakPRF !== null && (
            <span className="text-[10px] font-mono text-[#5C636D] tabular-nums">
              Peak: <span className="text-[#D98E33]">{peakPRF.toFixed(0)} Hz</span>
            </span>
          )}
          <span className="text-[10px] font-mono text-[#5C636D] tabular-nums">
            {totalPulses.toLocaleString()} intervals
          </span>
        </div>
      </div>
      <div className="flex-1 p-2">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[11px] font-mono text-[#5C636D]">
            No PRF data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#22262D" vertical={false} />
              <XAxis
                dataKey="range"
                tick={{ fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" }}
                stroke="#22262D"
                interval={Math.floor(chartData.length / 8)}
                label={{
                  value: "Hz",
                  position: "insideBottomRight",
                  offset: -5,
                  style: { fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" },
                }}
              />
              <YAxis
                tick={{ fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" }}
                stroke="#22262D"
                width={35}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#D98E3310" }} />
              <Bar
                dataKey="Overall"
                fill="#D98E33"
                fillOpacity={0.5}
                stroke="#D98E33"
                strokeWidth={1}
                radius={[1, 1, 0, 0]}
                isAnimationActive={false}
              />
              {prfData.per_emitter.map((emitter) => (
                <Bar
                  key={emitter.label}
                  dataKey={emitter.label}
                  fill={emitter.color}
                  fillOpacity={0.7}
                  stroke={emitter.color}
                  strokeWidth={0.5}
                  radius={[1, 1, 0, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {emitterLegend.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-x-3 gap-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-[#D98E33] opacity-50" />
            <span className="text-[9px] font-mono text-[#5C636D]">Overall</span>
          </div>
          {emitterLegend.map((e) => (
            <div key={e.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: e.color, opacity: 0.7 }} />
              <span className="text-[9px] font-mono text-[#5C636D]">{e.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(PRFHistogram);
