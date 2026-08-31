"use client";

import { useMemo, memo, useState, useCallback, useRef } from "react";

interface PulseData {
  frequency: number[];
  emitter_label: number[];
}

interface EmitterType {
  label: string;
  count: number;
  color: string;
}

interface BandEmitterHeatmapProps {
  pulseData: PulseData;
  emitterTypes: EmitterType[];
  emitterLabels: number[];
  nBands: number;
  freqRange: number[];
}

const PALETTE = [
  "#C4523B",
  "#D98E33",
  "#5E8C6A",
  "#B8763E",
  "#6B7B8D",
  "#9B59B6",
  "#3498DB",
  "#E67E22",
  "#1ABC9C",
  "#E74C3C",
];

const CELL_X = 55;
const CELL_Y = 4;
const CELL_W = 14;
const CELL_H = 20;
const GAP_X = 16;
const GAP_Y = 22;

function BandEmitterHeatmap({
  pulseData,
  emitterTypes,
  emitterLabels,
  nBands,
  freqRange,
}: BandEmitterHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ band: number; emitter: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const labelToColor = useMemo(() => {
    const map = new Map<number, string>();
    const typeColors = emitterTypes.map((et) => et.color);
    const palette = [...typeColors, ...PALETTE];
    emitterLabels.forEach((lbl, i) => {
      map.set(lbl, palette[i % palette.length]);
    });
    return map;
  }, [emitterTypes, emitterLabels]);

  const { matrix, bandTotals, emitterTotals, maxVal } = useMemo(() => {
    const nEmitters = emitterLabels.length;
    const mat: number[][] = Array.from({ length: nBands }, () => new Array(nEmitters).fill(0));
    const bTotals = new Array(nBands).fill(0);
    const eTotals = new Array(nEmitters).fill(0);

    const [fMin, fMax] = freqRange;
    const bandWidth = (fMax - fMin) / nBands;

    for (let i = 0; i < pulseData.frequency.length; i++) {
      const freq = pulseData.frequency[i];
      const label = pulseData.emitter_label[i];
      const bandIdx = Math.min(Math.floor((freq - fMin) / bandWidth), nBands - 1);
      const emitterIdx = emitterLabels.indexOf(label);
      if (bandIdx < 0 || bandIdx >= nBands || emitterIdx < 0) continue;
      mat[bandIdx][emitterIdx]++;
      bTotals[bandIdx]++;
      eTotals[emitterIdx]++;
    }

    let max = 0;
    for (const row of mat) for (const v of row) if (v > max) max = v;

    return { matrix: mat, bandTotals: bTotals, emitterTotals: eTotals, maxVal: max || 1 };
  }, [pulseData, emitterLabels, nBands, freqRange]);

  const getCellColor = (count: number): string => {
    if (count === 0) return "#1A1D22";
    const t = Math.min(count / maxVal, 1);
    const r = Math.round(26 + (217 - 26) * t);
    const g = Math.round(29 + (142 - 29) * t);
    const b = Math.round(34 + (51 - 34) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const svgViewBoxW = nBands * GAP_X + CELL_X;
  const svgViewBoxH = emitterLabels.length * GAP_Y + CELL_Y + 10;

  const handleSvgMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const inv = ctm.inverse();
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(inv);
      const mx = pt.x;
      const my = pt.y;

      const bi = Math.floor((mx - CELL_X) / GAP_X);
      const ei = Math.floor((my - CELL_Y) / GAP_Y);

      const inCellX = mx >= CELL_X + bi * GAP_X && mx <= CELL_X + bi * GAP_X + CELL_W;
      const inCellY = my >= CELL_Y + ei * GAP_Y && my <= CELL_Y + ei * GAP_Y + CELL_H;

      if (bi >= 0 && bi < nBands && ei >= 0 && ei < emitterLabels.length && inCellX && inCellY) {
        setHoveredCell({ band: bi, emitter: ei, x: e.clientX, y: e.clientY });
      } else {
        setHoveredCell(null);
      }
    },
    [nBands, emitterLabels.length]
  );

  const handleSvgMouseLeave = useCallback(() => setHoveredCell(null), []);

  const totalPulses = pulseData.frequency.length;

  return (
    <div className="flex flex-col h-full relative">
      <div className="px-3 py-2 border-b border-[#22262D] flex items-center justify-between">
        <span className="section-label">Band × Emitter Heatmap</span>
        <span className="text-[10px] font-mono text-[#5C636D] tabular-nums">
          {totalPulses.toLocaleString()} pulses
        </span>
      </div>
      <div className="flex-1 p-2 min-h-0 overflow-auto">
        <div className="flex h-full">
          <div className="flex items-center justify-center w-5 shrink-0">
            <span
              className="text-[9px] font-mono text-[#5C636D] whitespace-nowrap"
              style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
            >
              Frequency Band
            </span>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 min-h-0">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${svgViewBoxW} ${svgViewBoxH}`}
                className="w-full h-full"
                preserveAspectRatio="none"
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={handleSvgMouseLeave}
                style={{ cursor: "crosshair" }}
              >
                {matrix.map((row, bi) =>
                  row.map((count, ei) => {
                    const isH = hoveredCell?.band === bi && hoveredCell?.emitter === ei;
                    return (
                      <rect
                        key={`${bi}-${ei}`}
                        x={bi * GAP_X + CELL_X}
                        y={ei * GAP_Y + CELL_Y}
                        width={CELL_W}
                        height={CELL_H}
                        rx={2}
                        fill={isH ? "#D98E33" : getCellColor(count)}
                        fillOpacity={isH ? 0.85 : 1}
                        stroke={isH ? "#E8EAED" : count === 0 ? "none" : "rgba(255,255,255,0.04)"}
                        strokeWidth={0.4}
                      />
                    );
                  })
                )}

                {emitterTotals.map((total, ei) => (
                  <text
                    key={`et-${ei}`}
                    x={CELL_X - 4}
                    y={ei * GAP_Y + CELL_Y + 13}
                    textAnchor="end"
                    fill="#5C636D"
                    fontSize={8}
                    fontFamily="IBM Plex Mono"
                  >
                    {total}
                  </text>
                ))}

                {bandTotals.map((total, bi) => (
                  <text
                    key={`bt-${bi}`}
                    x={bi * GAP_X + CELL_X + CELL_W / 2}
                    y={emitterLabels.length * GAP_Y + CELL_Y + 8}
                    textAnchor="middle"
                    fill="#5C636D"
                    fontSize={8}
                    fontFamily="IBM Plex Mono"
                  >
                    {total}
                  </text>
                ))}
              </svg>
            </div>

            <div className="flex items-end gap-px pl-[55px] mt-1 overflow-hidden">
              {Array.from({ length: nBands }, (_, i) => (
                <div
                  key={i}
                  className="w-[16px] shrink-0 text-center text-[8px] font-mono text-[#5C636D] leading-none"
                >
                  {i % Math.max(1, Math.floor(nBands / 10)) === 0 ? i : ""}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center mt-0.5">
              <span className="text-[9px] font-mono text-[#5C636D]">Band ID</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-start gap-0.5 pl-2 pt-1 shrink-0">
            {emitterLabels.map((lbl) => {
              const color = labelToColor.get(lbl) ?? "#9BA3AD";
              return (
                <div key={lbl} className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: color, opacity: 0.8 }}
                  />
                  <span className="text-[8px] font-mono text-[#5C636D] whitespace-nowrap">
                    #{lbl}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {hoveredCell !== null && (
        <div
          className="fixed z-50 bg-[#181C22] border border-[#343A42] px-3 py-2 text-[11px] font-mono leading-relaxed pointer-events-none"
          style={{ left: hoveredCell.x + 12, top: hoveredCell.y - 10 }}
        >
          <div className="text-[#E8EAED]">
            Band <span className="tabular-nums">{hoveredCell.band}</span>
          </div>
          <div className="text-[#E8EAED]">
            Emitter <span style={{ color: labelToColor.get(emitterLabels[hoveredCell.emitter]) ?? "#9BA3AD" }}>#{emitterLabels[hoveredCell.emitter]}</span>
          </div>
          <div>
            <span className="text-[#D98E33] tabular-nums">{matrix[hoveredCell.band][hoveredCell.emitter]}</span>
            <span className="text-[#5C636D]"> pulses</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(BandEmitterHeatmap);
