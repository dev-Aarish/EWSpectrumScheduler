#!/usr/bin/env python3
"""Extract CSV stats data to JSON for dashboard."""

import csv
import json
from pathlib import Path

OUTPUT_DIR = Path("public/data")
SCAN_DIR = Path("../scan")


def extract_csv_stats():
    """Extract test_scan CSV stats."""
    csv_path = SCAN_DIR / "test_scan" / "data_stats.csv"
    
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    # Convert to numeric types
    processed = []
    for row in rows:
        processed.append({
            "id": int(row["id"]),
            "n_pulses": int(row["n_pulses"]),
            "n_emitters": int(row["n_emitters"]),
            "n_types": int(row["n_types"]),
            "mean_Frequency": float(row["mean_Frequency"]),
            "mean_Amplitude": float(row["mean_Amplitude"]),
            "std_Frequency": float(row["std_Frequency"]),
            "min_Frequency": float(row["min_Frequency"]),
            "max_Frequency": float(row["max_Frequency"]),
        })
    
    output_path = OUTPUT_DIR / "test_stats.json"
    with open(output_path, 'w') as f:
        json.dump(processed, f)
    
    print(f"Saved {len(processed)} config stats to {output_path}")


if __name__ == "__main__":
    extract_csv_stats()
