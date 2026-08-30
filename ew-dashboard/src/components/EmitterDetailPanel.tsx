"use client";

import { useMemo } from "react";
import { BarChart3, Radio, Zap, Target, X } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";

interface BandStats {
  band_id: number;
  dwell_centre_mhz: number;
  pulse_count: number;
  n_emitters: number;
  mean_amplitude: number;
  frequency_range: number[];
}

interface EmitterDetailPanelProps {
  bandStats: BandStats[];
  selectedBand: number | null;
  onBandSelect: (bandId: number | null) => void;
  dwellCentres: number[];
  waterfall: number[][];
  scanHistory: number[];
  headerRight?: React.ReactNode;
}

export default function EmitterDetailPanel({
  bandStats,
  selectedBand,
  onBandSelect,
  dwellCentres,
  waterfall,
  scanHistory,
  headerRight,
}: EmitterDetailPanelProps) {
  if (selectedBand === null || selectedBand === undefined) {
    return (
      <div className="bg-[#12151A] border-l border-[#22262D] flex flex-col h-full">
        <div className="px-3 py-2 border-b border-[#22262D] flex items-center justify-between">
          <span className="section-label">Band Inspector</span>
          {headerRight}
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-[#5C636D] text-[11px] font-mono">
            <Radio size={24} className="mx-auto mb-2 opacity-30" />
            <div>Select a band to inspect</div>
            <div className="text-[10px] mt-1">Click a band in the sidebar or waterfall</div>
          </div>
        </div>
      </div>
    );
  }

  const band = bandStats[selectedBand];
  if (!band) return null;

  // Generate activity timeline for this band
  const timeline = useMemo(() => {
    return waterfall[selectedBand]
      ? waterfall[selectedBand].map((v, i) => ({
          t: i,
          active: v,
          scanned: i < scanHistory.length && scanHistory[i] === selectedBand ? 1 : 0,
        }))
      : [];
  }, [waterfall, selectedBand, scanHistory]);

  const detectionRate = useMemo(
    () => timeline.length > 0 ? (timeline.filter((t) => t.active === 1).length / timeline.length) * 100 : 0,
    [timeline]
  );

  const scanRate = useMemo(
    () => timeline.length > 0 ? (timeline.filter((t) => t.scanned === 1).length / timeline.length) * 100 : 0,
    [timeline]
  );

  return (
    <div className="bg-[#12151A] border-l border-[#22262D] flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#22262D] flex items-center justify-between">
        <div>
          <span className="section-label">Band Inspector</span>
        </div>
        <div className="flex items-center gap-1">
          {headerRight}
          <button
            onClick={() => onBandSelect(null)}
            className="p-1 hover:bg-[#181C22] rounded transition-colors"
          >
            <X size={12} className="text-[#5C636D]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Band header */}
        <div className="p-3 border-b border-[#22262D] bg-[#181C22]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#D98E33]" />
            <span className="text-[13px] font-mono font-medium text-[#E8EAED]">
              Band {band.band_id}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[#9BA3AD] tabular-nums">
            {band.dwell_centre_mhz.toFixed(0)} MHz
          </div>
        </div>

        {/* Activity timeline mini-chart */}
        <div className="p-3 border-b border-[#22262D]">
          <div className="text-[10px] text-[#5C636D] uppercase tracking-wider mb-2">
            Activity Timeline
          </div>
          <div className="h-16 bg-[#0E1013] border border-[#22262D] rounded p-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline.slice(0, 100)}>
                <XAxis dataKey="t" hide />
                <YAxis hide domain={[0, 1]} />
                <Line
                  type="stepAfter"
                  dataKey="active"
                  stroke="#C4523B"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="stepAfter"
                  dataKey="scanned"
                  stroke="#D98E33"
                  strokeWidth={1}
                  dot={false}
                  strokeDasharray="2 2"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-3 mt-1 text-[9px] font-mono text-[#5C636D]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-0.5 bg-[#C4523B]" />
              <span>Transmission</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-0.5 bg-[#D98E33] border-dashed" />
              <span>Scanned</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="p-3 border-b border-[#22262D]">
          <div className="text-[10px] text-[#5C636D] uppercase tracking-wider mb-2">
            Statistics
          </div>
          <div className="space-y-2">
            <StatRow
              icon={<BarChart3 size={11} />}
              label="Pulse Count"
              value={band.pulse_count.toLocaleString()}
              color="#E8EAED"
            />
            <StatRow
              icon={<Radio size={11} />}
              label="Active Emitters"
              value={band.n_emitters.toString()}
              color="#5E8C6A"
            />
            <StatRow
              icon={<Zap size={11} />}
              label="Mean Amplitude"
              value={`${Math.abs(band.mean_amplitude).toFixed(1)} dB`}
              color="#D98E33"
            />
            <StatRow
              icon={<Target size={11} />}
              label="Detection Rate"
              value={`${detectionRate.toFixed(1)}%`}
              color="#C4523B"
            />
            <StatRow
              icon={<Target size={11} />}
              label="Scan Coverage"
              value={`${scanRate.toFixed(1)}%`}
              color="#D98E33"
            />
          </div>
        </div>

        {/* Frequency range */}
        <div className="p-3">
          <div className="text-[10px] text-[#5C636D] uppercase tracking-wider mb-2">
            Frequency Range
          </div>
          <div className="bg-[#0E1013] border border-[#22262D] rounded p-2">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#5C636D]">Min</span>
              <span className="text-[#E8EAED] tabular-nums">
                {band.frequency_range[0].toFixed(0)} MHz
              </span>
            </div>
            <div className="mt-1 h-1 bg-[#22262D] rounded overflow-hidden">
              <div
                className="h-full bg-[#D98E33]"
                style={{
                  width: `${((band.frequency_range[1] - band.frequency_range[0]) / 20000) * 100}%`,
                  marginLeft: `${(band.frequency_range[0] / 20000) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono mt-1">
              <span className="text-[#5C636D]">Max</span>
              <span className="text-[#E8EAED] tabular-nums">
                {band.frequency_range[1].toFixed(0)} MHz
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between text-[11px] font-mono">
      <div className="flex items-center gap-2 text-[#9BA3AD]">
        <span className="text-[#5C636D]">{icon}</span>
        <span>{label}</span>
      </div>
      <span className="tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
