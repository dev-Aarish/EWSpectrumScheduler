# Static → Dynamic Upgrade Checklist

## Data Layer

- [x] **Expand config list beyond 5** — Change `max_configs=5` in `extract_data.py:173` to load all 250 val configs (or make it a CLI arg)
- [x] **Add missing CSV columns to Dataset Explorer** — `extract_csv.py` only pulls 9 fields out of 24 available in `data_stats.csv`. Add std_Frequency, min/max_PulseWidth, min/max_AoA, etc.
- [x] **Make time bin count configurable** — `extract_data.py:61` hardcodes `min(200, len(toa_sorted))`. Expose as a parameter so high-pulse configs get better temporal resolution
- [x] **Parse emitter types from H5 transmitters group** — `metadata/transmitters` exists in every H5 file but is never read. Extract actual emitter type breakdown to replace the hardcoded sidebar counts

## Sidebar

- [x] **Emitter Types section** — Currently hardcoded (`Fixed-Freq: 12, PRF Agile: 8, Freq Hopping: 5, Spatial Scan: 3` at `Sidebar.tsx:164-169`). Replace with real data parsed from H5 transmitter metadata
- [x] **Filters section non-functional** — The "Min Pulses" and "Frequency Range" inputs (`Sidebar.tsx:199-229`) are uncontrolled with no filtering logic. Wire them to filter the band list
- [x] **Emitter count in section header is wrong** — `Sidebar.tsx:151` computes emitter count via a broken Set union. Replace with actual unique emitter count from data

## Status Bar

- [x] **System health always "NOMINAL"** — `StatusBar.tsx:94-96` is hardcoded. Either wire to real metrics (render time, memory, error rate) or remove the fake indicator
- [ ] **System mode hardcoded to "replay"** — `page.tsx:159` always passes `systemMode="replay"`. Add logic to detect or toggle between live/replay/training
- [x] **FPS always "60 FPS"** — `StatusBar.tsx:106` is decorative. Replace with a real `requestAnimationFrame` FPS counter or remove it

## Scheduler / Decision Data

- [ ] **Scheduler decisions are randomly generated** — `extract_data.py:104-117` uses `np.random` for band choice, confidence, and reward. The entire DecisionLog, ScanTimeline hit/miss colors, hit rate, and confidence stats are fake. Replace with real model output once ML pipeline exists
- [x] **Scan history is random band picks** — `scan_history` array is built from `np.random.randint`. Needs real scheduler policy to populate

## Dataset Explorer

- [x] **Table capped at 20 rows** — `DatasetExplorer.tsx:144` hardcodes `.slice(0, 20)`. Add pagination, infinite scroll, or "show all" toggle for the full 250 configs
- [x] **Search only filters by ID** — `DatasetExplorer.tsx:39` only matches on `id`. Could search across emitter count, frequency range, etc.

## Waterfall

- [x] **Hover tooltip is minimal** — `SpectrumWaterfall.tsx:307-339` only shows band ID, frequency, pulse count, active/idle. Add emitter types, mean amplitude, frequency range, or a mini sparkline

## Playback Controls

- [ ] **No pause-on-detection** — Playback doesn't stop when a hit occurs. Could auto-pause or highlight when the scheduler finds an emitter

## Decision Log

- [x] **Shows only last 6 entries** — `page.tsx:337` hardcodes `maxVisible={6}`. Increase, add virtual scroll, or let user expand the panel
- [ ] **No scroll-back** — Once decisions scroll off, they're gone. Add a scroll buffer or full log view

## Amplitude Distribution

- [x] **Fixed 5 dB bin size** — `AmplitudeDistribution.tsx:40-41` doesn't adapt to data range. Make bin count adaptive based on data spread or add a resolution control

## Charts

- [x] **Frequency Spectrum bars have no intensity mapping** — `FrequencySpectrum.tsx:113-124` uses flat gray for all non-selected, non-zero bands. Could use a gradient or heatmap color based on pulse count relative to max

## Band Inspector

- [ ] **Detection rate is computed from random decisions** — `EmitterDetailPanel.tsx:67-69` calculates detection rate against the random `waterfall` data, not real scheduler performance. Will be meaningful only after real model output replaces random data

---

## New Visualizations to Add

### Scatter Plot: Frequency vs AoA
- [x] Plot each pulse as a point on Frequency (x) vs AoA (y)
- [x] Color points by emitter label
- [x] Reveal spatial-spectral clustering of emitters
- [x] Add hover tooltips with pulse details (ToA, amplitude, emitter type)

### PRF (Pulse Repetition Frequency) Histogram
- [x] Compute inter-pulse intervals per band or per emitter
- [x] Plot histogram of PRF distribution
- [x] Add per-emitter-type overlay to distinguish radar vs comms
- [x] Useful for emitter identification and classification

### Cumulative Detection Curve
- [x] Plot cumulative intercepts over time (x = scan step, y = total intercepts)
- [x] Compare ML scheduler vs baselines (sequential, random, priority)
- [x] Normalize by total emitter transmissions to show interception ratio
- [x] Add shaded confidence bands if multiple runs available

### AoA Polar Plot
- [x] Plot angle of arrival on a polar/radial chart
- [x] Color by emitter type or threat level
- [x] Show spatial distribution of emitters relative to receiver
- [x] Highlight coverage gaps or concentrated threat directions

### Time-Frequency Spectrogram (Amplitude Heatmap)
- [x] Replace binary on/off waterfall with amplitude intensity encoding
- [x] Cell color maps to signal power (dB) instead of transmit/no-transmit
- [x] Add colorbar legend for amplitude scale
- [x] Option to toggle between binary and amplitude view

### Emitter Feature Space (t-SNE / UMAP)
- [x] Project pulse features (ToA, Frequency, PW, AoA, Amplitude) into 2D
- [x] Color by emitter label
- [x] Show whether emitters are linearly separable
- [x] Add cluster centroid markers and variance ellipses

### Band × Emitter Type Heatmap
- [x] Cross-tabulation: rows = frequency bands, columns = emitter types
- [x] Cell intensity = count of pulses from that emitter type in that band
- [x] Reveal spectral occupancy patterns and emitter-band associations
- [x] Add row/column totals as marginal bars

### Scan Strategy Comparison (Side-by-Side Waterfall)
- [ ] Render two waterfall views stacked or side-by-side
- [ ] One for ML scheduler, one for baseline (sequential/random)
- [ ] Same config, synchronized time axis
- [ ] Highlight differences in detection outcomes per band

### Training Curves (for future ML pipeline)
- [ ] Plot loss, reward, epsilon decay over training episodes
- [ ] Add evaluation metrics (Pd, Pfa, intercept rate) on secondary axis
- [ ] Show checkpoint markers and best-model indicators
- [ ] Compare multiple runs or hyperparameter settings

### Interception Ratio Over Time
- [x] Running average of successful intercepts as a function of scan steps
- [x] Break down by emitter type (threat vs non-threat)
- [x] Add target threshold line (e.g., 0.85 from AGENTS.md)
- [x] Compare across different scheduler strategies

---

## Priority Order

1. **Expand config list** (trivial, immediate value)
2. **Emitter types from H5** (fixes biggest fake data)
3. **Filters wired up** (UX is broken without this)
4. **Dataset Explorer pagination** (usability at 250 rows)
5. **Status bar realism** (remove fake health/FPS)
6. **Real scheduler decisions** (requires ML model — long-term)
7. **Cumulative Detection Curve** (core metric, high impact) - DONE
8. **Time-Frequency Spectrogram** (upgrade existing waterfall)
9. **Scatter: Frequency vs AoA** (emitter separability insight) - DONE
10. **AoA Polar Plot** (spatial awareness) - DONE
11. **PRF Histogram** (emitter classification) - DONE
12. **Band × Emitter Heatmap** (spectral occupancy)
13. **Emitter t-SNE/UMAP** (feature space analysis) - DONE
14. **Scan Strategy Comparison** (baseline benchmarking)
15. **Training Curves** (after ML pipeline exists)
16. **Interception Ratio Over Time** (after ML pipeline exists)
