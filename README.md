<div align="center">
  <h1>SolverLink</h1>
  <p><strong>A Web-Based Lean Structural Modeler for Rapid Handoff</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Status-Active-success.svg" alt="Status">
    <img src="https://img.shields.io/badge/Architecture-Client_JS_Modules-blue.svg" alt="Architecture">
    <img src="https://img.shields.io/badge/Stack-Vanilla_JS_|_Canvas_|_Three.js-orange.svg" alt="Stack">
  </p>
</div>

---

## 📖 Overview
**SolverLink** is an engineering-focused, browser-based structural modeling application designed to bridge the gap between initial conceptual layouts and heavy finite element analysis (FEA). 

Instead of jumping straight into complex solvers with full design parameters, SolverLink provides a lean, rapid environment to establish grid spans, define 3D frame geometry, distribute gravity loads, and parse tributary areas. It computes cumulative base reactions for up to 10 storeys and validates the model against structural constraints before generating a clean, error-free handoff to industry-standard solvers like STAAD.Pro, ETABS, and SAP2000.

This tool guarantees safe, validated model generation, stripping away the noise of detailed design to focus purely on **Geometry, Loads, and Handoff**.

---

## ✨ Core Features

*   **⚡ Rapid Geometric Modeling:** Define regular, orthogonal RC frames (up to 10 storeys) instantly using grid spans.
*   **📐 Automated Tributary Parsing:** Canvas-based 2D plan views automatically sketch and hatch column tributary areas (corner, edge, interior) with calculated spatial limits.
*   **⬇️ Cumulative Load Takedowns:** Calculates self-weight, beam dead loads, and slab loads, cascading them down to the foundation level.
*   **📊 Industry-Standard Base Reactions:** Generates professional-grade Base Reaction plans featuring support stubs, point loads, and total structural weight summaries.
*   **🛡️ Pre-Export Validation Gate:** Enforces structural integrity rules (preventing ghost members, invalid spans, unsupported nodes) *before* allowing solver export.
*   **💾 Seamless FEA Handoff:** Exports validated nodal coordinates, member incidences, and load combinations directly into STAAD/ETABS formats.

---

## 🛠️ Technical Stack
SolverLink is built for ultimate portability and zero-dependency deployment.
*   **Frontend:** HTML5, Vanilla JavaScript, CSS3
*   **Graphics & Visualization:** 
    *   `THREE.js` for lightweight 3D frame rendering
    *   `Canvas API` for dynamic, AutoCAD-style 2D structural plans
*   **Architecture:** Client-side browser application utilizing local JS engine modules (`engine/loads.js`, `engine/tributary.js`). No backend required.

---

## 🔄 The SolverLink Pipeline
1.  **Define Geometry:** Input X/Y spans and floor heights.
2.  **Assign Loads:** Input Superimposed Dead Loads (SDL) and Live Loads (LL).
3.  **Tributary Analysis:** View automatic beam/slab load distributions.
4.  **Reaction Takedown:** Review cumulative foundation support forces.
5.  **Validate:** Pass the strict internal model integrity gate.
6.  **Export:** Handoff to STAAD.Pro for final structural analysis (ETABS/SAP2000 are experimental).

---

## 🚀 Getting Started
SolverLink is a lean client-side application with local JavaScript engine modules. Run it from a static server so the browser loads `engine/*.js` consistently.

1. Clone the repository:
   ```bash
   git clone https://github.com/michaelfutol/solverlink.git
   ```
2. Serve the folder:
   ```bash
   python -m http.server 8000 --bind 127.0.0.1
   ```
3. Open `http://127.0.0.1:8000`.
4. Start modeling.

## SFFA MVP Definition
SolverLink SFFA MVP is a **regular RC frame generator and STAAD handoff validator**. It is intended to produce a visual model, preliminary tributary/reaction audit, validation report, and STAAD starter file for engineering review. It is not a permit-ready design substitute; the SFFA engineer must verify and complete analysis/design in STAAD/RCDC/manual workflows.

---
*Created as part of an engineering technology portfolio.*
