"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";

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
  maxVisible?: number;
}

export default function DecisionLog({
  decisions,
  maxVisible = 8,
}: DecisionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [decisions]);

  const visibleDecisions = decisions.slice(-maxVisible);

  return (
    <div className="bg-[#12151A] border-t border-[#22262D] h-32 flex flex-col">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-[#22262D] flex items-center justify-between">
        <div className="section-label flex items-center gap-2">
          <Terminal size={12} />
          <span>Scheduler Decision Log</span>
        </div>
        <span className="text-[10px] font-mono text-[#5C636D] tabular-nums">
          {decisions.length} entries
        </span>
      </div>

      {/* Log content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto font-mono text-[11px] p-2 space-y-0.5"
      >
        {visibleDecisions.length === 0 ? (
          <div className="text-[#5C636D] italic">
            Awaiting scan data
          </div>
        ) : (
          visibleDecisions.map((decision, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 ${
                decision.actual_detection ? "text-[#5E8C6A]" : "text-[#9BA3AD]"
              }`}
            >
              {/* Timestamp */}
              <span className="text-[#5C636D] tabular-nums shrink-0">
                t={decision.time_step.toString().padStart(3, "0")}
              </span>

              {/* Decision indicator */}
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
                Band{" "}
                <span className="text-[#D98E33] tabular-nums">
                  {decision.band_chosen}
                </span>
              </span>

              {/* Confidence */}
              <span className="text-[#5C636D]">
                conf=
                <span className="tabular-nums">
                  {decision.confidence.toFixed(3)}
                </span>
              </span>

              {/* Predicted reward */}
              <span className="text-[#5C636D]">
                rew=
                <span className="tabular-nums">
                  {decision.predicted_reward > 0 ? "+" : ""}
                  {decision.predicted_reward.toFixed(2)}
                </span>
              </span>

              {/* Result */}
              <span
                className={`shrink-0 ${
                  decision.actual_detection
                    ? "text-[#5E8C6A]"
                    : "text-[#B8763E]"
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
