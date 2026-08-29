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
    int_fields = ["id", "n_pulses", "n_emitters", "n_types"]
    float_fields = [
        "min_ToA", "min_Frequency", "min_PulseWidth", "min_AoA", "min_Amplitude",
        "max_ToA", "max_Frequency", "max_PulseWidth", "max_AoA", "max_Amplitude",
        "mean_ToA", "mean_Frequency", "mean_PulseWidth", "mean_AoA", "mean_Amplitude",
        "std_ToA", "std_Frequency", "std_PulseWidth", "std_AoA", "std_Amplitude",
    ]

    processed = []
    for row in rows:
        entry = {}
        for field in int_fields:
            entry[field] = int(row[field])
        for field in float_fields:
            entry[field] = float(row[field])
        processed.append(entry)
    
    output_path = OUTPUT_DIR / "test_stats.json"
    with open(output_path, 'w') as f:
        json.dump(processed, f)
    
    print(f"Saved {len(processed)} config stats to {output_path}")


if __name__ == "__main__":
    extract_csv_stats()
