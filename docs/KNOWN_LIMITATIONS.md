# Known Limitations

SolverLink is currently restricted to regular, orthogonal reinforced concrete frames. To ensure the integrity of the STAAD handoff, the following limitations are enforced. Attempting to bypass these limitations may result in blocked exports or corrupted FEA files.

### 1. Unsupported Geometry
- **Custom Beams:** Custom beams are not exported unless both of their endpoints mathematically resolve to defined column nodes/joints.
- **Cantilever Slabs / Beams:** Advanced cantilevers are currently flagged or blocked until the formal cantilever load distribution doctrine is finalized in the internal engine.
- **Stair Beams:** Stair geometry is highly complex and acts as a diaphragm/strut. Stair models are not exported to STAAD; they should be modeled manually by the engineer inside the solver.
- **Slab Openings:** Openings are evaluated solely for load deductions/area deductions. Their complex localized stress effects around the opening perimeter are not calculated and will not be exported as meshed voids.

### 2. Experimental Solvers
- **STAAD.Pro:** This is the baseline, supported export target.
- **ETABS / SAP2000:** Export to CSI products (ETABS/SAP) is considered highly **experimental** and is currently not supported for production SFFA workloads. The engineer assumes all risk when using these export functions.
