"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMemo, memo } from "react";

interface PulseData {
  frequency: number[];
  aoa: number[];
  amplitude: number[];
  toa: number[];
  emitter_label: number[];
}

interface EmitterType {
  label: string;
  count: number;
  color: string;
}

interface ScatterPlotProps {
  pulseData: PulseData;
  emitterTypes: EmitterType[];
  emitterLabels: number[];
}

const EMITTER_COLORS: Record<string, string> = {
  "bg-[#C4523B]": "#C4523B",
  "bg-[#D98E33]": "#D98E33",
  "bg-[#5E8C6A]": "#5E8C6A",
  "bg-[#B8763E]": "#B8763E",
  "bg-[#6B7B8D]": "#6B7B8D",
};

function tailwindToHex(tw: string): string {
  return EMITTER_COLORS[tw] ?? "#9BA3AD";
}

function CustomDot(props: any) {
  const { cx, cy, fill, payload } = props;
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="transparent" />
      <circle cx={cx} cy={cy} r={2.5} fill={fill} fillOpacity={0.6} stroke={fill} strokeWidth={0.5} strokeOpacity={0.8} />
    </g>
  );
}

function ScatterPlot({
  pulseData,
  emitterTypes,
  emitterLabels,
}: ScatterPlotProps) {
  const labelToColor = useMemo(() => {
    const map = new Map<number, string>();
    // Map emitter type colors to their hex equivalents for consistent ordering
    const typeColors = emitterTypes.map((et) => tailwindToHex(et.color));
    const palette = [...typeColors, "#C4523B", "#D98E33", "#5E8C6A", "#B87B3E", "#6B7B8D", "#9B59B6", "#3498DB"];
    emitterLabels.forEach((lbl, i) => {
      map.set(lbl, palette[i % palette.length]);
    });
    return map;
  }, [emitterTypes, emitterLabels]);

  const groupedData = useMemo(() => {
    const groups = new Map<number, { frequency: number; aoa: number; amplitude: number; toa: number; emitter_label: number }[]>();
    const len = pulseData.frequency.length;
    for (let i = 0; i < len; i++) {
      const lbl = pulseData.emitter_label[i];
      if (!groups.has(lbl)) groups.set(lbl, []);
      groups.get(lbl)!.push({
        frequency: pulseData.frequency[i],
        aoa: pulseData.aoa[i],
        amplitude: pulseData.amplitude[i],
        toa: pulseData.toa[i],
        emitter_label: lbl,
      });
    }
    return groups;
  }, [pulseData]);

  const uniqueLabels = useMemo(
    () => [...new Set(pulseData.emitter_label)].sort((a, b) => a - b),
    [pulseData.emitter_label]
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-[#181C22] border border-[#343A42] px-3 py-2 text-[11px] font-mono leading-relaxed">
        <div className="text-[#E8EAED]">
          Freq: <span className="tabular-nums">{d.frequency.toFixed(1)} MHz</span>
        </div>
        <div className="text-[#E8EAED]">
          AoA: <span className="tabular-nums">{d.aoa.toFixed(1)}°</span>
        </div>
        <div className="text-[#E8EAED]">
          Amp: <span className="tabular-nums">{d.amplitude.toFixed(1)} dBm</span>
        </div>
        <div className="text-[#E8EAED]">
          ToA: <span className="tabular-nums">{d.toa.toFixed(0)} μs</span>
        </div>
        <div className="text-[#D98E33] mt-0.5">
          Emitter #{d.emitter_label}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#22262D] flex items-center justify-between">
        <span className="section-label">Frequency vs AoA</span>
        <span className="text-[10px] font-mono text-[#5C636D] tabular-nums">
          {pulseData.frequency.length.toLocaleString()} pulses
        </span>
      </div>
      <div className="flex-1 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#22262D"
            />
            <XAxis
              type="number"
              dataKey="frequency"
              name="Frequency"
              tick={{ fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" }}
              stroke="#22262D"
              label={{
                value: "MHz",
                position: "insideBottomRight",
                offset: -5,
                style: { fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" },
              }}
            />
            <YAxis
              type="number"
              dataKey="aoa"
              name="AoA"
              tick={{ fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" }}
              stroke="#22262D"
              width={45}
              label={{
                value: "deg",
                angle: -90,
                position: "insideLeft",
                offset: 10,
                style: { fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" },
              }}
            />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            {uniqueLabels.map((lbl) => (
              <Scatter
                key={lbl}
                name={`Emitter #${lbl}`}
                data={groupedData.get(lbl) ?? []}
                fill={labelToColor.get(lbl) ?? "#9BA3AD"}
                fillOpacity={0.6}
                shape={<CustomDot color={labelToColor.get(lbl) ?? "#9BA3AD"} />}
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(ScatterPlot);
