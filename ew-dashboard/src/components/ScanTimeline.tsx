"use client";

import { useMemo, useRef, useEffect, useState, useCallback } from "react";

interface ScanTimelineProps {
  scanHistory: number[];
  waterfall: number[][];
  dwellCentres: number[];
  currentStep: number;
  onStepClick: (step: number) => void;
  nBands: number;
}

export default function ScanTimeline({
  scanHistory,
  waterfall,
  dwellCentres,
  currentStep,
  onStepClick,
  nBands,
}: ScanTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverStep, setHoverStep] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const lastMoveTime = useRef(0);

  // Cached bars — offscreen canvas for GPU-accelerated blit
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const barsCacheKeyRef = useRef<string>("");
  const lastCanvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        setDimensions({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const totalSteps = scanHistory.length;
  const barsPadding = 8;
  const barsWidth = Math.max(0, dimensions.width - barsPadding);
  const barWidth = totalSteps > 0 ? barsWidth / totalSteps : 0;

  // Draw the timeline bars on canvas (cached via offscreen canvas)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = dimensions.width;
    const h = dimensions.height;
    const canvasW = w * dpr;
    const canvasH = h * dpr;

    // Only reset canvas dimensions when they actually change
    if (lastCanvasSizeRef.current.w !== canvasW || lastCanvasSizeRef.current.h !== canvasH) {
      canvas.width = canvasW;
      canvas.height = canvasH;
      ctx.scale(dpr, dpr);
      lastCanvasSizeRef.current = { w: canvasW, h: canvasH };
      barsCacheKeyRef.current = ""; // Force full redraw
    }

    // Check cache — only full redraw if data changed
    const cacheKey = `${totalSteps}-${nBands}-${JSON.stringify(scanHistory.slice(0, 5))}`;
    if (offscreenCanvasRef.current && barsCacheKeyRef.current === cacheKey) {
      // Fast GPU-accelerated blit from offscreen canvas
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
      ctx.restore();
    } else {
      // Full bar redraw to offscreen canvas
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement("canvas");
      }
      offscreenCanvasRef.current.width = canvasW;
      offscreenCanvasRef.current.height = canvasH;
      const offCtx = offscreenCanvasRef.current.getContext("2d");
      if (!offCtx) return;
      offCtx.scale(dpr, dpr);

      offCtx.clearRect(0, 0, w, h);

      // Build hit lookup
      const hitSet = new Set<number>();
      for (let i = 0; i < scanHistory.length; i++) {
        if (waterfall[scanHistory[i]]?.[i] === 1) {
          hitSet.add(i);
        }
      }

      const containerHeight = h;
      for (let i = 0; i < totalSteps; i++) {
        const band = scanHistory[i];
        const isHit = hitSet.has(i);
        const x = i * barWidth;
        const barH = Math.max(4, (band / nBands) * containerHeight);

        offCtx.fillStyle = isHit ? "#5E8C6A" : "#3A3F46";
        offCtx.globalAlpha = 0.7;
        offCtx.fillRect(x, h - barH, barWidth, barH);
        offCtx.globalAlpha = 1;
      }

      // Copy to main canvas
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
      ctx.restore();

      barsCacheKeyRef.current = cacheKey;
    }

    // --- Dynamic overlay: current step highlight + hover ---
    if (currentStep >= 0 && currentStep < totalSteps) {
      const band = scanHistory[currentStep];
      const x = currentStep * barWidth;
      const barH = Math.max(4, (band / nBands) * h);

      ctx.fillStyle = "#D98E33";
      ctx.fillRect(x, h - barH, barWidth, barH);
    }

    if (hoverStep !== null && hoverStep !== currentStep && hoverStep >= 0 && hoverStep < totalSteps) {
      const band = scanHistory[hoverStep];
      const x = hoverStep * barWidth;
      const barH = Math.max(4, (band / nBands) * h);

      ctx.fillStyle = "#D98E33";
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x, h - barH, barWidth, barH);
      ctx.globalAlpha = 1;
    }
  }, [scanHistory, waterfall, nBands, dimensions, currentStep, hoverStep, totalSteps, barWidth]);

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const now = performance.now();
      if (now - lastMoveTime.current < 32) return;
      lastMoveTime.current = now;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const step = Math.round((x / barsWidth) * totalSteps);
      setHoverStep(Math.max(0, Math.min(totalSteps - 1, step)));
    },
    [barsWidth, totalSteps]
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const step = Math.round((x / barsWidth) * totalSteps);
      onStepClick(Math.max(0, Math.min(totalSteps - 1, step)));
    },
    [barsWidth, totalSteps, onStepClick]
  );

  return (
    <div className="bg-[#12151A] border-t border-[#22262D] flex-shrink-0 h-20 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-[#22262D] flex items-center justify-between">
        <span className="section-label">Scan History Timeline</span>
        <div className="flex items-center gap-3 text-[9px] font-mono text-[#5C636D]">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-[#D98E33]" />
            <span>Scanned</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-[#5E8C6A]" />
            <span>Hit</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-[#3A3F46]" />
            <span>Miss</span>
          </div>
        </div>
      </div>
      <div
        ref={containerRef}
        className="h-16 relative cursor-pointer px-2 py-1"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setHoverStep(null)}
          onClick={handleCanvasClick}
        />
      </div>
    </div>
  );
}
