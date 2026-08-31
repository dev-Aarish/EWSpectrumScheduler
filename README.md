# EWSpectrumScheduler

ML-based scheduler for Electronic Support (ES) receiver frequency scanning. Optimizes intercept time and detection probability against frequency-agile and spatially scanning emitters.

---

## Modes of Operation

The dashboard operates in three distinct modes, selectable by clicking the mode badge in the top-left corner.

### Replay

Loads pre-recorded or simulated scan data from HDF5 configuration files. Used for offline analysis, visualization, and comparing scheduler strategies against ground-truth emitter data.

- Data source: `scan/` directory (train/val/test configs)
- Scheduler decisions: random (placeholder until ML pipeline)
- Playback controls: manual step, auto-play, adjustable speed
- Use case: exploring configs, validating data extraction, debugging visualizations

### Training

Runs the ML agent (DQN/PPO) against a simulated RF environment. The scheduler learns a scan policy by interacting with emitter simulations and receiving rewards for successful intercepts.

- Data source: simulated RF environment generated from config parameters
- Scheduler decisions: learned policy with epsilon-greedy exploration
- Metrics: loss, reward, epsilon decay, intercept rate, Pd, Pfa
- Use case: developing and tuning the ML model before deployment

### Live

Operates on real-time RF input from SDR hardware or recorded IQ captures. The trained model makes band selection decisions on incoming signals with no playback controls — data streams continuously.

- Data source: SDR frontend (USRP/HackRF) or IQ file playback
- Scheduler decisions: trained model inference
- Metrics: inference latency, real-time detection outcomes, threat alerts
- Use case: field deployment or testing against real-world signals

---

## Data Pipeline

```
RF Input → Pulse Detection (CFAR) → Parameter Extraction → Scheduler → Band Selection
                                    ↓
                              pulse_data: {frequency, aoa, amplitude, toa, pulse_width, emitter_label}
```

In replay mode, the pipeline is bypassed and data is loaded directly from H5 files. In training/live modes, the full pipeline runs.