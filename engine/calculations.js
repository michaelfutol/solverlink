        // ========== CORE CALCULATIONS ==========

        /**
         * Main calculation function
         * Implements: SLAB -> BEAMS -> COLUMNS load path
         * v2.3: Calculates per-floor and cumulative across floors
         */
        function calculate() {
            // Clean spans to avoid zero / negative values
            state.xSpans = state.xSpans.map(span => sanitizeSpan(span));
            state.ySpans = state.ySpans.map(span => sanitizeSpan(span));

            // Step 1: Generate grid coordinates
            generateGrid();

            // Step 2: Generate slab panels (MOVED inside loop for per-floor logic)
            // generateSlabs();

            // Reset cumulative column loads
            for (let col of state.columns) {
                col.loadPerFloor = 0;
                col.totalLoad = 0;
                col.floorLoads = [];
            }

            // v2.3: Calculate loads for each floor
            let totalPuSum = 0;
            for (let floor of state.floors) {
                // v2.6: Skip GF if not suspended (ground-bearing slab)
                if (floor.id === 'GF' && !state.gfSuspended) {
                    // Store 0 load for GF to keep array consistent
                    for (let col of state.columns) {
                        col.floorLoads.push({ floorId: floor.id, load: 0 });
                    }
                    continue;
                }

                // Calculate factored load for this floor
                const slabWeight = 24 * (floor.slabThickness / 1000); // kN/m² = kPa
                const pu = 1.2 * (floor.dlSuper + slabWeight) + 1.6 * floor.liveLoad;
                const wallLoad = floor.wallLoad || 0;  // v3.0: Wall load (kN/m)
                totalPuSum += pu;

                // v3.17: Generate slabs and beams for THIS floor
                // Cantilevers are now resolved per-floor inside generateSlabs/generateBeams
                // (no more temporary global state.cantilevers swap)
                generateSlabs(floor.id);
                generateBeams(pu, wallLoad, floor);

                // v3.0: Size beams immediately to establish self-weight for this floor
                sizeMembers();

                // Calculate beam reactions
                calculateBeamReactions();

                // Step 6: Add reactions to columns for this floor
                calculateColumnLoadsForFloor(floor.id);
            }

            // Average pu for display (or use current floor's pu)
            const currentFloor = state.floors[state.currentFloorIndex];
            const currentSlabWeight = 24 * (currentFloor.slabThickness / 1000);
            const puDisplay = 1.2 * (currentFloor.dlSuper + currentSlabWeight) + 1.6 * currentFloor.liveLoad;

            // v2.5: Read footing parameters (with fallbacks for removed UI elements)
            state.footingDepth = parseFloat(document.getElementById('footingDepth')?.value) || 1.5;
            state.soilBearing = parseFloat(document.getElementById('soilBearing')?.value) || 150;  // v3.10: Default 150kPa if element removed

            // v3.0: Size all columns and beams FIRST (needed for self-weight calc)
            sizeMembers();

            // v3.0: Calculate footing sizes (includes column/beam/tie beam DL)
            calculateFootingSizes();

            // Update UI
            updateResults(puDisplay);

            // v3.17: Final regeneration for display (Current Floor)
            // Cantilevers resolved per-floor inside generateSlabs/generateBeams
            generateSlabs(currentFloor.id);
            generateBeams(puDisplay, currentFloor.wallLoad || 0, currentFloor); // Use display PU

            draw();

            // v3.0: Update concrete volume summary
            // updateConcreteVolume();

            // v3.16: Update professional status bar
            updateStatusBar();

            // Keep 3D in sync with 2D changes and recalculation state
            if (typeof render3DFrame === 'function' && view3DInitialized) {
                render3DFrame();
            }

            // v3.17: Capture snapshot for regression checking (temporary extraction scaffold)
            if (window._captureSnapshot) {
                window._lastSnapshot = dumpStateSnapshot();
            }
        }

        /**
         * v3.17: Reference snapshot for extraction regression checking
         * Captures calculation-relevant state fields for before/after comparison.
         * Enable with: window._captureSnapshot = true
         * Read with: console.log(JSON.stringify(window._lastSnapshot, null, 2))
         */
        function dumpStateSnapshot() {
            return {
                columns: state.columns.map(c => ({
                    id: c.id, active: c.active, totalLoad: +(c.totalLoad || 0).toFixed(4),
                    suggestedB: c.suggestedB, suggestedH: c.suggestedH,
                    selfWeight: +(c.selfWeight || 0).toFixed(4),
                    footingSize: +(c.footingSize || 0).toFixed(4),
                    footingThick: +(c.footingThick || 0).toFixed(4),
                    floorLoads: (c.floorLoads || []).map(fl => ({
                        floorId: fl.floorId, load: +fl.load.toFixed(4)
                    }))
                })),
                beams: state.beams.map(b => ({
                    id: b.id, w: +b.w.toFixed(4),
                    Rleft: +b.Rleft.toFixed(4), Rright: +b.Rright.toFixed(4),
                    tributaryArea: +b.tributaryArea.toFixed(4),
                    suggestedB: b.suggestedB, suggestedH: b.suggestedH,
                    selfWeight: +(b.selfWeight || 0).toFixed(4)
                })),
                slabs: state.slabs.map(s => ({
                    id: s.id, area: +s.area.toFixed(4),
                    isVoid: !!s.isVoid, isTwoWay: !!s.isTwoWay
                })),
                loadGovernance: collectLoadGovernanceSummary(),
                tieBeamW: state.tieBeamW,
                tieBeamH: state.tieBeamH,
                totalColumnSelfWeight: +(state.totalColumnSelfWeight || 0).toFixed(4),
                totalBeamSelfWeight: +(state.totalBeamSelfWeight || 0).toFixed(4)
            };
        }

        /**
         * v3.16: Update professional status bar with current project info
         */
        function updateStatusBar() {
            const indicator = document.getElementById('statusIndicator');
            const statusText = document.getElementById('statusText');
            const statusGrid = document.getElementById('statusGrid');
            const statusFloors = document.getElementById('statusFloors');
            const statusMembers = document.getElementById('statusMembers');

            if (indicator) indicator.style.background = 'var(--success)';
            if (statusText) statusText.textContent = 'Analysis Complete';

            if (statusGrid) {
                statusGrid.textContent = state.xSpans.length + 'x' + state.ySpans.length;
            }

            if (statusFloors) {
                statusFloors.textContent = state.floors.length;
            }

            if (statusMembers) {
                const nCols = state.columns ? state.columns.filter(c => c.active !== false).length : 0;
                const nBeams = state.beams ? state.beams.length : 0;
                const nSlabs = state.slabs ? state.slabs.length : 0;
                statusMembers.textContent = nCols + 'C / ' + nBeams + 'B / ' + nSlabs + 'S';
            }

            // Auto-clear status after 5 seconds
            setTimeout(() => {
                if (statusText) statusText.textContent = 'Ready';
            }, 5000);
        }

        /**
         * v3.0: Calculate footing sizes based on total column load
         * Now includes: slab loads + beam DL + column DL + tie beam DL
         * Simple formula: A_req = P / q_allow
         */
        function calculateFootingSizes() {
            const result = EngineLoads.calculateFootingSizes(state.columns, getLoadParams());
            state.tieBeamW = result.tieBeamW;
            state.tieBeamH = result.tieBeamH;
            state.tieBeamWidth = Math.round(state.tieBeamW * 1000);
            state.tieBeamDepth = Math.round(state.tieBeamH * 1000);
            const tieBeamWidthInput = document.getElementById('tieBeamWidth');
            const tieBeamDepthInput = document.getElementById('tieBeamDepth');
            if (tieBeamWidthInput) tieBeamWidthInput.value = state.tieBeamWidth;
            if (tieBeamDepthInput) tieBeamDepthInput.value = state.tieBeamDepth;

            // designAllFootings();
            console.log(`v3.0: Self-weight included - Column DL + Tie beam DL added to footings`);
            console.log(`v3.0: Tie beam sizing - ${(state.tieBeamW * 1000).toFixed(0)}×${(state.tieBeamH * 1000).toFixed(0)}mm`);
        }

        // isFloorAtOrAbove defined earlier (line ~4135)

        /**
         * Calculate column loads for a specific floor
         * v3.0: Includes beam reactions AND beam self-weight DL
         * v3.0: Skip planted columns for floors below their startFloor
         * v3.0: Skip columns that are not active on this specific floor
         */
        function calculateColumnLoadsForFloor(floorId) {
            EngineLoads.calculateColumnLoadsForFloor(state.columns, state.beams, state.floors, floorId);
        }

        /**
         * Step 1: Generate grid from spans
         * Creates absolute coordinates for column positions
         */
        function generateGrid() {
            // Build X coordinates
            const xCoords = [0];
            for (let span of state.xSpans) {
                xCoords.push(xCoords[xCoords.length - 1] + span);
            }

            // Build Y coordinates
            const yCoords = [0];
            for (let span of state.ySpans) {
                yCoords.push(yCoords[yCoords.length - 1] + span);
            }

            // Generate columns at intersections
            // v2.7: Preserve active state from existing columns
            const oldColumns = state.columns || [];

            // v3.0: Preserve custom-placed planted columns (not at grid intersections)
            const plantedColumns = oldColumns.filter(c => c.isPlanted === true);

            state.columns = [];
            const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Skip I and O

            for (let yi = 0; yi < yCoords.length; yi++) {
                for (let xi = 0; xi < xCoords.length; xi++) {
                    const id = `${letters[xi]}${yi + 1}`;

                    // Determine column type
                    const isCorner = (xi === 0 || xi === xCoords.length - 1) &&
                        (yi === 0 || yi === yCoords.length - 1);
                    const isEdge = !isCorner && (xi === 0 || xi === xCoords.length - 1 ||
                        yi === 0 || yi === yCoords.length - 1);

                    let type = 'interior';
                    if (isCorner) type = 'corner';
                    else if (isEdge) type = 'edge';

                    // v2.7: Check if this column existed before and preserve its active state
                    const oldCol = oldColumns.find(c => c.id === id);
                    const isActive = oldCol ? oldCol.active : true;  // Preserve or default true
                    const startFloor = oldCol?.startFloor || null;   // v3.0: Preserve planted column state
                    const activePerFloor = oldCol?.activePerFloor || null;  // v3.0: Preserve per-floor toggle state
                    const typePerFloor = oldCol?.typePerFloor || null;  // v3.0: Preserve per-floor TYPE state
                    const floorActive = oldCol?.floorActive || null;  // v3.0: Preserve per-floor active state
                    const manualB = oldCol?.webB || oldCol?.overrideB || (oldCol?.isOverride ? oldCol?.b : null);
                    const manualH = oldCol?.webD || oldCol?.overrideH || (oldCol?.isOverride ? oldCol?.h : null);

                    state.columns.push({
                        id,
                        x: xCoords[xi],
                        y: yCoords[yi],
                        xi, yi,
                        type,
                        active: isActive,  // v2.7: Preserved toggle state for L/U shapes
                        startFloor: startFloor,  // v3.0: For planted columns (null = from ground)
                        activePerFloor: activePerFloor,  // v3.0: Per-floor toggle state
                        typePerFloor: typePerFloor,  // v3.0: Per-floor type (corner/edge/interior)
                        floorActive: floorActive,    // v3.0: Per-floor active state
                        webB: manualB,
                        webD: manualH,
                        overrideB: manualB,
                        overrideH: manualH,
                        b: manualB,
                        h: manualH,
                        loadPerFloor: 0,
                        totalLoad: 0,
                        connectedBeams: [] // Will store beam IDs
                    });
                }
            }

            // v3.0: Re-add planted columns that were placed on beams (not at grid intersections)
            for (const pc of plantedColumns) {
                // Check if this planted column already exists (by position)
                const exists = state.columns.find(c =>
                    Math.abs(c.x - pc.x) < 0.1 && Math.abs(c.y - pc.y) < 0.1
                );
                if (!exists) {
                    // Preserve the planted column with all its properties
                    state.columns.push({
                        ...pc,
                        loadPerFloor: 0,
                        totalLoad: 0
                    });
                    console.log(`v3.0: Preserved planted column ${pc.id} at (${pc.x.toFixed(2)}, ${pc.y.toFixed(2)})`);
                }
            }
        }

        /**
         * Step 2: Generate slab panels
         */
        // v2.7: Helper to get column by grid indices
        function getColumnAt(xi, yi) {
            return state.columns.find(c => c.xi === xi && c.yi === yi);
        }

        /**
         * Step 2: Generate slab panels
         * v3.0: Now accepts floorId to distinct cantilevers
         */
        function generateSlabs(floorId) {
            // v3.0: Preserve existing opening data
            const oldSlabs = state.slabs || [];

            // v3.0: Get per-floor void slabs (FIXED: ensure each floor has its own array)
            const floor = floorId ? state.floors.find(f => f.id === floorId) : state.floors[state.currentFloorIndex];
            if (floor && !floor.voidSlabs) floor.voidSlabs = [];  // Initialize per-floor array
            if (floor && !floor.slabOpenings) floor.slabOpenings = [];
            const floorVoidSlabs = floor ? floor.voidSlabs : [];  // Use per-floor, never fallback to global
            const floorSlabOpeningMap = new Map((floor?.slabOpenings || []).map(opening => [opening.id, opening]));
            const oldSlabOpeningMap = new Map(oldSlabs
                .filter(slab => slab && (slab.openingW || slab.openingH))
                .map(slab => [slab.id, slab]));

            state.slabs = [];
            const xCoords = [0];
            for (let span of state.xSpans) xCoords.push(xCoords[xCoords.length - 1] + span);
            const yCoords = [0];
            for (let span of state.ySpans) yCoords.push(yCoords[yCoords.length - 1] + span);

            for (let yi = 0; yi < state.ySpans.length; yi++) {
                for (let xi = 0; xi < state.xSpans.length; xi++) {
                    // v3.0 FIX: ALWAYS generate all slabs regardless of column state
                    // This prevents cascade deletion when column is toggled

                    const lx = state.xSpans[xi];
                    const ly = state.ySpans[yi];
                    const mainSlabId = `S${yi * state.xSpans.length + xi + 1}`;
                    const x1 = xCoords[xi];
                    const x2 = xCoords[xi + 1];
                    const y1 = yCoords[yi];
                    const y2 = yCoords[yi + 1];

                    // v3.0: Find custom beams that cross this panel
                    const crossingX = [x1, x2];
                    const crossingY = [y1, y2];

                    const floorCustomBeams = floor?.customBeams || [];
                    for (const cb of floorCustomBeams) {
                        // v3.0 FIX: dir='X' means horizontal beam (constant Y), splits Y range
                        // dir='Y' means vertical beam (constant X), splits X range
                        if (cb.dir === 'X' && cb.pos > y1 && cb.pos < y2) {
                            // Horizontal beam at Y=cb.pos splits the Y range
                            if (cb.start < x2 && cb.end > x1) crossingY.push(cb.pos);
                        } else if (cb.dir === 'Y' && cb.pos > x1 && cb.pos < x2) {
                            // Vertical beam at X=cb.pos splits the X range
                            if (cb.start < y2 && cb.end > y1) crossingX.push(cb.pos);
                        }
                    }

                    // Sort unique coordinates
                    const sortedX = [...new Set(crossingX)].sort((a, b) => a - b);
                    const sortedY = [...new Set(crossingY)].sort((a, b) => a - b);

                    // Generate sub-slabs
                    for (let sy = 0; sy < sortedY.length - 1; sy++) {
                        for (let sx = 0; sx < sortedX.length - 1; sx++) {
                            const sx1 = sortedX[sx];
                            const sx2 = sortedX[sx + 1];
                            const sy1 = sortedY[sy];
                            const sy2 = sortedY[sy + 1];
                            const slx = sx2 - sx1;
                            const sly = sy2 - sy1;
                            const subId = (sortedX.length > 2 || sortedY.length > 2)
                                ? `${mainSlabId}_${sx}_${sy}`
                                : mainSlabId;

                            const ratio = Math.max(slx, sly) / Math.min(slx, sly);
                            const isTwoWay = ratio < 2;

                            // Void state from floor's voidSlabs array
                            const isVoid = floorVoidSlabs.includes(subId);

                            state.slabs.push({
                                id: subId,
                                parentId: mainSlabId,
                                x1: sx1, y1: sy1, x2: sx2, y2: sy2,
                                lx: slx, ly: sly,
                                area: slx * sly,
                                isTwoWay,
                                xi, yi, // Grid indices of the parent
                                sx, sy, // Sub-indices
                                isVoid: isVoid
                            });
                        }
                    }
                }
            }

            // v3.0 FIX: Ghost cleanup - remove orphaned voidSlabs references
            // When spans change, slab IDs change and old voidSlabs refs become orphans
            if (floor && floor.voidSlabs && floor.voidSlabs.length > 0) {
                const validSlabIds = state.slabs.map(s => s.id);
                const orphans = floor.voidSlabs.filter(id => !validSlabIds.includes(id));
                if (orphans.length > 0) {
                    orphans.forEach(orphanId => {
                        const idx = floor.voidSlabs.indexOf(orphanId);
                        if (idx >= 0) floor.voidSlabs.splice(idx, 1);
                    });
                    console.log(`v3.0: Cleaned ${orphans.length} orphaned voidSlabs on floor ${floor.id}:`, orphans);
                }
            }

            // v3.0: Generate cantilever slabs (specific to floor if provided)
            generateCantileverSlabs(xCoords, yCoords, floorId);

            let totalOpeningArea = 0;
            state.slabs.forEach(slab => {
                const opening = floorSlabOpeningMap.get(slab.id) || oldSlabOpeningMap.get(slab.id);
                if (opening) {
                    slab.openingW = Math.min(Math.max(0, Number(opening.openingW || 0)), slab.lx * 0.9);
                    slab.openingH = Math.min(Math.max(0, Number(opening.openingH || 0)), slab.ly * 0.9);
                }
                const openingArea = (slab.openingW || 0) * (slab.openingH || 0);
                slab.netArea = Math.max(0, slab.area - openingArea);
                totalOpeningArea += openingArea;
            });
            state.totalOpeningArea = totalOpeningArea;
        }

        // v3.0 FIX: Helper to get effective cantilevers for a floor
        // Now returns per-floor cantilevers ONLY, never falls back to global
        function getCantilevers(floorId) {
            const floor = floorId
                ? state.floors.find(f => f.id === floorId)
                : state.floors[state.currentFloorIndex];

            // GF without suspended mode has no cantilevers
            if (floor?.id === 'GF' && !state.gfSuspended) {
                return { top: [], bottom: [], left: [], right: [] };
            }

            // v3.0 FIX: Return floor-specific cantilevers, or empty if none defined
            // This prevents cantilevers from one floor appearing on all floors
            if (floor?.cantilevers) {
                return floor.cantilevers;
            }

            // v3.0 FIX: No floor-specific cantilevers = return zeros (not global!)
            const numX = state.xSpans.length;
            const numY = state.ySpans.length;
            return {
                top: new Array(numX).fill(0),
                bottom: new Array(numX).fill(0),
                left: new Array(numY).fill(0),
                right: new Array(numY).fill(0)
            };
        }

        // v3.0: Generate cantilever slab panels extending beyond the grid
        function generateCantileverSlabs(xCoords, yCoords, floorId) {
            const cants = getCantilevers(floorId);

            // v3.0: Get per-floor void slabs for cantilevers too
            const currentFloor = state.floors.find(f => f.id === floorId);
            const floorVoidSlabs = currentFloor?.voidSlabs || [];

            // Top cantilevers (above first row, yi = 0)
            for (let xi = 0; xi < state.xSpans.length; xi++) {

                const cantLen = cants.top[xi] || 0;
                if (cantLen > 0) {
                    const spanWidth = state.xSpans[xi];
                    state.slabs.push({
                        id: `SC-T${xi + 1}`,
                        x1: xCoords[xi],
                        y1: -cantLen,  // Extends above grid (negative Y)
                        x2: xCoords[xi + 1],
                        y2: 0,
                        lx: spanWidth,
                        ly: cantLen,
                        area: spanWidth * cantLen,
                        isCantilever: true,
                        cantileverEdge: 'top',
                        spanIndex: xi,
                        supportingBeamId: `BX-1-${xi + 1}`,  // Top edge beam
                        isVoid: floorVoidSlabs.includes(`SC-T${xi + 1}`)
                    });
                }
            }

            // Bottom cantilevers (below last row)
            const maxY = yCoords[yCoords.length - 1];
            const lastYi = state.ySpans.length;  // Last beam row index
            for (let xi = 0; xi < state.xSpans.length; xi++) {
                const cantLen = cants.bottom[xi] || 0;
                if (cantLen > 0) {
                    const spanWidth = state.xSpans[xi];
                    state.slabs.push({
                        id: `SC-B${xi + 1}`,
                        x1: xCoords[xi],
                        y1: maxY,
                        x2: xCoords[xi + 1],
                        y2: maxY + cantLen,  // Extends below grid
                        lx: spanWidth,
                        ly: cantLen,
                        area: spanWidth * cantLen,
                        isCantilever: true,
                        cantileverEdge: 'bottom',
                        spanIndex: xi,
                        supportingBeamId: `BX-${lastYi + 1}-${xi + 1}`,  // Bottom edge beam
                        isVoid: floorVoidSlabs.includes(`SC-B${xi + 1}`)
                    });
                }
            }

            // Left cantilevers (left of first column, xi = 0)
            for (let yi = 0; yi < state.ySpans.length; yi++) {
                const cantLen = cants.left[yi] || 0;
                if (cantLen > 0) {
                    const spanHeight = state.ySpans[yi];
                    state.slabs.push({
                        id: `SC-L${yi + 1}`,
                        x1: -cantLen,  // Extends left of grid (negative X)
                        y1: yCoords[yi],
                        x2: 0,
                        y2: yCoords[yi + 1],
                        lx: cantLen,
                        ly: spanHeight,
                        area: cantLen * spanHeight,
                        isCantilever: true,
                        cantileverEdge: 'left',
                        spanIndex: yi,
                        supportingBeamId: `BY-1-${yi + 1}`,  // Left edge beam
                        isVoid: floorVoidSlabs.includes(`SC-L${yi + 1}`)
                    });
                }
            }

            // Right cantilevers (right of last column)
            const maxX = xCoords[xCoords.length - 1];
            const lastXi = state.xSpans.length;  // Last beam column index
            for (let yi = 0; yi < state.ySpans.length; yi++) {
                const cantLen = cants.right[yi] || 0;
                if (cantLen > 0) {
                    const spanHeight = state.ySpans[yi];
                    state.slabs.push({
                        id: `SC-R${yi + 1}`,
                        x1: maxX,
                        y1: yCoords[yi],
                        x2: maxX + cantLen,  // Extends right of grid
                        y2: yCoords[yi + 1],
                        lx: cantLen,
                        ly: spanHeight,
                        area: cantLen * spanHeight,
                        isCantilever: true,
                        cantileverEdge: 'right',
                        spanIndex: yi,
                        supportingBeamId: `BY-${lastXi + 1}-${yi + 1}`,  // Right edge beam
                        isVoid: floorVoidSlabs.includes(`SC-R${yi + 1}`)
                    });
                }
            }
        }

        // v3.0: Generate cantilever beams (from columns) and edge beams (at cantilever tips)
        // v3.17: Accept explicit floorCantilevers to avoid global state.cantilevers swap
        function generateCantileverBeams(xCoords, yCoords, letters, floorCantilevers, floorId = null) {
            const cants = floorCantilevers || state.cantilevers;
            const activeFloorId = floorId || state.floors[state.currentFloorIndex]?.id;
            const maxX = xCoords[xCoords.length - 1];
            const maxY = yCoords[yCoords.length - 1];

            // TOP CANTILEVERS: Beams extend from columns at yi=0 upward (negative Y)
            for (let xi = 0; xi <= state.xSpans.length; xi++) {
                // Check if any adjacent span has a top cantilever
                const leftCant = xi > 0 ? (cants.top[xi - 1] || 0) : 0;
                const rightCant = xi < state.xSpans.length ? (cants.top[xi] || 0) : 0;
                const maxCant = Math.max(leftCant, rightCant);

                if (maxCant > 0) {
                    const col = getColumnAt(xi, 0);
                    // v3.0 FIX: Use per-floor check to prevent cascade deletion
                    if (col && isColumnActiveOnFloor(col, activeFloorId)) {
                        // Cantilever beam from column to edge
                        state.beams.push({
                            id: `BCY-T-${xi + 1}`,
                            direction: 'Y',
                            beamType: 'cantilever',
                            isCantilever: true,
                            cantileverEdge: 'top',
                            x1: xCoords[xi],
                            y1: -maxCant,
                            x2: xCoords[xi],
                            y2: 0,
                            span: maxCant,
                            startCol: null,  // Free end
                            endCol: col.id,  // Connected to column
                            tributaryWidth: 0,
                            tributaryArea: 0,
                            slices: [],
                            w: 0,
                            Rleft: 0,
                            Rright: 0
                        });
                    }
                }
            }
            // TOP EDGE BEAM: Runs along the top edge of cantilever
            let topEdgeSegments = [];
            for (let xi = 0; xi < state.xSpans.length; xi++) {
                const cantLen = cants.top[xi] || 0;
                if (cantLen > 0) {
                    topEdgeSegments.push({ xi, cantLen });
                }
            }
            for (let seg of topEdgeSegments) {
                state.beams.push({
                    id: `BEX-T-${seg.xi + 1}`,
                    direction: 'X',
                    beamType: 'cantilever_edge',
                    isEdgeBeam: true,
                    cantileverEdge: 'top',
                    x1: xCoords[seg.xi],
                    y1: -seg.cantLen,
                    x2: xCoords[seg.xi + 1],
                    y2: -seg.cantLen,
                    span: state.xSpans[seg.xi],
                    tributaryWidth: 0,
                    tributaryArea: 0,
                    slices: [],
                    w: 0,
                    Rleft: 0,
                    Rright: 0
                });
            }

            // BOTTOM CANTILEVERS: Beams extend from columns at yi=last downward
            const lastYi = state.ySpans.length;
            for (let xi = 0; xi <= state.xSpans.length; xi++) {
                const leftCant = xi > 0 ? (cants.bottom[xi - 1] || 0) : 0;
                const rightCant = xi < state.xSpans.length ? (cants.bottom[xi] || 0) : 0;
                const maxCant = Math.max(leftCant, rightCant);

                if (maxCant > 0) {
                    const col = getColumnAt(xi, lastYi);
                    // v3.0 FIX: Use per-floor check
                    if (col && isColumnActiveOnFloor(col, activeFloorId)) {
                        state.beams.push({
                            id: `BCY-B-${xi + 1}`,
                            direction: 'Y',
                            beamType: 'cantilever',
                            isCantilever: true,
                            cantileverEdge: 'bottom',
                            x1: xCoords[xi],
                            y1: maxY,
                            x2: xCoords[xi],
                            y2: maxY + maxCant,
                            span: maxCant,
                            startCol: col.id,
                            endCol: null,
                            tributaryWidth: 0,
                            tributaryArea: 0,
                            slices: [],
                            w: 0,
                            Rleft: 0,
                            Rright: 0
                        });
                    }
                }
            }

            // BOTTOM EDGE BEAM
            for (let xi = 0; xi < state.xSpans.length; xi++) {
                const cantLen = cants.bottom[xi] || 0;
                if (cantLen > 0) {
                    state.beams.push({
                        id: `BEX-B-${xi + 1}`,
                        direction: 'X',
                        beamType: 'cantilever_edge',
                        isEdgeBeam: true,
                        cantileverEdge: 'bottom',
                        x1: xCoords[xi],
                        y1: maxY + cantLen,
                        x2: xCoords[xi + 1],
                        y2: maxY + cantLen,
                        span: state.xSpans[xi],
                        tributaryWidth: 0,
                        tributaryArea: 0,
                        slices: [],
                        w: 0,
                        Rleft: 0,
                        Rright: 0
                    });
                }
            }

            // LEFT CANTILEVERS: Beams extend from columns at xi=0 leftward
            for (let yi = 0; yi <= state.ySpans.length; yi++) {
                const topCant = yi > 0 ? (cants.left[yi - 1] || 0) : 0;
                const bottomCant = yi < state.ySpans.length ? (cants.left[yi] || 0) : 0;
                const maxCant = Math.max(topCant, bottomCant);

                if (maxCant > 0) {
                    const col = getColumnAt(0, yi);
                    // v3.0 FIX: Use per-floor check
                    if (col && isColumnActiveOnFloor(col, activeFloorId)) {
                        state.beams.push({
                            id: `BCX-L-${yi + 1}`,
                            direction: 'X',
                            beamType: 'cantilever',
                            isCantilever: true,
                            cantileverEdge: 'left',
                            x1: -maxCant,
                            y1: yCoords[yi],
                            x2: 0,
                            y2: yCoords[yi],
                            span: maxCant,
                            startCol: null,
                            endCol: col.id,
                            tributaryWidth: 0,
                            tributaryArea: 0,
                            slices: [],
                            w: 0,
                            Rleft: 0,
                            Rright: 0
                        });
                    }
                }
            }

            // LEFT EDGE BEAM
            for (let yi = 0; yi < state.ySpans.length; yi++) {
                const cantLen = cants.left[yi] || 0;
                if (cantLen > 0) {
                    state.beams.push({
                        id: `BEY-L-${yi + 1}`,
                        direction: 'Y',
                        beamType: 'cantilever_edge',
                        isEdgeBeam: true,
                        cantileverEdge: 'left',
                        x1: -cantLen,
                        y1: yCoords[yi],
                        x2: -cantLen,
                        y2: yCoords[yi + 1],
                        span: state.ySpans[yi],
                        tributaryWidth: 0,
                        tributaryArea: 0,
                        slices: [],
                        w: 0,
                        Rleft: 0,
                        Rright: 0
                    });
                }
            }

            // RIGHT CANTILEVERS: Beams extend from columns at xi=last rightward
            const lastXi = state.xSpans.length;
            for (let yi = 0; yi <= state.ySpans.length; yi++) {
                const topCant = yi > 0 ? (cants.right[yi - 1] || 0) : 0;
                const bottomCant = yi < state.ySpans.length ? (cants.right[yi] || 0) : 0;
                const maxCant = Math.max(topCant, bottomCant);

                if (maxCant > 0) {
                    const col = getColumnAt(lastXi, yi);
                    // v3.0 FIX: Use per-floor check
                    if (col && isColumnActiveOnFloor(col, activeFloorId)) {
                        state.beams.push({
                            id: `BCX-R-${yi + 1}`,
                            direction: 'X',
                            beamType: 'cantilever',
                            isCantilever: true,
                            cantileverEdge: 'right',
                            x1: maxX,
                            y1: yCoords[yi],
                            x2: maxX + maxCant,
                            y2: yCoords[yi],
                            span: maxCant,
                            startCol: col.id,
                            endCol: null,
                            tributaryWidth: 0,
                            tributaryArea: 0,
                            slices: [],
                            w: 0,
                            Rleft: 0,
                            Rright: 0
                        });
                    }
                }
            }

            // RIGHT EDGE BEAM
            for (let yi = 0; yi < state.ySpans.length; yi++) {
                const cantLen = cants.right[yi] || 0;
                if (cantLen > 0) {
                    state.beams.push({
                        id: `BEY-R-${yi + 1}`,
                        direction: 'Y',
                        beamType: 'cantilever_edge',
                        isEdgeBeam: true,
                        cantileverEdge: 'right',
                        x1: maxX + cantLen,
                        y1: yCoords[yi],
                        x2: maxX + cantLen,
                        y2: yCoords[yi + 1],
                        span: state.ySpans[yi],
                        tributaryWidth: 0,
                        tributaryArea: 0,
                        slices: [],
                        w: 0,
                        Rleft: 0,
                        Rright: 0
                    });
                }
            }
        }

        /**
         * Step 3 & 4: Generate beams and calculate tributary widths
         * v2.2: Now creates slices per slab with proper 45° math
         * Short span direction gets MORE load (stiffer)
         * v3.0: Added wallLoad parameter for line loads on beams
         */
        function generateBeams(pu, wallLoad = 0, targetFloor = null) {
            state.beams = [];

            // X-direction beams (horizontal, span in X)
            const xCoords = [0];
            for (let span of state.xSpans) xCoords.push(xCoords[xCoords.length - 1] + span);
            const yCoords = [0];
            for (let span of state.ySpans) yCoords.push(yCoords[yCoords.length - 1] + span);

            // Letters for column IDs (must match generateGrid)
            const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

            // Create beam objects with slices array
            for (let yi = 0; yi < yCoords.length; yi++) {
                for (let xi = 0; xi < state.xSpans.length; xi++) {
                    // v2.7: Skip beams where either endpoint column is inactive
                    const leftCol = getColumnAt(xi, yi);
                    const rightCol = getColumnAt(xi + 1, yi);
                    if (!leftCol || !rightCol || leftCol.active === false || rightCol.active === false) {
                        continue;
                    }

                    const beamSpan = state.xSpans[xi];
                    const beamId = `BX-${yi + 1}-${xi + 1}`;

                    state.beams.push({
                        id: beamId,
                        direction: 'X',
                        beamType: 'regular',
                        xi, yi,
                        x1: xCoords[xi],
                        y1: yCoords[yi],
                        x2: xCoords[xi + 1],
                        y2: yCoords[yi],
                        span: beamSpan,
                        // Column connections for load distribution
                        startCol: `${letters[xi]}${yi + 1}`,
                        endCol: `${letters[xi + 1]}${yi + 1}`,
                        tributaryWidth: 0,
                        tributaryArea: 0,
                        slices: [],  // v2.2: per-slab slices
                        w: 0,
                        Rleft: 0,
                        Rright: 0
                    });
                }
            }

            // Y-direction beams (along gridlines in X direction)
            for (let xi = 0; xi < xCoords.length; xi++) {
                for (let yi = 0; yi < state.ySpans.length; yi++) {
                    // v2.7: Skip beams where either endpoint column is inactive
                    const topCol = getColumnAt(xi, yi);
                    const bottomCol = getColumnAt(xi, yi + 1);
                    if (!topCol || !bottomCol || topCol.active === false || bottomCol.active === false) {
                        continue;
                    }

                    const beamSpan = state.ySpans[yi];
                    const beamId = `BY-${xi + 1}-${yi + 1}`;

                    state.beams.push({
                        id: beamId,
                        direction: 'Y',
                        beamType: 'regular',
                        xi, yi,
                        x1: xCoords[xi],
                        y1: yCoords[yi],
                        x2: xCoords[xi],
                        y2: yCoords[yi + 1],
                        span: beamSpan,
                        // Column connections for load distribution
                        startCol: `${letters[xi]}${yi + 1}`,
                        endCol: `${letters[xi]}${yi + 2}`,
                        tributaryWidth: 0,
                        tributaryArea: 0,
                        slices: [],  // v2.2: per-slab slices
                        w: 0,
                        Rleft: 0,
                    });
                }
            }

            // v3.0: Add custom (intermediate framing) beams to state.beams
            const floor = targetFloor || state.floors[state.currentFloorIndex];

            // v3.17: Resolve floor cantilevers explicitly and pass to beam generation
            const floorCantilevers = getCantilevers(floor?.id);
            generateCantileverBeams(xCoords, yCoords, letters, floorCantilevers, floor?.id);
            const customBeams = floor?.customBeams || [];
            for (const cb of customBeams) {
                let x1, y1, x2, y2, span, direction;

                // v3.0 FIX: dir='X' means horizontal beam (constant Y), dir='Y' means vertical beam (constant X)
                if (cb.dir === 'X') {
                    // Horizontal beam: runs along X axis, Y is constant = cb.pos
                    x1 = cb.start;
                    x2 = cb.end;
                    y1 = cb.pos;
                    y2 = cb.pos;
                    span = cb.end - cb.start;
                    direction = 'X';  // Spans in X direction
                } else {
                    // Vertical beam: runs along Y axis, X is constant = cb.pos
                    x1 = cb.pos;
                    x2 = cb.pos;
                    y1 = cb.start;
                    y2 = cb.end;
                    span = cb.end - cb.start;
                    direction = 'Y';  // Spans in Y direction
                }

                const generatedCustomBeam = {
                    id: cb.id,
                    direction: direction,
                    isCustom: true,  // Flag for custom beam
                    beamType: cb.beamType || cb.type || (cb.isStair ? 'stair' : 'custom'),
                    x1, y1, x2, y2,
                    span: span,
                    startCol: null,  // Custom beams may not connect to grid columns
                    endCol: null,
                    webW: cb.webW,
                    webD: cb.webD,
                    suggestedB: cb.suggestedB || cb.webW,
                    suggestedH: cb.suggestedH || cb.webD,
                    tributaryWidth: 0,
                    tributaryArea: 0,
                    slices: [],
                    w: 0,
                    Rleft: 0,
                    Rright: 0
                };
                generatedCustomBeam.topology = resolveBeamTopology(generatedCustomBeam, floor?.id, state.beams);
                generatedCustomBeam.exportReadiness = classifyCustomBeamExportReadiness(generatedCustomBeam);
                state.beams.push(generatedCustomBeam);
            }

            // Map for quick access (now includes cantilever beams + custom beams)
            const beamMap = Object.fromEntries(state.beams.map(beam => [beam.id, beam]));

            // v3.0: Helper to check if a custom beam crosses a slab
            function getCustomBeamsCrossingSlab(slab) {
                const crossing = [];
                for (const cb of customBeams) {
                    // v3.0 FIX: dir='X' means horizontal beam (constant Y), dir='Y' means vertical (constant X)
                    if (cb.dir === 'X') {
                        // Horizontal beam at Y = cb.pos
                        // Check if beam Y is within slab Y range AND beam X overlaps slab X
                        if (cb.pos > slab.y1 && cb.pos < slab.y2 &&
                            cb.start < slab.x2 && cb.end > slab.x1) {
                            crossing.push({
                                ...cb,
                                beamId: cb.id,
                                splitDir: 'Y',  // Splits slab horizontally (Y direction)
                                splitPos: cb.pos
                            });
                        }
                    } else {
                        // Vertical beam at X = cb.pos
                        if (cb.pos > slab.x1 && cb.pos < slab.x2 &&
                            cb.start < slab.y2 && cb.end > slab.y1) {
                            crossing.push({
                                ...cb,
                                beamId: cb.id,
                                splitDir: 'X',  // Splits slab vertically (X direction)
                                splitPos: cb.pos
                            });
                        }
                    }
                }
                return crossing;
            }

            // v2.2: Distribute slab areas with proper slices
            // v3.0: Skip void slabs - they don't contribute load to any beam
            for (let slab of state.slabs) {
                // v3.0: Skip void slabs - no load distribution
                if (slab.isVoid) {
                    console.log(`v3.0: Skipping void slab ${slab.id} in load distribution`);
                    continue;
                }
                // Skip cantilever slabs - handled separately below
                if (slab.isCantilever) continue;
                // Find beams on 4 edges geometrically
                const TOL = 0.05; // 5cm tolerance
                const topBeam = state.beams.find(b => b.direction === 'X' && Math.abs(b.y1 - slab.y1) < TOL && b.x1 <= slab.x1 + TOL && b.x2 >= slab.x2 - TOL);
                const bottomBeam = state.beams.find(b => b.direction === 'X' && Math.abs(b.y1 - slab.y2) < TOL && b.x1 <= slab.x1 + TOL && b.x2 >= slab.x2 - TOL);
                const leftBeam = state.beams.find(b => b.direction === 'Y' && Math.abs(b.x1 - slab.x1) < TOL && b.y1 <= slab.y1 + TOL && b.y2 >= slab.y2 - TOL);
                const rightBeam = state.beams.find(b => b.direction === 'Y' && Math.abs(b.x1 - slab.x2) < TOL && b.y1 <= slab.y1 + TOL && b.y2 >= slab.y2 - TOL);

                const topBeamId = topBeam?.id;
                const bottomBeamId = bottomBeam?.id;
                const leftBeamId = leftBeam?.id;
                const rightBeamId = rightBeam?.id;

                // Slab coordinates
                const x0 = slab.x1, x1 = slab.x2;
                const y0 = slab.y1, y1 = slab.y2;

                // Helper to create polygon and compute centroid
                function makeSlice(beamId, side, areaSide, poly) {
                    const beam = beamMap[beamId];
                    if (!beam) return;

                    beam.tributaryArea += areaSide;
                    beam.slices.push(EngineTributary.createBeamSlice({
                        slabId: slab.id,
                        side: side,
                        area: areaSide,
                        pu: pu,
                        span: beam.span,
                        poly: poly,
                    }));
                }

                if (slab.isTwoWay) {
                    const h = Math.min(slab.lx, slab.ly) / 2;  // 45° inset height

                    // Provisional areas based on 45° triangular/trapezoidal geometry
                    const xSideArea_raw = slab.lx * h / 2; // triangle for X-beams (top/bottom)
                    const trapBase = slab.ly;
                    const trapTop = slab.ly - 2 * h;
                    const ySideArea_raw = trapTop > 0
                        ? (trapBase + trapTop) * h / 2  // trapezoid for Y-beams
                        : slab.ly * h / 2;              // triangle when lines meet

                    // Normalize so total = slab.area
                    const rawTotal = 2 * xSideArea_raw + 2 * ySideArea_raw;
                    const scale = rawTotal > 0 ? slab.area / rawTotal : 0;

                    const A_top = xSideArea_raw * scale;
                    const A_bottom = xSideArea_raw * scale;
                    const A_left = ySideArea_raw * scale;
                    const A_right = ySideArea_raw * scale;

                    let topPoly, bottomPoly, leftPoly, rightPoly;

                    if (slab.lx <= slab.ly) {
                        // Short direction = X
                        // Top/Bottom = Triangles
                        topPoly = [
                            { x: x0, y: y0 },
                            { x: x1, y: y0 },
                            { x: (x0 + x1) / 2, y: y0 + h }
                        ];
                        bottomPoly = [
                            { x: x0, y: y1 },
                            { x: x1, y: y1 },
                            { x: (x0 + x1) / 2, y: y1 - h }
                        ];
                        // Left/Right = Trapezoids
                        leftPoly = [
                            { x: x0, y: y0 },
                            { x: x0, y: y1 },
                            { x: x0 + h, y: y1 - h },
                            { x: x0 + h, y: y0 + h }
                        ];
                        rightPoly = [
                            { x: x1, y: y0 },
                            { x: x1, y: y1 },
                            { x: x1 - h, y: y1 - h },
                            { x: x1 - h, y: y0 + h }
                        ];
                    } else {
                        // Short direction = Y
                        // Left/Right = Triangles
                        leftPoly = [
                            { x: x0, y: y0 },
                            { x: x0, y: y1 },
                            { x: x0 + h, y: (y0 + y1) / 2 }
                        ];
                        rightPoly = [
                            { x: x1, y: y0 },
                            { x: x1, y: y1 },
                            { x: x1 - h, y: (y0 + y1) / 2 }
                        ];
                        // Top/Bottom = Trapezoids
                        topPoly = [
                            { x: x0, y: y0 },
                            { x: x1, y: y0 },
                            { x: x1 - h, y: y0 + h },
                            { x: x0 + h, y: y0 + h }
                        ];
                        bottomPoly = [
                            { x: x0, y: y1 },
                            { x: x1, y: y1 },
                            { x: x1 - h, y: y1 - h },
                            { x: x0 + h, y: y1 - h }
                        ];
                    }

                    makeSlice(topBeamId, 'top', A_top, topPoly);
                    makeSlice(bottomBeamId, 'bottom', A_bottom, bottomPoly);
                    makeSlice(leftBeamId, 'left', A_left, leftPoly);
                    makeSlice(rightBeamId, 'right', A_right, rightPoly);
                } else {
                    // One-way slab: split into 2 rectangles
                    const halfArea = slab.area / 2;

                    if (slab.lx < slab.ly) {
                        // Spanning in Y, supported by left/right beams
                        const midX = (x0 + x1) / 2;
                        const leftPoly = [{ x: x0, y: y0 }, { x: midX, y: y0 }, { x: midX, y: y1 }, { x: x0, y: y1 }];
                        const rightPoly = [{ x: midX, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: midX, y: y1 }];
                        makeSlice(leftBeamId, 'left', halfArea, leftPoly);
                        makeSlice(rightBeamId, 'right', halfArea, rightPoly);
                    } else {
                        // Spanning in X, supported by top/bottom beams
                        const midY = (y0 + y1) / 2;
                        const topPoly = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: midY }, { x: x0, y: midY }];
                        const bottomPoly = [{ x: x0, y: midY }, { x: x1, y: midY }, { x: x1, y: y1 }, { x: x0, y: y1 }];
                        makeSlice(topBeamId, 'top', halfArea, topPoly);
                        makeSlice(bottomBeamId, 'bottom', halfArea, bottomPoly);
                    }
                }
            }

            // v3.0: Distribute slab loads to CUSTOM BEAMS that cross them
            // Custom beams receive load from the portions of slabs they cross
            for (let slab of state.slabs) {
                if (slab.isCantilever || slab.isVoid) continue;

                const crossingBeams = getCustomBeamsCrossingSlab(slab);
                for (const cb of crossingBeams) {
                    const customBeam = beamMap[cb.beamId];
                    if (!customBeam) continue;

                    // Calculate the portion of slab area that loads this custom beam
                    // Simplified: the custom beam gets a strip of width = MIN(span_in_direction, half_slab_dimension)
                    const tributaryArea = EngineTributary.calculateCustomBeamTributaryArea(cb, slab);

                    customBeam.tributaryArea += tributaryArea;
                    customBeam.slices.push(EngineTributary.createBeamSlice({
                        slabId: slab.id,
                        side: 'custom',
                        area: tributaryArea,
                        pu: pu,
                        span: customBeam.span,
                        extra: { isCustom: true },
                        poly: [
                            { x: slab.x1, y: slab.y1 },
                            { x: slab.x2, y: slab.y1 },
                            { x: slab.x2, y: slab.y2 },
                            { x: slab.x1, y: slab.y2 }
                        ]
                    }));

                    console.log(`v3.0: Custom beam ${cb.beamId} receives ${tributaryArea.toFixed(2)} m² from slab ${slab.id}`);
                }
            }

            // v3.0: Distribute cantilever slab loads to beams
            // Load goes to (1) the main grid edge beam, and (2) the cantilever beams
            // v3.0 FIX: Skip voided cantilever slabs - they shouldn't contribute load
            for (let slab of state.slabs.filter(s => s.isCantilever && !s.isVoid)) {
                const slabArea = slab.area;
                const supportBeamIds = EngineTributary.getCantileverSupportBeamIds(slab, {
                    xSpanCount: state.xSpans.length,
                    ySpanCount: state.ySpans.length
                });

                // ===== PART 1: Add load to the MAIN GRID EDGE BEAM =====
                // This is the beam along the grid edge that the cantilever extends from
                const mainBeam = beamMap[supportBeamIds.mainBeamId];
                if (mainBeam) {
                    // Add FULL cantilever area to the supporting edge beam
                    mainBeam.tributaryArea += slabArea;
                    mainBeam.slices.push(EngineTributary.createBeamSlice({
                        slabId: slab.id,
                        side: 'cantilever',
                        area: slabArea,
                        pu: pu,
                        span: mainBeam.span,
                        wOverride: 0,
                        extra: { isCantilever: true },
                        poly: [
                            { x: slab.x1, y: slab.y1 },
                            { x: slab.x2, y: slab.y1 },
                            { x: slab.x2, y: slab.y2 },
                            { x: slab.x1, y: slab.y2 }
                        ]
                    }));
                }

                // ===== PART 2: Also add load to CANTILEVER BEAMS (perpendicular) =====
                const [cantBeam1Id, cantBeam2Id] = supportBeamIds.cantileverBeamIds;
                // Cantilever beams get half the slab area each (for their own load calc)
                const halfArea = slabArea / 2;
                const cantBeam1 = beamMap[cantBeam1Id];
                const cantBeam2 = beamMap[cantBeam2Id];

                if (cantBeam1) cantBeam1.tributaryArea += halfArea;
                if (cantBeam2) cantBeam2.tributaryArea += halfArea;
            }

            // Finalize tributary widths and loads
            for (let beam of state.beams) {
                const loadSummary = EngineTributary.calculateBeamLineLoad(beam, pu, wallLoad);
                beam.tributaryArea = loadSummary.tributaryArea;
                beam.tributaryWidth = loadSummary.tributaryWidth;
                beam.wallLoad = loadSummary.wallLoad;
                beam.w = loadSummary.w;
            }

            applyBeamSizeOverridesToBeams(floor?.id);
        }

        /**
         * Step 5: Calculate beam reactions
         * For uniform load: R_left = R_right = w * L / 2
         * v3.0: Cantilever beams - all load goes to support column
         */
        function calculateBeamReactions() {
            EngineLoads.calculateBeamReactions(state.beams);
        }

        /**
         * Step 6: Calculate column loads
         * Column load = Sum of all beam reactions at that column
         * v3.0: Handles cantilever beams using startCol/endCol IDs
         */
        function calculateColumnLoads() {
            // Reset column loads
            for (let col of state.columns) {
                col.loadPerFloor = 0;
                col.connectedBeams = [];
            }

            // Sum beam reactions to columns
            for (let beam of state.beams) {
                // v3.0: Cantilever and edge beams use startCol/endCol IDs
                if (beam.isCantilever || beam.isEdgeBeam) {
                    if (beam.startCol) {
                        const col = state.columns.find(c => c.id === beam.startCol);
                        if (col) {
                            col.loadPerFloor += beam.Rleft;
                            col.connectedBeams.push(beam.id);
                        }
                    }
                    if (beam.endCol) {
                        const col = state.columns.find(c => c.id === beam.endCol);
                        if (col) {
                            col.loadPerFloor += beam.Rright;
                            col.connectedBeams.push(beam.id);
                        }
                    }
                } else {
                    // Normal beams: find columns by xi/yi indices
                    let colLeft, colRight;

                    if (beam.direction === 'X') {
                        // X beam: connects columns at same yi, adjacent xi
                        colLeft = state.columns.find(c => c.xi === beam.xi && c.yi === beam.yi);
                        colRight = state.columns.find(c => c.xi === beam.xi + 1 && c.yi === beam.yi);
                    } else {
                        // Y beam: connects columns at same xi, adjacent yi
                        colLeft = state.columns.find(c => c.xi === beam.xi && c.yi === beam.yi);
                        colRight = state.columns.find(c => c.xi === beam.xi && c.yi === beam.yi + 1);
                    }

                    if (colLeft) {
                        colLeft.loadPerFloor += beam.Rleft;
                        colLeft.connectedBeams.push(beam.id);
                    }
                    if (colRight) {
                        colRight.loadPerFloor += beam.Rright;
                        colRight.connectedBeams.push(beam.id);
                    }
                }
            }

            // Calculate total load (sum across floors, not multiply!)
            for (let col of state.columns) {
                // Each floor has same load pattern
                col.totalLoad = col.loadPerFloor * state.numFloors;
            }
        }

        // ========== v3.0: MEMBER SIZING (NSCP 2015) ==========

        /**
         * Size a column based on axial load (simplified - axial only, no moment)
         * Formula: Pu ≤ φPn = φ × 0.80 × [0.85 × f'c × (Ag - Ast) + fy × Ast]
         * Simplified: Ag_required = Pu / (φ × 0.80 × (0.85 × f'c × (1 - ρ) + fy × ρ))
         * v3.0: Supports rectangular columns (b × h)
         * @param {number} Pu_kN - Ultimate axial load in kN
         * @param {number} height_m - Column height in meters (for self-weight)
         * @returns {object} { b, h, Ast, selfWeight_kN, isOverride }
         */
        function sizeColumn(Pu_kN, height_m = 3.0) {
            return EngineLoads.sizeColumn(Pu_kN, height_m, getLoadParams());
        }

        function sizeBeam(span_m, isCantilever = false) {
            return EngineLoads.sizeBeam(span_m, isCantilever, getLoadParams());
        }

        function sizeMembers() {
            const result = EngineLoads.sizeMembers(state.columns, state.beams, getLoadParams());
            state.totalColumnSelfWeight = result.totalColumnSelfWeight;
            state.totalBeamSelfWeight = result.totalBeamSelfWeight;
        }

        // ========== UI UPDATES ==========
        function updateResults(pu) {
            // v3.0: Total area - use net area (after opening deductions)
            const grossArea = state.slabs.reduce((sum, s) => sum + s.area, 0);
            const netArea = state.slabs.reduce((sum, s) => sum + (s.netArea || s.area), 0);
            const openingArea = state.totalOpeningArea || 0;

            // Show net area (what actually carries load)
            document.getElementById('totalArea').textContent = netArea.toFixed(1);

            // If there are openings, add a note
            if (openingArea > 0) {
                document.getElementById('totalArea').title =
                    `Gross: ${ grossArea.toFixed(1) } m² - Openings: ${ openingArea.toFixed(1) } m² = Net: ${ netArea.toFixed(1) } m²`;
            }

            // Beam tributary area check (compare to net area)
            const totalBeamArea = state.beams.reduce((sum, b) => sum + b.tributaryArea, 0);
            const areaBalance = netArea > 0 ? (totalBeamArea / netArea) * 100 : 0;
            const areaDelta = totalBeamArea - netArea;
            const balanceEl = document.getElementById('areaBalance');
            const balanceDetailEl = document.getElementById('areaBalanceDetail');
            balanceEl.textContent = `${ areaBalance.toFixed(1) }% `;
            balanceEl.style.color = Math.abs(areaDelta) < 0.01 ? 'var(--success)' : 'var(--warning)';
            balanceDetailEl.textContent = `${ areaDelta.toFixed(2) } m² diff`;

            // Factored load
            document.getElementById('factoredLoad').textContent = pu.toFixed(2);

            // Total per floor (use current selected floor)
            const currentFloor = state.floors[state.currentFloorIndex];
            const totalPerFloor = state.columns.reduce((sum, c) => {
                const floorLoad = c.floorLoads.find(f => f.floorId === currentFloor.id);
                return sum + (floorLoad ? floorLoad.load : 0);
            }, 0);
            document.getElementById('totalPerFloor').textContent = totalPerFloor.toFixed(0);

            // Max column (total across all floors)
            const maxCol = state.columns.length
                ? Math.max(...state.columns.map(c => c.totalLoad))
                : 0;
            document.getElementById('maxColumn').textContent = maxCol.toFixed(0);

            // v3.0: Use updateColumnTable for full column display with b×h and footings
            updateColumnTable();

            // v3.2: Update footing schedule table
            updateFootingSchedule();

            // v2.7: Beam table - clickable rows for 3D highlighting
            // v3.0: Show support reaction for cantilever beams + editable size
            // v3.1: Use grid-based beam naming convention (B-2F-A1B1)
            const beamBody = document.getElementById('beamResultsBody');

            // v3.1: Helper to get grid-based beam label
            const GRID_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
            function getBeamGridCol(x) {
                let cumX = 0;
                for (let i = 0; i < state.xSpans.length; i++) {
                    if (Math.abs(x - cumX) < 0.1) return GRID_LETTERS[i];
                    cumX += state.xSpans[i];
                }
                if (Math.abs(x - cumX) < 0.1) return GRID_LETTERS[state.xSpans.length];
                return '?';
            }
            function getBeamGridRow(y) {
                let cumY = 0;
                for (let i = 0; i < state.ySpans.length; i++) {
                    if (Math.abs(y - cumY) < 0.1) return (i + 1).toString();
                    cumY += state.ySpans[i];
                }
                if (Math.abs(y - cumY) < 0.1) return (state.ySpans.length + 1).toString();
                return '?';
            }
            function getBeamLabel(beam) {
                const floorId = state.floors[state.currentFloorIndex]?.id || '2F';
                if (beam.direction === 'X') {
                    const row = getBeamGridRow(beam.y1);
                    const startCol = getBeamGridCol(beam.x1);
                    const endCol = getBeamGridCol(beam.x2);
                    return `B - ${ floorId } -${ startCol }${ row }${ endCol }${ row } `;
                } else {
                    const col = getBeamGridCol(beam.x1);
                    const startRow = getBeamGridRow(beam.y1);
                    const endRow = getBeamGridRow(beam.y2);
                    return `B - ${ floorId } -${ col }${ startRow }${ col }${ endRow } `;
                }
            }

            beamBody.innerHTML = state.beams.slice(0, 30).map(beam => {
                const isSelected = state.selectedMemberId === beam.id;
                // v3.0: For cantilevers, show the support reaction (non-zero one)
                const displayR = beam.isCantilever
                    ? Math.max(beam.Rleft, beam.Rright)
                    : beam.Rleft;
                // v3.0: Different styling for cantilever/edge beams
                const beamStyle = beam.isCantilever
                    ? 'color:#f59e0b;'
                    : (beam.isEdgeBeam ? 'color:#ec4899;' : '');
                // v3.0: Editable beam size with override indicator
                const hasOverride = beam.overrideB || beam.overrideH;
                // v3.1: Use grid-based beam label
                const beamLabel = getBeamLabel(beam);
                return `
                < tr onclick = "selectMember('${beam.id}')" style = "cursor:pointer;${isSelected ? 'background:rgba(239,68,68,0.3);' : ''}" title = "Click to highlight in 3D" >
                    <td style="${beamStyle}">${beamLabel}</td>
                    <td>${beam.w.toFixed(1)}</td>
                    <td>${displayR.toFixed(1)}</td>
                </tr >
                `;
            }).join('');

            // v3.0: Update slab openings table
            updateSlabOpeningsTable();
            updateModelReadinessPanel();
        }

// ========== v3.12: ENGINEERING ANALYSIS FUNCTIONS ==========

// --- SEISMIC ANALYSIS (NSCP 2015 / ASCE 7-16) ---
function calculateSeismic() {
    const zone = parseInt(document.getElementById('seismicZone')?.value || 4);
    const soil = document.getElementById('soilProfile')?.value || 'SD';
    const I = parseFloat(document.getElementById('importFactor')?.value || 1.0);
    const R = parseFloat(document.getElementById('rFactor')?.value || 8.5);

    // Zone factors
    const Z = zone === 4 ? 0.40 : 0.20;

    // Soil coefficients (NSCP Table 208-7/8)
    const Ca_table = { 'SC': {2: 0.15, 4: 0.40}, 'SD': {2: 0.22, 4: 0.44}, 'SE': {2: 0.28, 4: 0.44} };
    const Cv_table = { 'SC': {2: 0.20, 4: 0.56}, 'SD': {2: 0.32, 4: 0.64}, 'SE': {2: 0.50, 4: 0.96} };
    const Ca = (Ca_table[soil] && Ca_table[soil][zone]) || 0.44;
    const Cv = (Cv_table[soil] && Cv_table[soil][zone]) || 0.64;

    // Building weight
    const numFloors = state.floors.length;
    const totalHeight = state.floors.reduce((sum, f) => sum + (f.height || 3.0), 0);

    // Approximate period T = Ct * hn^(3/4) for concrete frame
    const Ct = 0.0731; // NSCP for concrete moment frames
    const T = Ct * Math.pow(totalHeight, 0.75);

    // Seismic coefficients
    const Cs_calc = (Cv * I) / (R * T);
    const Cs_max = (2.5 * Ca * I) / R;
    const Cs_min = 0.11 * Ca * I;
    const Cs = Math.max(Cs_min, Math.min(Cs_calc, Cs_max));

    // Total building weight (approximate)
    let W = 0;
    state.floors.forEach(floor => {
        const slabArea = state.xSpans.reduce((a,b) => a+b, 0) * state.ySpans.reduce((a,b) => a+b, 0);
        const slabWt = slabArea * ((floor.slabThickness || 150) / 1000) * 24;
        const superDL = slabArea * (floor.dlSuper || 2.0);
        const livePartial = slabArea * (floor.liveLoad || 2.0) * 0.25;
        W += slabWt + superDL + livePartial;
    });

    const V = Cs * W; // Base shear

    // Summary
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    let html = '';
    html += '<tr><td>Seismic Zone</td><td>' + zone + '</td><td>Z = ' + Z + '</td></tr>';
    html += '<tr><td>Soil Profile</td><td>' + soil + '</td><td>Ca=' + Ca.toFixed(2) + ' Cv=' + Cv.toFixed(2) + '</td></tr>';
    html += '<tr><td>Building Height</td><td>' + totalHeight.toFixed(1) + ' m</td><td>' + numFloors + ' stories</td></tr>';
    html += '<tr><td>Period T</td><td>' + T.toFixed(3) + ' sec</td><td>Ct=' + Ct + '</td></tr>';
    html += '<tr><td>Cs (calculated)</td><td>' + Cs_calc.toFixed(4) + '</td><td>Cv*I/(R*T)</td></tr>';
    html += '<tr><td>Cs (max)</td><td>' + Cs_max.toFixed(4) + '</td><td>2.5*Ca*I/R</td></tr>';
    html += '<tr><td>Cs (min)</td><td>' + Cs_min.toFixed(4) + '</td><td>0.11*Ca*I</td></tr>';
    html += '<tr style="font-weight:bold; border-top:2px solid #000;"><td>Cs (governing)</td><td>' + Cs.toFixed(4) + '</td><td></td></tr>';
    html += '<tr><td>Building Weight W</td><td>' + W.toFixed(0) + ' kN</td><td></td></tr>';
    html += '<tr style="font-weight:bold; font-size:1.1em; border-top:2px solid #000;"><td>BASE SHEAR V</td><td>' + V.toFixed(1) + ' kN</td><td>Cs x W</td></tr>';

    const tbody = document.getElementById('seismicBody');
    if (tbody) tbody.innerHTML = html;

    // Story forces (inverted triangular distribution)
    let cumH = 0;
    const storyData = [];
    let sumWiHi = 0;
    state.floors.forEach(floor => {
        cumH += (floor.height || 3.0);
        const slabArea = state.xSpans.reduce((a,b) => a+b, 0) * state.ySpans.reduce((a,b) => a+b, 0);
        const Wi = slabArea * ((floor.slabThickness || 150) / 1000) * 24 + slabArea * (floor.dlSuper || 2.0);
        sumWiHi += Wi * cumH;
        storyData.push({ name: floor.id, hi: cumH, Wi: Wi, WiHi: Wi * cumH });
    });

    let storyHtml = '';
    storyData.forEach(s => {
        const Fi = (s.WiHi / sumWiHi) * V;
        storyHtml += '<tr><td>' + s.name + '</td><td>' + s.hi.toFixed(1) + '</td><td>' + s.Wi.toFixed(0) + '</td><td>' + s.WiHi.toFixed(0) + '</td><td><strong>' + Fi.toFixed(1) + '</strong></td></tr>';
    });
    const sfBody = document.getElementById('storyForceBody');
    if (sfBody) sfBody.innerHTML = storyHtml;
}

// --- WIND LOAD ANALYSIS (NSCP 2015) ---
function calculateWind() {
    const V = parseInt(document.getElementById('windSpeed')?.value || 200);
    const exposure = document.getElementById('windExposure')?.value || 'C';
    const I_w = 1.0; // Importance factor for wind

    const qh = 0.613 * Math.pow(V / 1000, 2) * 1000; // velocity pressure at height (kPa approx)

    const totalHeight = state.floors.reduce((sum, f) => sum + (f.height || 3.0), 0);
    const buildingWidth = state.xSpans.reduce((a,b) => a+b, 0);
    const buildingDepth = state.ySpans.reduce((a,b) => a+b, 0);

    let html = '';
    html += '<tr><td>Wind Speed V</td><td>' + V + ' km/h</td></tr>';
    html += '<tr><td>Exposure Category</td><td>' + exposure + '</td></tr>';
    html += '<tr><td>Building Height</td><td>' + totalHeight.toFixed(1) + ' m</td></tr>';
    html += '<tr><td>Building Width (X)</td><td>' + buildingWidth.toFixed(1) + ' m</td></tr>';
    html += '<tr><td>Building Depth (Y)</td><td>' + buildingDepth.toFixed(1) + ' m</td></tr>';

    const tbody = document.getElementById('windBody');
    if (tbody) tbody.innerHTML = html;

    // Exposure coefficients
    const alphaTable = { 'B': 7.0, 'C': 9.5, 'D': 11.5 };
    const zgTable = { 'B': 365.76, 'C': 274.32, 'D': 213.36 };
    const alpha = alphaTable[exposure] || 9.5;
    const zg = zgTable[exposure] || 274.32;

    let cumH = 0;
    let storyHtml = '';
    state.floors.forEach(floor => {
        cumH += (floor.height || 3.0);
        const Kz = 2.01 * Math.pow(Math.max(cumH, 4.6) / zg, 2 / alpha);
        const qz = 0.613 * Kz * I_w * Math.pow(V * 1000 / 3600, 2) / 1000; // kPa
        const Cp = 0.8; // windward
        const G = 0.85; // gust factor
        const p = qz * G * Cp; // wind pressure
        const tributaryH = floor.height || 3.0;
        const F = p * buildingWidth * tributaryH; // force on this story

        storyHtml += '<tr><td>' + floor.id + '</td><td>' + cumH.toFixed(1) + '</td><td>' + Kz.toFixed(3) + '</td><td>' + qz.toFixed(3) + '</td><td><strong>' + F.toFixed(1) + '</strong></td></tr>';
    });

    const wsBody = document.getElementById('windStoryBody');
    if (wsBody) wsBody.innerHTML = storyHtml;
}

// --- BEAM DESIGN (ACI 318-14) ---
function designAllBeams() {
    const fc = state.fc || 21;
    const fy = state.fy || 415;
    const phi = 0.90;
    const coverMm = 40;
    const tbody = document.getElementById('beamDesignBody');
    if (!tbody) return;

    let html = '';
    state.beams.forEach(beam => {
        if (beam.isCustom || beam.isCantilever || beam.deleted) return;
        const b = beam.suggestedB || 250; // mm
        const h = beam.suggestedH || 400; // mm
        const d = h - coverMm - 10; // effective depth
        const L = beam.span || 4.0; // m
        const wu = beam.uniformLoad || beam.totalDistributed || (beam.wallLoad || 0) + 15; // kN/m approx

        // Flexure - simply supported
        const Mu = (wu * L * L) / 8; // kN.m
        const Rn = (Mu * 1e6) / (phi * b * d * d);
        const disc = 1 - (2 * Rn) / (0.85 * fc);
        let rho = disc > 0 ? (0.85 * fc / fy) * (1 - Math.sqrt(disc)) : 0.005;
        const rho_min = Math.max(0.25 * Math.sqrt(fc) / fy, 1.4 / fy);
        rho = Math.max(rho, rho_min);
        const As = rho * b * d;
        const barDia = h >= 500 ? 20 : 16;
        const Ab = Math.PI * barDia * barDia / 4;
        const nBars = Math.max(2, Math.ceil(As / Ab));

        // Shear
        const Vu = wu * L / 2; // kN
        const Vc = 0.17 * Math.sqrt(fc) * b * d / 1000; // kN
        const phiVc = 0.75 * Vc;
        let stirrups = '-';
        if (Vu > phiVc) {
            const Vs = (Vu / 0.75) - Vc;
            const Av = 2 * Math.PI * 5 * 5; // 2 legs of 10mm
            const s = Math.min(Math.floor((Av * fy * d) / (Vs * 1000)), d / 2, 300);
            stirrups = '2L-10mm @ ' + Math.max(s, 75) + 'mm';
        } else {
            stirrups = '2L-10mm @ ' + Math.min(Math.floor(d/2), 200) + 'mm';
        }

        html += '<tr>' +
            '<td>' + (beam.id || '-') + '</td>' +
            '<td>' + b + 'x' + h + '</td>' +
            '<td>' + L.toFixed(1) + '</td>' +
            '<td>' + wu.toFixed(1) + '</td>' +
            '<td>' + Mu.toFixed(1) + '</td>' +
            '<td>' + As.toFixed(0) + '</td>' +
            '<td>' + nBars + '-D' + barDia + '</td>' +
            '<td>' + Vu.toFixed(1) + '</td>' +
            '<td>' + stirrups + '</td>' +
            '</tr>';
    });
    tbody.innerHTML = html || '<tr><td colspan="9">No beams to design</td></tr>';
}

// --- COLUMN CHECK (ACI 318-14) ---
function checkAllColumns() {
    const fc = state.fc || 21;
    const fy = state.fy || 415;
    const phi = 0.65; // tied columns
    const tbody = document.getElementById('colDesignBody');
    if (!tbody) return;

    let html = '';
    const colGroups = {};
    state.columns.forEach(col => {
        if (col.active === false) return;
        const b = col.suggestedB || 250;
        const h = col.suggestedH || 250;
        const key = b + 'x' + h;
        if (!colGroups[key]) colGroups[key] = { b, h, cols: [] };
        colGroups[key].cols.push(col);
    });

    Object.values(colGroups).forEach(grp => {
        const b = grp.b, h = grp.h;
        const Ag = b * h;
        const rho = 0.01; // 1% minimum
        const Ast = rho * Ag;
        const Pn = 0.80 * (0.85 * fc * (Ag - Ast) + fy * Ast) / 1000; // kN
        const phiPn = phi * Pn;

        const barDia = b >= 350 ? 20 : 16;
        const Ab = Math.PI * barDia * barDia / 4;
        const nBars = Math.max(4, Math.ceil(Ast / Ab));
        const tieSize = 10;
        const tieSpacing = Math.min(16 * barDia, Math.min(b, h), 300);

        grp.cols.forEach(col => {
            const Pu = col.totalLoadWithDL || col.totalLoad || 0;
            const ratio = Pu / phiPn;
            const status = ratio <= 1.0 ? 'OK' : 'NG';

            html += '<tr>' +
                '<td>' + col.id + '</td>' +
                '<td>' + b + 'x' + h + '</td>' +
                '<td>' + Pu.toFixed(0) + '</td>' +
                '<td>' + phiPn.toFixed(0) + '</td>' +
                '<td style="' + (ratio > 1 ? 'color:red;font-weight:bold;' : '') + '">' + ratio.toFixed(2) + '</td>' +
                '<td>' + (rho * 100).toFixed(1) + '</td>' +
                '<td>' + nBars + '-D' + barDia + '</td>' +
                '<td>D' + tieSize + '@' + tieSpacing + '</td>' +
                '<td style="font-weight:bold;' + (status === 'OK' ? 'color:green;' : 'color:red;') + '">' + status + '</td>' +
                '</tr>';
        });
    });
    tbody.innerHTML = html || '<tr><td colspan="9">No columns</td></tr>';
}

// --- SLAB DESIGN (ACI 318-14) ---
function designAllSlabs() {
    const fc = state.fc || 21;
    const fy = state.fy || 415;
    const tbody = document.getElementById('slabDesignBody');
    if (!tbody) return;

    let html = '';
    state.slabs.forEach((slab, i) => {
        if (slab.isVoid) return;
        const Lx = Math.min(slab.width, slab.height); // short span
        const Ly = Math.max(slab.width, slab.height); // long span
        const ratio = Ly / Lx;
        const type = ratio >= 2 ? 'One-Way' : 'Two-Way';

        const floor = state.floors[state.currentFloorIndex];
        const t = floor?.slabThickness || 150;

        // Minimum thickness (ACI Table 9.5a)
        let tMin;
        if (type === 'One-Way') {
            tMin = Math.ceil((Lx * 1000) / 24); // simply supported = L/20, continuous = L/24
        } else {
            tMin = Math.ceil((Lx * 1000) / 33); // two-way slab
        }
        tMin = Math.max(tMin, 100); // absolute min

        // Flexure
        const d = t - 25 - 6; // mm effective depth
        const wu = 1.2 * ((t / 1000 * 24) + (floor?.dlSuper || 2.0)) + 1.6 * (floor?.liveLoad || 2.0);
        let Mu;
        if (type === 'One-Way') {
            Mu = (wu * Lx * Lx) / 8; // kN.m/m
        } else {
            Mu = (wu * Lx * Lx) / 10; // approximate for two-way
        }

        const Rn = (Mu * 1e6) / (0.9 * 1000 * d * d);
        const disc = 1 - (2 * Rn) / (0.85 * fc);
        let rho = disc > 0 ? (0.85 * fc / fy) * (1 - Math.sqrt(disc)) : 0.002;
        rho = Math.max(rho, fy >= 400 ? 0.0018 : 0.002);
        const As = rho * 1000 * d; // mm2/m

        const barDia = 12;
        const Ab = Math.PI * barDia * barDia / 4;
        const spacing = Math.min(Math.floor(Ab * 1000 / As), 3 * t, 450);

        html += '<tr>' +
            '<td>S' + (i + 1) + '</td>' +
            '<td>' + type + '</td>' +
            '<td>' + Lx.toFixed(1) + '</td>' +
            '<td>' + Ly.toFixed(1) + '</td>' +
            '<td>' + t + '</td>' +
            '<td style="' + (t < tMin ? 'color:red;font-weight:bold;' : '') + '">' + tMin + '</td>' +
            '<td>' + Mu.toFixed(1) + '</td>' +
            '<td>' + As.toFixed(0) + '</td>' +
            '<td>D' + barDia + '@' + spacing + '</td>' +
            '</tr>';
    });
    tbody.innerHTML = html || '<tr><td colspan="9">No slabs</td></tr>';
}

// --- STAIRCASE LOADING ---
function calculateStaircase() {
    const rise = parseInt(document.getElementById('stairRise')?.value || 175);
    const tread = parseInt(document.getElementById('stairTread')?.value || 275);
    const waist = parseInt(document.getElementById('stairWaist')?.value || 150);

    const theta = Math.atan(rise / tread) * 180 / Math.PI;
    const cosTheta = Math.cos(theta * Math.PI / 180);

    // Effective slab thickness
    const hStep = rise / 2; // mm - average step height
    const tEff = waist / cosTheta + hStep; // mm

    // Dead load
    const slabDL = (tEff / 1000) * 24; // kN/m2
    const finishDL = 1.5; // kN/m2 (railing + finish)
    const totalDL = slabDL + finishDL;

    // Live load
    const LL = 4.8; // kN/m2 for stairs (NSCP)

    // Factored
    const wu = 1.2 * totalDL + 1.6 * LL;

    let html = '';
    html += '<tr><td>Rise</td><td>' + rise + ' mm</td><td></td></tr>';
    html += '<tr><td>Tread</td><td>' + tread + ' mm</td><td></td></tr>';
    html += '<tr><td>Waist Thickness</td><td>' + waist + ' mm</td><td></td></tr>';
    html += '<tr><td>Slope Angle</td><td>' + theta.toFixed(1) + '</td><td>degrees</td></tr>';
    html += '<tr><td>Effective Thickness</td><td>' + tEff.toFixed(0) + '</td><td>mm</td></tr>';
    html += '<tr style="border-top:1px solid #ccc;"><td>Slab Dead Load</td><td>' + slabDL.toFixed(2) + '</td><td>kN/m2</td></tr>';
    html += '<tr><td>Finish + Railing</td><td>' + finishDL.toFixed(2) + '</td><td>kN/m2</td></tr>';
    html += '<tr><td>Total DL</td><td>' + totalDL.toFixed(2) + '</td><td>kN/m2</td></tr>';
    html += '<tr><td>Live Load (NSCP)</td><td>' + LL.toFixed(2) + '</td><td>kN/m2</td></tr>';
    html += '<tr style="font-weight:bold; border-top:2px solid #000;"><td>FACTORED wu</td><td>' + wu.toFixed(2) + '</td><td>kN/m2</td></tr>';

    const tbody = document.getElementById('staircaseBody');
    if (tbody) tbody.innerHTML = html;
}

// --- WATER TANK LOADING ---
function calculateWaterTank() {
    const capacity = parseInt(document.getElementById('tankCapacity')?.value || 1000);
    const location = document.getElementById('tankLocation')?.value || 'roof';

    const waterWeight = capacity * 9.81 / 1000; // kN (1 liter = 1 kg)
    const tankSelfWeight = waterWeight * 0.15; // ~15% for tank structure
    const totalWeight = waterWeight + tankSelfWeight;

    // Distribute to nearest columns (assume 4 support points)
    const nSupports = 4;
    const pointLoad = totalWeight / nSupports;

    // If roof, add additional factor for seismic
    const seismicFactor = location === 'roof' ? 1.5 : 1.0;
    const designLoad = pointLoad * seismicFactor;

    let html = '';
    html += '<tr><td>Tank Capacity</td><td>' + capacity + '</td><td>liters</td></tr>';
    html += '<tr><td>Water Weight</td><td>' + waterWeight.toFixed(1) + '</td><td>kN</td></tr>';
    html += '<tr><td>Tank Self-Weight (~15%)</td><td>' + tankSelfWeight.toFixed(1) + '</td><td>kN</td></tr>';
    html += '<tr><td>Total Weight</td><td>' + totalWeight.toFixed(1) + '</td><td>kN</td></tr>';
    html += '<tr style="border-top:1px solid #ccc;"><td>Support Points</td><td>' + nSupports + '</td><td>columns</td></tr>';
    html += '<tr><td>Point Load (service)</td><td>' + pointLoad.toFixed(1) + '</td><td>kN</td></tr>';
    if (location === 'roof') {
        html += '<tr><td>Seismic Factor (Fp)</td><td>' + seismicFactor.toFixed(1) + '</td><td></td></tr>';
    }
    html += '<tr style="font-weight:bold; border-top:2px solid #000;"><td>DESIGN POINT LOAD</td><td>' + designLoad.toFixed(1) + '</td><td>kN per support</td></tr>';

    const tbody = document.getElementById('waterTankBody');
    if (tbody) tbody.innerHTML = html;
}
