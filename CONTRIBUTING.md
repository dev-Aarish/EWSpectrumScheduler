# Contributing — Smart Scan EW Dashboard

## What Has Been Built

An **electronic warfare operator's console** dashboard that visualizes the scan dataset: frequency-band transmission/non-transmission truth data, receiver scheduling decisions, and interception performance metrics. The UI follows the design language in `design.md` — dark instrument-panel aesthetic, signal amber accent, monospace numerals, flat hairline-bordered panels.

### Current Feature Set

| Component | File | Description |
|-----------|------|-------------|
| **Status Bar** | `src/components/StatusBar.tsx` | Top console bar — system mode (live/replay/training), config ID, scan progress bar, active band count, system health, live clock with milliseconds |
| **Sidebar** | `src/components/Sidebar.tsx` | Left rail — frequency range, band list sorted by activity, emitter type breakdown, min-pulse and frequency-range filters |
| **Spectrum Waterfall** | `src/components/SpectrumWaterfall.tsx` | Canvas-based heatmap — rows = frequency bands, columns = time bins. Cells colored by transmission state. Click-to-select band, hover tooltips, sweep-line marker with glow, scan history overlay |
| **Frequency Spectrum** | `src/components/FrequencySpectrum.tsx` | Recharts bar chart — pulse count per frequency band. Click bars to select bands. Tooltip shows freq, pulses, emitters, mean amplitude |
| **Amplitude Distribution** | `src/components/AmplitudeDistribution.tsx` | Recharts area chart — histogram of mean amplitude across active bands. Highlights selected band's amplitude |
| **Emitter Detail Panel** | `src/components/EmitterDetailPanel.tsx` | Right panel — appears when a band is selected. Shows band ID, frequency, activity timeline mini-chart, pulse count, emitter count, mean amplitude, detection rate, scan coverage, frequency range bar |
| **Scan Timeline** | `src/components/ScanTimeline.tsx` | Horizontal bar chart below waterfall — visualizes the entire scan history. Height = band index, color = hit (green) / miss (gray) / current step (amber). Click anywhere to jump to that time step |
| **Decision Log** | `src/components/DecisionLog.tsx` | Terminal-style log — timestamped scheduler decisions with band choice, confidence, predicted reward, HIT/MISS badges. Filterable by All/Hits/Misses |
| **Dataset Explorer** | `src/components/DatasetExplorer.tsx` | Sortable, searchable table of 250 test configurations. Columns: ID, pulses, emitters, mean frequency, mean amplitude. Click any row to load that config |

### Layout

```
+------------------------------------------------------------------+
| Status Bar (mode, config, progress, bands, health, clock)        |
+------+-------------------------------------------+---------------+
|      | Spectrum Waterfall (canvas heatmap)       |               |
| Side | Click to select band                      | Emitter       |
| bar  | Hover for tooltip                         | Detail        |
|      | Amber sweep line + glow                   | Panel         |
|      +-------------------------------------------+ (appears on   |
|      | Scan Timeline (clickable bar chart)       |  band select) |
+------+-------------------------------------------+---------------+
| [Scheduler Log] [Dataset Explorer] [Frequency Analysis]           |
| (tabbed bottom panel)                                             |
+------------------------------------------------------------------+
```

---

## Data Pipeline

### Source Data

Raw simulation data lives in HDF5 (`.h5`) files under `scan/`:

```
scan/
├── train_scan/          # ~2500 config files (config_0.h5 ... config_2499.h5)
├── val_scan/            # 250 config files (config_0.h5 ... config_249.h5)
└── test_scan/
    ├── data_stats.csv           # Per-config statistics (250 rows)
    ├── data_stats_global.csv    # Global aggregate stats
    └── missing.txt
```

Each `config_*.h5` file contains:

| Key | Shape | Content |
|-----|-------|---------|
| `data` | `(N, 5)` | Pulse sequences — columns: ToA, Frequency, PulseWidth, AoA, Amplitude |
| `labels` | `(N, 1)` | Emitter ID per pulse (integer labels) |
| `metadata/receiver` | group | `dwell_centres_mhz` (36 bands), `dwell_times_s`, `freq_range_mhz`, `start_position_km` |
| `metadata/transmitters` | group | Per-transmitter configs (frequency, position, PRI, pulse width, scan) |

### Extraction Scripts

Two Python scripts in `ew-dashboard/scripts/` convert H5/CSV to JSON:

**`scripts/extract_data.py`** — reads H5 files, builds waterfall grids, generates scheduler decisions:

```bash
cd ew-dashboard
python3 scripts/extract_data.py
```

Outputs to `public/data/`:
- `config_0.json` ... `config_249.json` — per-config data with waterfall, band stats, decisions
- `config_list.json` — array of config IDs `["config_0", "config_1", ...]`
- `stats.json` — aggregate stats

**`scripts/extract_csv.py`** — reads `scan/test_scan/data_stats.csv`:

```bash
cd ew-dashboard
python3 scripts/extract_csv.py
```

Outputs to `public/data/`:
- `test_stats.json` — 250 config records with id, n_pulses, n_emitters, mean_Frequency, mean_Amplitude, etc.

### How the Dashboard Fetches Data

All data fetching happens client-side via `fetch()` against the Next.js static `public/data/` directory:

```typescript
// Config list (for sidebar selector + dataset explorer)
fetch("/data/config_list.json")       → ["config_0", "config_1", ...]

// Individual config data (loaded when config is selected)
fetch("/data/config_0.json")          → { config_id, waterfall, band_stats, ... }

// Test dataset stats (for dataset explorer table)
fetch("/data/test_stats.json")        → [{ id, n_pulses, n_emitters, ... }, ...]
```

No API routes, no server-side rendering for data. The JSON files are pre-generated by the Python scripts and served statically from `public/data/`.

### JSON Data Shape (per config)

```typescript
{
  config_id: string;              // "config_0"
  n_pulses: number;               // Total pulse count
  n_emitters: number;             // Number of unique emitters
  n_bands: number;                // 36 (from receiver dwell centres)
  freq_range_mhz: [number, number];  // [500, 18000]
  dwell_centres_mhz: number[];   // 36 band center frequencies
  feature_names: string[];        // ["ToA", "Frequency", "PulseWidth", "AoA", "Amplitude"]
  waterfall: number[][];          // [n_bands][n_time_bins] — 0=idle, 1=transmission
  waterfall_labels: number[][];   // [n_bands][n_time_bins] — emitter ID
  band_stats: Array<{
    band_id: number;
    dwell_centre_mhz: number;
    pulse_count: number;
    n_emitters: number;
    mean_amplitude: number;
    frequency_range: [number, number];
  }>;
  scheduler_decisions: Array<{
    time_step: number;
    band_chosen: number;
    confidence: number;
    predicted_reward: number;
    actual_detection: boolean;
    timestamp: number;
  }>;
  scan_history: number[];         // Band chosen at each time step
  n_time_bins: number;            // 200
}
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+ with `h5py` and `numpy`

### 1. Extract Data from H5 Files

```bash
cd ew-dashboard

# Install Python dependencies (if not already installed)
pip install h5py numpy

# Extract H5 configs to JSON (takes ~30s for 5 configs)
python3 scripts/extract_data.py

# Extract CSV test stats to JSON
python3 scripts/extract_csv.py
```

This populates `public/data/` with the JSON files the dashboard reads.

### 2. Install Node Dependencies

```bash
cd ew-dashboard
npm install
```

### 3. Start the Server

**Development mode** (hot reload):

```bash
cd ew-dashboard
npm run dev
# → http://localhost:3000
```

**Production mode** (optimized build):

```bash
cd ew-dashboard
npm run build
npm start
# → http://localhost:3000
```

**Persistent background server** (survives terminal close):

```bash
cd ew-dashboard
npm run build
screen -dmS ew-server bash -c 'node node_modules/.bin/next start -p 3000'
# Attach: screen -r ew-server
# Quit server: screen -S ew-server -X quit
```

### 4. Extract More Configs (Optional)

Edit `scripts/extract_data.py` and change `max_configs=5` to a higher number, then re-run:

```bash
python3 scripts/extract_data.py   # extracts first N configs from val_scan/
```

Available configs: 250 in `val_scan/`, ~2500 in `train_scan/`.

---

## Project Structure

```
ew-dashboard/
├── public/data/                 # Pre-extracted JSON data files
│   ├── config_0.json ...        # Per-config waterfall, band stats, decisions
│   ├── config_list.json         # Array of available config IDs
│   ├── stats.json               # Aggregate dataset stats
│   └── test_stats.json          # 250-row test config table data
├── scripts/
│   ├── extract_data.py          # H5 → JSON extraction
│   └── extract_csv.py           # CSV → JSON extraction
├── src/
│   ├── app/
│   │   ├── globals.css          # Design system tokens (colors, fonts, etc.)
│   │   ├── layout.tsx           # Root layout (IBM Plex fonts)
│   │   └── page.tsx             # Main dashboard orchestrator
│   └── components/
│       ├── StatusBar.tsx         # Top console status bar
│       ├── Sidebar.tsx           # Left rail — band/emitter selection
│       ├── SpectrumWaterfall.tsx # Canvas-based heatmap visualization
│       ├── FrequencySpectrum.tsx # Bar chart — pulses per band
│       ├── AmplitudeDistribution.tsx  # Area chart — amplitude histogram
│       ├── EmitterDetailPanel.tsx      # Right panel — band inspector
│       ├── ScanTimeline.tsx      # Clickable scan history bar chart
│       ├── DecisionLog.tsx       # Terminal-style scheduler log
│       └── DatasetExplorer.tsx   # Sortable config table
└── package.json
```

---

## Design System Quick Reference

All defined in `src/app/globals.css` following `design.md`:

| Token | Value | Use |
|-------|-------|-----|
| `--bg-canvas` | `#0B0D0F` | App background |
| `--bg-panel` | `#12151A` | Panel background |
| `--bg-panel-raised` | `#181C22` | Elevated panel |
| `--bg-inset` | `#0E1013` | Recessed areas |
| `--border-subtle` | `#22262D` | Hairline borders |
| `--border-strong` | `#343A42` | Emphasized borders |
| `--accent` | `#D98E33` | Signal amber (primary accent) |
| `--accent-dim` | `#8A5E24` | Accent at rest |
| `--transmission-hit` | `#C4523B` | Detected transmission |
| `--non-transmission` | `#3A3F46` | Idle/silent band |
| `--correct-prediction` | `#5E8C6A` | Model correct |
| `--false-alarm` | `#B8763E` | False alarm |
| `--threat-priority` | `#A13A34` | High-priority emitter |

**Fonts:** IBM Plex Sans (UI), IBM Plex Mono (data/numbers with `tabular-nums`)

**Rules:** No emoji, no purple/cyan/lime, no shadows (hairline borders only), no gradient text, no stock imagery.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4 with CSS custom properties
- **Charts:** Recharts (bar, area, line)
- **Canvas:** Native HTML5 Canvas (waterfall heatmap)
- **Icons:** Lucide React (line icons only)
- **Data:** Pre-extracted JSON from Python (h5py, numpy)
- **Fonts:** Google Fonts (IBM Plex Sans, IBM Plex Mono)
