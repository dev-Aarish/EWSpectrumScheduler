"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
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
import ScatterPlot from "@/components/ScatterPlot";
import PRFHistogram from "@/components/PRFHistogram";
import AoAPolarPlot from "@/components/AoAPolarPlot";

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
  pulse_data: {
    frequency: number[];
    aoa: number[];
    amplitude: number[];
    toa: number[];
    emitter_label: number[];
  };
  prf_data: {
    overall: { range: string; count: number; min: number; binSize: number }[];
    per_emitter: {
      label: string;
      color: string;
      data: { range: string; count: number; min: number; binSize: number }[];
    }[];
    toi_range: number[];
  };
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);

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

  // Memoized derived stats (must be before any early return)
  const activeBandsCount = useMemo(
    () => configData?.band_stats?.filter((b) => b.pulse_count > 0).length ?? 0,
    [configData?.band_stats]
  );
  const totalHits = useMemo(
    () => configData?.scheduler_decisions?.filter((d) => d.actual_detection).length ?? 0,
    [configData?.scheduler_decisions]
  );
  const totalDecisions = configData?.scheduler_decisions?.length ?? 0;
  const hitRate = totalDecisions > 0 ? (totalHits / totalDecisions) * 100 : 0;
  const avgConfidence = useMemo(
    () =>
      totalDecisions > 0
        ? (configData?.scheduler_decisions?.reduce((s, d) => s + d.confidence, 0) ?? 0) /
          totalDecisions
        : 0,
    [configData?.scheduler_decisions, totalDecisions]
  );

  const emitterLabels = useMemo(
    () =>
      configData
        ? [...new Set(configData.pulse_data.emitter_label)].sort((a, b) => a - b)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [configData?.pulse_data.emitter_label]
  );

  const freqRangeProp = useMemo(
    (): [number, number] => configData ? [configData.freq_range_mhz[0], configData.freq_range_mhz[1]] : [0, 0],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [configData?.freq_range_mhz]
  );

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

  return (
    <div className="h-screen flex flex-col bg-[#0B0D0F]">
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
        {/* Left sidebar — collapsible with GPU-accelerated slide transition */}
        <div
          style={{
            width: sidebarCollapsed ? 40 : 224,
            minWidth: sidebarCollapsed ? 40 : 224,
            maxWidth: sidebarCollapsed ? 40 : 224,
            transition: "width 200ms cubic-bezier(0.4, 0, 0.2, 1), min-width 200ms cubic-bezier(0.4, 0, 0.2, 1), max-width 200ms cubic-bezier(0.4, 0, 0.2, 1)",
            willChange: "width",
          }}
          className="bg-[#12151A] border-r border-[#22262D] flex-shrink-0 overflow-hidden relative"
        >
          {/* Expanded content — slides out and fades when collapsing */}
          <div
            className="absolute inset-y-0 right-0 flex flex-col w-[224px]"
            style={{
              opacity: sidebarCollapsed ? 0 : 1,
              transform: sidebarCollapsed ? "translateX(8px)" : "translateX(0)",
              transition: "opacity 150ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
              pointerEvents: sidebarCollapsed ? "none" : "auto",
              willChange: "opacity, transform",
            }}
          >
            <Sidebar
              bandStats={configData.band_stats}
              selectedBand={selectedBand}
              onBandSelect={setSelectedBand}
              nBands={configData.n_bands}
              freqRange={freqRangeProp}
              emitterTypes={configData.emitter_types ?? []}
              headerRight={
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-1 rounded hover:bg-[#181C22] transition-colors text-[#5C636D] hover:text-[#9BA3AD]"
                  title="Collapse Configuration"
                >
                  <PanelLeftClose size={12} />
                </button>
              }
            />
          </div>
          {/* Collapsed content — fades in when collapsed */}
          <div
            className="absolute inset-0 flex flex-col items-center py-2"
            style={{
              opacity: sidebarCollapsed ? 1 : 0,
              transition: "opacity 200ms cubic-bezier(0.4, 0, 0.2, 1) 80ms",
              pointerEvents: sidebarCollapsed ? "auto" : "none",
            }}
          >
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-1.5 rounded hover:bg-[#181C22] transition-colors text-[#5C636D] hover:text-[#9BA3AD]"
              title="Expand Configuration"
            >
              <PanelLeftOpen size={14} />
            </button>
            <div className="mt-2 flex-1 flex items-center justify-center" style={{ writingMode: "vertical-rl" }}>
              <span className="section-label text-[9px] tracking-widest">CONFIG</span>
            </div>
          </div>
        </div>

        {/* Center panel — scrollable */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {/* Controls bar */}
            <div className="px-3 py-2 bg-[#12151A] border-y border-[#22262D] flex items-center gap-3 flex-shrink-0">
              <span className="section-label shrink-0">Controls</span>

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

              <div className="w-px h-4 bg-[#22262D]" />

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1 bg-[#D98E33]/10 border border-[#D98E33]/30 text-[#D98E33] rounded hover:bg-[#D98E33]/20 transition-colors"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
              </button>
              <button
                onClick={() => { setScanStep(0); setIsPlaying(false); }}
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
                onClick={() => setScanStep((p) => Math.min(configData.n_time_bins - 1, p + 1))}
                className="p-1 bg-[#22262D] text-[#9BA3AD] rounded hover:bg-[#343A42] transition-colors"
              >
                <ChevronRight size={12} />
              </button>

              <span className="text-[11px] font-mono text-[#D98E33] tabular-nums shrink-0">
                {scanStep}/{configData.n_time_bins}
              </span>

              <div className="w-px h-4 bg-[#22262D]" />

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

              <div className="flex-1" />

              <div className="flex items-center gap-3 text-[10px] font-mono shrink-0">
                <span className="text-[#5C636D]">
                  Hit Rate: <span className="text-[#5E8C6A] tabular-nums">{hitRate.toFixed(1)}%</span>
                </span>
                <span className="text-[#5C636D]">
                  Conf: <span className="text-[#D98E33] tabular-nums">{(avgConfidence * 100).toFixed(1)}%</span>
                </span>
                <span className="text-[#5C636D]">
                  Active: <span className="text-[#E8EAED] tabular-nums">{activeBandsCount}/{configData.n_bands}</span>
                </span>
              </div>
            </div>

            {/* Waterfall + Timeline (fixed height section) */}
            <div className="flex-shrink-0">
              <div className="h-[420px] flex flex-col">
                <SpectrumWaterfall
                  waterfall={configData.waterfall}
                  waterfallLabels={configData.waterfall_labels}
                  nBands={configData.n_bands}
                  nTimeBins={configData.n_time_bins}
                  selectedBand={selectedBand}
                  scanHistory={configData.scan_history}
                  dwellCentres={configData.dwell_centres_mhz}
                  currentScanStep={scanStep}
                  bandStats={configData.band_stats}
                  onBandClick={setSelectedBand}
                />
              </div>
              <ScanTimeline
                scanHistory={configData.scan_history}
                waterfall={configData.waterfall}
                dwellCentres={configData.dwell_centres_mhz}
                currentStep={scanStep}
                onStepClick={setScanStep}
                nBands={configData.n_bands}
              />
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-[#22262D] bg-[#12151A] flex-shrink-0">
              {[
                { key: "charts" as const, label: "Charts" },
                { key: "log" as const, label: "Scheduler Log" },
                { key: "explorer" as const, label: "Dataset Explorer" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setBottomTab(tab.key)}
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
            <div className="bg-[#0B0D0F]">
              {bottomTab === "log" && (
                <div className="h-[400px]">
                  <DecisionLog decisions={configData.scheduler_decisions} currentStep={scanStep} />
                </div>
              )}
              {bottomTab === "explorer" && (
                <div className="h-[500px]">
                  <DatasetExplorer
                    testStats={testStats}
                    currentConfigId={currentConfigId}
                    onConfigSelect={setCurrentConfigId}
                  />
                </div>
              )}
              {bottomTab === "charts" && (
                <div className="grid grid-cols-2 gap-3 p-3">
                  <div className="bg-[#12151A] border border-[#22262D] rounded-lg h-[320px] flex flex-col overflow-hidden">
                    <FrequencySpectrum
                      bandStats={configData.band_stats}
                      selectedBand={selectedBand}
                      onBandSelect={setSelectedBand}
                    />
                  </div>
                  <div className="bg-[#12151A] border border-[#22262D] rounded-lg h-[320px] flex flex-col overflow-hidden">
                    <AmplitudeDistribution
                      bandStats={configData.band_stats}
                      selectedBand={selectedBand}
                    />
                  </div>
                  <div className="bg-[#12151A] border border-[#22262D] rounded-lg h-[320px] flex flex-col overflow-hidden">
                    <ScatterPlot
                      pulseData={configData.pulse_data}
                      emitterTypes={configData.emitter_types ?? []}
                      emitterLabels={emitterLabels}
                    />
                  </div>
                  <div className="bg-[#12151A] border border-[#22262D] rounded-lg h-[320px] flex flex-col overflow-hidden">
                    <AoAPolarPlot
                      pulseData={configData.pulse_data}
                      emitterTypes={configData.emitter_types ?? []}
                      emitterLabels={emitterLabels}
                    />
                  </div>
                  <div className="bg-[#12151A] border border-[#22262D] rounded-lg h-[320px] col-span-2 flex flex-col overflow-hidden">
                    <PRFHistogram
                      prfData={configData.prf_data}
                      selectedBand={selectedBand}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel — collapsible with GPU-accelerated slide transition */}
        <div
          style={{
            width: inspectorCollapsed ? 40 : 288,
            minWidth: inspectorCollapsed ? 40 : 288,
            maxWidth: inspectorCollapsed ? 40 : 288,
            transition: "width 200ms cubic-bezier(0.4, 0, 0.2, 1), min-width 200ms cubic-bezier(0.4, 0, 0.2, 1), max-width 200ms cubic-bezier(0.4, 0, 0.2, 1)",
            willChange: "width",
          }}
          className="bg-[#12151A] border-l border-[#22262D] flex-shrink-0 overflow-hidden relative"
        >
          {/* Expanded content — slides out and fades when collapsing */}
          <div
            className="absolute inset-y-0 left-0 flex flex-col w-[288px]"
            style={{
              opacity: inspectorCollapsed ? 0 : 1,
              transform: inspectorCollapsed ? "translateX(-8px)" : "translateX(0)",
              transition: "opacity 150ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
              pointerEvents: inspectorCollapsed ? "none" : "auto",
              willChange: "opacity, transform",
            }}
          >
            <EmitterDetailPanel
              bandStats={configData.band_stats}
              selectedBand={selectedBand}
              onBandSelect={setSelectedBand}
              dwellCentres={configData.dwell_centres_mhz}
              waterfall={configData.waterfall}
              scanHistory={configData.scan_history}
              headerRight={
                <button
                  onClick={() => setInspectorCollapsed(true)}
                  className="p-1 rounded hover:bg-[#181C22] transition-colors text-[#5C636D] hover:text-[#9BA3AD]"
                  title="Collapse Band Inspector"
                >
                  <PanelRightClose size={12} />
                </button>
              }
            />
          </div>
          {/* Collapsed content — fades in when collapsed */}
          <div
            className="absolute inset-0 flex flex-col items-center py-2"
            style={{
              opacity: inspectorCollapsed ? 1 : 0,
              transition: "opacity 200ms cubic-bezier(0.4, 0, 0.2, 1) 80ms",
              pointerEvents: inspectorCollapsed ? "auto" : "none",
            }}
          >
            <button
              onClick={() => setInspectorCollapsed(false)}
              className="p-1.5 rounded hover:bg-[#181C22] transition-colors text-[#5C636D] hover:text-[#9BA3AD]"
              title="Expand Band Inspector"
            >
              <PanelRightOpen size={14} />
            </button>
            <div className="mt-2 flex-1 flex items-center justify-center" style={{ writingMode: "vertical-rl" }}>
              <span className="section-label text-[9px] tracking-widest">INSPECT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
