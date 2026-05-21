# Kira Milestones

## Finished App Definition
SolverLink SFFA is a rapid structural model preparation and solver handoff app. It should let SFFA build a regular RC frame, calculate preliminary gravity load paths, visualize tributary areas and base reactions, validate model safety, then export a clean STAAD starter model for final engineering analysis and design.

It is not the final structural design authority. STAAD/RCDC/manual engineering review remains the authority.

## Milestone 0 - Repo Stabilization
- Confirm `index.html` runs through a local static server.
- Confirm `engine/loads.js` and `engine/tributary.js` load.
- Confirm startup error reporting is visible.
- Confirm no initialization console errors.
- Confirm `Run Analysis` works from default state.

Done when the default model appears and analysis completes without crashing.

## Milestone 1 - SFFA Golden Baseline
- `xSpans`: `[4, 4]`
- `ySpans`: `[5, 5]`
- Floors: `2F + RF`
- `gfSuspended`: `false`
- Typical slab: `150 mm`
- Roof slab: `120 mm`
- Typical wall load: `6.0 kN/m`
- Roof wall load: `0`
- Typical live load: `1.9` or `2.0 kPa`
- Roof live load: `1.0 kPa`

Done when every reload produces the same geometry and reaction totals.

## Milestone 2 - Geometry Truth
- Validate grid coordinates.
- Validate column locations.
- Validate beam start/end columns.
- Validate floor elevations.
- Confirm no ghost beams, orphan nodes, or missing supports.
- Confirm GF suspended logic is correct.

Done when the app can state that the frame geometry is solver-safe.

## Milestone 3 - Load Path Truth
- Enforce the doctrine: slab to beams to columns to supports.
- Confirm slab areas, floor loads, beam tributary widths, line loads, beam reactions, and cumulative column reactions.
- Confirm total applied gravity load approximately equals total base reactions.

Done when each major load has an auditable source.

## Milestone 4 - MVP Views
- Layout
- Reactions
- Tributary Slabs
- Tributary Beams
- Tributary Columns
- Column Schedule
- Beam Schedule
- Slab Schedule
- Validate

Done when each view opens, matches the schedule data, and does not crash.

## Milestone 5 - Validation Gate
- Block invalid spans, invalid heights, missing members, unresolved topology, cantilevers, unsupported custom beams, and unsafe deleted-member states.
- Use `PASS`, `WARNING`, and `BLOCKED` statuses.

Done when STAAD export cannot run on a blocked model.

## Milestone 6 - STAAD Export MVP
- Export regular grid columns.
- Export regular grid beams.
- Export floor elevations, supports, material/property placeholders, and safe gravity loads.
- Do not export custom beams, cantilevers, stair beams, or slab openings as solver topology.

Done when STAAD can open the file without broken incidences or missing nodes.

## Milestone 7 - SFFA Handoff Package
- Project summary
- Grid dimensions
- Floor data
- Member counts
- Column, beam, and slab schedules
- Base reactions
- Validation report
- STAAD export file
- Limitations note

Done when the output can be handed to an SFFA engineer for solver review.

## Milestone 8 - Save and Load
- Save `.fstr`.
- Load `.fstr`.
- Preserve spans, floors, loads, member sizes, deleted/toggled members, and relevant validation state.

Done when a saved project reopens with matching model data.

## Milestone 9 - Controlled Expansion
- Column-to-column custom beams
- Simple cantilever doctrine
- Stair beam support logic
- Slab openings as deduction-only
- Wall load object editor
- Point load editor
- DXF export
- ETABS export
- PDF report

Done only when each expansion has validation rules before export.
