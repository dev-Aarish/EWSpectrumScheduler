#!/usr/bin/env python3
"""
Extract H5 scan data to JSON for Next.js dashboard.
Reads config files from scan/val_scan/ and outputs JSON data files.
"""

import h5py
import numpy as np
import json
import os
import argparse
from pathlib import Path

# Output directory
OUTPUT_DIR = Path("public/data")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Scan directory (relative to project root)
SCAN_DIR = Path("../scan")

# Feature names
FEATURE_NAMES = ["ToA", "Frequency", "PulseWidth", "AoA", "Amplitude"]

MAX_SCATTER_PULSES = 2000  # Max pulses for scatter plot data (downsample large configs)
MAX_PRF_BINS = 50  # Max bins for PRF histogram

EMITTER_TYPE_COLORS = {
    "Fixed-Frequency": "bg-[#C4523B]",
    "PRF Agile": "bg-[#D98E33]",
    "Freq Hopping": "bg-[#5E8C6A]",
    "Spatial Scan": "bg-[#B8763E]",
    "Omni": "bg-[#6B7B8D]",
}


def extract_emitter_types(tx_group) -> list:
    """Classify transmitters from H5 metadata/transmitters group."""
    counts = {
        "Fixed-Frequency": 0,
        "PRF Agile": 0,
        "Freq Hopping": 0,
        "Spatial Scan": 0,
        "Omni": 0,
    }

    for tx_key in tx_group.keys():
        tx = tx_group[tx_key]

        # Read freq_mode
        freq_mode = ""
        if "frequency_config" in tx:
            fc = tx["frequency_config"]
            freq_mode = fc.attrs.get("freq_mode", "")

        # Read pri_mode
        pri_mode = ""
        if "pri_config" in tx:
            pri = tx["pri_config"]
            pri_mode = pri.attrs.get("pri_mode", "")

        # Read scan_type
        scan_type = ""
        if "scan_config" in tx:
            sc = tx["scan_config"]
            scan_type = sc.attrs.get("scan_type", "")

        # Classify
        if freq_mode in ("FixedSingle", "FixedMultiSimultaneous"):
            counts["Fixed-Frequency"] += 1

        if pri_mode in ("Staggered", "SwitchDwell", "Jittered"):
            counts["PRF Agile"] += 1

        if freq_mode in ("RandomRange", "RandomFixed", "HoppingSawtooth"):
            counts["Freq Hopping"] += 1

        if scan_type == "Circular":
            counts["Spatial Scan"] += 1
        elif scan_type == "Omni":
            counts["Omni"] += 1

    return [
        {"label": label, "count": count, "color": EMITTER_TYPE_COLORS[label]}
        for label, count in counts.items()
        if count > 0
    ]


def compute_prf_data(toa: np.ndarray, labels: np.ndarray, n_bands: int, band_indices: np.ndarray) -> dict:
    """Compute PRF (Pulse Repetition Frequency) data from inter-pulse intervals.
    
    PRF = 1 / ToI (inter-pulse interval) in Hz.
    Returns overall PRF histogram and per-emitter-type overlays.
    """
    sorted_idx = np.argsort(toa)
    toa_sorted = toa[sorted_idx]
    labels_sorted = labels[sorted_idx]
    bands_sorted = band_indices[sorted_idx]

    # Overall inter-pulse intervals
    toi = np.diff(toa_sorted)  # in microseconds
    toi = toi[toi > 0]  # remove zero/negative intervals
    if len(toi) == 0:
        return {"overall": [], "per_emitter": [], "toi_range": [0, 0]}

    prf_hz = 1e6 / toi  # convert microseconds to Hz

    # Clamp to reasonable range for display (1 Hz to 500 kHz)
    prf_clamped = np.clip(prf_hz, 1, 500_000)

    # Overall histogram
    log_min = np.log10(prf_clamped.min())
    log_max = np.log10(prf_clamped.max())
    n_bins = min(MAX_PRF_BINS, max(10, int(np.sqrt(len(prf_clamped)))))

    if log_max - log_min < 1e-6:
        # All values are essentially the same
        overall = [{"range": f"{prf_clamped[0]:.0f}", "count": len(prf_clamped), "min": float(prf_clamped[0]), "binSize": 1.0}]
        per_emitter = []
        return {"overall": overall, "per_emitter": per_emitter, "toi_range": [float(toi.min()), float(toi.max())]}

    log_edges = np.linspace(log_min, log_max, n_bins + 1)
    edges = 10 ** log_edges

    overall_bins = []
    for i in range(n_bins):
        lo, hi = edges[i], edges[i + 1]
        count = int(np.sum((prf_clamped >= lo) & (prf_clamped < hi)))
        if i == n_bins - 1:
            count = int(np.sum((prf_clamped >= lo) & (prf_clamped <= hi)))
        label = f"{lo:.0f}" if lo >= 100 else f"{lo:.1f}"
        overall_bins.append({
            "range": label,
            "count": count,
            "min": float(lo),
            "binSize": float(hi - lo),
        })

    # Per-emitter PRF histograms
    unique_labels = sorted(set(labels_sorted))
    per_emitter = []
    emitter_colors = ["#C4523B", "#D98E33", "#5E8C6A", "#B8763E", "#6B7B8D", "#9B59B6", "#3498DB"]

    for idx, lbl in enumerate(unique_labels):
        mask = labels_sorted == lbl
        if mask.sum() < 2:
            continue
        emitter_toa = toa_sorted[mask]
        emitter_toi = np.diff(emitter_toa)
        emitter_toi = emitter_toi[emitter_toi > 0]
        if len(emitter_toi) == 0:
            continue
        emitter_prf = np.clip(1e6 / emitter_toi, 1, 500_000)

        # Use the same bin edges as overall for consistency
        emitter_bins = []
        for i in range(n_bins):
            lo, hi = edges[i], edges[i + 1]
            count = int(np.sum((emitter_prf >= lo) & (emitter_prf < hi)))
            if i == n_bins - 1:
                count = int(np.sum((emitter_prf >= lo) & (emitter_prf <= hi)))
            emitter_bins.append({
                "range": f"{lo:.0f}" if lo >= 100 else f"{lo:.1f}",
                "count": count,
                "min": float(lo),
                "binSize": float(hi - lo),
            })

        per_emitter.append({
            "label": f"Emitter #{int(lbl)}",
            "color": emitter_colors[idx % len(emitter_colors)],
            "data": emitter_bins,
        })

    return {
        "overall": overall_bins,
        "per_emitter": per_emitter,
        "toi_range": [float(toi.min()), float(toi.max())],
    }


def extract_config_data(h5_path: str, max_time_bins: int = 200) -> dict:
    """Extract data from a single H5 config file."""
    with h5py.File(h5_path, 'r') as f:
        data = f['data'][:]
        labels = f['labels'][:].flatten()
        
        # Extract metadata
        recv = f['metadata/receiver']
        freq_range = recv['freq_range_mhz'][()]
        dwell_centres = recv['dwell_centres_mhz'][()]
        n_bands = len(dwell_centres)
        
        # Extract transmitter info
        tx_group = f['metadata/transmitters']
        n_emitters = len(tx_group.keys())
        emitter_types = extract_emitter_types(tx_group)
        
        # Compute band activity (which bands have transmissions)
        # Frequency column (index 1) maps to band index
        freq_min, freq_max = freq_range
        band_width = (freq_max - freq_min) / n_bands
        
        # Map each pulse to a band
        frequencies = data[:, 1]
        band_indices = np.clip(
            ((frequencies - freq_min) / band_width).astype(int), 
            0, n_bands - 1
        )
        
        # Create time-ordered pulse sequence
        toa = data[:, 0]
        sorted_indices = np.argsort(toa)
        toa_sorted = toa[sorted_indices]
        freq_sorted = frequencies[sorted_indices]
        labels_sorted = labels[sorted_indices]
        bands_sorted = band_indices[sorted_indices]
        amplitude_sorted = data[:, 4][sorted_indices]
        
        # Compute time bins for waterfall visualization
        n_time_bins = min(max_time_bins, len(toa_sorted))
        time_bins = np.linspace(toa_sorted.min(), toa_sorted.max(), n_time_bins + 1)
        
        # Build waterfall grid: rows = bands, cols = time bins
        waterfall = np.zeros((n_bands, n_time_bins), dtype=int)
        waterfall_labels = np.zeros((n_bands, n_time_bins), dtype=int)
        waterfall_amplitude = np.zeros((n_bands, n_time_bins), dtype=float)
        
        # Accumulate amplitudes per cell for mean computation
        amplitude_sums = np.zeros((n_bands, n_time_bins), dtype=float)
        amplitude_counts = np.zeros((n_bands, n_time_bins), dtype=int)
        
        for i in range(len(bands_sorted)):
            t_idx = np.searchsorted(time_bins[1:], toa_sorted[i])
            t_idx = min(t_idx, n_time_bins - 1)
            b_idx = int(bands_sorted[i])
            waterfall[b_idx, t_idx] = 1  # Transmission detected
            waterfall_labels[b_idx, t_idx] = int(labels_sorted[i])
            amplitude_sums[b_idx, t_idx] += amplitude_sorted[i]
            amplitude_counts[b_idx, t_idx] += 1
        
        # Compute mean amplitude per cell (cells with no pulses stay 0)
        has_pulses = amplitude_counts > 0
        waterfall_amplitude[has_pulses] = amplitude_sums[has_pulses] / amplitude_counts[has_pulses]
        
        # Compute global amplitude range for colorbar scaling
        if has_pulses.any():
            amp_min = float(waterfall_amplitude[has_pulses].min())
            amp_max = float(waterfall_amplitude[has_pulses].max())
        else:
            amp_min, amp_max = 0.0, 0.0
        
        # Compute per-band statistics
        band_stats = []
        for b in range(n_bands):
            mask = bands_sorted == b
            if mask.any():
                band_stats.append({
                    "band_id": b,
                    "dwell_centre_mhz": float(dwell_centres[b]),
                    "pulse_count": int(mask.sum()),
                    "n_emitters": len(np.unique(labels_sorted[mask])),
                    "mean_amplitude": float(np.mean(amplitude_sorted[mask])),
                    "frequency_range": [
                        float(freq_sorted[mask].min()),
                        float(freq_sorted[mask].max())
                    ]
                })
            else:
                band_stats.append({
                    "band_id": b,
                    "dwell_centre_mhz": float(dwell_centres[b]),
                    "pulse_count": 0,
                    "n_emitters": 0,
                    "mean_amplitude": 0.0,
                    "frequency_range": [0.0, 0.0]
                })
        
        # Compute band activity scores for heuristic scheduler
        band_pulse_counts = np.array([band_stats[b]["pulse_count"] for b in range(n_bands)])
        total_pulses = band_pulse_counts.sum()
        if total_pulses > 0:
            band_activity_probs = band_pulse_counts / total_pulses
        else:
            band_activity_probs = np.ones(n_bands) / n_bands
        
        # Generate scheduler decisions using activity-weighted heuristic
        scheduler_decisions = []
        scan_history = []
        last_scanned = np.full(n_bands, -n_time_bins)  # Track when each band was last scanned
        n_decisions = n_time_bins
        
        for t in range(n_decisions):
            # Score bands: activity probability + recency bonus for unscanned bands
            time_since_scan = t - last_scanned
            recency_bonus = np.clip(time_since_scan / n_time_bins, 0, 1)
            scores = 0.7 * band_activity_probs + 0.3 * recency_bonus
            scores = scores / scores.sum()  # Normalize to probabilities
            
            # Choose band based on weighted probabilities
            band_choice = np.random.choice(n_bands, p=scores)
            last_scanned[band_choice] = t
            
            # Compute confidence based on activity (more active = higher confidence)
            confidence = float(np.clip(band_activity_probs[band_choice] * n_bands * 0.8 + 0.2, 0.3, 0.95))
            predicted_reward = float(np.clip(band_activity_probs[band_choice] * n_bands, -1.0, 2.0))
            actual = int(waterfall[band_choice, t])
            scheduler_decisions.append({
                "time_step": t,
                "band_chosen": int(band_choice),
                "confidence": round(confidence, 3),
                "predicted_reward": round(predicted_reward, 3),
                "actual_detection": actual == 1,
                "timestamp": float(time_bins[t])
            })
            scan_history.append(int(band_choice))
        
        # Build pulse-level scatter data (Frequency vs AoA colored by emitter)
        n_total = len(data)
        if n_total <= MAX_SCATTER_PULSES:
            scatter_indices = np.arange(n_total)
        else:
            # Reservoir sampling for uniform downsample
            rng = np.random.default_rng(42)
            scatter_indices = np.arange(MAX_SCATTER_PULSES)
            for i in range(MAX_SCATTER_PULSES, n_total):
                j = rng.integers(0, i + 1)
                if j < MAX_SCATTER_PULSES:
                    scatter_indices[j] = i

        pulse_data = {
            "frequency": np.round(data[scatter_indices, 1], 2).tolist(),
            "aoa": np.round(data[scatter_indices, 3], 2).tolist(),
            "amplitude": np.round(data[scatter_indices, 4], 2).tolist(),
            "toa": np.round(data[scatter_indices, 0], 2).tolist(),
            "emitter_label": labels[scatter_indices].astype(int).tolist(),
        }

        # Compute PRF (Pulse Repetition Frequency) data
        prf_data = compute_prf_data(toa, labels, n_bands, band_indices)

        return {
            "config_id": Path(h5_path).stem,
            "n_pulses": len(data),
            "n_emitters": n_emitters,
            "emitter_types": emitter_types,
            "n_bands": int(n_bands),
            "freq_range_mhz": [float(freq_range[0]), float(freq_range[1])],
            "dwell_centres_mhz": dwell_centres.tolist(),
            "feature_names": FEATURE_NAMES,
            "waterfall": waterfall.tolist(),
            "waterfall_labels": waterfall_labels.tolist(),
            "waterfall_amplitude": waterfall_amplitude.tolist(),
            "amplitude_range": [amp_min, amp_max],
            "band_stats": band_stats,
            "pulse_data": pulse_data,
            "prf_data": prf_data,
            "scheduler_decisions": scheduler_decisions,
            "scan_history": scan_history,
            "n_time_bins": n_time_bins
        }


def extract_all_configs(split: str = "val_scan", max_configs: int = 0, max_time_bins: int = 200) -> list:
    """Extract data from multiple config files. max_configs=0 means all."""
    scan_dir = SCAN_DIR / split
    h5_files = sorted([f for f in scan_dir.glob("config_*.h5")])
    if max_configs > 0:
        h5_files = h5_files[:max_configs]
    
    configs = []
    for h5_file in h5_files:
        print(f"Extracting {h5_file.name}...")
        try:
            config_data = extract_config_data(str(h5_file), max_time_bins)
            configs.append(config_data)
        except Exception as e:
            print(f"  Error: {e}")
    
    return configs


def generate_dataset_stats(configs: list) -> dict:
    """Generate aggregate statistics from configs."""
    total_pulses = sum(c["n_pulses"] for c in configs)
    total_emitters = sum(c["n_emitters"] for c in configs)
    
    return {
        "n_configs": len(configs),
        "total_pulses": total_pulses,
        "total_emitters": total_emitters,
        "mean_pulses_per_config": round(total_pulses / len(configs)),
        "mean_emitters_per_config": round(total_emitters / len(configs)),
        "freq_range_mhz": configs[0]["freq_range_mhz"] if configs else [0, 0],
        "n_bands": configs[0]["n_bands"] if configs else 0,
    }


def main():
    parser = argparse.ArgumentParser(description="Extract EW scan data to JSON for dashboard")
    parser.add_argument("--split", default="val_scan", help="Dataset split to extract (default: val_scan)")
    parser.add_argument("--max-configs", type=int, default=0, help="Max configs to extract, 0=all (default: 0)")
    parser.add_argument("--time-bins", type=int, default=200, help="Max time bins for waterfall (default: 200)")
    args = parser.parse_args()

    print("=== Extracting EW Scan Data ===")
    print(f"  Split: {args.split}")
    print(f"  Max configs: {args.max_configs or 'all'}")
    print(f"  Max time bins: {args.time_bins}")
    
    # Extract configs
    configs = extract_all_configs(args.split, args.max_configs, args.time_bins)
    
    # Save individual configs
    for config in configs:
        config_id = config["config_id"]
        output_path = OUTPUT_DIR / f"{config_id}.json"
        with open(output_path, 'w') as f:
            json.dump(config, f)
        print(f"  Saved {output_path}")
    
    # Generate and save dataset stats
    stats = generate_dataset_stats(configs)
    stats_path = OUTPUT_DIR / "stats.json"
    with open(stats_path, 'w') as f:
        json.dump(stats, f)
    print(f"  Saved {stats_path}")
    
    # Save config list
    config_list = [c["config_id"] for c in configs]
    list_path = OUTPUT_DIR / "config_list.json"
    with open(list_path, 'w') as f:
        json.dump(config_list, f)
    print(f"  Saved {list_path}")
    
    print(f"\n=== Done: Extracted {len(configs)} configs ===")


if __name__ == "__main__":
    main()
