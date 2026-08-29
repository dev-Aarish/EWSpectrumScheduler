"use client";

import { useMemo, useRef, useEffect, useState } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverStep, setHoverStep] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

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

  // Build step data with hit/miss info
  const steps = useMemo(() => {
    return scanHistory.map((band, i) => {
      const isHit = waterfall[band]?.[i] === 1;
      return { step: i, band, isHit };
    });
  }, [scanHistory, waterfall]);

  const totalSteps = steps.length;
  const containerHeight = dimensions.height || 64;
  // Bars container has px-2 (4px each side) inside the ref container
  const barsPadding = 8;
  const barsWidth = Math.max(0, dimensions.width - barsPadding);
  const barWidth = totalSteps > 0 ? barsWidth / totalSteps : 0;

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
        onClick={(e) => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const step = Math.round((x / barsWidth) * totalSteps);
          onStepClick(Math.max(0, Math.min(totalSteps - 1, step)));
        }}
        onMouseMove={(e) => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const step = Math.round((x / barsWidth) * totalSteps);
          setHoverStep(Math.max(0, Math.min(totalSteps - 1, step)));
        }}
        onMouseLeave={() => setHoverStep(null)}
      >
        {/* Bars */}
        <div className="relative h-full px-2">
          {steps.map((s, i) => {
            const isActive = i === currentStep;
            const isHovered = i === hoverStep;
            const isHit = s.isHit;
            let bgColor = "#3A3F46";
            if (isActive) bgColor = "#D98E33";
            else if (isHit) bgColor = "#5E8C6A";
            else bgColor = "#3A3F46";

            const barH = Math.max(4, (s.band / nBands) * containerHeight);

            return (
              <div
                key={i}
                className="absolute bottom-0 group"
                style={{
                  left: `${i * barWidth}px`,
                  width: `${barWidth}px`,
                }}
              >
                <div
                  className="w-full transition-all duration-75"
                  style={{
                    height: `${barH}px`,
                    backgroundColor: bgColor,
                    opacity: isHovered ? 1 : isActive ? 1 : 0.7,
                    borderTop: isActive ? "1px solid #D98E33" : "none",
                  }}
                />
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#181C22] border border-[#343A42] px-2 py-1 text-[9px] font-mono text-[#E8EAED] whitespace-nowrap pointer-events-none z-10">
                    <div>
                      t={i} Band {s.band} ({dwellCentres[s.band]?.toFixed(0)} MHz)
                    </div>
                    <div className={isHit ? "text-[#5E8C6A]" : "text-[#B8763E]"}>
                      {isHit ? "HIT" : "MISS"}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Current step marker */}
        {currentStep >= 0 && currentStep < totalSteps && (
          <div
            className="absolute top-0 bottom-0 w-px bg-[#D98E33] pointer-events-none"
            style={{
              left: `${(currentStep / totalSteps) * barsWidth}px`,
            }}
          />
        )}
      </div>
    </div>
  );
}
