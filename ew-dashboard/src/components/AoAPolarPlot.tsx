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

  const { points, ampMin, ampMax } = useMemo(() => {
    const len = pulseData.aoa.length;
    const amps = pulseData.amplitude;
    const aMin = Math.min(...amps);
    const aMax = Math.max(...amps);
    const aRange = aMax - aMin || 1;

    const pts = [];
    for (let i = 0; i < len; i++) {
      const angle = pulseData.aoa[i]; // degrees, 0-360
      const normAmp = (amps[i] - aMin) / aRange; // 0-1
      const r = 15 + normAmp * (MAX_RADIUS - 15); // min radius so center isn't crowded
      const rad = (angle - 90) * DEG_TO_RAD; // -90 so 0° is up (north)
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

  // Coverage gaps: bin angles into 12 sectors (30° each), find empty ones
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

  const handleHover = (e: React.MouseEvent) => {
    const target = e.currentTarget as SVGGElement;
    const circle = target.querySelector("circle:last-child") as SVGCircleElement;
    if (circle) {
      circle.setAttribute("r", "5");
      circle.setAttribute("fill-opacity", "1");
    }
  };

  const handleLeave = (e: React.MouseEvent) => {
    const target = e.currentTarget as SVGGElement;
    const circle = target.querySelector("circle:last-child") as SVGCircleElement;
    if (circle) {
      circle.setAttribute("r", "2");
      circle.setAttribute("fill-opacity", "0.6");
    }
  };

  const CustomTooltip = (d: any) => {
    return (
      <title>
        {`AoA: ${d.angle.toFixed(1)}° | Amp: ${d.amplitude.toFixed(1)} dBm | Emitter #${d.label}\nFreq: ${d.frequency.toFixed(1)} MHz | ToA: ${d.toa.toFixed(0)} μs`}
      </title>
    );
  };

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
            const rad = (gapAngle - 90) * DEG_TO_RAD;
            const midRad = ((gapAngle + 15) - 90) * DEG_TO_RAD;
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

          {/* Pulse points */}
          {points.map((p, i) => {
            const color = labelToColor.get(p.label) ?? "#9BA3AD";
            return (
              <g
                key={i}
                onMouseEnter={handleHover}
                onMouseLeave={handleLeave}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={15}
                  fill="transparent"
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={2}
                  fill={color}
                  fillOpacity={0.6}
                  stroke={color}
                  strokeWidth={0.5}
                  strokeOpacity={0.8}
                >
                  <CustomTooltip {...p} />
                </circle>
              </g>
            );
          })}

          {/* Receiver marker */}
          <circle cx={CENTER} cy={CENTER} r={3} fill="#D98E33" fillOpacity={0.8} />
          <circle cx={CENTER} cy={CENTER} r={5} fill="none" stroke="#D98E33" strokeWidth={0.8} strokeOpacity={0.4} />
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
