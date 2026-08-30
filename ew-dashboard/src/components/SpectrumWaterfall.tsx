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

const PADDING = { top: 8, right: 12, bottom: 24, left: 64 };

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

  // Cached heatmap — offscreen canvas for GPU-accelerated blit
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heatmapCacheKeyRef = useRef<string>("");
  const lastCanvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const lastHoverTime = useRef(0);

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

  // Build the heatmap (cached via offscreen canvas — only redraws when data changes)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasW = dimensions.width * dpr;
    const canvasH = dimensions.height * dpr;

    // Only reset canvas dimensions when they actually change (avoids clear + context reset)
    if (lastCanvasSizeRef.current.w !== canvasW || lastCanvasSizeRef.current.h !== canvasH) {
      canvas.width = canvasW;
      canvas.height = canvasH;
      ctx.scale(dpr, dpr);
      lastCanvasSizeRef.current = { w: canvasW, h: canvasH };
      heatmapCacheKeyRef.current = ""; // Force full redraw
    }

    const plotWidth = dimensions.width - PADDING.left - PADDING.right;
    const plotHeight = dimensions.height - PADDING.top - PADDING.bottom;
    const cellWidth = plotWidth / nTimeBins;
    const cellHeight = plotHeight / nBands;

    // Check if we can reuse the cached offscreen heatmap
    const cacheKey = `${waterfall.length}-${nBands}-${nTimeBins}-${selectedBand}-${JSON.stringify(scanHistory.slice(0, 5))}`;
    if (offscreenCanvasRef.current && heatmapCacheKeyRef.current === cacheKey) {
      // Fast GPU-accelerated blit from offscreen canvas
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
      ctx.restore();
    } else {
      // Full heatmap draw to offscreen canvas
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement("canvas");
      }
      offscreenCanvasRef.current.width = canvasW;
      offscreenCanvasRef.current.height = canvasH;
      const offCtx = offscreenCanvasRef.current.getContext("2d");
      if (!offCtx) return;
      offCtx.scale(dpr, dpr);

      // Clear
      offCtx.fillStyle = "#0E1013";
      offCtx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Draw horizontal grid lines
      offCtx.strokeStyle = "#1E2128";
      offCtx.lineWidth = 0.5;
      const gridStep = Math.max(1, Math.floor(nBands / 18));
      for (let b = 0; b < nBands; b += gridStep) {
        const y = PADDING.top + b * cellHeight;
        offCtx.beginPath();
        offCtx.moveTo(PADDING.left, y);
        offCtx.lineTo(PADDING.left + plotWidth, y);
        offCtx.stroke();
      }

      // Draw vertical grid lines
      const tGridStep = Math.max(1, Math.floor(nTimeBins / 20));
      for (let t = 0; t < nTimeBins; t += tGridStep) {
        const x = PADDING.left + t * cellWidth;
        offCtx.beginPath();
        offCtx.moveTo(x, PADDING.top);
        offCtx.lineTo(x, PADDING.top + plotHeight);
        offCtx.stroke();
      }

      // Precompute scan lookup
      const scanLookup = new Set<number>();
      for (let t = 0; t < scanHistory.length; t++) {
        scanLookup.add(t * nBands + scanHistory[t]);
      }

      // Precompute transmission RGB once
      const tR = 0xC4, tG = 0x52, tB = 0x3B;

      // Draw heatmap cells
      for (let band = 0; band < nBands; band++) {
        for (let t = 0; t < nTimeBins; t++) {
          const x = PADDING.left + t * cellWidth;
          const y = PADDING.top + band * cellHeight;

          const isTransmission = waterfall[band][t] === 1;
          const isScanned = scanLookup.has(t * nBands + band);

          if (isTransmission) {
            const label = waterfallLabels[band]?.[t] || 0;
            const intensity = Math.min(1, label / 20);
            offCtx.fillStyle = `rgba(${tR}, ${tG}, ${tB}, ${0.5 + intensity * 0.5})`;
          } else {
            offCtx.fillStyle = "#1A1D22";
          }

          offCtx.fillRect(x, y, cellWidth + 0.5, cellHeight + 0.5);

          if (isScanned) {
            offCtx.fillStyle = "rgba(217, 142, 51, 0.25)";
            offCtx.fillRect(x, y, cellWidth + 0.5, cellHeight + 0.5);
          }
        }
      }

      // Selected band highlight
      if (selectedBand !== null && selectedBand >= 0 && selectedBand < nBands) {
        const y = PADDING.top + selectedBand * cellHeight;
        offCtx.fillStyle = "rgba(217, 142, 51, 0.08)";
        offCtx.fillRect(PADDING.left, y, plotWidth, cellHeight);
        offCtx.strokeStyle = "#D98E33";
        offCtx.lineWidth = 1.5;
        offCtx.setLineDash([]);
        offCtx.strokeRect(PADDING.left + 0.5, y + 0.5, plotWidth - 1, cellHeight - 1);
        offCtx.fillStyle = "#D98E33";
        offCtx.font = "bold 10px 'IBM Plex Mono', monospace";
        offCtx.textAlign = "right";
        offCtx.textBaseline = "middle";
        offCtx.fillText(`B${selectedBand}`, PADDING.left - 4, y + cellHeight / 2);
      }

      // Y-axis labels
      offCtx.fillStyle = "#5C636D";
      offCtx.font = "9px 'IBM Plex Mono', monospace";
      offCtx.textAlign = "right";
      offCtx.textBaseline = "middle";
      const labelStep = Math.max(1, Math.floor(nBands / 12));
      for (let band = 0; band < nBands; band += labelStep) {
        const y = PADDING.top + band * cellHeight + cellHeight / 2;
        const freq = dwellCentres[band];
        offCtx.fillText(`${freq.toFixed(0)}`, PADDING.left - 8, y);
      }

      // Y-axis title
      offCtx.save();
      offCtx.translate(10, PADDING.top + plotHeight / 2);
      offCtx.rotate(-Math.PI / 2);
      offCtx.fillStyle = "#3A3F46";
      offCtx.font = "8px 'IBM Plex Mono', monospace";
      offCtx.textAlign = "center";
      offCtx.fillText("FREQ (MHz)", 0, 0);
      offCtx.restore();

      // X-axis time markers
      offCtx.fillStyle = "#3A3F46";
      offCtx.font = "8px 'IBM Plex Mono', monospace";
      offCtx.textAlign = "center";
      const tLabelStep = Math.max(1, Math.floor(nTimeBins / 10));
      for (let t = 0; t < nTimeBins; t += tLabelStep) {
        const x = PADDING.left + t * cellWidth;
        offCtx.fillText(`t${t}`, x, dimensions.height - 6);
      }

      // Copy to main canvas
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
      ctx.restore();

      heatmapCacheKeyRef.current = cacheKey;
    }

    // --- Draw dynamic overlay (sweep line) — cheap, runs every frame ---
    if (currentScanStep >= 0 && currentScanStep < nTimeBins) {
      const x = PADDING.left + currentScanStep * cellWidth;

      // Glow region
      const gradient = ctx.createLinearGradient(x - 30, 0, x + 30, 0);
      gradient.addColorStop(0, "rgba(217, 142, 51, 0)");
      gradient.addColorStop(0.5, "rgba(217, 142, 51, 0.08)");
      gradient.addColorStop(1, "rgba(217, 142, 51, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - 30, PADDING.top, 60, plotHeight);

      // Sweep line
      ctx.strokeStyle = "#D98E33";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, PADDING.top);
      ctx.lineTo(x, PADDING.top + plotHeight);
      ctx.stroke();

      // Triangle marker at top
      ctx.fillStyle = "#D98E33";
      ctx.beginPath();
      ctx.moveTo(x - 4, PADDING.top - 2);
      ctx.lineTo(x + 4, PADDING.top - 2);
      ctx.lineTo(x, PADDING.top + 4);
      ctx.closePath();
      ctx.fill();

      // Current scan band box
      if (currentScanStep < scanHistory.length) {
        const currentBand = scanHistory[currentScanStep];
        if (currentBand >= 0 && currentBand < nBands) {
          const y = PADDING.top + currentBand * cellHeight;
          ctx.strokeStyle = "#D98E33";
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.strokeRect(x - cellWidth / 2, y, cellWidth, cellHeight);
        }
      }
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
  ]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const now = performance.now();
      if (now - lastHoverTime.current < 32) return;
      lastHoverTime.current = now;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const plotHeight = dimensions.height - PADDING.top - PADDING.bottom;
      const cellHeight = plotHeight / nBands;

      const y = e.clientY - rect.top - PADDING.top;
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
