"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Filter, Layers } from "lucide-react";

interface BandStats {
  band_id: number;
  dwell_centre_mhz: number;
  pulse_count: number;
  n_emitters: number;
  mean_amplitude: number;
  frequency_range: number[];
}

interface SidebarProps {
  bandStats: BandStats[];
  selectedBand: number | null;
  onBandSelect: (bandId: number | null) => void;
  nBands: number;
  freqRange: [number, number];
}

export default function Sidebar({
  bandStats,
  selectedBand,
  onBandSelect,
  nBands,
  freqRange,
}: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState({
    bands: true,
    emitters: true,
    filters: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Sort bands by pulse count for the list
  const sortedBands = [...bandStats].sort(
    (a, b) => b.pulse_count - a.pulse_count
  );
  const activeBands = sortedBands.filter((b) => b.pulse_count > 0);

  return (
    <aside className="w-56 bg-[#12151A] border-r border-[#22262D] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-[#22262D]">
        <div className="section-label flex items-center gap-2">
          <Layers size={12} />
          <span>Configuration</span>
        </div>
        <div className="mt-2 font-mono text-[11px] text-[#9BA3AD]">
          <div className="flex justify-between">
            <span>Range</span>
            <span className="text-[#E8EAED] tabular-nums">
              {freqRange[0]}-{freqRange[1]} MHz
            </span>
          </div>
          <div className="flex justify-between">
            <span>Bands</span>
            <span className="text-[#E8EAED] tabular-nums">{nBands}</span>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Band List Section */}
        <div className="border-b border-[#22262D]">
          <button
            onClick={() => toggleSection("bands")}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#181C22] transition-colors"
          >
            <span className="section-label flex items-center gap-2">
              <Filter size={12} />
              Active Bands
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#5C636D] tabular-nums">
                {activeBands.length}
              </span>
              {expandedSections.bands ? (
                <ChevronDown size={12} className="text-[#5C636D]" />
              ) : (
                <ChevronRight size={12} className="text-[#5C636D]" />
              )}
            </div>
          </button>

          {expandedSections.bands && (
            <div className="px-2 pb-2">
              {/* All bands option */}
              <button
                onClick={() => onBandSelect(null)}
                className={`w-full px-2 py-1.5 text-left text-[11px] font-mono rounded transition-colors ${
                  selectedBand === null
                    ? "bg-[#D98E33]/10 text-[#D98E33] border border-[#D98E33]/30"
                    : "text-[#9BA3AD] hover:bg-[#181C22] hover:text-[#E8EAED]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>All Bands</span>
                  <span className="text-[#5C636D] tabular-nums">
                    {bandStats.reduce((sum, b) => sum + b.pulse_count, 0).toLocaleString()}
                  </span>
                </div>
              </button>

              {/* Band list */}
              <div className="mt-1 space-y-0.5 max-h-64 overflow-y-auto">
                {activeBands.map((band) => (
                  <button
                    key={band.band_id}
                    onClick={() => onBandSelect(band.band_id)}
                    className={`w-full px-2 py-1.5 text-left text-[11px] font-mono rounded transition-colors ${
                      selectedBand === band.band_id
                        ? "bg-[#D98E33]/10 text-[#D98E33] border border-[#D98E33]/30"
                        : "text-[#9BA3AD] hover:bg-[#181C22] hover:text-[#E8EAED]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Band {band.band_id}</span>
                      <span className="text-[#5C636D] tabular-nums">
                        {band.pulse_count.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#5C636D] tabular-nums">
                      {band.dwell_centre_mhz.toFixed(0)} MHz
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Emitter Types Section */}
        <div className="border-b border-[#22262D]">
          <button
            onClick={() => toggleSection("emitters")}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#181C22] transition-colors"
          >
            <span className="section-label">Emitter Types</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#5C636D] tabular-nums">
                {new Set(bandStats.flatMap((b) => Array(b.n_emitters).fill(0))).size}
              </span>
              {expandedSections.emitters ? (
                <ChevronDown size={12} className="text-[#5C636D]" />
              ) : (
                <ChevronRight size={12} className="text-[#5C636D]" />
              )}
            </div>
          </button>

          {expandedSections.emitters && (
            <div className="px-3 pb-2">
              <div className="text-[11px] font-mono text-[#9BA3AD] space-y-1">
                {[
                  { label: "Fixed-Freq", count: 12, color: "bg-[#C4523B]" },
                  { label: "PRF Agile", count: 8, color: "bg-[#D98E33]" },
                  { label: "Freq Hopping", count: 5, color: "bg-[#5E8C6A]" },
                  { label: "Spatial Scan", count: 3, color: "bg-[#B8763E]" },
                ].map((emitter) => (
                  <div key={emitter.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-sm ${emitter.color}`} />
                      <span>{emitter.label}</span>
                    </div>
                    <span className="text-[#5C636D] tabular-nums">
                      {emitter.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filters Section */}
        <div>
          <button
            onClick={() => toggleSection("filters")}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#181C22] transition-colors"
          >
            <span className="section-label">Filters</span>
            {expandedSections.filters ? (
              <ChevronDown size={12} className="text-[#5C636D]" />
            ) : (
              <ChevronRight size={12} className="text-[#5C636D]" />
            )}
          </button>

          {expandedSections.filters && (
            <div className="px-3 pb-3 space-y-2">
              <div>
                <label className="block text-[10px] text-[#5C636D] uppercase tracking-wider mb-1">
                  Min Pulses
                </label>
                <input
                  type="number"
                  defaultValue={0}
                  className="w-full bg-[#0E1013] border border-[#22262D] text-[#E8EAED] text-[11px] font-mono px-2 py-1 rounded focus:outline-none focus:border-[#D98E33]/50"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#5C636D] uppercase tracking-wider mb-1">
                  Frequency Range
                </label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    defaultValue={freqRange[0]}
                    className="flex-1 bg-[#0E1013] border border-[#22262D] text-[#E8EAED] text-[11px] font-mono px-2 py-1 rounded focus:outline-none focus:border-[#D98E33]/50"
                  />
                  <span className="text-[#5C636D] text-[11px] self-center">-</span>
                  <input
                    type="number"
                    defaultValue={freqRange[1]}
                    className="flex-1 bg-[#0E1013] border border-[#22262D] text-[#E8EAED] text-[11px] font-mono px-2 py-1 rounded focus:outline-none focus:border-[#D98E33]/50"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
