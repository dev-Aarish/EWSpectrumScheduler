"use client";

import { useState, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import StatusBar from "@/components/StatusBar";
import Sidebar from "@/components/Sidebar";
import SpectrumWaterfall from "@/components/SpectrumWaterfall";
import FrequencySpectrum from "@/components/FrequencySpectrum";
import AmplitudeDistribution from "@/components/AmplitudeDistribution";
import EmitterDetailPanel from "@/components/EmitterDetailPanel";
import DecisionLog from "@/components/DecisionLog";
import DatasetExplorer from "@/components/DatasetExplorer";
import ScanTimeline from "@/components/ScanTimeline";

interface ConfigData {
  config_id: string;
  n_pulses: number;
  n_emitters: number;
  emitter_types: { label: string; count: number; color: string }[];
  n_bands: number;
  freq_range_mhz: number[];
  dwell_centres_mhz: number[];
  feature_names: string[];
  waterfall: number[][];
  waterfall_labels: number[][];
  band_stats: {
    band_id: number;
    dwell_centre_mhz: number;
    pulse_count: number;
    n_emitters: number;
    mean_amplitude: number;
    frequency_range: number[];
  }[];
  scheduler_decisions: {
    time_step: number;
    band_chosen: number;
    confidence: number;
    predicted_reward: number;
    actual_detection: boolean;
    timestamp: number;
  }[];
  scan_history: number[];
  n_time_bins: number;
}

interface TestStat {
  id: number;
  n_pulses: number;
  n_emitters: number;
  n_types: number;
  min_ToA: number;
  min_Frequency: number;
  min_PulseWidth: number;
  min_AoA: number;
  min_Amplitude: number;
  max_ToA: number;
  max_Frequency: number;
  max_PulseWidth: number;
  max_AoA: number;
  max_Amplitude: number;
  mean_ToA: number;
  mean_Frequency: number;
  mean_PulseWidth: number;
  mean_AoA: number;
  mean_Amplitude: number;
  std_ToA: number;
  std_Frequency: number;
  std_PulseWidth: number;
  std_AoA: number;
  std_Amplitude: number;
}

export default function Dashboard() {
  const [configs, setConfigs] = useState<string[]>([]);
  const [currentConfigId, setCurrentConfigId] = useState<string>("config_0");
  const [configData, setConfigData] = useState<ConfigData | null>(null);
  const [testStats, setTestStats] = useState<TestStat[]>([]);
  const [selectedBand, setSelectedBand] = useState<number | null>(null);
  const [scanStep, setScanStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(100);
  const [bottomTab, setBottomTab] = useState<"log" | "explorer" | "charts">("charts");

  // Load config list
  useEffect(() => {
    fetch("/data/config_list.json")
      .then((res) => res.json())
      .then((data) => setConfigs(data))
      .catch(console.error);
  }, []);

  // Load test stats
  useEffect(() => {
    fetch("/data/test_stats.json")
      .then((res) => res.json())
      .then((data) => setTestStats(data))
      .catch(console.error);
  }, []);

  // Load config data
  useEffect(() => {
    if (!currentConfigId) return;
    fetch(`/data/${currentConfigId}.json`)
      .then((res) => res.json())
      .then((data) => {
        setConfigData(data);
        setScanStep(0);
        setIsPlaying(false);
      })
      .catch(console.error);
  }, [currentConfigId]);

  // Auto-play scan animation
  useEffect(() => {
    if (!isPlaying || !configData) return;
    const interval = setInterval(() => {
      setScanStep((prev) => {
        if (prev >= configData.n_time_bins - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, configData, playSpeed]);

  if (!configData) {
    return (
      <div className="h-screen bg-[#0B0D0F] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#5C636D] font-mono text-[13px]">
            Loading scan data...
          </div>
          <div className="mt-3 w-48 h-1 bg-[#22262D] rounded overflow-hidden">
            <div
              className="h-full bg-[#D98E33] transition-all duration-300"
              style={{ width: "60%" }}
            />
          </div>
          <div className="mt-2 text-[10px] font-mono text-[#5C636D]">
            Initializing EW console...
          </div>
        </div>
      </div>
    );
  }

  const activeBandsCount = configData.band_stats.filter(
    (b) => b.pulse_count > 0
  ).length;
  const totalHits = configData.scheduler_decisions.filter(
    (d) => d.actual_detection
  ).length;
  const totalDecisions = configData.scheduler_decisions.length;
  const hitRate = totalDecisions > 0 ? (totalHits / totalDecisions) * 100 : 0;
  const avgConfidence =
    totalDecisions > 0
      ? configData.scheduler_decisions.reduce((s, d) => s + d.confidence, 0) /
        totalDecisions
      : 0;

  return (
    <div className="h-screen flex flex-col bg-[#0B0D0F] overflow-hidden">
      {/* Top status bar */}
      <StatusBar
        systemMode="replay"
        currentConfig={currentConfigId}
        scanProgress={(scanStep / configData.n_time_bins) * 100}
        activeBands={activeBandsCount}
        totalBands={configData.n_bands}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <Sidebar
          bandStats={configData.band_stats}
          selectedBand={selectedBand}
          onBandSelect={setSelectedBand}
          nBands={configData.n_bands}
          freqRange={[
            configData.freq_range_mhz[0],
            configData.freq_range_mhz[1],
          ]}
          emitterTypes={configData.emitter_types ?? []}
        />

        {/* Center panel */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Waterfall header with controls */}
          <div className="px-3 py-1.5 bg-[#12151A] border-b border-[#22262D] flex items-center gap-3">
            <span className="section-label shrink-0">Spectrum Waterfall</span>

            {/* Config selector */}
            <select
              value={currentConfigId}
              onChange={(e) => setCurrentConfigId(e.target.value)}
              className="bg-[#0E1013] border border-[#22262D] text-[#E8EAED] text-[11px] font-mono px-2 py-1 rounded focus:outline-none focus:border-[#D98E33]/50 shrink-0"
            >
              {configs.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>

            {/* Divider */}
            <div className="w-px h-4 bg-[#22262D]" />

            {/* Playback controls */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1 bg-[#D98E33]/10 border border-[#D98E33]/30 text-[#D98E33] rounded hover:bg-[#D98E33]/20 transition-colors"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            </button>
            <button
              onClick={() => {
                setScanStep(0);
                setIsPlaying(false);
              }}
              className="p-1 bg-[#22262D] text-[#9BA3AD] rounded hover:bg-[#343A42] transition-colors"
              title="Reset"
            >
              <RotateCcw size={12} />
            </button>
            <button
              onClick={() => setScanStep((p) => Math.max(0, p - 1))}
              className="p-1 bg-[#22262D] text-[#9BA3AD] rounded hover:bg-[#343A42] transition-colors"
            >
              <ChevronLeft size={12} />
            </button>
            <button
              onClick={() =>
                setScanStep((p) =>
                  Math.min(configData.n_time_bins - 1, p + 1)
                )
              }
              className="p-1 bg-[#22262D] text-[#9BA3AD] rounded hover:bg-[#343A42] transition-colors"
            >
              <ChevronRight size={12} />
            </button>

            {/* Step counter */}
            <span className="text-[11px] font-mono text-[#D98E33] tabular-nums shrink-0">
              {scanStep}/{configData.n_time_bins}
            </span>

            {/* Divider */}
            <div className="w-px h-4 bg-[#22262D]" />

            {/* Speed control */}
            <div className="flex items-center gap-1 text-[10px] font-mono text-[#5C636D]">
              <span>Speed:</span>
              {[200, 100, 50, 25].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaySpeed(speed)}
                  className={`px-1.5 py-0.5 rounded transition-colors ${
                    playSpeed === speed
                      ? "bg-[#D98E33]/20 text-[#D98E33]"
                      : "hover:bg-[#181C22]"
                  }`}
                >
                  {speed === 200 ? "0.5x" : speed === 100 ? "1x" : speed === 50 ? "2x" : "4x"}
                </button>
              ))}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Quick stats inline */}
            <div className="flex items-center gap-3 text-[10px] font-mono shrink-0">
              <span className="text-[#5C636D]">
                Hit Rate:{" "}
                <span className="text-[#5E8C6A] tabular-nums">
                  {hitRate.toFixed(1)}%
                </span>
              </span>
              <span className="text-[#5C636D]">
                Conf:{" "}
                <span className="text-[#D98E33] tabular-nums">
                  {(avgConfidence * 100).toFixed(1)}%
                </span>
              </span>
              <span className="text-[#5C636D]">
                Active:{" "}
                <span className="text-[#E8EAED] tabular-nums">
                  {activeBandsCount}/{configData.n_bands}
                </span>
              </span>
            </div>
          </div>

          {/* Spectrum waterfall */}
          <SpectrumWaterfall
            waterfall={configData.waterfall}
            waterfallLabels={configData.waterfall_labels}
            nBands={configData.n_bands}
            nTimeBins={configData.n_time_bins}
            selectedBand={selectedBand}
            scanHistory={configData.scan_history}
            dwellCentres={configData.dwell_centres_mhz}
            currentScanStep={scanStep}
          />

          {/* Scan timeline */}
          <ScanTimeline
            scanHistory={configData.scan_history}
            waterfall={configData.waterfall}
            dwellCentres={configData.dwell_centres_mhz}
            currentStep={scanStep}
            onStepClick={setScanStep}
            nBands={configData.n_bands}
          />

          {/* Bottom panel with tabs */}
          <div className="h-48 bg-[#12151A] border-t border-[#22262D] flex flex-col">
            {/* Tab bar */}
            <div className="flex border-b border-[#22262D]">
              {[
                { key: "log" as const, label: "Scheduler Log" },
                { key: "explorer" as const, label: "Dataset Explorer" },
                { key: "charts" as const, label: "Frequency Analysis" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setBottomTab(tab.key as any)}
                  className={`px-4 py-1.5 text-[11px] font-mono border-b-2 transition-colors ${
                    bottomTab === tab.key
                      ? "border-[#D98E33] text-[#D98E33] bg-[#181C22]"
                      : "border-transparent text-[#5C636D] hover:text-[#9BA3AD] hover:bg-[#181C22]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {bottomTab === "log" && (
                <DecisionLog decisions={configData.scheduler_decisions} maxVisible={6} />
              )}
              {bottomTab === "explorer" && (
                <DatasetExplorer
                  testStats={testStats}
                  currentConfigId={currentConfigId}
                  onConfigSelect={setCurrentConfigId}
                />
              )}
              {bottomTab === "charts" && (
                <div className="h-full grid grid-cols-2 gap-0 divide-x divide-[#22262D]">
                  <FrequencySpectrum
                    bandStats={configData.band_stats}
                    selectedBand={selectedBand}
                    onBandSelect={setSelectedBand}
                  />
                  <AmplitudeDistribution
                    bandStats={configData.band_stats}
                    selectedBand={selectedBand}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel - Emitter Detail / Metrics */}
        <EmitterDetailPanel
          bandStats={configData.band_stats}
          selectedBand={selectedBand}
          onBandSelect={setSelectedBand}
          dwellCentres={configData.dwell_centres_mhz}
          waterfall={configData.waterfall}
          scanHistory={configData.scan_history}
        />
      </div>
    </div>
  );
}
