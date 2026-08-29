"use client";

import { useState, useEffect } from "react";
import StatusBar from "@/components/StatusBar";
import Sidebar from "@/components/Sidebar";
import SpectrumWaterfall from "@/components/SpectrumWaterfall";
import MetricsPanel from "@/components/MetricsPanel";
import DecisionLog from "@/components/DecisionLog";

interface ConfigData {
  config_id: string;
  n_pulses: number;
  n_emitters: number;
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

export default function Dashboard() {
  const [configs, setConfigs] = useState<string[]>([]);
  const [currentConfigId, setCurrentConfigId] = useState<string>("config_0");
  const [configData, setConfigData] = useState<ConfigData | null>(null);
  const [selectedBand, setSelectedBand] = useState<number | null>(null);
  const [scanStep, setScanStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Load config list
  useEffect(() => {
    fetch("/data/config_list.json")
      .then((res) => res.json())
      .then((data) => setConfigs(data))
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
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, configData]);

  if (!configData) {
    return (
      <div className="h-screen bg-[#0B0D0F] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#5C636D] font-mono text-[13px]">
            Loading scan data...
          </div>
          <div className="mt-2 w-32 h-0.5 bg-[#22262D] rounded overflow-hidden">
            <div className="h-full bg-[#D98E33] animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      </div>
    );
  }

  const activeBandsCount = configData.band_stats.filter(
    (b) => b.pulse_count > 0
  ).length;

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
        />

        {/* Center panel - Waterfall + Decision Log */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Waterfall header */}
          <div className="px-3 py-1.5 bg-[#12151A] border-b border-[#22262D] flex items-center justify-between">
            <div className="section-label">Spectrum Waterfall</div>
            <div className="flex items-center gap-2">
              {/* Config selector */}
              <select
                value={currentConfigId}
                onChange={(e) => setCurrentConfigId(e.target.value)}
                className="bg-[#0E1013] border border-[#22262D] text-[#E8EAED] text-[11px] font-mono px-2 py-1 rounded focus:outline-none focus:border-[#D98E33]/50"
              >
                {configs.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>

              {/* Playback controls */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-2 py-1 bg-[#D98E33]/10 border border-[#D98E33]/30 text-[#D98E33] text-[11px] font-mono rounded hover:bg-[#D98E33]/20 transition-colors"
              >
                {isPlaying ? "PAUSE" : "PLAY"}
              </button>
              <button
                onClick={() => setScanStep(0)}
                className="px-2 py-1 bg-[#22262D] text-[#9BA3AD] text-[11px] font-mono rounded hover:bg-[#343A42] transition-colors"
              >
                RESET
              </button>

              {/* Step controls */}
              <button
                onClick={() =>
                  setScanStep((prev) => Math.max(0, prev - 1))
                }
                className="px-2 py-1 bg-[#22262D] text-[#9BA3AD] text-[11px] font-mono rounded hover:bg-[#343A42] transition-colors"
              >
                &lt;
              </button>
              <span className="text-[11px] font-mono text-[#D98E33] tabular-nums">
                {scanStep}/{configData.n_time_bins}
              </span>
              <button
                onClick={() =>
                  setScanStep((prev) =>
                    Math.min(configData.n_time_bins - 1, prev + 1)
                  )
                }
                className="px-2 py-1 bg-[#22262D] text-[#9BA3AD] text-[11px] font-mono rounded hover:bg-[#343A42] transition-colors"
              >
                &gt;
              </button>
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

          {/* Decision log */}
          <DecisionLog decisions={configData.scheduler_decisions} />
        </div>

        {/* Right panel - Metrics */}
        <MetricsPanel
          scanProgress={(scanStep / configData.n_time_bins) * 100}
          totalPulses={configData.n_pulses}
          nEmitters={configData.n_emitters}
          nBands={configData.n_bands}
        />
      </div>
    </div>
  );
}
