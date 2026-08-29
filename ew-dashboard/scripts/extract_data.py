#!/usr/bin/env python3
"""
Extract H5 scan data to JSON for Next.js dashboard.
Reads config files from scan/val_scan/ and outputs JSON data files.
"""

import h5py
import numpy as np
import json
import os
from pathlib import Path

# Output directory
OUTPUT_DIR = Path("public/data")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Scan directory (relative to project root)
SCAN_DIR = Path("../scan")

# Feature names
FEATURE_NAMES = ["ToA", "Frequency", "PulseWidth", "AoA", "Amplitude"]

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


def extract_config_data(h5_path: str) -> dict:
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
        n_time_bins = min(200, len(toa_sorted))
        time_bins = np.linspace(toa_sorted.min(), toa_sorted.max(), n_time_bins + 1)
        
        # Build waterfall grid: rows = bands, cols = time bins
        waterfall = np.zeros((n_bands, n_time_bins), dtype=int)
        waterfall_labels = np.zeros((n_bands, n_time_bins), dtype=int)
        
        for i in range(len(bands_sorted)):
            t_idx = np.searchsorted(time_bins[1:], toa_sorted[i])
            t_idx = min(t_idx, n_time_bins - 1)
            b_idx = int(bands_sorted[i])
            waterfall[b_idx, t_idx] = 1  # Transmission detected
            waterfall_labels[b_idx, t_idx] = int(labels_sorted[i])
        
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
        
        # Generate simulated scheduler decisions (for demo)
        scheduler_decisions = []
        scan_history = []
        for t in range(min(50, n_time_bins)):
            band_choice = np.random.randint(0, n_bands)
            confidence = float(np.random.uniform(0.3, 0.95))
            predicted_reward = float(np.random.uniform(-1.0, 2.0))
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
            "band_stats": band_stats,
            "scheduler_decisions": scheduler_decisions,
            "scan_history": scan_history,
            "n_time_bins": n_time_bins
        }


def extract_all_configs(split: str = "val_scan", max_configs: int = 0) -> list:
    """Extract data from multiple config files. max_configs=0 means all."""
    scan_dir = SCAN_DIR / split
    h5_files = sorted([f for f in scan_dir.glob("config_*.h5")])
    if max_configs > 0:
        h5_files = h5_files[:max_configs]
    
    configs = []
    for h5_file in h5_files:
        print(f"Extracting {h5_file.name}...")
        try:
            config_data = extract_config_data(str(h5_file))
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
    print("=== Extracting EW Scan Data ===")
    
    # Extract validation configs
    configs = extract_all_configs("val_scan")
    
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
