"use client";

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

interface AoAPolarPlotProps {
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

const DEG_TO_RAD = Math.PI / 180;
const MAX_RADIUS = 160;
const RING_COUNT = 5;
const LABEL_OFFSET = 26;
const SVG_SIZE = (MAX_RADIUS + LABEL_OFFSET) * 2 + 16;
const CENTER = SVG_SIZE / 2;

function AoAPolarPlot({
  pulseData,
  emitterTypes,
  emitterLabels,
}: AoAPolarPlotProps) {
  const labelToColor = useMemo(() => {
    const map = new Map<number, string>();
    const typeColors = emitterTypes.map((et) => tailwindToHex(et.color));
    const palette = [
      ...typeColors,
      "#C4523B",
      "#D98E33",
      "#5E8C6A",
      "#B87B3E",
      "#6B7B8D",
      "#9B59B6",
      "#3498DB",
    ];
    emitterLabels.forEach((lbl, i) => {
      map.set(lbl, palette[i % palette.length]);
    });
    return map;
  }, [emitterTypes, emitterLabels]);

  const { points } = useMemo(() => {
    const len = pulseData.aoa.length;
    const amps = pulseData.amplitude;
    const aMin = Math.min(...amps);
    const aMax = Math.max(...amps);
    const aRange = aMax - aMin || 1;

    const pts = [];
    for (let i = 0; i < len; i++) {
      const angle = pulseData.aoa[i];
      const normAmp = (amps[i] - aMin) / aRange;
      const r = 15 + normAmp * (MAX_RADIUS - 15);
      const rad = (angle - 90) * DEG_TO_RAD;
      pts.push({
        x: CENTER + r * Math.cos(rad),
        y: CENTER + r * Math.sin(rad),
        angle,
        amplitude: amps[i],
        label: pulseData.emitter_label[i],
        toa: pulseData.toa[i],
        frequency: pulseData.frequency[i],
      });
    }
    return { points: pts, ampMin: aMin, ampMax: aMax };
  }, [pulseData]);

  const coverageGaps = useMemo(() => {
    const sectorSize = 30;
    const sectors = new Array(360 / sectorSize).fill(false);
    for (const p of points) {
      const s = Math.floor(((p.angle % 360) + 360) % 360 / sectorSize);
      sectors[s] = true;
    }
    return sectors
      .map((active, i) => (!active ? i : -1))
      .filter((i) => i >= 0)
      .map((i) => i * sectorSize);
  }, [points]);

  // Derive a stable key from the data identity so the wrapper re-mounts on config change
  const animKey = useMemo(
    () => `${pulseData.aoa.length}-${pulseData.aoa[0] ?? 0}`,
    [pulseData]
  );

  // Batch points into groups for staggered CSS animation
  // Each batch gets a progressively longer delay
  const BATCH_SIZE = 80;
  const batches = useMemo(() => {
    const result: typeof points[] = [];
    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      result.push(points.slice(i, i + BATCH_SIZE));
    }
    return result;
  }, [points]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#22262D] flex items-center justify-between">
        <span className="section-label">AoA Polar Plot</span>
        <span className="text-[10px] font-mono text-[#5C636D] tabular-nums">
          {points.length.toLocaleString()} pulses
        </span>
      </div>
      <div className="flex-1 p-2 flex items-center justify-center min-h-0">
        <svg
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <style>{`
            @keyframes aoa-dot-in {
              0% { opacity: 0; transform: scale(0); }
              100% { opacity: 1; transform: scale(1); }
            }
            .aoa-dot {
              animation: aoa-dot-in 250ms ease-out both;
              transform-origin: center;
              transform-box: fill-box;
            }
            .aoa-dot:hover circle:last-child {
              r: 5;
              fill-opacity: 1;
            }
          `}</style>

          {/* Concentric rings */}
          {Array.from({ length: RING_COUNT }, (_, i) => {
            const r = ((i + 1) / RING_COUNT) * MAX_RADIUS;
            return (
              <circle
                key={`ring-${i}`}
                cx={CENTER}
                cy={CENTER}
                r={r}
                fill="none"
                stroke="#22262D"
                strokeWidth={0.8}
              />
            );
          })}

          {/* Radial lines every 30° */}
          {Array.from({ length: 12 }, (_, i) => {
            const angle = i * 30 * DEG_TO_RAD;
            return (
              <line
                key={`rad-${i}`}
                x1={CENTER}
                y1={CENTER}
                x2={CENTER + MAX_RADIUS * Math.cos(angle)}
                y2={CENTER + MAX_RADIUS * Math.sin(angle)}
                stroke="#22262D"
                strokeWidth={0.5}
              />
            );
          })}

          {/* Degree labels every 30° */}
          {[
            { label: "0°", angle: -90 },
            { label: "30°", angle: -60 },
            { label: "60°", angle: -30 },
            { label: "90°", angle: 0 },
            { label: "120°", angle: 30 },
            { label: "150°", angle: 60 },
            { label: "180°", angle: 90 },
            { label: "210°", angle: 120 },
            { label: "240°", angle: 150 },
            { label: "270°", angle: 180 },
            { label: "300°", angle: 210 },
            { label: "330°", angle: 240 },
          ].map(({ label, angle }) => {
            const rad = angle * DEG_TO_RAD;
            return (
              <text
                key={label}
                x={CENTER + (MAX_RADIUS + LABEL_OFFSET) * Math.cos(rad)}
                y={CENTER + (MAX_RADIUS + LABEL_OFFSET) * Math.sin(rad)}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#5C636D"
                fontSize={8}
                fontFamily="IBM Plex Mono"
              >
                {label}
              </text>
            );
          })}

          {/* Coverage gap highlights */}
          {coverageGaps.map((gapAngle) => {
            const arcPath = describeArc(
              CENTER,
              CENTER,
              MAX_RADIUS * 0.3,
              gapAngle - 90,
              gapAngle + 30 - 90
            );
            return (
              <path
                key={`gap-${gapAngle}`}
                d={arcPath}
                fill="#C4523B"
                fillOpacity={0.08}
                stroke="none"
              />
            );
          })}

          {/* Pulse points — batched CSS stagger animation */}
          {batches.map((batch, batchIdx) => (
            <g key={`batch-${animKey}-${batchIdx}`}>
              {batch.map((p, localIdx) => {
                const globalIdx = batchIdx * BATCH_SIZE + localIdx;
                const color = labelToColor.get(p.label) ?? "#9BA3AD";
                const delay = batchIdx * 60; // ms delay per batch
                return (
                  <g
                    key={globalIdx}
                    className="aoa-dot"
                    style={{
                      animationDelay: `${delay}ms`,
                    }}
                  >
                    {/* Invisible hit area */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={15}
                      fill="transparent"
                    />
                    {/* Visible dot */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={2}
                      fill={color}
                      fillOpacity={0.6}
                      stroke={color}
                      strokeWidth={0.5}
                      strokeOpacity={0.8}
                      style={{
                        transition: "r 100ms ease-out, fill-opacity 100ms ease-out",
                      }}
                    >
                      <title>{`AoA: ${p.angle.toFixed(1)} | Amp: ${p.amplitude.toFixed(1)} dBm | Emitter #${p.label}\nFreq: ${p.frequency.toFixed(1)} MHz | ToA: ${p.toa.toFixed(0)} us`}</title>
                    </circle>
                  </g>
                );
              })}
            </g>
          ))}

          {/* Receiver marker */}
          <circle cx={CENTER} cy={CENTER} r={3} fill="#D98E33" fillOpacity={0.8}>
            <animate
              attributeName="r"
              values="3;4;3"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="fill-opacity"
              values="0.8;0.4;0.8"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx={CENTER} cy={CENTER} r={5} fill="none" stroke="#D98E33" strokeWidth={0.8} strokeOpacity={0.4}>
            <animate
              attributeName="r"
              values="5;7;5"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="stroke-opacity"
              values="0.4;0.1;0.4"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      </div>
    </div>
  );
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

export default memo(AoAPolarPlot);
