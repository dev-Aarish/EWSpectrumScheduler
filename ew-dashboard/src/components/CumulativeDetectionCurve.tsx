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

interface CumulativeDetectionCurveProps {
  waterfall: number[][];
  schedulerDecisions: Decision[];
  bandStats: BandStats[];
  scanHistory: number[];
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

const N_RANDOM_RUNS = 10;

function CumulativeDetectionCurve({
  waterfall,
  schedulerDecisions,
  bandStats,
  scanHistory,
  nBands,
  nTimeBins,
  scanStep,
}: CumulativeDetectionCurveProps) {
  const { chartData, totals, maxPossible } = useMemo(() => {
    const totalTransmissions = waterfall.reduce(
      (sum, row) => sum + row.reduce((s, v) => s + v, 0),
      0
    );

    // --- ML Scheduler (real data) ---
    const mlCumulative: number[] = [];
    let mlHits = 0;
    for (let t = 0; t < nTimeBins; t++) {
      if (t < schedulerDecisions.length && schedulerDecisions[t].actual_detection) {
        mlHits++;
      }
      mlCumulative.push(mlHits);
    }

    // --- Sequential Scan baseline ---
    const seqCumulative: number[] = [];
    let seqHits = 0;
    for (let t = 0; t < nTimeBins; t++) {
      const band = t % nBands;
      if (waterfall[band]?.[t] === 1) seqHits++;
      seqCumulative.push(seqHits);
    }

    // --- Random Scan baseline (average of N runs) ---
    const randomRuns: number[][] = [];
    for (let run = 0; run < N_RANDOM_RUNS; run++) {
      const runCumulative: number[] = [];
      let runHits = 0;
      for (let t = 0; t < nTimeBins; t++) {
        const band = Math.floor(Math.random() * nBands);
        if (waterfall[band]?.[t] === 1) runHits++;
        runCumulative.push(runHits);
      }
      randomRuns.push(runCumulative);
    }
    const randomCumulative: number[] = [];
    const randomUpper: number[] = [];
    const randomLower: number[] = [];
    for (let t = 0; t < nTimeBins; t++) {
      const values = randomRuns.map((r) => r[t]);
      values.sort((a, b) => a - b);
      const mean = values.reduce((s, v) => s + v, 0) / N_RANDOM_RUNS;
      randomCumulative.push(Math.round(mean * 10) / 10);
      randomUpper.push(values[Math.floor(N_RANDOM_RUNS * 0.9)]);
      randomLower.push(values[Math.floor(N_RANDOM_RUNS * 0.1)]);
    }

    // --- Priority Scan baseline (scan most active bands first) ---
    const priorityOrder = bandStats
      .map((b, i) => ({ idx: i, count: b.pulse_count }))
      .sort((a, b) => b.count - a.count)
      .map((b) => b.idx);

    const priCumulative: number[] = [];
    let priHits = 0;
    for (let t = 0; t < nTimeBins; t++) {
      const cycleLen = priorityOrder.length || 1;
      const band = priorityOrder[t % cycleLen];
      if (waterfall[band]?.[t] === 1) priHits++;
      priCumulative.push(priHits);
    }

    // --- Assemble chart data ---
    const data = [];
    const sampleEvery = nTimeBins > 200 ? Math.ceil(nTimeBins / 200) : 1;
    for (let t = 0; t < nTimeBins; t += sampleEvery) {
      data.push({
        step: t,
        "ML Scheduler": mlCumulative[t],
        Sequential: seqCumulative[t],
        Random: randomCumulative[t],
        Priority: priCumulative[t],
        randomUpper: randomUpper[t],
        randomLower: randomLower[t],
      });
    }
    // Ensure last point is included
    if ((nTimeBins - 1) % sampleEvery !== 0) {
      data.push({
        step: nTimeBins - 1,
        "ML Scheduler": mlCumulative[nTimeBins - 1],
        Sequential: seqCumulative[nTimeBins - 1],
        Random: randomCumulative[nTimeBins - 1],
        Priority: priCumulative[nTimeBins - 1],
        randomUpper: randomUpper[nTimeBins - 1],
        randomLower: randomLower[nTimeBins - 1],
      });
    }

    return {
      chartData: data,
      totals: {
        ml: mlHits,
        seq: seqHits,
        random: randomCumulative[nTimeBins - 1],
        pri: priHits,
      },
      maxPossible: totalTransmissions,
    };
  }, [waterfall, schedulerDecisions, bandStats, nBands, nTimeBins]);

  const ratios = useMemo(
    () => ({
      ml: maxPossible > 0 ? ((totals.ml / maxPossible) * 100).toFixed(1) : "0",
      seq: maxPossible > 0 ? ((totals.seq / maxPossible) * 100).toFixed(1) : "0",
      random: maxPossible > 0 ? ((totals.random / maxPossible) * 100).toFixed(1) : "0",
      pri: maxPossible > 0 ? ((totals.pri / maxPossible) * 100).toFixed(1) : "0",
    }),
    [totals, maxPossible]
  );

  // Progressive reveal — only show data up to current scanStep
  const visibleData = useMemo(() => {
    return chartData.filter((d) => d.step <= scanStep + 1);
  }, [chartData, scanStep]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#181C22] border border-[#343A42] px-3 py-2 text-[11px] font-mono leading-relaxed">
        <div className="text-[#5C636D] mb-1">
          Step <span className="tabular-nums text-[#E8EAED]">{label}</span>
        </div>
        {payload.map((p: any) => {
          if (p.dataKey === "randomUpper" || p.dataKey === "randomLower") return null;
          const strategy = STRATEGIES.find((s) => s.label === p.dataKey);
          const ratio = maxPossible > 0 ? ((p.value / maxPossible) * 100).toFixed(1) : "0";
          return (
            <div key={p.dataKey} style={{ color: strategy?.color ?? p.color }} className="tabular-nums">
              {p.dataKey}: <span className="font-semibold">{p.value}</span>
              <span className="text-[#5C636D] ml-1">({ratio}%)</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#22262D] flex items-center justify-between">
        <span className="section-label">Cumulative Detection Curve</span>
        <div className="flex items-center gap-3">
          {STRATEGIES.map((s) => {
            const ratioKey = s.key === "ml_scheduler" ? "ml" : s.key === "sequential" ? "seq" : s.key;
            const ratio = ratios[ratioKey as keyof typeof ratios] ?? "0";
            return (
              <div key={s.key} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-[9px] font-mono text-[#5C636D]">
                  {s.label}{" "}
                  <span className="tabular-nums" style={{ color: s.color }}>
                    {ratio}%
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
                tick={{ fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" }}
                stroke="#22262D"
                width={40}
                label={{
                  value: "Intercepts",
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  style: { fill: "#5C636D", fontSize: 9, fontFamily: "IBM Plex Mono" },
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Current scan step marker */}
              <ReferenceLine
                x={scanStep}
                stroke="#D98E33"
                strokeDasharray="4 2"
                strokeOpacity={0.5}
              />
              {/* Random confidence band (upper/lower) */}
              <Line
                type="monotone"
                dataKey="randomUpper"
                stroke="#9BA3AD"
                strokeOpacity={0.15}
                strokeWidth={0}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="randomLower"
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
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default memo(CumulativeDetectionCurve);
