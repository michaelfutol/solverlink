# Solver Truth Rules

SolverLink operates under a strict, immutable engineering doctrine known as the "Solver Truth Rules". This doctrine protects the structural engineer, the client, and the software from liability.

## The Core Doctrine

**"SolverLink is an engineering handoff machine, not a final design substitute."**

SolverLink is branded internally as the **SolverLink SFFA MVP — Regular RC Frame Generator and STAAD Handoff Validator**.

### Rule 1: Visual Modeler First, Not a Calculator
SolverLink's primary function is to accelerate the transition from architectural conceptual layouts into a 3D wireframe / STAAD starter model. It calculates preliminary loads to audit the geometry, but it is **not** producing permit-ready structural calculations.

### Rule 2: STAAD is the Absolute Truth
Final engineering truth is deferred entirely to STAAD.Pro (or ETABS). SolverLink will generate nodes, members, incidences, and apply preliminary tributary loads. However, the final structural analysis (deflection, P-Delta, dynamic wind/seismic forces, and rigorous reinforcement design) happens inside the heavy FEA solver.

### Rule 3: Do No Harm (The Export Gate)
SolverLink must aggressively refuse to export unsafe, mathematically ambiguous, or unsupported topologies. It must validate spans, detect ghost elements, and enforce support definitions before generating the `.std` file. 

### Rule 4: The SFFA Workflow
1. **Input:** Regular villa / small building grids.
2. **Output:** Visual model + tributary/reaction audit + STAAD starter model.
3. **Engineer Role:** The SFFA engineer must still review, modify, analyze, and design the structure using STAAD, RCDC, Excel, and manual checks.
