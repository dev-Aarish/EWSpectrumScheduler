"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { useMemo, memo } from "react";

interface BandStats {
  band_id: number;
  dwell_centre_mhz: number;
  pulse_count: number;
  n_emitters: number;
  mean_amplitude: number;
  frequency_range: number[];
}

interface Decision {
  time_step: number;
  band_chosen: number;
  confidence: number;
  predicted_reward: number;
  actual_detection: boolean;
  timestamp: number;
}

interface EmitterType {
  label: string;
  count: number;
  color: string;
}

interface InterceptionRatioOverTimeProps {
  waterfall: number[][];
  waterfallLabels: number[][];
  schedulerDecisions: Decision[];
  bandStats: BandStats[];
  emitterTypes: EmitterType[];
  nBands: number;
  nTimeBins: number;
  scanStep: number;
}

const STRATEGIES = [
  { key: "ml_scheduler", label: "ML Scheduler", color: "#D98E33", dash: undefined },
  { key: "sequential", label: "Sequential", color: "#6B7B8D", dash: "5 3" },
  { key: "random", label: "Random", color: "#9BA3AD", dash: "3 2" },
  { key: "priority", label: "Priority", color: "#5E8C6A", dash: "8 4" },
] as const;

const THRESHOLD = 0.85;

const N_RANDOM_RUNS = 10;

function InterceptionRatioOverTime({
  waterfall,
  waterfallLabels,
  schedulerDecisions,
  bandStats,
  emitterTypes,
  nBands,
  nTimeBins,
  scanStep,
}: InterceptionRatioOverTimeProps) {
  const { chartData, strategyRatios, emitterTypeRatios } = useMemo(() => {
    // Running interception ratio: cumulative_hits[t] / cumulative_transmissions[t]
    // cumulative_transmissions[t] = total waterfall cells with 1 across all bands for time <= t

    // Precompute per-time-step total transmissions across all bands
    const transmissionsPerStep = new Array<number>(nTimeBins).fill(0);
    for (let t = 0; t < nTimeBins; t++) {
      for (let b = 0; b < nBands; b++) {
        if (waterfall[b]?.[t] === 1) transmissionsPerStep[t]++;
      }
    }

    // --- ML Scheduler (real data) ---
    const mlHits = new Array<number>(nTimeBins).fill(0);
    let mlHitCum = 0;
    for (let t = 0; t < nTimeBins; t++) {
      if (t < schedulerDecisions.length && schedulerDecisions[t].actual_detection) {
        mlHitCum++;
      }
      mlHits[t] = mlHitCum;
    }

    // --- Sequential Scan baseline ---
    const seqHits = new Array<number>(nTimeBins).fill(0);
    let seqHitCum = 0;
    for (let t = 0; t < nTimeBins; t++) {
      const band = t % nBands;
      if (waterfall[band]?.[t] === 1) seqHitCum++;
      seqHits[t] = seqHitCum;
    }

    // --- Random Scan baseline (average of N runs) ---
    const randomRuns: number[][] = [];
    for (let run = 0; run < N_RANDOM_RUNS; run++) {
      const runHits = new Array<number>(nTimeBins).fill(0);
      let runHitCum = 0;
      for (let t = 0; t < nTimeBins; t++) {
        const band = Math.floor(Math.random() * nBands);
        if (waterfall[band]?.[t] === 1) runHitCum++;
        runHits[t] = runHitCum;
      }
      randomRuns.push(runHits);
    }
    const randomMean = new Array<number>(nTimeBins).fill(0);
    const randomUpper = new Array<number>(nTimeBins).fill(0);
    const randomLower = new Array<number>(nTimeBins).fill(0);
    for (let t = 0; t < nTimeBins; t++) {
      const values = randomRuns.map((r) => r[t]);
      values.sort((a, b) => a - b);
      const mean = values.reduce((s, v) => s + v, 0) / N_RANDOM_RUNS;
      randomMean[t] = mean;
      randomUpper[t] = values[Math.floor(N_RANDOM_RUNS * 0.9)];
      randomLower[t] = values[Math.floor(N_RANDOM_RUNS * 0.1)];
    }

    // --- Priority Scan baseline (scan most active bands first) ---
    const priorityOrder = bandStats
      .map((b, i) => ({ idx: i, count: b.pulse_count }))
      .sort((a, b) => b.count - a.count)
      .map((b) => b.idx);

    const priHits = new Array<number>(nTimeBins).fill(0);
    let priHitCum = 0;
    for (let t = 0; t < nTimeBins; t++) {
      const cycleLen = priorityOrder.length || 1;
      const band = priorityOrder[t % cycleLen];
      if (waterfall[band]?.[t] === 1) priHitCum++;
      priHits[t] = priHitCum;
    }

    // --- Compute running ratios ---
    const runningTransmissions = new Array<number>(nTimeBins).fill(0);
    let transCum = 0;
    for (let t = 0; t < nTimeBins; t++) {
      transCum += transmissionsPerStep[t];
      runningTransmissions[t] = transCum;
    }

    const ratio = (hits: number[], t: number) =>
      runningTransmissions[t] > 0 ? hits[t] / runningTransmissions[t] : 0;

    // --- Per-emitter-type interception ratio (ML scheduler only) ---
    // emitter_label -> cumulative transmissions and detections per type
    const uniqueLabels = [...new Set(emitterTypes.map((_, i) => i))];
    const typeTransmissionCum: Record<number, number[]> = {};
    const typeDetectionCum: Record<number, number[]> = {};
    for (const lbl of uniqueLabels) {
      typeTransmissionCum[lbl] = new Array<number>(nTimeBins).fill(0);
      typeDetectionCum[lbl] = new Array<number>(nTimeBins).fill(0);
    }

    // Count transmissions per type per time step
    for (let t = 0; t < nTimeBins; t++) {
      for (let b = 0; b < nBands; b++) {
        if (waterfall[b]?.[t] === 1) {
          const lbl = waterfallLabels[b]?.[t] ?? 0;
          if (lbl in typeTransmissionCum) {
            typeTransmissionCum[lbl][t]++;
          }
        }
      }
    }

    // Count ML detections per type per time step
    for (let t = 0; t < nTimeBins; t++) {
      if (t < schedulerDecisions.length && schedulerDecisions[t].actual_detection) {
        const band = schedulerDecisions[t].band_chosen;
        const lbl = waterfallLabels[band]?.[t] ?? 0;
        if (lbl in typeDetectionCum) {
          typeDetectionCum[lbl][t]++;
        }
      }
    }

    // Cumulative sums for per-type
    const typeTransCum: Record<number, number[]> = {};
    const typeDetCum: Record<number, number[]> = {};
    for (const lbl of uniqueLabels) {
      typeTransCum[lbl] = new Array<number>(nTimeBins).fill(0);
      typeDetCum[lbl] = new Array<number>(nTimeBins).fill(0);
      let tc = 0;
      let dc = 0;
      for (let t = 0; t < nTimeBins; t++) {
        tc += typeTransmissionCum[lbl][t];
        dc += typeDetectionCum[lbl][t];
        typeTransCum[lbl][t] = tc;
        typeDetCum[lbl][t] = dc;
      }
    }

    const typeRatio = (lbl: number, t: number) =>
      typeTransCum[lbl][t] > 0 ? typeDetCum[lbl][t] / typeTransCum[lbl][t] : 0;

    // --- Assemble chart data ---
    const sampleEvery = nTimeBins > 200 ? Math.ceil(nTimeBins / 200) : 1;
    const data = [];
    for (let t = 0; t < nTimeBins; t += sampleEvery) {
      const point: Record<string, number> = {
        step: t,
        "ML Scheduler": ratio(mlHits, t),
        Sequential: ratio(seqHits, t),
        Random: ratio(randomMean, t),
        Priority: ratio(priHits, t),
        randomUpperUpper: ratio(randomUpper, t),
        randomLowerLower: ratio(randomLower, t),
      };
      for (const lbl of uniqueLabels) {
        const typeName = emitterTypes[lbl]?.label ?? `Type ${lbl}`;
        point[typeName] = typeRatio(lbl, t);
      }
      data.push(point);
    }
    // Ensure last point
    if ((nTimeBins - 1) % sampleEvery !== 0) {
      const t = nTimeBins - 1;
      const point: Record<string, number> = {
        step: t,
        "ML Scheduler": ratio(mlHits, t),
        Sequential: ratio(seqHits, t),
        Random: ratio(randomMean, t),
        Priority: ratio(priHits, t),
        randomUpperUpper: ratio(randomUpper, t),
        randomLowerLower: ratio(randomLower, t),
      };
      for (const lbl of uniqueLabels) {
        const typeName = emitterTypes[lbl]?.label ?? `Type ${lbl}`;
        point[typeName] = typeRatio(lbl, t);
      }
      data.push(point);
    }

    // Final ratio values (at last time step)
    const last = nTimeBins - 1;
    const stratRatios = {
      ml: ratio(mlHits, last),
      seq: ratio(seqHits, last),
      random: ratio(randomMean, last),
      pri: ratio(priHits, last),
    };

    const emTypeRatios = uniqueLabels.map((lbl) => ({
      label: emitterTypes[lbl]?.label ?? `Type ${lbl}`,
      color: emitterTypes[lbl]?.color ?? "#5C636D",
      ratio: typeRatio(lbl, last),
    }));

    return {
      chartData: data,
      strategyRatios: stratRatios,
      emitterTypeRatios: emTypeRatios,
    };
  }, [waterfall, waterfallLabels, schedulerDecisions, bandStats, emitterTypes, nBands, nTimeBins]);

  // Progressive reveal — only show data up to current scanStep
  const visibleData = useMemo(() => {
    return chartData.filter((d) => d.step <= scanStep + 1);
  }, [chartData, scanStep]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#181C22] border border-[#343A42] px-3 py-2 text-[11px] font-mono leading-relaxed max-h-[240px] overflow-y-auto">
        <div className="text-[#5C636D] mb-1">
          Step <span className="tabular-nums text-[#E8EAED]">{label}</span>
        </div>
        {payload.map((p: any) => {
          if (p.dataKey === "randomUpperUpper" || p.dataKey === "randomLowerLower") return null;
          const strategy = STRATEGIES.find((s) => s.label === p.dataKey);
          const emitter = emitterTypeRatios.find((e) => e.label === p.dataKey);
          const color = strategy?.color ?? emitter?.color ?? p.color;
          const pct = (p.value * 100).toFixed(1);
          return (
            <div key={p.dataKey} style={{ color }} className="tabular-nums">
              {p.dataKey}: <span className="font-semibold">{pct}%</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#22262D] flex items-center justify-between flex-wrap gap-1">
        <span className="section-label">Interception Ratio Over Time</span>
        <div className="flex items-center gap-3 flex-wrap">
          {STRATEGIES.map((s) => {
            const ratioKey = s.key === "ml_scheduler" ? "ml" : s.key === "sequential" ? "seq" : s.key;
            const val = strategyRatios[ratioKey as keyof typeof strategyRatios] ?? 0;
            return (
              <div key={s.key} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-[9px] font-mono text-[#5C636D]">
                  {s.label}{" "}
                  <span className="tabular-nums" style={{ color: s.color }}>
                    {(val * 100).toFixed(1)}%
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex-1 p-2">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[11px] font-mono text-[#5C636D]">
            No detection data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visibleData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#22262D" vertical={false} />
              <XAxis
                dataKey="step"
                tick={{ fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" }}
                stroke="#22262D"
                label={{
                  value: "Scan Step",
                  position: "insideBottomRight",
                  offset: -5,
                  style: { fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" },
                }}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" }}
                stroke="#22262D"
                width={40}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                label={{
                  value: "Interception Ratio",
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  style: { fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" },
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Target threshold line */}
              <ReferenceLine
                y={THRESHOLD}
                stroke="#D98E33"
                strokeDasharray="6 3"
                strokeOpacity={0.6}
                label={{
                  value: `Target ${(THRESHOLD * 100).toFixed(0)}%`,
                  position: "insideTopRight",
                  fill: "#D98E33",
                  fontSize: 9,
                  fontFamily: "IBM Plex Mono",
                }}
              />
              {/* Current scan step marker */}
              <ReferenceLine
                x={scanStep}
                stroke="#D98E33"
                strokeDasharray="4 2"
                strokeOpacity={0.3}
              />
              {/* Random confidence band */}
              <ReferenceArea
                y1={0}
                y2={0}
                fill="#9BA3AD"
                fillOpacity={0}
                strokeOpacity={0}
              />
              <Line
                type="monotone"
                dataKey="randomUpperUpper"
                stroke="#9BA3AD"
                strokeOpacity={0.15}
                strokeWidth={0}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="randomLowerLower"
                stroke="#9BA3AD"
                strokeOpacity={0.15}
                strokeWidth={0}
                fill="#9BA3AD"
                fillOpacity={0.05}
                dot={false}
                isAnimationActive={false}
              />
              {/* Strategy lines */}
              {STRATEGIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.label}
                  stroke={s.color}
                  strokeWidth={s.key === "ml_scheduler" ? 2 : 1.5}
                  strokeDasharray={s.dash}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
              {/* Per-emitter-type breakdown lines (thinner, dashed) */}
              {emitterTypeRatios.map((et) => (
                <Line
                  key={et.label}
                  type="monotone"
                  dataKey={et.label}
                  stroke={et.color}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  strokeOpacity={0.6}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default memo(InterceptionRatioOverTime);
