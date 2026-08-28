# AGENTS.md - Smart Scan Strategy for Electronic Warfare

## Project Overview

This project develops a **Machine Learning-based Electronic Support (ES) Receiver Scheduler** for Electronic Warfare (EW). The core problem is optimizing the frequency scanning strategy of an ES receiver in the absence of prior intelligence about emitters and their operating characteristics.

### Problem Statement

Detection of hostile communication or radar signals requires scanning a wide frequency spectrum. ES receivers have high sensitivity but instantaneous bandwidth at least an order lower than the system's overall bandwidth. Traditional open-loop strategies based on pre-mission data waste time on non-threatening emitters and may miss new or threatening ones.

**Goal:** Develop a robust ML-based scheduler that minimizes intercept time and ensures high interception rate against spatially scanning and frequency-agile emitters.

### Key Metrics

| Metric | Description |
|--------|-------------|
| **Probability of Detection (Pd)** | Likelihood of correctly detecting an active emitter |
| **Probability of False Alarm (Pfa)** | Likelihood of false positive detection |
| **Sensitivity** | Minimum signal strength detectable |
| **Average Intercept Rate** | Number of successful intercepts per unit time |
| **Average Reward/Cost Function** | ML optimization objective |
| **Percentage of Correct Predictions** | Accuracy of emitter prediction model |
| **Average Intercept Time Error** | Deviation from optimal intercept timing |
| **Interception Ratio** | Fraction of total emitter transmissions intercepted |

---

## Repository Structure

```
EWSpectrumScheduler/
├── AGENTS.md                    # This file - development guidelines
├── README.md                    # Project documentation
└── scan/                        # Simulation data directory
    ├── train_scan/              # Training configurations (config_*.h5)
    │   ├── config_0.h5
    │   ├── config_1.h5
    │   └── ... (~2500+ configs)
    ├── val_scan/                # Validation configurations (config_*.h5)
    │   ├── config_0.h5
    │   ├── config_1.h5
    │   └── ... (~250 configs)
    └── test_scan/               # Test data and statistics
        ├── data_stats.csv       # Per-config statistics
        ├── data_stats_global.csv # Global aggregate statistics
        └── missing.txt          # Missing/placeholder config count
```

### Data Format

Each `config_*.h5` file contains HDF5-structured simulation data. The `data_stats.csv` files contain the following columns per configuration:

- **Identification:** `id`, `n_pulses`, `n_emitters`, `n_types`
- **Time of Arrival (ToA):** `min_ToA`, `max_ToA`, `mean_ToA`, `std_ToA`
- **Frequency:** `min_Frequency`, `max_Frequency`, `mean_Frequency`, `std_Frequency`
- **Pulse Width:** `min_PulseWidth`, `max_PulseWidth`, `mean_PulseWidth`, `std_PulseWidth`
- **Angle of Arrival (AoA):** `min_AoA`, `max_AoA`, `mean_AoA`, `std_AoA`
- **Amplitude:** `min_Amplitude`, `max_Amplitude`, `mean_Amplitude`, `std_Amplitude`

---

## Development Guidelines

### Code Style and Conventions

- **Language:** Python 3.10+
- **ML Framework:** PyTorch (preferred) or TensorFlow
- **Data Processing:** NumPy, Pandas, h5py
- **Visualization:** Matplotlib, Seaborn
- **Code Formatting:** Black formatter, isort for imports
- **Type Hints:** Required for all function signatures
- **Docstrings:** Google-style docstrings for all public functions/classes

### File Naming Conventions

```
src/
├── data/                    # Data loading and preprocessing
│   ├── __init__.py
│   ├── dataset.py          # PyTorch Dataset classes
│   ├── transforms.py       # Data transformations
│   └── augmentations.py    # Data augmentation techniques
├── models/                  # ML model architectures
│   ├── __init__.py
│   ├── scheduler.py        # Main scheduler model
│   ├── predictor.py        # Emitter prediction model
│   └── encoder.py          # Feature encoders
├── training/                # Training pipeline
│   ├── __init__.py
│   ├── trainer.py          # Training loop
│   ├── losses.py           # Custom loss functions
│   └── metrics.py          # Evaluation metrics
├── simulation/              # RF environment simulation
│   ├── __init__.py
│   ├── environment.py      # RF environment model
│   ├── emitter.py          # Emitter behavior models
│   └── receiver.py         # Receiver model
├── algorithms/              # Scanning algorithms
│   ├── __init__.py
│   ├── baseline.py         # Baseline scan strategies
│   ├── smart_scan.py       # ML-based smart scan
│   └── adaptive.py         # Adaptive algorithms
├── evaluation/              # Evaluation and visualization
│   ├── __init__.py
│   ├── evaluator.py        # Performance evaluation
│   └── visualization.py    # Result visualization
├── configs/                 # Configuration files
│   ├── default.yaml        # Default hyperparameters
│   └── experiments/        # Experiment-specific configs
├── scripts/                 # Utility scripts
│   ├── train.py            # Training entry point
│   ├── evaluate.py         # Evaluation entry point
│   └── simulate.py         # Simulation entry point
├── tests/                   # Unit and integration tests
│   ├── test_data.py
│   ├── test_models.py
│   └── test_algorithms.py
└── notebooks/               # Jupyter notebooks for analysis
    ├── data_exploration.ipynb
    └── results_analysis.ipynb
```

### System Model

The receiver operates in a two-dimensional search space:
- **Frequency Dimension:** Discretized frequency bands spanning the monitored spectrum
- **Time Dimension:** Discrete time slots for scanning decisions

#### State Space

```python
# State representation for the scheduler
state = {
    "current_band": int,           # Current frequency band index
    "time_slot": int,              # Current time step
    "detection_history": Tensor,   # Recent detection outcomes [lookback window]
    "band_activity": Tensor,       # Activity levels per band [n_bands]
    "emitter_predictions": Tensor, # Predicted emitter presence [n_bands]
    "scan_priority": Tensor,       # Computed priority scores [n_bands]
}
```

#### Action Space

```python
# Action: select next frequency band to scan
action = {
    "next_band": int,              # Band index to scan next
    "dwell_time": float,           # Optional: time to spend on band
    "confidence": float,           # Prediction confidence (for adaptive dwell)
}
```

#### Reward Function

```python
reward = (
    w1 * detection_reward +        # Bonus for detecting active emitter
    w2 * threat_priority_reward +   # Bonus for detecting high-priority emitter
    w3 * time_penalty +             # Penalty for time elapsed
    w4 * false_alarm_penalty +      # Penalty for scanning empty bands
    w5 * revisit_bonus              # Bonus for optimal revisit timing
)
```

### Machine Learning Architecture

#### Recommended Approaches

1. **Deep Q-Network (DQN)** - For discrete band selection
   - Experience replay buffer
   - Target network with periodic updates
   - Epsilon-greedy exploration with decay

2. **Proximal Policy Optimization (PPO)** - For continuous action spaces
   - Actor-critic architecture
   - Generalized Advantage Estimation (GAE)
   - Clipped surrogate objective

3. **Transformer-based Scheduler** - For sequence modeling
   - Self-attention over detection history
   - Positional encoding for time slots
   - Multi-head attention for parallel band evaluation

4. **Graph Neural Network (GNN)** - For band relationship modeling
   - Nodes: frequency bands
   - Edges: temporal and spectral relationships
   - Message passing for context aggregation

#### Model Input Features

```python
features = {
    # Temporal features
    "time_since_last_scan": Tensor,      # Per-band time since last scan
    "scan_frequency": Tensor,            # Historical scan rate per band
    "detection_recency": Tensor,         # Time since last detection per band
    
    # Spectral features
    "band_activity_rate": Tensor,        # Historical activity probability
    "emitter_type_distribution": Tensor, # Predicted emitter types per band
    "frequency_agility_score": Tensor,   # Measure of frequency hopping
    
    # Contextual features
    "total_emitters_detected": int,      # Count of unique emitters found
    "threat_level_estimate": float,      # Current threat assessment
    "scan_coverage": float,              # Percentage of spectrum recently scanned
    
    # History features
    "detection_history_window": Tensor,  # Last N detection outcomes
    "reward_history_window": Tensor,     # Last N reward values
}
```

### Training Pipeline

1. **Data Loading**
   - Load HDF5 configuration files
   - Extract pulse sequences and emitter ground truth
   - Split into train/val/test (already provided in `scan/`)

2. **Environment Simulation**
   - Initialize RF environment from config
   - Simulate emitter transmissions per time step
   - Model receiver sweep dynamics

3. **Training Loop**
   - Collect experience through simulation episodes
   - Store transitions in replay buffer
   - Update model using selected algorithm
   - Log metrics and save checkpoints

4. **Evaluation**
   - Run trained model on validation configs
   - Compute all performance metrics
   - Compare against baseline strategies
   - Generate analysis reports

### Baseline Strategies for Comparison

1. **Sequential Scan** - Linear sweep across all bands
2. **Random Scan** - Random band selection
3. **Priority-based Scan** - Static priority from pre-mission data
4. **Adaptive Scan** - Heuristic-based adaptation (no ML)

### Evaluation Protocol

```python
# Evaluation criteria
evaluation = {
    "interception_ratio": float,      # Target: > 0.85
    "mean_intercept_time": float,     # Target: < 2.0x optimal
    "detection_probability": float,   # Target: > 0.90
    "false_alarm_rate": float,        # Target: < 0.05
    "adaptation_speed": float,        # Time to adapt to new emitter
    "computational_cost": float,      # Inference time per decision
}
```

### Testing Requirements

- **Unit Tests:** All data processing, model components, and utility functions
- **Integration Tests:** Full training and evaluation pipeline
- **Performance Tests:** Model inference latency and memory usage
- **Edge Cases:** Empty spectrum, maximum emitter density, frequency-hopping emitters

### Configuration Management

Use YAML files for all experiment configurations:

```yaml
# configs/default.yaml
data:
  train_path: "scan/train_scan"
  val_path: "scan/val_scan"
  test_path: "scan/test_scan"
  
simulation:
  n_bands: 100
  time_slots: 1000
  receiver_sensitivity: -90.0  # dBm
  
model:
  architecture: "dqn"
  hidden_dim: 256
  n_layers: 3
  learning_rate: 0.0003
  gamma: 0.99
  epsilon_start: 1.0
  epsilon_end: 0.01
  epsilon_decay: 0.995
  
training:
  batch_size: 64
  replay_buffer_size: 100000
  target_update_freq: 100
  max_episodes: 5000
  eval_interval: 100
```

---

## Common Commands

### Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Or with conda
conda env create -f environment.yml
conda activate ew-scheduler
```

### Training
```bash
# Train with default config
python scripts/train.py --config configs/default.yaml

# Train with custom experiment
python scripts/train.py --config configs/experiments/transformer_v1.yaml

# Resume from checkpoint
python scripts/train.py --resume checkpoints/model_best.pt
```

### Evaluation
```bash
# Evaluate on validation set
python scripts/evaluate.py --checkpoint checkpoints/model_best.pt --split val

# Evaluate on test set
python scripts/evaluate.py --checkpoint checkpoints/model_best.pt --split test

# Generate comparison report
python scripts/evaluate.py --compare --baselines sequential,random,priority
```

### Simulation
```bash
# Run single configuration simulation
python scripts/simulate.py --config scan/val_scan/config_0.h5

# Run batch simulation
python scripts/simulate.py --batch scan/val_scan/
```

### Testing
```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=src --cov-report=html

# Run specific test module
pytest tests/test_models.py -v
```

### Code Quality
```bash
# Format code
black src/ tests/ scripts/

# Sort imports
isort src/ tests/ scripts/

# Type checking
mypy src/

# Linting
flake8 src/ tests/
```

---

## Emitter Behavior Models

### Emitter Types

1. **Fixed-Frequency Emitter** - Continuous transmission on single frequency
2. **Pulse-Repetition Frequency (PRF) Agile** - Varies pulse timing
3. **Frequency-Hopping** - Rapidly changes frequency according to pattern
4. **Spatially Scanning** - Rotating antenna with dwell time per direction
5. **Random Access** - unpredictable transmission patterns

### Signal Parameters

```python
emitter_params = {
    "center_freq": float,        # Center frequency (MHz)
    "bandwidth": float,          # Signal bandwidth (MHz)
    "pulse_width": float,        # Pulse duration (microseconds)
    "prf": float,                # Pulse repetition frequency (Hz)
    "scan_rate": float,          # Antenna scan rate (RPM)
    "dwell_time": float,         # Time on frequency (ms)
    "hop_rate": float,           # Frequency hop rate (hops/sec)
    "duty_cycle": float,         # Transmission duty cycle
    "peak_power": float,         # Peak transmitted power (dBm)
    "threat_level": int,         # 1-5 threat priority
}
```

---

## Performance Optimization

### Computational Considerations

- **Inference Time:** Scheduler decision must be made within scan dwell time
- **Memory Usage:** Model must fit within embedded system constraints
- **Batch Processing:** Use vectorized operations for parallel band evaluation

### Model Compression

- **Quantization:** INT8 inference for edge deployment
- **Pruning:** Remove redundant connections
- **Knowledge Distillation:** Train smaller model from larger teacher

---

## Security and Classification

- **Classification:** Handle all RF environment data as potentially sensitive
- **Access Control:** Restrict repository access to authorized personnel
- **Data Handling:** Never commit real-world signal intelligence data
- **Simulation Only:** All training data is simulated, not operational

---

## Version Control

### Branch Strategy

- `main` - Stable, tested code
- `develop` - Integration branch for features
- `feature/*` - Individual feature development
- `experiment/*` - Experimental model architectures
- `hotfix/*` - Critical bug fixes

### Commit Messages

Follow conventional commits:
```
feat: add transformer-based scheduler model
fix: correct reward calculation in simulation
docs: update AGENTS.md with new metrics
test: add unit tests for data loading
perf: optimize inference pipeline
```

---

## References

- Adaptive radar/EW scan strategies literature
- Reinforcement learning for resource allocation
- Electronic Support Measures (ESM) fundamentals
- Frequency-agile emitter modeling techniques
