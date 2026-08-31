"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  emitterTypes: { label: string; count: number; color: string }[];
  headerRight?: React.ReactNode;
}

export default function Sidebar({
  bandStats,
  selectedBand,
  onBandSelect,
  nBands,
  freqRange,
  emitterTypes,
  headerRight,
}: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState({
    bands: true,
    emitters: true,
    filters: false,
  });
  const [minPulses, setMinPulses] = useState<string>("0");
  const [freqMin, setFreqMin] = useState<string>(String(freqRange[0]));
  const [freqMax, setFreqMax] = useState<string>(String(freqRange[1]));

  // Reset filters when freqRange changes (new config loaded)
  useEffect(() => {
    setFreqMin(String(freqRange[0]));
    setFreqMax(String(freqRange[1]));
    setMinPulses("0");
  }, [freqRange[0], freqRange[1]]);

  // Parse filter values (empty string defaults to appropriate bound)
  const parsedMinPulses = minPulses === "" ? 0 : Number(minPulses);
  const parsedFreqMin = freqMin === "" ? freqRange[0] : Number(freqMin);
  const parsedFreqMax = freqMax === "" ? freqRange[1] : Number(freqMax);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Sort and filter bands by pulse count for the list
  const sortedBands = useMemo(
    () => [...bandStats].sort((a, b) => b.pulse_count - a.pulse_count),
    [bandStats]
  );
  const activeBands = useMemo(
    () =>
      sortedBands.filter(
        (b) =>
          b.pulse_count > 0 &&
          b.pulse_count >= parsedMinPulses &&
          b.dwell_centre_mhz >= parsedFreqMin &&
          b.dwell_centre_mhz <= parsedFreqMax
      ),
    [sortedBands, parsedMinPulses, parsedFreqMin, parsedFreqMax]
  );

  // Select all text on focus for number inputs
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <aside className="bg-[#12151A] border-r border-[#22262D] flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="p-3 border-b border-[#22262D]">
        <div className="section-label flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={12} />
            <span>Configuration</span>
          </div>
          {headerRight}
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

          <AnimatePresence initial={false}>
          {expandedSections.bands && (
            <motion.div
              key="bands-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
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
            </motion.div>
          )}
          </AnimatePresence>
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
                {emitterTypes.reduce((s, e) => s + e.count, 0)}
              </span>
              {expandedSections.emitters ? (
                <ChevronDown size={12} className="text-[#5C636D]" />
              ) : (
                <ChevronRight size={12} className="text-[#5C636D]" />
              )}
            </div>
          </button>

          <AnimatePresence initial={false}>
          {expandedSections.emitters && (
            <motion.div
              key="emitters-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-2">
                <div className="text-[11px] font-mono text-[#9BA3AD] space-y-1">
                  {emitterTypes.map((emitter) => (
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
            </motion.div>
          )}
          </AnimatePresence>
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

          <AnimatePresence initial={false}>
          {expandedSections.filters && (
            <motion.div
              key="filters-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-2">
                <div>
                  <label className="block text-[10px] text-[#5C636D] uppercase tracking-wider mb-1">
                    Min Pulses
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minPulses}
                    onFocus={handleFocus}
                    onChange={(e) => setMinPulses(e.target.value)}
                    className="w-full bg-[#0E1013] border border-[#22262D] text-[#E8EAED] text-[11px] font-mono px-2 py-1 rounded focus:outline-none focus:border-[#D98E33]/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#5C636D] uppercase tracking-wider mb-1">
                    Frequency Range
                  </label>
                  <div className="flex flex-col gap-1">
                    <input
                      type="number"
                      min={freqRange[0]}
                      max={freqRange[1]}
                      value={freqMin}
                      onFocus={handleFocus}
                      onChange={(e) => setFreqMin(e.target.value)}
                      className="w-full bg-[#0E1013] border border-[#22262D] text-[#E8EAED] text-[11px] font-mono px-2 py-1 rounded focus:outline-none focus:border-[#D98E33]/50"
                    />
                    <input
                      type="number"
                      min={freqRange[0]}
                      max={freqRange[1]}
                      value={freqMax}
                      onFocus={handleFocus}
                      onChange={(e) => setFreqMax(e.target.value)}
                      className="w-full bg-[#0E1013] border border-[#22262D] text-[#E8EAED] text-[11px] font-mono px-2 py-1 rounded focus:outline-none focus:border-[#D98E33]/50"
                    />
                  </div>
                </div>
                {/* Reset filters button */}
                {(parsedMinPulses > 0 || parsedFreqMin !== freqRange[0] || parsedFreqMax !== freqRange[1]) && (
                  <button
                    onClick={() => {
                      setMinPulses("0");
                      setFreqMin(String(freqRange[0]));
                      setFreqMax(String(freqRange[1]));
                    }}
                    className="w-full text-[10px] text-[#D98E33] hover:text-[#D98E33]/80 transition-colors py-1"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}
