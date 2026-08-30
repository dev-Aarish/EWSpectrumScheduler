"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal, Filter } from "lucide-react";

interface Decision {
  time_step: number;
  band_chosen: number;
  confidence: number;
  predicted_reward: number;
  actual_detection: boolean;
  timestamp: number;
}

interface DecisionLogProps {
  decisions: Decision[];
  currentStep?: number;
  maxVisible?: number;
}

export default function DecisionLog({
  decisions,
  currentStep,
  maxVisible,
}: DecisionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<"all" | "hits" | "misses">("all");
  const prevCountRef = useRef(0);

  const visibleDecisions = decisions.filter((d) => {
    if (currentStep !== undefined && d.time_step > currentStep) return false;
    if (filter === "hits") return d.actual_detection;
    if (filter === "misses") return !d.actual_detection;
    return true;
  });

  const slicedDecisions = maxVisible ? visibleDecisions.slice(-maxVisible) : visibleDecisions;

  const hits = visibleDecisions.filter((d) => d.actual_detection).length;
  const misses = visibleDecisions.filter((d) => !d.actual_detection).length;

  useEffect(() => {
    if (scrollRef.current && slicedDecisions.length > prevCountRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevCountRef.current = slicedDecisions.length;
  }, [slicedDecisions.length]);

  return (
    <div className="h-full flex flex-col">
      {/* Filter bar */}
      <div className="px-3 py-1 border-b border-[#22262D] flex items-center gap-2">
        <Terminal size={11} className="text-[#5C636D]" />
        <span className="text-[10px] font-mono text-[#5C636D]">
          {decisions.length} entries
        </span>
        <div className="w-px h-3 bg-[#22262D] mx-1" />
        {(["all", "hits", "misses"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
              filter === f
                ? f === "hits"
                  ? "bg-[#5E8C6A]/20 text-[#5E8C6A]"
                  : f === "misses"
                  ? "bg-[#B8763E]/20 text-[#B8763E]"
                  : "bg-[#D98E33]/20 text-[#D98E33]"
                : "text-[#5C636D] hover:bg-[#181C22]"
            }`}
          >
            {f === "all" ? "All" : f === "hits" ? `Hits (${hits})` : `Misses (${misses})`}
          </button>
        ))}
      </div>

      {/* Log content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto font-mono text-[11px] p-2 space-y-0.5"
      >
        {slicedDecisions.length === 0 ? (
          <div className="text-[#5C636D] text-[11px] p-2">No matching entries</div>
        ) : (
          slicedDecisions.map((decision, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 py-0.5 px-1 rounded transition-colors hover:bg-[#181C22]/50 ${
                decision.actual_detection ? "text-[#9BA3AD]" : "text-[#5C636D]"
              }`}
            >
              {/* Timestamp */}
              <span className="text-[#3A3F46] tabular-nums shrink-0 w-10">
                t={decision.time_step.toString().padStart(3, "0")}
              </span>

              {/* Detection indicator */}
              <span
                className={`shrink-0 ${
                  decision.actual_detection
                    ? "text-[#C4523B]"
                    : "text-[#3A3F46]"
                }`}
              >
                {decision.actual_detection ? "[*]" : "[.]"}
              </span>

              {/* Band choice */}
              <span className="text-[#E8EAED]">
                B<span className="text-[#D98E33] tabular-nums">{decision.band_chosen}</span>
              </span>

              {/* Confidence bar */}
              <span className="text-[#5C636D] shrink-0 w-16">
                c=
                <span className="tabular-nums text-[#9BA3AD]">
                  {(decision.confidence * 100).toFixed(0)}%
                </span>
              </span>

              {/* Reward */}
              <span className="text-[#5C636D] shrink-0 w-16">
                r=
                <span
                  className={`tabular-nums ${
                    decision.predicted_reward > 0 ? "text-[#5E8C6A]" : "text-[#B8763E]"
                  }`}
                >
                  {decision.predicted_reward > 0 ? "+" : ""}
                  {decision.predicted_reward.toFixed(2)}
                </span>
              </span>

              {/* Result */}
              <span
                className={`shrink-0 text-[10px] px-1.5 py-0 rounded ${
                  decision.actual_detection
                    ? "bg-[#5E8C6A]/15 text-[#5E8C6A]"
                    : "bg-[#B8763E]/10 text-[#B8763E]"
                }`}
              >
                {decision.actual_detection ? "HIT" : "MISS"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
