# SolverLink Development Diary

## 2026-05-16 — Birth & Isolation

### MVP-009: Footing/Foundation Removal
- Stripped all footing/foundation/design/reporting UI from FutolStructure clone
- Applied `non-mvp` CSS class to 28+ hidden tabs
- Gated 3D footing rendering with `isSolverLinkMode` check
- Replaced 3D footings with green support cone markers
- Rebranded header: FutolStructure → SolverLink
- Removed Footing ID column from Column Schedule

### MVP-010: Plan-Based Views
- Converted Beam Tributary, Column Tributary, Base Reactions from schedule-only to canvas-based plan views
- Created `drawPlanGrid()` shared helper
- Created `drawBeamTributaryPlan()` — beam load intensity colors, IDs, reaction arrows
- Created `drawColumnTributaryPlan()` — column markers sized by load, type labels
- Created `drawReactionsPlan()` — support triangles, P labels, solver-pending placeholders

### MVP-010b: Full Isolation
- Moved entire SolverLink to `d:\projects\solverlink\` (independent folder)
- Removed old copy from inside Codex folder `futolStructure 04-14-26`
- Codex folder verified clean — only .claude, .vscode, tributary-pro-v2.0 remain
- Zero contamination risk going forward

### MVP-010c: Column Tributary Area Sketch ✅
- Real structural tributary area drawing with mid-span boundary lines
- Corner/Edge/Interior tributary regions with proper hatching
- Area labels per column (m²)
- Color-coded zones per column with 45° diagonal hatching

### MVP-010d: Industry-Standard Reactions ✅
- Title shows "2 Storey Cumulative" (floor count)
- Column stubs as hatched squares (ANSI31)
- Fixed support triangles with ground hatching below each column
- Red downward arrows proportional to load magnitude
- Annotation boxes per support: P total, per-floor breakdown, column self-weight, Vx/Vy/Mx/My solver placeholders
- REACTION SUMMARY info box: total floors, support count, ΣP, P range
- totalLoad already cumulative: loadPerFloor × numFloors (confirmed in code)
- totalLoadWithDL includes column self-weight when available

