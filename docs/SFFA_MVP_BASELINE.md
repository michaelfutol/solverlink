# SFFA MVP Baseline

To ensure stability and engineering accuracy, the SolverLink SFFA MVP is continuously tested against this "golden baseline". If the application cannot correctly model and export this exact baseline without errors or console warnings, the build is considered **failing** and must be reverted.

## The Golden Baseline
- **Geometry:**
  - `xSpans`: [4, 4]
  - `ySpans`: [5, 5]
  - `floors`: 2F + RF (2 Storeys + Roof)
  - `gfSuspended`: false
- **Section Properties:**
  - `slabThickness`: 150mm typical, 120mm roof
- **Loads:**
  - `wallLoad`: 6.0 kN/m typical, 0 roof
  - `liveLoad`: 1.9 or 2.0 kPa typical, 1.0 kPa roof

## Required Outcomes
1. `index.html` loads cleanly with zero console initialization errors.
2. The `engine/loads.js` and `engine/tributary.js` modules are loaded successfully.
3. `calculate()` runs perfectly from the default state without hanging.
4. Columns, Beams, and Slabs arrays populate accurately.
5. Layout, Reactions, Slab Tributary, Beam Tributary, Column Tributary, and Validation tabs open without crashing.
6. The Export module generates a safe, mathematically coherent `.std` file matching the baseline geometry.
