"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface BandStat {
  band_id: number;
  dwell_centre_mhz: number;
  pulse_count: number;
  n_emitters: number;
  mean_amplitude: number;
  frequency_range: number[];
}

interface SpectrumWaterfallProps {
  waterfall: number[][];
  waterfallLabels: number[][];
  nBands: number;
  nTimeBins: number;
  selectedBand: number | null;
  scanHistory: number[];
  dwellCentres: number[];
  currentScanStep: number;
  bandStats?: BandStat[];
  onBandClick?: (band: number) => void;
}

export default function SpectrumWaterfall({
  waterfall,
  waterfallLabels,
  nBands,
  nTimeBins,
  selectedBand,
  scanHistory,
  dwellCentres,
  currentScanStep,
  bandStats,
  onBandClick,
}: SpectrumWaterfallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    band: number;
    time: number;
    x: number;
    y: number;
  } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const COLORS = {
    transmission: "#C4523B",
    transmissionHover: "#D4654E",
    nonTransmission: "#1A1D22",
    scanHighlight: "#D98E33",
    scanGlow: "rgba(217, 142, 51, 0.12)",
    gridLine: "#1E2128",
    selectedBandBg: "rgba(217, 142, 51, 0.08)",
    selectedBandBorder: "#D98E33",
    hoveredBand: "rgba(155, 163, 173, 0.06)",
    threatEmitter: "#A13A34",
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const padding = { top: 8, right: 12, bottom: 24, left: 64 };
    const plotWidth = dimensions.width - padding.left - padding.right;
    const plotHeight = dimensions.height - padding.top - padding.bottom;
    const cellWidth = plotWidth / nTimeBins;
    const cellHeight = plotHeight / nBands;

    // Clear
    ctx.fillStyle = "#0E1013";
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Draw horizontal grid lines (every few bands)
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 0.5;
    const gridStep = Math.max(1, Math.floor(nBands / 18));
    for (let b = 0; b < nBands; b += gridStep) {
      const y = padding.top + b * cellHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotWidth, y);
      ctx.stroke();
    }

    // Draw vertical grid lines
    const tGridStep = Math.max(1, Math.floor(nTimeBins / 20));
    for (let t = 0; t < nTimeBins; t += tGridStep) {
      const x = padding.left + t * cellWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotHeight);
      ctx.stroke();
    }

    // Draw heatmap cells
    for (let band = 0; band < nBands; band++) {
      for (let t = 0; t < nTimeBins; t++) {
        const x = padding.left + t * cellWidth;
        const y = padding.top + band * cellHeight;

        const isTransmission = waterfall[band][t] === 1;
        const isScanned = t < scanHistory.length && scanHistory[t] === band;
        const isSelected = selectedBand === band;
        const isHovered = hoveredCell?.band === band;

        // Base cell
        if (isTransmission) {
          // Intensity based on label (higher label = more intense)
          const label = waterfallLabels[band]?.[t] || 0;
          const intensity = Math.min(1, label / 20);
          const r = parseInt(COLORS.transmission.slice(1, 3), 16);
          const g = parseInt(COLORS.transmission.slice(3, 5), 16);
          const bVal = parseInt(COLORS.transmission.slice(5, 7), 16);
          ctx.fillStyle = `rgba(${r}, ${g}, ${bVal}, ${0.5 + intensity * 0.5})`;
        } else {
          ctx.fillStyle = COLORS.nonTransmission;
        }

        ctx.fillRect(x, y, cellWidth + 0.5, cellHeight + 0.5);

        // Scan marker overlay
        if (isScanned) {
          ctx.fillStyle = "rgba(217, 142, 51, 0.25)";
          ctx.fillRect(x, y, cellWidth + 0.5, cellHeight + 0.5);
        }
      }
    }

    // Selected band highlight
    if (selectedBand !== null && selectedBand >= 0 && selectedBand < nBands) {
      const y = padding.top + selectedBand * cellHeight;

      // Background highlight
      ctx.fillStyle = COLORS.selectedBandBg;
      ctx.fillRect(padding.left, y, plotWidth, cellHeight);

      // Border
      ctx.strokeStyle = COLORS.selectedBandBorder;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.strokeRect(padding.left + 0.5, y + 0.5, plotWidth - 1, cellHeight - 1);

      // Band label
      ctx.fillStyle = COLORS.selectedBandBorder;
      ctx.font = "bold 10px 'IBM Plex Mono', monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `B${selectedBand}`,
        padding.left - 4,
        y + cellHeight / 2
      );
    }

    // Hovered band highlight
    if (hoveredCell && hoveredCell.band !== selectedBand) {
      const y = padding.top + hoveredCell.band * cellHeight;
      ctx.fillStyle = COLORS.hoveredBand;
      ctx.fillRect(padding.left, y, plotWidth, cellHeight);
    }

    // Current scan step marker
    if (currentScanStep >= 0 && currentScanStep < nTimeBins) {
      const x = padding.left + currentScanStep * cellWidth;

      // Glow region
      const gradient = ctx.createLinearGradient(x - 30, 0, x + 30, 0);
      gradient.addColorStop(0, "rgba(217, 142, 51, 0)");
      gradient.addColorStop(0.5, "rgba(217, 142, 51, 0.08)");
      gradient.addColorStop(1, "rgba(217, 142, 51, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - 30, padding.top, 60, plotHeight);

      // Sweep line
      ctx.strokeStyle = COLORS.scanHighlight;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotHeight);
      ctx.stroke();

      // Triangle marker at top
      ctx.fillStyle = COLORS.scanHighlight;
      ctx.beginPath();
      ctx.moveTo(x - 4, padding.top - 2);
      ctx.lineTo(x + 4, padding.top - 2);
      ctx.lineTo(x, padding.top + 4);
      ctx.closePath();
      ctx.fill();

      // Current scan band box
      if (currentScanStep < scanHistory.length) {
        const currentBand = scanHistory[currentScanStep];
        if (currentBand >= 0 && currentBand < nBands) {
          const y = padding.top + currentBand * cellHeight;
          ctx.strokeStyle = COLORS.scanHighlight;
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.strokeRect(x - cellWidth / 2, y, cellWidth, cellHeight);
        }
      }
    }

    // Y-axis labels
    ctx.fillStyle = "#5C636D";
    ctx.font = "9px 'IBM Plex Mono', monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const labelStep = Math.max(1, Math.floor(nBands / 12));
    for (let band = 0; band < nBands; band += labelStep) {
      const y = padding.top + band * cellHeight + cellHeight / 2;
      const freq = dwellCentres[band];
      ctx.fillText(`${freq.toFixed(0)}`, padding.left - 8, y);
    }

    // Y-axis title
    ctx.save();
    ctx.translate(10, padding.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#3A3F46";
    ctx.font = "8px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("FREQ (MHz)", 0, 0);
    ctx.restore();

    // X-axis time markers
    ctx.fillStyle = "#3A3F46";
    ctx.font = "8px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    const tLabelStep = Math.max(1, Math.floor(nTimeBins / 10));
    for (let t = 0; t < nTimeBins; t += tLabelStep) {
      const x = padding.left + t * cellWidth;
      ctx.fillText(`t${t}`, x, dimensions.height - 6);
    }
  }, [
    waterfall,
    waterfallLabels,
    nBands,
    nTimeBins,
    selectedBand,
    scanHistory,
    dwellCentres,
    currentScanStep,
    dimensions,
    hoveredCell,
  ]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const padding = { top: 8, right: 12, bottom: 24, left: 64 };
      const plotHeight = dimensions.height - padding.top - padding.bottom;
      const cellHeight = plotHeight / nBands;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top - padding.top;
      const band = Math.floor(y / cellHeight);

      if (band >= 0 && band < nBands) {
        setHoveredCell({ band, time: 0, x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else {
        setHoveredCell(null);
      }
    },
    [dimensions, nBands]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (hoveredCell && onBandClick) {
        onBandClick(hoveredCell.band);
      }
    },
    [hoveredCell, onBandClick]
  );

  return (
    <div ref={containerRef} className="flex-1 relative bg-[#0E1013] min-h-[200px]">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredCell(null)}
        onClick={handleClick}
      />

      {/* Floating tooltip */}
      {hoveredCell && (() => {
        const band = hoveredCell.band;
        const stats = bandStats?.[band];
        const bandWaterfall = waterfall[band] || [];
        const pulseCount = bandWaterfall.filter((v) => v === 1).length;
        const isActive = bandWaterfall.includes(1);
        const freqRange = stats?.frequency_range;
        const sparkData = bandWaterfall.slice(0, 80);
        const sparkWidth = 120;
        const sparkHeight = 16;
        const sparkPoints = sparkData.length > 1
          ? sparkData.map((v, i) => {
              const x = (i / (sparkData.length - 1)) * sparkWidth;
              const y = v === 1 ? 2 : sparkHeight - 2;
              return `${x},${y}`;
            }).join(" ")
          : "";

        return (
          <div
            className="absolute bg-[#181C22] border border-[#343A42] px-3 py-2 text-[10px] font-mono pointer-events-none z-20 min-w-[180px]"
            style={{
              left: Math.min(hoveredCell.x + 12, dimensions.width - 210),
              top: Math.max(hoveredCell.y - 80, 4),
            }}
          >
            <div className="text-[#E8EAED] font-medium text-[11px]">
              Band {band} &middot; {dwellCentres[band]?.toFixed(0)} MHz
            </div>
            <div className="text-[#9BA3AD] mt-1 space-y-0.5">
              <div className="flex justify-between">
                <span>Pulses</span>
                <span className="text-[#D98E33] tabular-nums">{pulseCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <span className={isActive ? "text-[#C4523B]" : "text-[#5C636D]"}>
                  {isActive ? "Active" : "Idle"}
                </span>
              </div>
              {stats && (
                <>
                  <div className="flex justify-between">
                    <span>Emitters</span>
                    <span className="text-[#E8EAED] tabular-nums">{stats.n_emitters}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mean Amp</span>
                    <span className="text-[#E8EAED] tabular-nums">
                      {stats.mean_amplitude.toFixed(1)} dB
                    </span>
                  </div>
                  {freqRange && freqRange.length === 2 && (
                    <div className="flex justify-between">
                      <span>Freq Range</span>
                      <span className="text-[#E8EAED] tabular-nums">
                        {freqRange[0].toFixed(0)}-{freqRange[1].toFixed(0)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
            {sparkPoints && (
              <div className="mt-1.5 pt-1 border-t border-[#2A2E35]">
                <svg width={sparkWidth} height={sparkHeight} className="block">
                  <polyline
                    points={sparkPoints}
                    fill="none"
                    stroke={isActive ? "#C4523B" : "#3A3F46"}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
            <div className="text-[#5C636D] text-[9px] mt-1">Click to inspect</div>
          </div>
        );
      })()}
    </div>
  );
}
