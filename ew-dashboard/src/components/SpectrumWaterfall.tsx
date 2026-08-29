"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface SpectrumWaterfallProps {
  waterfall: number[][];
  waterfallLabels: number[][];
  nBands: number;
  nTimeBins: number;
  selectedBand: number | null;
  scanHistory: number[];
  dwellCentres: number[];
  currentScanStep: number;
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
}: SpectrumWaterfallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    band: number;
    time: number;
  } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Colors matching design.md
  const COLORS = {
    transmission: "#C4523B",
    nonTransmission: "#1A1D22",
    scanHighlight: "#D98E33",
    scanGlow: "rgba(217, 142, 51, 0.15)",
    gridLine: "#22262D",
    selectedBand: "rgba(217, 142, 51, 0.1)",
    hoveredBand: "rgba(155, 163, 173, 0.08)",
  };

  // Handle resize
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

  // Draw the waterfall
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const padding = { top: 28, right: 12, bottom: 32, left: 56 };
    const plotWidth = dimensions.width - padding.left - padding.right;
    const plotHeight = dimensions.height - padding.top - padding.bottom;
    const cellWidth = plotWidth / nTimeBins;
    const cellHeight = plotHeight / nBands;

    // Clear
    ctx.fillStyle = "#0E1013";
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Draw cells
    for (let band = 0; band < nBands; band++) {
      for (let t = 0; t < nTimeBins; t++) {
        const x = padding.left + t * cellWidth;
        const y = padding.top + band * cellHeight;

        // Base color - non-transmission
        if (waterfall[band][t] === 1) {
          ctx.fillStyle = COLORS.transmission;
        } else {
          ctx.fillStyle = COLORS.nonTransmission;
        }

        ctx.fillRect(x, y, cellWidth + 0.5, cellHeight + 0.5);

        // Scan history indicator (amber dots)
        if (t < scanHistory.length && scanHistory[t] === band) {
          ctx.fillStyle = COLORS.scanHighlight;
          ctx.fillRect(x, y, cellWidth + 0.5, cellHeight + 0.5);
        }
      }
    }

    // Draw selected band highlight
    if (selectedBand !== null && selectedBand >= 0 && selectedBand < nBands) {
      const y = padding.top + selectedBand * cellHeight;
      ctx.fillStyle = COLORS.selectedBand;
      ctx.fillRect(padding.left, y, plotWidth, cellHeight);
      
      // Accent outline
      ctx.strokeStyle = COLORS.scanHighlight;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(padding.left, y, plotWidth, cellHeight);
    }

    // Draw hovered band
    if (hoveredCell !== null && hoveredCell.band !== selectedBand) {
      const y = padding.top + hoveredCell.band * cellHeight;
      ctx.fillStyle = COLORS.hoveredBand;
      ctx.fillRect(padding.left, y, plotWidth, cellHeight);
    }

    // Current scan step marker
    if (currentScanStep >= 0 && currentScanStep < nTimeBins) {
      const x = padding.left + currentScanStep * cellWidth;
      
      // Glow effect
      ctx.fillStyle = COLORS.scanGlow;
      ctx.fillRect(x - 20, padding.top, 40, plotHeight);
      
      // Vertical line
      ctx.strokeStyle = COLORS.scanHighlight;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotHeight);
      ctx.stroke();

      // Current band highlight at scan step
      if (currentScanStep < scanHistory.length) {
        const currentBand = scanHistory[currentScanStep];
        if (currentBand >= 0 && currentBand < nBands) {
          const y = padding.top + currentBand * cellHeight;
          ctx.strokeStyle = COLORS.scanHighlight;
          ctx.lineWidth = 2;
          ctx.strokeRect(
            x - cellWidth / 2,
            y,
            cellWidth,
            cellHeight
          );
        }
      }
    }

    // Y-axis labels (band frequencies)
    ctx.fillStyle = "#9BA3AD";
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const labelStep = Math.max(1, Math.floor(nBands / 10));
    for (let band = 0; band < nBands; band += labelStep) {
      const y = padding.top + band * cellHeight + cellHeight / 2;
      const freq = dwellCentres[band];
      ctx.fillText(`${freq.toFixed(0)}`, padding.left - 6, y);
    }

    // X-axis label
    ctx.fillStyle = "#5C636D";
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("TIME", padding.left + plotWidth / 2, dimensions.height - 8);

    // Y-axis label
    ctx.save();
    ctx.translate(12, padding.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#5C636D";
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("FREQ (MHz)", 0, 0);
    ctx.restore();
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
    COLORS,
  ]);

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const padding = { top: 28, right: 12, bottom: 32, left: 56 };
      const plotWidth = dimensions.width - padding.left - padding.right;
      const plotHeight = dimensions.height - padding.top - padding.bottom;
      const cellHeight = plotHeight / nBands;

      const y = e.clientY - rect.top - padding.top;
      const band = Math.floor(y / cellHeight);

      if (band >= 0 && band < nBands) {
        setHoveredCell({ band, time: 0 });
      } else {
        setHoveredCell(null);
      }
    },
    [dimensions, nBands]
  );

  return (
    <div ref={containerRef} className="flex-1 relative bg-[#0E1013]">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredCell(null)}
      />
      
      {/* Tooltip */}
      {hoveredCell && (
        <div className="absolute top-2 left-14 bg-[#181C22] border border-[#343A42] px-2 py-1 text-[10px] font-mono text-[#E8EAED] pointer-events-none">
          <div>Band {hoveredCell.band} | {dwellCentres[hoveredCell.band]?.toFixed(0)} MHz</div>
          <div className="text-[#9BA3AD]">
            {waterfall[hoveredCell.band]?.includes(1) ? "Active" : "Idle"} | 
            Pulses: {waterfall[hoveredCell.band]?.filter((v) => v === 1).length}
          </div>
        </div>
      )}
    </div>
  );
}
