"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BandStat {
  band_id: number;
  dwell_centre_mhz: number;
  pulse_count: number;
  n_emitters: number;
  mean_amplitude: number;
  frequency_range: number[];
}

export type WaterfallViewMode = "binary" | "amplitude";

interface SpectrumWaterfallProps {
  waterfall: number[][];
  waterfallLabels: number[][];
  waterfallAmplitude?: number[][];
  amplitudeRange?: [number, number];
  nBands: number;
  nTimeBins: number;
  selectedBand: number | null;
  scanHistory: number[];
  dwellCentres: number[];
  currentScanStep: number;
  /** 0 to nTimeBins float — for smooth sweep line interpolation */
  scanProgress?: number;
  bandStats?: BandStat[];
  onBandClick?: (band: number) => void;
  viewMode?: WaterfallViewMode;
  onViewModeChange?: (mode: WaterfallViewMode) => void;
}

const PADDING = { top: 8, right: 12, bottom: 24, left: 64 };
const COLORBAR_WIDTH = 16;
const COLORBAR_GAP = 8;

/** Viridis-inspired colormap: 0 → dark purple, 0.5 → teal/green, 1 → bright yellow */
function amplitudeToColor(value: number, min: number, max: number): string {
  if (max <= min) return "rgb(68, 1, 84)";
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));

  // 5-stop gradient: purple → blue → teal → green → yellow
  const stops = [
    [68, 1, 84],     // #440154  deep purple
    [59, 82, 139],   // #3B528B  blue
    [33, 145, 140],  // #21918C  teal
    [94, 201, 98],   // #5EC962  green
    [253, 231, 37],  // #FDE725  yellow
  ];
  const seg = t * (stops.length - 1);
  const i = Math.min(Math.floor(seg), stops.length - 2);
  const f = seg - i;
  const r = Math.round(stops[i][0] + (stops[i + 1][0] - stops[i][0]) * f);
  const g = Math.round(stops[i][1] + (stops[i + 1][1] - stops[i][1]) * f);
  const b = Math.round(stops[i][2] + (stops[i + 1][2] - stops[i][2]) * f);
  return `rgb(${r},${g},${b})`;
}

/** Pre-render the colormap as a vertical gradient strip for the colorbar */
function colormapGradientCSS(): string {
  const stops: string[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const c = amplitudeToColor(t, 0, 1);
    stops.push(`${c} ${(t * 100).toFixed(1)}%`);
  }
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

export default function SpectrumWaterfall({
  waterfall,
  waterfallLabels,
  waterfallAmplitude,
  amplitudeRange,
  nBands,
  nTimeBins,
  selectedBand,
  scanHistory,
  dwellCentres,
  currentScanStep,
  scanProgress,
  bandStats,
  onBandClick,
  viewMode = "binary",
  onViewModeChange,
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

  // Crossfade on config/data change — snapshot old canvas, dissolve it over new content
  const [crossfadeSnapshot, setCrossfadeSnapshot] = useState<string | null>(null);
  const prevWaterfallRef = useRef(waterfall);
  useEffect(() => {
    if (prevWaterfallRef.current !== waterfall) {
      prevWaterfallRef.current = waterfall;
      const canvas = canvasRef.current;
      if (canvas) {
        setCrossfadeSnapshot(canvas.toDataURL());
      }
    }
  }, [waterfall]);

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
    const cacheKey = `${waterfall.length}-${nBands}-${nTimeBins}-${selectedBand}-${JSON.stringify(scanHistory.slice(0, 5))}-${viewMode}-${amplitudeRange?.[0]}-${amplitudeRange?.[1]}`;
    if (offscreenCanvasRef.current && heatmapCacheKeyRef.current === cacheKey) {
      // Fast GPU-accelerated blit from offscreen canvas
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvasW, canvasH);
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
      const isAmplitude = viewMode === "amplitude" && waterfallAmplitude && amplitudeRange;
      const ampMin = amplitudeRange?.[0] ?? 0;
      const ampMax = amplitudeRange?.[1] ?? 1;

      // Draw heatmap cells
      for (let band = 0; band < nBands; band++) {
        for (let t = 0; t < nTimeBins; t++) {
          const x = PADDING.left + t * cellWidth;
          const y = PADDING.top + band * cellHeight;

          const isTransmission = waterfall[band][t] === 1;
          const isScanned = scanLookup.has(t * nBands + band);

          if (isAmplitude && isTransmission) {
            const amp = waterfallAmplitude![band][t];
            offCtx.fillStyle = amplitudeToColor(amp, ampMin, ampMax);
          } else if (isTransmission) {
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

      // Colorbar (amplitude mode only)
      if (isAmplitude) {
        const cbX = PADDING.left + plotWidth + COLORBAR_GAP;
        const cbHeight = plotHeight;
        const cbY = PADDING.top;

        // Gradient strip
        const grad = offCtx.createLinearGradient(0, cbY, 0, cbY + cbHeight);
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          grad.addColorStop(t, amplitudeToColor(ampMin + t * (ampMax - ampMin), ampMin, ampMax));
        }
        offCtx.fillStyle = grad;
        offCtx.fillRect(cbX, cbY, COLORBAR_WIDTH, cbHeight);
        offCtx.strokeStyle = "#2A2E35";
        offCtx.lineWidth = 0.5;
        offCtx.strokeRect(cbX, cbY, COLORBAR_WIDTH, cbHeight);

        // Tick labels
        offCtx.fillStyle = "#5C636D";
        offCtx.font = "8px 'IBM Plex Mono', monospace";
        offCtx.textAlign = "left";
        offCtx.textBaseline = "middle";
        const nTicks = 5;
        for (let i = 0; i <= nTicks; i++) {
          const t = i / nTicks;
          const val = ampMin + t * (ampMax - ampMin);
          const y = cbY + (1 - t) * cbHeight;
          offCtx.fillText(`${val.toFixed(0)}`, cbX + COLORBAR_WIDTH + 3, y);
          // Small tick mark
          offCtx.beginPath();
          offCtx.moveTo(cbX + COLORBAR_WIDTH, y);
          offCtx.lineTo(cbX + COLORBAR_WIDTH + 2, y);
          offCtx.strokeStyle = "#5C636D";
          offCtx.lineWidth = 0.5;
          offCtx.stroke();
        }

        // dB label
        offCtx.save();
        offCtx.translate(cbX + COLORBAR_WIDTH + 22, cbY + cbHeight / 2);
        offCtx.rotate(-Math.PI / 2);
        offCtx.fillStyle = "#3A3F46";
        offCtx.font = "8px 'IBM Plex Mono', monospace";
        offCtx.textAlign = "center";
        offCtx.fillText("dB", 0, 0);
        offCtx.restore();
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
    // Use scanProgress for smooth interpolation between time bins
    const progress = scanProgress ?? currentScanStep;
    if (progress >= 0 && progress < nTimeBins) {
      const x = PADDING.left + progress * cellWidth;

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

      // Current scan band box (uses discrete step for exact band index)
      const discreteStep = Math.round(progress);
      if (discreteStep >= 0 && discreteStep < scanHistory.length) {
        const currentBand = scanHistory[discreteStep];
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
    waterfallAmplitude,
    amplitudeRange,
    nBands,
    nTimeBins,
    selectedBand,
    scanHistory,
    dwellCentres,
    currentScanStep,
    scanProgress,
    dimensions,
    viewMode,
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
      {/* Crossfade snapshot: old canvas content dissolves over new content */}
      <AnimatePresence>
        {crossfadeSnapshot && (
          <motion.img
            key={crossfadeSnapshot}
            src={crossfadeSnapshot}
            alt=""
            className="absolute inset-0 w-full h-full pointer-events-none"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.06,
              ease: [0.4, 0, 0.2, 1],
            }}
            onAnimationComplete={() => setCrossfadeSnapshot(null)}
          />
        )}
      </AnimatePresence>

      {/* View mode toggle */}
      {onViewModeChange && (
        <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 bg-[#181C22]/90 border border-[#2A2E35] rounded px-1.5 py-0.5">
          <button
            onClick={() => onViewModeChange("binary")}
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${
              viewMode === "binary"
                ? "bg-[#D98E33]/20 text-[#D98E33]"
                : "text-[#5C636D] hover:text-[#9BA3AD]"
            }`}
          >
            Binary
          </button>
          <button
            onClick={() => onViewModeChange("amplitude")}
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${
              viewMode === "amplitude"
                ? "bg-[#D98E33]/20 text-[#D98E33]"
                : "text-[#5C636D] hover:text-[#9BA3AD]"
            }`}
          >
            Amplitude
          </button>
        </div>
      )}

      {/* Floating tooltip */}
      {hoveredCell && (() => {
        const band = hoveredCell.band;
        const stats = bandStats?.[band];
        const bandWaterfall = waterfall[band] || [];
        const pulseCount = bandWaterfall.filter((v) => v === 1).length;
        const isActive = bandWaterfall.includes(1);
        const freqRange = stats?.frequency_range;
        const isAmpMode = viewMode === "amplitude" && waterfallAmplitude && amplitudeRange;

        // Sparkline: in amplitude mode show amplitude values, otherwise binary
        const sparkData = isAmpMode
          ? (waterfallAmplitude![band] || []).slice(0, 80)
          : bandWaterfall.slice(0, 80);
        const sparkWidth = 120;
        const sparkHeight = 16;
        const sparkPoints = sparkData.length > 1
          ? (() => {
              if (isAmpMode) {
                const ampMin = amplitudeRange![0];
                const ampMax = amplitudeRange![1];
                const range = ampMax - ampMin || 1;
                return sparkData.map((v, i) => {
                  const x = (i / (sparkData.length - 1)) * sparkWidth;
                  const y = sparkHeight - 2 - ((v - ampMin) / range) * (sparkHeight - 4);
                  return `${x},${y}`;
                }).join(" ");
              }
              return sparkData.map((v, i) => {
                const x = (i / (sparkData.length - 1)) * sparkWidth;
                const y = v === 1 ? 2 : sparkHeight - 2;
                return `${x},${y}`;
              }).join(" ");
            })()
          : "";

        // Compute mean amplitude for this band in amplitude mode
        const bandAmp = isAmpMode
          ? (waterfallAmplitude![band] || []).filter((v) => v > 0)
          : [];
        const meanAmp = bandAmp.length > 0
          ? bandAmp.reduce((s, v) => s + v, 0) / bandAmp.length
          : null;

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
                  {isAmpMode && meanAmp !== null && (
                    <div className="flex justify-between">
                      <span>Cell Amp</span>
                      <span className="text-[#E8EAED] tabular-nums">
                        {meanAmp.toFixed(1)} dB
                      </span>
                    </div>
                  )}
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
                    stroke={isAmpMode ? "#5EC962" : isActive ? "#C4523B" : "#3A3F46"}
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
