        const RESIDENT_ETHOS_ENABLED = false;
        // ========== v3.0: PLAN TABS & LAYER TOGGLES ==========
        let currentPlanTab = 'structural';  // 'structural' first, then 'analysis' for tributary
        let lastStructuralTab = 'structural';

        function returnToLastPlan() {
            setPlanTab(lastStructuralTab || 'structural');
        }
        let layerVisibility = {
            grid: true,
            areas: true,
            beams: true,
            cols: true
        };

        // v3.0: Planted column beam placement mode
        let placingPlantedColumn = false;   // True when user is placing a planted column on a beam
        let selectedBeamForPC = null;       // Beam selected for planted column placement

        // Set active plan tab
        function setPlanTab(tab) {
            currentPlanTab = tab;

            // Update tab buttons FIRST (instant visual feedback)
            document.querySelectorAll('.plan-tab').forEach(btn => btn.classList.remove('active'));

            // Map tab names to button IDs
            const tabBtnMap = {
                'analysis': 'tabTribSlabs',
                'reactions': 'tabReactions',
                'tribBeams': 'tabTribBeams',
                'tribCols': 'tabTribCols',
                'structural': 'tabStructural',
                'foundation': 'tabFoundation',
                'colSchedule': 'tabColSchedule',
                'beamSchedule': 'tabBeamSchedule',
                'footingSchedule': 'tabFootingSchedule',
                'slabSchedule': 'tabSlabSchedule',
                'blockwall': 'tabBlockwall',
                'loadSummary': 'tabLoadSummary',
                'rebarSchedule': 'tabRebarSchedule',
                'bom': 'tabBOM',
                'seismic': 'tabSeismic',
                'wind': 'tabWind',
                'beamDesign': 'tabBeamDesign',
                'colDesign': 'tabColDesign',
                'slabDesign': 'tabSlabDesign',
                'staircase': 'tabStaircase',
                'waterTank': 'tabWaterTank',
                'validate': 'tabValidate',
                'bbs': 'tabBBS',
                'crackWidth': 'tabCrackWidth',
                'slenderness': 'tabSlenderness',
                'ductile': 'tabDuctile',
                'deflection': 'tabDeflection',
                'loadCombos': 'tabLoadCombos',
                'devLength': 'tabDevLength',
                'fdnStability': 'tabFdnStability',
                'pdfReport': 'tabPDFReport',
                'dashboard': 'tabDashboard',
                'settings': 'tabSettings',
                'costEstimate': 'tabCostEstimate',
                'steelSummary': 'tabSteelSummary',
                'retainingWall': 'tabRetainingWall',
                'combinedFtg': 'tabCombinedFtg',
                'torsion': 'tabTorsion',
                'mixDesign': 'tabMixDesign',
                'aiAssistant': 'tabAIAssistant'
            };

            const btnId = tabBtnMap[tab];
            if (btnId) {
                const btn = document.getElementById(btnId);
                if (btn) btn.classList.add('active');
            }

            // Hide all schedule panels
            const schedulePanels = ['panelReactions', 'panelTribBeams', 'panelTribCols', 'panelValidate', 'panelColSchedule', 'panelBeamSchedule', 'panelFootingSchedule', 'panelSlabSchedule', 'panelBlockwall', 'panelLoadSummary', 'panelRebarSchedule', 'panelBOM', 'panelSeismic', 'panelWind', 'panelBeamDesign', 'panelColDesign', 'panelSlabDesign', 'panelStaircase', 'panelWaterTank', 'panelBBS', 'panelCrackWidth', 'panelSlenderness', 'panelDuctile', 'panelDeflection', 'panelLoadCombos', 'panelDevLength', 'panelFdnStability', 'panelPDFReport', 'panelDashboard', 'panelSettings', 'panelCostEstimate', 'panelSteelSummary', 'panelRetainingWall', 'panelCombinedFtg', 'panelTorsion', 'panelMixDesign', 'panelAIAssistant'];
            schedulePanels.forEach(id => {
                const panel = document.getElementById(id);
                if (panel) panel.style.display = 'none';
            });

            // Get canvas and 3D elements
            const mainCanvas = document.getElementById('mainCanvas');
            const container3D = document.getElementById('container3D');

            // v3.8: Handle schedule tabs (reactions, tribBeams, tribCols are now canvas-based plan views)
            const isScheduleTab = ['validate', 'colSchedule', 'beamSchedule', 'footingSchedule', 'slabSchedule', 'blockwall', 'loadSummary', 'rebarSchedule', 'bom', 'seismic', 'wind', 'beamDesign', 'colDesign', 'slabDesign', 'staircase', 'waterTank', 'bbs', 'crackWidth', 'slenderness', 'ductile', 'deflection', 'loadCombos', 'devLength', 'fdnStability', 'pdfReport', 'dashboard', 'settings', 'costEstimate', 'steelSummary', 'retainingWall', 'combinedFtg', 'torsion', 'mixDesign', 'aiAssistant'].includes(tab);

            if (!isScheduleTab) lastStructuralTab = tab;

            const appContainer = document.querySelector('.app-container');

            if (isScheduleTab) {
                // Hide canvas, show schedule panel
                if (mainCanvas) mainCanvas.style.display = 'none';
                if (container3D) container3D.style.display = 'none';
                if (appContainer) appContainer.classList.add('schedule-mode');

                // v3.9: Defer schedule population to next frame for instant tab switch feel
                requestAnimationFrame(() => {
                    if (tab === 'colSchedule') {
                        document.getElementById('panelColSchedule').style.display = 'block';
                        populateColumnSchedule();
                    } else if (tab === 'beamSchedule') {
                        document.getElementById('panelBeamSchedule').style.display = 'block';
                        populateBeamSchedule();
                    } else if (tab === 'footingSchedule') {
                        document.getElementById('panelFootingSchedule').style.display = 'block';
                        populateFootingSchedule();
                    } else if (tab === 'slabSchedule') {
                        document.getElementById('panelSlabSchedule').style.display = 'block';
                        populateSlabSchedule();
                    } else if (tab === 'blockwall') {
                        document.getElementById('panelBlockwall').style.display = 'block';
                        calculateBlockwalls();
                    } else if (tab === 'loadSummary') {
                        document.getElementById('panelLoadSummary').style.display = 'block';
                        populateLoadSummary();
                    } else if (tab === 'rebarSchedule') {
                        document.getElementById('panelRebarSchedule').style.display = 'block';
                        populateRebarSchedule();
                    } else if (tab === 'bom') {
                        document.getElementById('panelBOM').style.display = 'block';
                        populateBOM();
                    } else if (tab === 'seismic') {
                        document.getElementById('panelSeismic').style.display = 'block';
                        calculateSeismic();
                    } else if (tab === 'wind') {
                        document.getElementById('panelWind').style.display = 'block';
                        calculateWind();
                    } else if (tab === 'beamDesign') {
                        document.getElementById('panelBeamDesign').style.display = 'block';
                        designAllBeams();
                    } else if (tab === 'colDesign') {
                        document.getElementById('panelColDesign').style.display = 'block';
                        checkAllColumns();
                    } else if (tab === 'slabDesign') {
                        document.getElementById('panelSlabDesign').style.display = 'block';
                        designAllSlabs();
                    } else if (tab === 'staircase') {
                        document.getElementById('panelStaircase').style.display = 'block';
                        calculateStaircase();
                    } else if (tab === 'validate') {
                        document.getElementById('panelValidate').style.display = 'block';
                        if (typeof renderValidationPanel === 'function') renderValidationPanel();
                    } else if (tab === 'waterTank') {
                        document.getElementById('panelWaterTank').style.display = 'block';
                        calculateWaterTank();
                    } else if (tab === 'bbs') {
                        document.getElementById('panelBBS').style.display = 'block';
                        populateBBS();
                    } else if (tab === 'crackWidth') {
                        document.getElementById('panelCrackWidth').style.display = 'block';
                        checkCrackWidth();
                    } else if (tab === 'slenderness') {
                        document.getElementById('panelSlenderness').style.display = 'block';
                        checkSlenderness();
                    } else if (tab === 'ductile') {
                        document.getElementById('panelDuctile').style.display = 'block';
                        populateDuctileDetailing();
                    } else if (tab === 'deflection') {
                        document.getElementById('panelDeflection').style.display = 'block';
                        checkDeflection();
                    } else if (tab === 'loadCombos') {
                        document.getElementById('panelLoadCombos').style.display = 'block';
                        populateLoadCombos();
                    } else if (tab === 'devLength') {
                        document.getElementById('panelDevLength').style.display = 'block';
                        populateDevLength();
                    } else if (tab === 'fdnStability') {
                        document.getElementById('panelFdnStability').style.display = 'block';
                        checkFdnStability();
                    } else if (tab === 'pdfReport') {
                        document.getElementById('panelPDFReport').style.display = 'block';
                    } else if (tab === 'dashboard') {
                        document.getElementById('panelDashboard').style.display = 'block';
                        populateDashboard();
                    } else if (tab === 'settings') {
                        document.getElementById('panelSettings').style.display = 'block';
                        loadSettings();
                    } else if (tab === 'costEstimate') {
                        document.getElementById('panelCostEstimate').style.display = 'block';
                        calculateCost();
                    } else if (tab === 'steelSummary') {
                        document.getElementById('panelSteelSummary').style.display = 'block';
                        populateSteelSummary();
                    } else if (tab === 'retainingWall') {
                        document.getElementById('panelRetainingWall').style.display = 'block';
                        designRetainingWall();
                    } else if (tab === 'combinedFtg') {
                        document.getElementById('panelCombinedFtg').style.display = 'block';
                        designCombinedFooting();
                    } else if (tab === 'torsion') {
                        document.getElementById('panelTorsion').style.display = 'block';
                        checkTorsion();
                    } else if (tab === 'mixDesign') {
                        document.getElementById('panelMixDesign').style.display = 'block';
                        calculateMixDesign();
                    } else if (tab === 'aiAssistant') {
                        document.getElementById('panelAIAssistant').style.display = 'block';
                        initAIAssistant();
                    }
                });
            } else {
                if (appContainer) appContainer.classList.remove('schedule-mode');
                // Show canvas for plan tabs
                if (mainCanvas) mainCanvas.style.display = 'block';
                // v3.9 FIX: Properly exit 3D mode - hide container and remove active class
                if (container3D) {
                    container3D.classList.remove('active');
                    container3D.style.display = 'none';  // Explicitly hide
                }
                // Update 3D button state
                const btn3D = document.getElementById('view3D');
                if (btn3D) btn3D.classList.remove('active');
                // v3.9: Defer draw to next frame for instant tab switch feel
                requestAnimationFrame(() => draw());
            }

            console.log(`v3.9: Switched to ${tab} tab`);
        }

        // Toggle layer visibility
        function toggleLayer(layer) {
            layerVisibility[layer] = !layerVisibility[layer];
            const btn = document.getElementById('layer' + layer.charAt(0).toUpperCase() + layer.slice(1));
            if (btn) {
                btn.classList.toggle('active', layerVisibility[layer]);
            }
            draw();
            console.log(`v3.0: Layer ${layer} = ${layerVisibility[layer]}`);
        }

        const MIN_SPAN = 0.25; // m, guard against zero/negative spans

        function sanitizeSpan(value, fallback = 4.0) {
            const numeric = parseFloat(value);
            if (Number.isFinite(numeric) && numeric > MIN_SPAN) return numeric;
            return fallback;
        }

        // ========== v3.1: COLUMN GRID ALIGNMENT ==========
        // Toggle between centered and outer-aligned edge columns
        function syncColumnAlignmentButton() {
            const btn = document.getElementById('colAlignBtn');
            if (!btn) return;

            if (state.columnAlignment === 'outer') {
                btn.textContent = '📍 Col: Flush';
                btn.style.background = 'linear-gradient(135deg, #10b981, #047857)';
                btn.style.color = 'white';
                btn.style.borderColor = '#10b981';
            } else {
                btn.textContent = '📍 Col: Center';
                btn.style.background = 'transparent';
                btn.style.color = '#10b981';
                btn.style.borderColor = '#10b981';
            }
        }

        function toggleColumnAlignment() {
            if (state.columnAlignment === 'center') {
                state.columnAlignment = 'outer';
            } else {
                state.columnAlignment = 'center';
            }

            syncColumnAlignmentButton();

            console.log(`v3.1: Column alignment = ${state.columnAlignment}`);
            draw();
            if (typeof render3DFrame === 'function' && view3DInitialized) {
                render3DFrame();
            }
        }

        // ========== CANVAS SETUP ==========
        let canvas, ctx;

        function initCanvas() {
            canvas = document.getElementById('mainCanvas');
            ctx = canvas.getContext('2d');
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);
            // v2.7: Click on column to toggle active state
            canvas.addEventListener('click', handleCanvasClick);
            // v3.0: Mouseup for beam drawing
            canvas.addEventListener('mouseup', finishBeamDraw);
        }

        function resizeCanvas() {
            const wrapper = canvas.parentElement;
            canvas.width = wrapper.clientWidth;
            canvas.height = wrapper.clientHeight;
            draw();
        }

        // NOTE: handleCanvasClick is defined later (around line 4083) with full functionality
        // including: beam mode, beam deletion, slab void, column context menu, and Shift+Click-to-place

        // v3.0: Finish beam drawing (placeholder for beam draw mode)
        // ========== SPAN UI ==========
        function renderSpans() {
            renderSpanInputs('x', state.xSpans, 'xSpansContainer');
            renderSpanInputs('y', state.ySpans, 'ySpansContainer');
        }

        function renderSpanInputs(dir, spans, containerId) {
            const container = document.getElementById(containerId);
            container.innerHTML = '';

            spans.forEach((span, i) => {
                const row = document.createElement('div');
                row.className = 'span-row';
                row.innerHTML = `
                    <span style="color:#8b949e;font-size:0.7rem;width:30px;">${dir.toUpperCase()}${i + 1}</span>
                    <input type="number" value="${span}" step="0.5" min="${MIN_SPAN}" max="20"
                           onchange="updateSpan('${dir}', ${i}, this.value)">
                    <button class="remove-btn" onclick="removeSpan('${dir}', ${i})"
                            ${spans.length <= 1 ? 'disabled' : ''}>×</button>
                `;
                container.appendChild(row);
            });
        }

        function updateSpan(dir, index, value) {
            const spans = dir === 'x' ? state.xSpans : state.ySpans;
            spans[index] = sanitizeSpan(value, spans[index] || 4.0);
            calculate();
        }

        function addSpan(dir) {
            const spans = dir === 'x' ? state.xSpans : state.ySpans;
            spans.push(4.0);
            syncCantileversToSpans();  // v3.0: Keep cantilever arrays in sync
            renderSpans();
            renderCantileverInputs();  // v3.0: Re-render cantilever inputs
            calculate();
        }

        function removeSpan(dir, index) {
            const spans = dir === 'x' ? state.xSpans : state.ySpans;
            if (spans.length > 1) {
                spans.splice(index, 1);
                syncCantileversToSpans();  // v3.0: Keep cantilever arrays in sync
                renderSpans();
                renderCantileverInputs();  // v3.0: Re-render cantilever inputs
                calculate();
            }
        }

        // ========== v3.0: CANTILEVER UI ==========

        // Sync cantilever arrays when spans change
        function syncCantileversToSpans() {
            // Top/Bottom match xSpans length
            while (state.cantilevers.top.length < state.xSpans.length) {
                state.cantilevers.top.push(0);
            }
            while (state.cantilevers.top.length > state.xSpans.length) {
                state.cantilevers.top.pop();
            }
            while (state.cantilevers.bottom.length < state.xSpans.length) {
                state.cantilevers.bottom.push(0);
            }
            while (state.cantilevers.bottom.length > state.xSpans.length) {
                state.cantilevers.bottom.pop();
            }

            // Left/Right match ySpans length
            while (state.cantilevers.left.length < state.ySpans.length) {
                state.cantilevers.left.push(0);
            }
            while (state.cantilevers.left.length > state.ySpans.length) {
                state.cantilevers.left.pop();
            }
            while (state.cantilevers.right.length < state.ySpans.length) {
                state.cantilevers.right.push(0);
            }
            while (state.cantilevers.right.length > state.ySpans.length) {
                state.cantilevers.right.pop();
            }

            // v3.0 FIX: Also sync per-floor cantilever arrays for all floors
            for (const floor of state.floors) {
                if (!floor.cantilevers) continue;

                // Top/Bottom match xSpans length
                while (floor.cantilevers.top.length < state.xSpans.length) floor.cantilevers.top.push(0);
                while (floor.cantilevers.top.length > state.xSpans.length) floor.cantilevers.top.pop();
                while (floor.cantilevers.bottom.length < state.xSpans.length) floor.cantilevers.bottom.push(0);
                while (floor.cantilevers.bottom.length > state.xSpans.length) floor.cantilevers.bottom.pop();

                // Left/Right match ySpans length
                while (floor.cantilevers.left.length < state.ySpans.length) floor.cantilevers.left.push(0);
                while (floor.cantilevers.left.length > state.ySpans.length) floor.cantilevers.left.pop();
                while (floor.cantilevers.right.length < state.ySpans.length) floor.cantilevers.right.push(0);
                while (floor.cantilevers.right.length > state.ySpans.length) floor.cantilevers.right.pop();
            }
        }

        // Render cantilever input fields for all 4 edges
        function renderCantileverInputs() {
            syncCantileversToSpans();

            // Top edge (follows X spans)
            renderCantileverEdge('cantileverTop', 'top', state.xSpans, 'X');
            // Bottom edge (follows X spans)
            renderCantileverEdge('cantileverBottom', 'bottom', state.xSpans, 'X');
            // Left edge (follows Y spans)
            renderCantileverEdge('cantileverLeft', 'left', state.ySpans, 'Y');
            // Right edge (follows Y spans)
            renderCantileverEdge('cantileverRight', 'right', state.ySpans, 'Y');
        }

        function renderCantileverEdge(containerId, edge, spans, axis) {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.innerHTML = '';
            const values = state.cantilevers[edge];

            spans.forEach((span, i) => {
                const inputDiv = document.createElement('div');
                inputDiv.className = 'cantilever-span-input';
                inputDiv.innerHTML = `
                    <span>${axis}${i + 1}</span>
                    <input type="number" value="${values[i] || 0}" step="0.1" min="0" max="5"
                           onchange="updateCantilever('${edge}', ${i}, this.value)"
                           title="Cantilever for ${axis}${i + 1} span (${span}m)">
                `;
                container.appendChild(inputDiv);
            });
        }

        // v3.0: Update cantilever value (Global UI + Per Floor Persistence)
        function updateCantilever(edge, index, value) {

            const numValue = parseFloat(value) || 0;
            const clamped = Math.max(0, Math.min(5, numValue));  // Clamp 0-5m

            // 1. Update Global UI state (what binds to inputs currently)
            state.cantilevers[edge][index] = clamped;

            // 2. Persist to Current Floor
            // This ensures that when we generate loads for this floor, we use these values
            const currentFloor = state.floors[state.currentFloorIndex];
            if (currentFloor) {
                if (!currentFloor.cantilevers) {
                    // Init structure if missing
                    currentFloor.cantilevers = {
                        top: [...state.cantilevers.top],
                        bottom: [...state.cantilevers.bottom],
                        left: [...state.cantilevers.left],
                        right: [...state.cantilevers.right]
                    };
                }
                currentFloor.cantilevers[edge][index] = clamped;
            }

            calculate();
        }

        // ========== v3.1: MEMBER DIMENSIONS TABLE ==========
        // CAD Layers for DXF Export
        const CAD_LAYERS = {
            GRID: 'A-GRID',           // Gridlines
            GRID_BUBBLE: 'A-GRID-IDEN', // Grid bubbles/identifiers
            DIMENSION: 'A-ANNO-DIMS',  // Dimensions
            BEAM: 'S-BEAM',           // Structural beams
            COLUMN: 'S-COLS',         // Structural columns
            SLAB: 'S-SLAB',           // Slab outlines
            TEXT: 'A-ANNO-TEXT'       // General text/labels
        };

        // Update member dimensions from the table and sync with left panel
        function updateMemberDimensions() {
            // Read values from dimension table
            const colB = parseInt(document.getElementById('dimColB')?.value) || 250;
            const colD = parseInt(document.getElementById('dimColD')?.value) || 250;
            const beamB = parseInt(document.getElementById('dimBeamB')?.value) || 250;
            const beamD = parseInt(document.getElementById('dimBeamD')?.value) || 400;

            // Update state
            state.defaultColumnB = colB;
            state.defaultColumnH = colD;
            state.defaultBeamB = beamB;
            state.defaultBeamH = beamD;

            // Sync with left panel inputs (if they exist)
            const colBInput = document.getElementById('columnWidthInput');
            const colDInput = document.getElementById('columnDepthInput');
            const beamBInput = document.getElementById('beamWidthInput');
            const beamDInput = document.getElementById('beamDepthInput');

            if (colBInput) colBInput.value = colB;
            if (colDInput) colDInput.value = colD;
            if (beamBInput) beamBInput.value = beamB;
            if (beamDInput) beamDInput.value = beamD;

            console.log(`v3.1: Member dimensions updated - Col: ${colB}x${colD}, Beam: ${beamB}x${beamD}`);

            // Recalculate to redraw
            calculate();
        }

        // Sync dimension table FROM state (called on load/project load)
        function syncDimensionTable() {
            const dimColB = document.getElementById('dimColB');
            const dimColD = document.getElementById('dimColD');
            const dimBeamB = document.getElementById('dimBeamB');
            const dimBeamD = document.getElementById('dimBeamD');

            if (dimColB) dimColB.value = state.defaultColumnB || 250;
            if (dimColD) dimColD.value = state.defaultColumnH || 250;
            if (dimBeamB) dimBeamB.value = state.defaultBeamB || 250;
            if (dimBeamD) dimBeamD.value = state.defaultBeamH || 400;
        }

        // ========== v2.3: FLOOR TABS UI ==========

        function getOrdinalSuffix(num) {
            const mod100 = num % 100;
            if (mod100 >= 11 && mod100 <= 13) return 'th';
            switch (num % 10) {
                case 1: return 'st';
                case 2: return 'nd';
                case 3: return 'rd';
                default: return 'th';
            }
        }

        function getFloorId(index, total, includeGF = state.gfSuspended) {
            if (includeGF && index === 0) return 'GF';
            if (index === total - 1) return 'RF';
            return `${index + (includeGF ? 1 : 2)}F`;
        }

        function getFloorName(id, isRoof) {
            if (id === 'GF') return 'Ground Floor';
            if (isRoof || id === 'RF') return 'Roof';
            const floorNum = parseInt(id, 10);
            return `${floorNum}${getOrdinalSuffix(floorNum)} Floor`;
        }

        function renderFloorTabs() {
            const container = document.getElementById('floorTabs');
            container.innerHTML = '';

            state.floors.forEach((floor, i) => {
                const btn = document.createElement('button');
                btn.className = `floor-tab${i === state.currentFloorIndex ? ' active' : ''}${floor.isRoof ? ' roof' : ''}`;
                btn.textContent = floor.id;
                btn.onclick = () => selectFloor(i);
                container.appendChild(btn);
            });

            updateFloorUI();
        }

        function selectFloor(index) {
            state.currentFloorIndex = index;
            renderFloorTabs();

            // v3.0: Recalculate to regenerate slabs with per-floor void data
            calculate();

            // Refresh column table to show this floor's loads
            if (state.columns.length > 0) {
                const currentFloor = state.floors[state.currentFloorIndex];
                const currentSlabWeight = 24 * (currentFloor.slabThickness / 1000);
                const puDisplay = 1.2 * (currentFloor.dlSuper + currentSlabWeight) + 1.6 * currentFloor.liveLoad;

                // Update factored load display
                document.getElementById('factoredLoad').textContent = puDisplay.toFixed(2);

                // Update column table
                updateColumnTable();
            }
        }


        function updateColumnTable() {
            const currentFloor = state.floors[state.currentFloorIndex];
            if (!currentFloor) return;

            // Total per floor (use current selected floor)
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

            // v3.0: Build floor options for dropdown (empty = ground)
            const floorOptions = state.floors.map(f =>
                `<option value="${f.id}">${f.id}</option>`
            ).join('');

            // v3.1: Generate column type IDs based on size (C1, C2, etc.)
            // Columns with same BxD get same type
            const columnTypeMap = new Map();  // key: "BxD" -> type number
            let nextColType = 1;
            state.columns.forEach(col => {
                if (col.active === false) return;
                const { b, h } = getColumnSizeMm(col);
                const sizeKey = `${b}x${h}`;
                if (!columnTypeMap.has(sizeKey)) {
                    columnTypeMap.set(sizeKey, nextColType++);
                }
            });

            function getColumnTypeId(col) {
                const { b, h } = getColumnSizeMm(col);
                const sizeKey = `${b}x${h}`;
                return `C${columnTypeMap.get(sizeKey) || 1}`;
            }

            // v3.0: Column table with b×h size, planted column dropdown, and toggle checkbox
            const colBody = document.getElementById('columnResultsBody');
            colBody.innerHTML = state.columns.map(col => {
                const floorLoad = col.floorLoads.find(f => f.floorId === currentFloor.id);
                const thisFloor = floorLoad ? floorLoad.load : 0;
                const footingStr = col.footingSize ? `${col.footingSize.toFixed(1)}×${col.footingSize.toFixed(1)}` : '-';
                // v3.0: Per-floor active state
                const isActiveOnThisFloor = isColumnActiveOnFloor(col, currentFloor.id);
                const isActiveOnAnyFloor = col.active !== false;
                // v3.0: Show column size as b×h
                const colSize = getColumnSizeMm(col);
                const colSizeStr = `${colSize.b}×${colSize.h}`;
                // v3.0: Planted column indicator
                const isPlanted = col.startFloor ? true : false;
                // v3.0: Partial indicator - active on some floors but not this one
                const isPartial = isActiveOnAnyFloor && !isActiveOnThisFloor;
                // v3.0: Get column type for THIS floor (not global)
                const colType = getColumnTypeForFloor(col, currentFloor.id);
                // v3.1: Get column type ID (C1, C2 based on size)
                const colTypeId = isActiveOnAnyFloor ? getColumnTypeId(col) : '-';
                // v3.0: Calculate breakdown totals
                let totalSlabLoad = 0, totalBeamDL = 0;
                col.floorLoads.forEach(fl => {
                    totalSlabLoad += (fl.slabLoad || 0);
                    totalBeamDL += (fl.beamDL || 0);
                });
                const colDL = col.columnDL || 0;
                const tieBeamDL = col.tieBeamDL || 0;
                const footingDL = col.footingDL || 0;

                // v3.0: Breakdown tooltip text
                const breakdownText = `LOAD BREAKDOWN for ${col.id}:
━━━━━━━━━━━━━━━━
📦 Slab+LL:    ${totalSlabLoad.toFixed(1)} kN
📏 Beam DL:    ${totalBeamDL.toFixed(1)} kN
🏛️ Column DL:  ${colDL.toFixed(1)} kN
🔗 Tie Beam:   ${tieBeamDL.toFixed(1)} kN
🧱 Footing:    ${footingDL.toFixed(1)} kN
━━━━━━━━━━━━━━━━
📊 TOTAL:      ${(col.totalLoadWithDL || col.totalLoad).toFixed(1)} kN`;

                return `
        <tr style="${!isActiveOnThisFloor ? 'opacity:0.4;text-decoration:line-through;' : ''} ${isPlanted ? 'background:rgba(249,115,22,0.1);' : ''} ${isPartial ? 'background:rgba(59,130,246,0.1);' : ''}">
            <td style="text-align:center;" title="Toggle column on ${currentFloor.id} only">
                <input type="checkbox" ${isActiveOnThisFloor ? 'checked' : ''} onchange="toggleColumn('${col.id}')" style="cursor:pointer;width:16px;height:16px;">
            </td>
            <td><strong style="color:#00d4ff;">${colTypeId}-${col.id}</strong></td>
            <td style="color:${colType === 'corner' ? '#f59e0b' : colType === 'edge' ? '#00d4ff' : '#10b981'}">${colType}</td>
            <td>
                <select onchange="setColumnStartFloor('${col.id}', this.value)" style="padding:2px;font-size:0.65rem;background:#1a1f2e;color:#fff;border:1px solid ${isPlanted ? '#f97316' : '#444'};border-radius:4px;width:50px;">
                    <option value="" ${!col.startFloor ? 'selected' : ''}>GND</option>
                    ${state.floors.map(f =>
                    `<option value="${f.id}" ${col.startFloor === f.id ? 'selected' : ''}>${f.id}</option>`
                ).join('')}
                </select>
            </td>
            <td>${isActiveOnThisFloor ? thisFloor.toFixed(1) : '-'}</td>
            <td><strong>${isActiveOnAnyFloor ? col.totalLoad.toFixed(1) : '-'}</strong></td>
        </tr>
    `;
            }).join('');

            // v3.0: Also update summary panel
            updateLoadSummary();
        }

        // v3.0: Update load summary panel with totals
        function updateLoadSummary() {
            let sumSlabDL = 0, sumLL = 0, sumBeamDL = 0, sumColDL = 0, sumTieBeamDL = 0, sumFootingDL = 0;

            // Calculate slab area and loads
            const numFloors = state.floors.length;
            const slabArea = state.slabs.reduce((sum, s) => {
                if (s.isVoid || s.isCantilever) return sum;
                return sum + (Math.abs(s.x2 - s.x1) * Math.abs(s.y2 - s.y1));
            }, 0);

            // Slab DL = area × thickness × concrete density × floors × 1.2 factor
            const slabThickM = (state.slabThickness || 150) / 1000;
            sumSlabDL = slabArea * slabThickM * (state.concreteDensity || 24) * numFloors * 1.2;

            // LL = area × LL intensity × floors × 1.6 factor
            sumLL = slabArea * (state.LL || 2.0) * numFloors * 1.6;

            // Sum from columns
            state.columns.forEach(col => {
                if (col.active === false) return;
                sumColDL += (col.columnDL || 0);
                sumTieBeamDL += (col.tieBeamDL || 0);
                sumFootingDL += (col.footingDL || 0);
            });

            // Sum beam DL
            sumBeamDL = (state.totalBeamSelfWeight || 0) * numFloors * 1.2;

            // Update UI - don't add ' kN' suffix since HTML table has a kN column
            const fmt = (v) => v > 0 ? v.toFixed(0) : '-';
            document.getElementById('sumSlabDL').textContent = fmt(sumSlabDL);
            document.getElementById('sumLL').textContent = fmt(sumLL);
            document.getElementById('sumBeamDL').textContent = fmt(sumBeamDL);
            document.getElementById('sumColDL').textContent = fmt(sumColDL);
            document.getElementById('sumTieBeamDL').textContent = fmt(sumTieBeamDL);
            document.getElementById('sumFootingDL').textContent = fmt(sumFootingDL);

            const grandTotal = sumSlabDL + sumLL + sumBeamDL + sumColDL + sumTieBeamDL + sumFootingDL;
            document.getElementById('grandTotal').textContent = grandTotal.toFixed(0);
        }


        // v3.0: Helper - Check if floorId is at or above startFloor
        // Used for planted columns (columns that start above ground)
        function isFloorAtOrAbove(floorId, startFloor) {
            return EngineLoads.isFloorAtOrAbove(state.floors, floorId, startFloor);
        }

        // v2.7: Toggle column active state (for L/U layouts)
        // v3.0: Now per-floor - toggling on RF doesn't affect 2F
        function toggleColumn(colId, floorId = null) {
            const col = state.columns.find(c => c.id === colId);
            if (!col) return;

            // Use current floor if not specified
            const targetFloor = floorId || state.floors[state.currentFloorIndex].id;

            // Initialize activePerFloor if not exists (migrate from old boolean)
            if (!col.activePerFloor) {
                col.activePerFloor = {};
                state.floors.forEach(f => {
                    col.activePerFloor[f.id] = col.active !== false;
                });
            }

            // Toggle for this specific floor
            col.activePerFloor[targetFloor] = !col.activePerFloor[targetFloor];

            // Update legacy active flag (true if active on ANY floor)
            col.active = Object.values(col.activePerFloor).some(v => v);

            console.log(`v3.0: Column ${colId} toggled on ${targetFloor}: ${col.activePerFloor[targetFloor] ? 'ON' : 'OFF'}`);

            calculate();  // Recalculate loads
            recalculateColumnTypes(targetFloor); // v3.0: Recalculate for THIS floor specifically
            render3DFrame();  // Re-render 3D
        }

        // v3.0: Check if column is active on a specific floor
        function isColumnActiveOnFloor(col, floorId) {
            return EngineLoads.isColumnActiveOnFloor(col, floorId, state.floors);
        }

        // v3.2: Update tie beam size from input controls
        function updateTieBeamSize() {
            const widthInput = document.getElementById('tieBeamWidth');
            const depthInput = document.getElementById('tieBeamDepth');

            state.tieBeamWidth = normalizeMemberSizeMm(widthInput.value, 200, 150, 1500, 25);
            state.tieBeamDepth = normalizeMemberSizeMm(depthInput.value, 350, 200, 2000, 25);

            // Enforce minimums (NBC code)
            if (state.tieBeamWidth < 200) {
                state.tieBeamWidth = 200;
                widthInput.value = 200;
            }
            if (state.tieBeamDepth < 350) {
                state.tieBeamDepth = 350;
                depthInput.value = 350;
            }
            state.tieBeamW = state.tieBeamWidth / 1000;
            state.tieBeamH = state.tieBeamDepth / 1000;
            if (widthInput) widthInput.value = state.tieBeamWidth;
            if (depthInput) depthInput.value = state.tieBeamDepth;

            console.log(`v3.2: Tie beam size updated: ${state.tieBeamWidth}×${state.tieBeamDepth}mm`);
            refreshMemberSizeDependents();
        }

        // v3.2: Update footing schedule table
        function updateFootingSchedule() {
            const tbody = document.getElementById('footingScheduleBody');
            if (!tbody) return;

            // Get columns with footings (non-planted)
            const footingColumns = state.columns.filter(col => {
                if (col.active === false) return false;
                if (col.startFloor && col.startFloor !== 'GND' && col.startFloor !== '1F') return false;
                return true;
            });

            // Group by footing size
            const footingTypes = {};
            footingColumns.forEach(col => {
                const size = col.footingSize || 1.0;
                const sizeKey = size.toFixed(2);
                if (!footingTypes[sizeKey]) {
                    footingTypes[sizeKey] = {
                        size: size,
                        count: 0,
                        typeId: `F${Object.keys(footingTypes).length + 1}`,
                        columns: [],
                        design: null
                    };
                }
                footingTypes[sizeKey].count++;
                footingTypes[sizeKey].columns.push(col.id);
                // Use first column's design as representative
                if (!footingTypes[sizeKey].design && col.footingDesign) {
                    footingTypes[sizeKey].design = col.footingDesign;
                }
            });

            // Build schedule rows with design results
            let html = '';
            Object.values(footingTypes).forEach(ft => {
                const fd = ft.design;
                const thk = fd ? fd.h : 300;
                const rebar = fd ? fd.rebarStr : '-';
                const punchOK = fd ? (fd.punchingOK ? '✓' : '✗') : '-';
                const shearOK = fd ? (fd.wideOK ? '✓' : '✗') : '-';

                html += `
                    <tr>
                        <td><strong>${ft.typeId}</strong></td>
                        <td style="font-size:0.6rem;">${ft.columns.slice(0, 4).join(', ')}${ft.columns.length > 4 ? ' +' + (ft.columns.length - 4) : ''}</td>
                        <td>${ft.size.toFixed(2)}×${ft.size.toFixed(2)}</td>
                        <td>${thk}</td>
                        <td style="font-size:0.6rem;">${rebar}</td>
                        <td style="text-align:center;">${punchOK}</td>
                        <td style="text-align:center;">${shearOK}</td>
                    </tr>
                `;
            });

            tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center;color:#8b949e;">No footings</td></tr>';

            // Update summary
            const summaryEl = document.getElementById('footingScheduleSummary');
            if (summaryEl) {
                summaryEl.textContent = `Total: ${footingColumns.length} footings, ${Object.keys(footingTypes).length} types`;
            }
        }


        // Alias for tab switching
        const populateFootingSchedule = updateFootingSchedule;

        // v3.0: Set column start floor (for planted columns)
        function setColumnStartFloor(colId, floorId) {
            const col = state.columns.find(c => c.id === colId);
            if (col) {
                col.startFloor = floorId || null;  // null = from ground
                calculate();  // Recalculate with new start floor
                render3DFrame();  // Re-render 3D
                console.log(`v3.0: Column ${colId} planted at ${floorId || 'Ground'}`);
            }
        }

        // v3.0: Set column size override (manual b×h)
        function setColumnSize(colId, dim, value) {
            const col = state.columns.find(c => c.id === colId);
            if (col) {
                updateColumnParam(colId, dim === 'b' ? 'webB' : 'webD', value);
            }
        }

        // v3.0: Set beam size override (manual b×h)
        function setBeamSize(beamId, dim, value) {
            const beam = state.beams.find(b => b.id === beamId);
            if (beam) {
                updateBeamParam(beamId, dim === 'b' ? 'webW' : 'webD', value);
            }
        }

        // v3.0: Update slab openings table in results panel
        function updateSlabOpeningsTable() {
            const tbody = document.getElementById('slabOpeningsBody');
            if (!tbody) return;

            tbody.innerHTML = state.slabs.map(slab => {
                const openingW = slab.openingW || 0;
                const openingH = slab.openingH || 0;
                const openingArea = openingW * openingH;
                const netArea = slab.area - openingArea;
                const hasOpening = openingArea > 0;

                return `
                <tr style="${hasOpening ? 'background:rgba(239,68,68,0.1);' : ''}">
                    <td><strong>${slab.id}</strong></td>
                    <td style="font-size:0.65rem;">${slab.lx.toFixed(1)}×${slab.ly.toFixed(1)}</td>
                    <td>
                        <input type="number" value="${openingW}" step="0.1" min="0" max="${slab.lx}"
                               style="width:40px;padding:2px;font-size:0.65rem;background:#1a1f2e;color:#fff;border:1px solid ${hasOpening ? '#ef4444' : '#444'};border-radius:3px;"
                               onchange="setSlabOpening('${slab.id}', 'w', this.value)">×
                        <input type="number" value="${openingH}" step="0.1" min="0" max="${slab.ly}"
                               style="width:40px;padding:2px;font-size:0.65rem;background:#1a1f2e;color:#fff;border:1px solid ${hasOpening ? '#ef4444' : '#444'};border-radius:3px;"
                               onchange="setSlabOpening('${slab.id}', 'h', this.value)">
                    </td>
                    <td style="color:${hasOpening ? '#ef4444' : '#10b981'}">${netArea.toFixed(1)} m²</td>
                </tr>
            `;
            }).join('');
        }

        // v3.0: Set opening dimension for a slab
        function setSlabOpening(slabId, dim, value) {
            const slab = state.slabs.find(s => s.id === slabId);
            if (slab) {
                const numValue = parseFloat(value) || 0;
                if (dim === 'w') {
                    slab.openingW = Math.min(numValue, slab.lx * 0.9);  // Max 90% of slab width
                } else {
                    slab.openingH = Math.min(numValue, slab.ly * 0.9);  // Max 90% of slab height
                }
                // Recalculate net area
                slab.netArea = slab.area - (slab.openingW || 0) * (slab.openingH || 0);
                const floor = state.floors[state.currentFloorIndex];
                if (floor) {
                    if (!floor.slabOpenings) floor.slabOpenings = [];
                    const existing = floor.slabOpenings.find(opening => opening.id === slabId);
                    if (existing) {
                        existing.openingW = slab.openingW || 0;
                        existing.openingH = slab.openingH || 0;
                    } else {
                        floor.slabOpenings.push({
                            id: slabId,
                            openingW: slab.openingW || 0,
                            openingH: slab.openingH || 0
                        });
                    }
                    floor.slabOpenings = floor.slabOpenings.filter(opening =>
                        Number(opening.openingW || 0) > 0 || Number(opening.openingH || 0) > 0
                    );
                }
                console.log(`v3.0: Slab ${slabId} opening set to ${slab.openingW}×${slab.openingH}m (net: ${slab.netArea.toFixed(1)}m²)`);

                // Recalculate loads with new net areas
                calculate();
            }
        }

        // v2.7: Recalculate column types based on ACTIVE columns only
        // This identifies new corners/edges when columns are disabled (for L/U shapes)
        // v3.0: Recalculate column types (corner/edge/interior) for a specific floor
        function recalculateColumnTypes(floorId = null) {
            // Use current floor if not specified
            const targetFloorId = floorId || state.floors[state.currentFloorIndex]?.id;
            const maxXi = Math.max(...state.columns.map(c => c.xi));
            const maxYi = Math.max(...state.columns.map(c => c.yi));

            // v3.0: Helper uses per-floor active state - returns BOOLEAN
            function hasActiveAt(xi, yi) {
                const col = state.columns.find(c => c.xi === xi && c.yi === yi);
                if (!col) return false;  // v3.0: Explicitly return false for out-of-bounds
                return isColumnActiveOnFloor(col, targetFloorId);
            }

            for (let col of state.columns) {
                // v3.0: Skip if column is inactive on this floor
                if (!isColumnActiveOnFloor(col, targetFloorId)) continue;

                const { xi, yi } = col;

                // Count active neighbors in each direction
                const hasLeft = hasActiveAt(xi - 1, yi);
                const hasRight = hasActiveAt(xi + 1, yi);
                const hasUp = hasActiveAt(xi, yi - 1);
                const hasDown = hasActiveAt(xi, yi + 1);

                // Also check diagonals for re-entrant corner detection
                const hasUpLeft = hasActiveAt(xi - 1, yi - 1);
                const hasUpRight = hasActiveAt(xi + 1, yi - 1);
                const hasDownLeft = hasActiveAt(xi - 1, yi + 1);
                const hasDownRight = hasActiveAt(xi + 1, yi + 1);

                const horizNeighbors = (hasLeft ? 1 : 0) + (hasRight ? 1 : 0);
                const vertNeighbors = (hasUp ? 1 : 0) + (hasDown ? 1 : 0);
                const totalNeighbors = horizNeighbors + vertNeighbors;

                // Determine column type based on orthogonal neighbors ONLY
                // Diagonal gaps don't make a column a corner - structural load still goes through orthogonal neighbors

                // v3.0: Initialize typePerFloor if not exists
                if (!col.typePerFloor) col.typePerFloor = {};

                let newType = 'interior';
                if (totalNeighbors === 4) {
                    // Has neighbors on all 4 sides = always interior
                    newType = 'interior';
                } else if (totalNeighbors === 3) {
                    // Missing 1 orthogonal neighbor = edge column
                    newType = 'edge';
                } else if (totalNeighbors === 2) {
                    // Check if L-shape (corner) or in-line (edge)
                    const isLShape = (hasLeft && hasUp) || (hasLeft && hasDown) ||
                        (hasRight && hasUp) || (hasRight && hasDown);
                    newType = isLShape ? 'corner' : 'edge';
                } else {
                    // 0 or 1 neighbor = corner (edge case)
                    newType = 'corner';
                }

                // v3.0: Store per-floor type and update global type for current floor
                col.typePerFloor[targetFloorId] = newType;
                col.type = newType;  // Also update global for backward compatibility
            }
        }

        // v3.0: Get column type for a specific floor
        function getColumnTypeForFloor(col, floorId) {
            if (!col) return 'interior';
            if (col.typePerFloor && col.typePerFloor[floorId]) {
                return col.typePerFloor[floorId];
            }
            return col.type || 'interior';
        }

        function updateFloorUI() {
            const floor = state.floors[state.currentFloorIndex];
            if (!floor) return;

            document.getElementById('currentFloorName').textContent = floor.name;
            document.getElementById('floorTypeBadge').textContent = floor.isRoof ? 'Roof' : 'Typical';
            document.getElementById('floorTypeBadge').className = `floor-type-badge${floor.isRoof ? ' roof' : ''}`;

            document.getElementById('floorDL').value = floor.dlSuper;
            document.getElementById('floorLL').value = floor.liveLoad;
            document.getElementById('floorSlabThickness').value = floor.slabThickness;
            document.getElementById('floorHeight').value = floor.height;
            document.getElementById('floorWallLoad').value = floor.wallLoad || 0;
        }

        function updateCurrentFloor() {
            const floor = state.floors[state.currentFloorIndex];
            if (!floor) return;

            floor.dlSuper = parseFloat(document.getElementById('floorDL').value) || 2.0;
            floor.liveLoad = parseFloat(document.getElementById('floorLL').value) || 2.0;
            floor.slabThickness = parseFloat(document.getElementById('floorSlabThickness').value) || 150;
            floor.height = parseFloat(document.getElementById('floorHeight').value) || 3.0;
            floor.wallLoad = parseFloat(document.getElementById('floorWallLoad').value) || 0;

            calculate();
        }

        // v2.6: Toggle GF suspended slab
        // v2.7: Now dynamically adds/removes GF from floors array
        function toggleGFSuspended() {
            state.gfSuspended = document.getElementById('gfSuspended').checked;

            // Show/hide elevation height dropdown
            const elevSection = document.getElementById('elevationSection');
            if (elevSection) {
                elevSection.style.display = state.gfSuspended ? 'block' : 'none';
            }

            // v2.7: Add or remove GF floor from array
            const hasGF = state.floors.some(f => f.id === 'GF');

            if (state.gfSuspended && !hasGF) {
                const elevHeight = parseFloat(document.getElementById('elevationHeight')?.value) || 1.2;
                state.floors.unshift(
                    createFloor('GF', 'Ground Floor', state.xSpans.length, state.ySpans.length, { height: elevHeight })
                );
                state.currentFloorIndex = 0;
            } else if (!state.gfSuspended && hasGF) {
                // Remove GF from the start
                state.floors.shift();
                state.currentFloorIndex = 0;
            }

            renderFloorTabs();
            calculate();
        }

        // v2.6: Apply NSCP preset DL/LL values
        const NSCP_PRESETS = {
            residential: { dlSuper: 1.5, liveLoad: 1.9, roofLL: 1.0, name: 'Residential' },
            residential_heavy: { dlSuper: 2.0, liveLoad: 2.4, roofLL: 1.0, name: 'Residential(Heavy)' },
            office: { dlSuper: 2.0, liveLoad: 2.4, roofLL: 1.0, name: 'Office' },
            commercial: { dlSuper: 2.5, liveLoad: 4.8, roofLL: 1.5, name: 'Commercial/Retail' },
            school: { dlSuper: 2.0, liveLoad: 4.8, roofLL: 1.0, name: 'School/Assembly' },
            hospital: { dlSuper: 2.5, liveLoad: 3.8, roofLL: 1.0, name: 'Hospital' }
        };

        function applyNSCPPreset() {
            const type = document.getElementById('buildingType').value;
            const preset = NSCP_PRESETS[type];
            if (!preset) return;

            // Apply to all floors
            for (let floor of state.floors) {
                floor.dlSuper = preset.dlSuper;
                floor.liveLoad = floor.isRoof ? preset.roofLL : preset.liveLoad;
            }

            // Update current floor UI
            updateFloorUI();
            calculate();
        }

        function addFloor() {
            const total = state.floors.length;
            // Insert before roof (last)
            const insertIndex = total > 0 && state.floors[total - 1].isRoof ? total - 1 : total;

            // Rename existing floors
            state.floors.forEach((f, i) => {
                if (i < insertIndex && !f.isRoof && f.id !== 'GF') {
                    // Keep as is
                }
            });

            const newFloor = createFloor(
                'TMP',
                'Temporary Floor',
                state.xSpans.length,
                state.ySpans.length
            );

            state.floors.splice(insertIndex, 0, newFloor);

            // Update IDs for all floors
            state.floors.forEach((f, i) => {
                f.id = getFloorId(i, state.floors.length, state.gfSuspended);
                f.name = getFloorName(f.id, f.isRoof);
            });

            renderFloorTabs();
            calculate();
        }

        function removeFloor() {
            if (state.floors.length <= 2) return; // Keep at least GF + RF

            // Remove the currently selected floor (unless it's GF or RF)
            const floor = state.floors[state.currentFloorIndex];
            if (floor.id === 'GF' || floor.isRoof) {
                // Can't remove GF or RF, remove the last typical floor instead
                const lastTypical = state.floors.findLastIndex(f => !f.isRoof && f.id !== 'GF');
                if (lastTypical > 0) {
                    state.floors.splice(lastTypical, 1);
                }
            } else {
                state.floors.splice(state.currentFloorIndex, 1);
            }

            // Clamp current floor index
            if (state.currentFloorIndex >= state.floors.length) {
                state.currentFloorIndex = state.floors.length - 1;
            }

            // Rename remaining floors
            state.floors.forEach((f, i) => {
                f.id = getFloorId(i, state.floors.length, state.gfSuspended);
                f.name = getFloorName(f.id, f.isRoof);
            });

        renderFloorTabs();
        calculate();
        }

        // ========== CONTROLS ==========
        function zoomIn() {
            state.scale *= 1.2;
            draw();
        }

        function zoomOut() {
            state.scale /= 1.2;
            draw();
        }

        function fitView() {
            if (state.columns.length === 0) return;

            const maxX = Math.max(...state.columns.map(c => c.x));
            const maxY = Math.max(...state.columns.map(c => c.y));

            const margin = 150;
            const scaleX = (canvas.width - margin * 2) / maxX;
            const scaleY = (canvas.height - margin * 2) / maxY;
            state.scale = Math.min(scaleX, scaleY, 80);

            state.offsetX = (canvas.width - maxX * state.scale) / 2;
            state.offsetY = (canvas.height - maxY * state.scale) / 2;

            draw();
        }

        function toggleLabels() {
            state.showLabels = !state.showLabels;
            document.getElementById('toggleLabels').classList.toggle('active', state.showLabels);
            draw();
        }

        // v2.2: Toggle Areas visualization
        function toggleAreas() {
            state.showAreas = !state.showAreas;
            const btn = document.getElementById('toggleAreas');
            if (btn) btn.classList.toggle('active', state.showAreas);
            draw();
        }

        // v3.9: Toggle 1m grid mesh background
        function toggleGridMesh() {
            if (state.gridVisible === undefined) state.gridVisible = true;
            state.gridVisible = !state.gridVisible;
            const btn = document.getElementById('gridMeshBtn');
            if (btn) btn.classList.toggle('active', state.gridVisible);
            draw();
            if (typeof render3DFrame === 'function') render3DFrame();
            console.log(`v3.9: Grid mesh = ${ state.gridVisible ? 'ON' : 'OFF' } `);
        }

        // v2.4: Pan tool
        function togglePan() {
            state.isPanning = !state.isPanning;
            const btn = document.getElementById('panTool');
            if (btn) btn.classList.toggle('active', state.isPanning);
            canvas.style.cursor = state.isPanning ? 'grab' : 'default';
        }

        // v3.0 FIX: Update GF elevation height when dropdown changes
        // This fixes the bug where 2F beam levels weren't auto-adjusting
        function updateGFElevation(newHeight) {
            if (!state.gfSuspended) return;  // Only applies when GF Suspended is checked

            // Find the GF floor in state.floors
            const gfFloor = state.floors.find(f => f.id === 'GF');
            if (gfFloor) {
                gfFloor.height = newHeight;
                console.log(`v3.0: GF elevation updated to ${ newHeight } m`);
            }

            // Also update all subsequent floor heights to stack properly
            let cumulativeHeight = newHeight;
            for (let i = 1; i < state.floors.length; i++) {
                const floor = state.floors[i];
                // Get base floor height (default 3m for normal floors)
                const baseHeight = floor.baseHeight || state.defaultFloorHeight || 3.0;
                cumulativeHeight += baseHeight;
                floor.elevation = cumulativeHeight;  // Store cumulative elevation
            }
        }

        // v3.0: Toggle sub-gridlines overlay
        function toggleSubGrid() {
            state.showSubGrid = !state.showSubGrid;
            const btn = document.getElementById('gridToggleBtn');
            if (btn) btn.classList.toggle('active', state.showSubGrid);
            draw();
        }

        // v3.0: Undo last action (restore deleted beam or slab)
        function undoLastAction() {
            if (state.undoStack.length === 0) {
                console.log('v3.0: Nothing to undo');
                return;
            }

            const action = state.undoStack.pop();
            console.log(`v3.0: Undoing ${ action.type } on floor ${ action.floorId } `, action.data);

            if (action.type === 'beam') {
                // Find the floor and restore the beam (undo deletion)
                const floor = state.floors.find(f => f.id === action.floorId);
                if (floor) {
                    if (!floor.customBeams) floor.customBeams = [];
                    floor.customBeams.push(action.data);
                    console.log(`v3.0: Restored beam ${ action.data.id } on floor ${ action.floorId } `);
                }
            } else if (action.type === 'beamAdd') {
                // v3.0 FIX: Remove a beam that was added (undo addition)
                const floor = state.floors.find(f => f.id === action.floorId);
                if (floor && floor.customBeams) {
                    const idx = floor.customBeams.findIndex(b => b.id === action.data.id);
                    if (idx >= 0) {
                        floor.customBeams.splice(idx, 1);
                        console.log(`v3.0: Removed beam ${ action.data.id } from floor ${ action.floorId } `);
                    }
                }
            } else if (action.type === 'voidSlab') {
                // Restore slab void state
                const floor = state.floors.find(f => f.id === action.floorId);
                if (floor) {
                    if (!floor.voidSlabs) floor.voidSlabs = [];
                    if (action.data.wasVoid) {
                        floor.voidSlabs.push(action.data.slabId);
                    } else {
                        const idx = floor.voidSlabs.indexOf(action.data.slabId);
                        if (idx >= 0) floor.voidSlabs.splice(idx, 1);
                    }
                }
            }


            updateUndoButton();
            calculate();
        }

        // v3.0: Update undo button state
        function updateUndoButton() {
            const btn = document.getElementById('undoBtn');
            if (btn) {
                const count = state.undoStack.length;
                btn.textContent = count > 0 ? `↩️ Undo(${ count })` : '↩️ Undo';
                btn.classList.toggle('active', count > 0);
            }
        }

        // v3.0: Keyboard shortcut for undo (Ctrl+Z) - DEPRECATED: Now handled by v3.10 undo/redo system
        // The new system at line ~2580 handles Ctrl+Z/Y with proper redo support
        // document.addEventListener('keydown', (e) => {
        //     if (e.ctrlKey && e.key === 'z') {
        //         e.preventDefault();
        //         undoLastAction();
        //     }
        // });

        // v3.0: Toggle snap-to-grid
        function toggleSnap() {
            state.snapEnabled = !state.snapEnabled;
            const btn = document.getElementById('snapToggleBtn');
            if (btn) {
                btn.textContent = state.snapEnabled ? '🧲 Snap: ON' : '🧲 Snap: OFF';
                btn.classList.toggle('active', state.snapEnabled);
            }
        }

        // v3.0: Theme switcher with localStorage persistence
        function setTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('tributaryTheme', theme);

            // Update theme buttons active state
            document.querySelectorAll('.theme-option').forEach(btn => btn.classList.remove('active'));
            if (theme === 'dark') {
                document.getElementById('themeBtn-midnight')?.classList.add('active');
            } else if (theme === 'blueprint') {
                document.getElementById('themeBtn-papermatte')?.classList.add('active');
            } else if (theme === 'light') {
                document.getElementById('themeBtn-light')?.classList.add('active');
            }

            // Update canvas background for 3D view
            if (typeof draw === 'function') draw();

            // v3.16: Update 3D renderer background color based on theme
            if (typeof renderer3D !== 'undefined' && renderer3D) {
                const bgColor = get3DThemeBackground();
                renderer3D.setClearColor(bgColor);
                if (scene3D) scene3D.background = new THREE.Color(bgColor);
            }

            console.log(`v3.16: Theme changed to ${theme}`);
        }

        // v3.0: Load saved theme on startup
        function initTheme() {
            const savedTheme = localStorage.getItem('tributaryTheme') || 'dark'; // Default to Midnight
            setTheme(savedTheme);
        }

        // Toggle Settings Panel visibility
        function toggleSettingsPanel() {
            const panel = document.getElementById('settingsPanel');
            if (panel) panel.classList.toggle('hidden');
        }

        // Initialize theme on load
        document.addEventListener('DOMContentLoaded', initTheme);

        // v3.0: Update snap size from dropdown
        function updateSnapSize(value) {
            state.snapSize = parseFloat(value);
        }

        // v3.0: Snap a value to the grid
        function snapToGrid(value) {
            if (!state.snapEnabled) return value;
            return Math.round(value / state.snapSize) * state.snapSize;
        }

        function initPan() {
            canvas.addEventListener('mousedown', (e) => {
                if (state.isPanning) {
                    state.isDragging = true;
                    state.lastMouseX = e.clientX;
                    state.lastMouseY = e.clientY;
                    canvas.style.cursor = 'grabbing';
                }
            });

            canvas.addEventListener('mousemove', (e) => {
                if (state.isDragging && state.isPanning) {
                    const dx = e.clientX - state.lastMouseX;
                    const dy = e.clientY - state.lastMouseY;
                    state.offsetX += dx;
                    state.offsetY += dy;
                    state.lastMouseX = e.clientX;
                    state.lastMouseY = e.clientY;
                    draw();
                }
            });

            canvas.addEventListener('mouseup', () => {
                if (state.isDragging) {
                    state.isDragging = false;
                    canvas.style.cursor = state.isPanning ? 'grab' : 'default';
                }
            });

            canvas.addEventListener('mouseleave', () => {
                state.isDragging = false;
            });

            // v3.9: CAD-style scroll wheel zoom (centered on mouse position)
            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                // World position before zoom
                const worldXBefore = (mouseX - state.offsetX) / state.scale;
                const worldYBefore = (mouseY - state.offsetY) / state.scale;

                // Apply zoom (scroll up = zoom in, scroll down = zoom out)
                const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
                state.scale *= zoomFactor;
                state.scale = Math.max(10, Math.min(200, state.scale)); // Clamp zoom

                // Adjust offset to keep mouse position fixed
                state.offsetX = mouseX - worldXBefore * state.scale;
                state.offsetY = mouseY - worldYBefore * state.scale;

                draw();
            }, { passive: false });

            // v3.9: Middle mouse button pan (press wheel and drag)
            let middleMousePanning = false;
            let middleMouseStartX = 0, middleMouseStartY = 0;

            canvas.addEventListener('mousedown', (e) => {
                if (e.button === 1) { // Middle mouse button
                    e.preventDefault();
                    middleMousePanning = true;
                    middleMouseStartX = e.clientX;
                    middleMouseStartY = e.clientY;
                    canvas.style.cursor = 'grabbing';
                }
            });

            canvas.addEventListener('mousemove', (e) => {
                if (middleMousePanning) {
                    const dx = e.clientX - middleMouseStartX;
                    const dy = e.clientY - middleMouseStartY;
                    state.offsetX += dx;
                    state.offsetY += dy;
                    middleMouseStartX = e.clientX;
                    middleMouseStartY = e.clientY;
                    draw();
                }
            });

            canvas.addEventListener('mouseup', (e) => {
                if (e.button === 1 && middleMousePanning) {
                    middleMousePanning = false;
                    canvas.style.cursor = state.isPanning ? 'grab' : 'default';
                }
            });

            // v3.0 ADDITION: Click handler for deleting elements
            canvas.addEventListener('click', (e) => {
                // Skip if panning, adding beam, or dragging
                if (state.isPanning || state.addingBeam || state.isDragging) return;

                const rect = canvas.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;

                // Convert to world coordinates
                const worldX = (clickX - state.offsetX) / state.scale;
                const worldY = (clickY - state.offsetY) / state.scale;

                const currentFloorId = state.floors[state.currentFloorIndex]?.id;

                // 1. Check columns (highest priority - small targets) - v3.0: Show context menu
                for (let col of state.columns) {
                    const dx = Math.abs(worldX - col.x);
                    const dy = Math.abs(worldY - col.y);
                    const hitRadius = 0.5; // 0.5m hit area

                    if (dx < hitRadius && dy < hitRadius) {
                        console.log(`v3.0: Clicked column ${ col.id } - showing menu`);
                        showColumnMenu(col.id, e.clientX, e.clientY);
                        return;
                    }
                }

                // 2. Check custom beams (next priority)
                const customBeams = getFloorCustomBeams();
                for (let cb of customBeams) {
                    let hit = false;
                    const tolerance = 0.3;

                    if (cb.dir === 'Y') {
                        // Horizontal beam at Y = cb.pos
                        if (Math.abs(worldY - cb.pos) < tolerance &&
                            worldX >= cb.start - tolerance &&
                            worldX <= cb.end + tolerance) {
                            hit = true;
                        }
                    } else {
                        // Vertical beam at X = cb.pos
                        if (Math.abs(worldX - cb.pos) < tolerance &&
                            worldY >= cb.start - tolerance &&
                            worldY <= cb.end + tolerance) {
                            hit = true;
                        }
                    }

                    if (hit) {
                        console.log(`v3.0: Clicked custom beam ${ cb.id } - DELETING`);
                        deleteCustomBeam(cb.id);
                        return;
                    }
                }

                // 3. Check structural beams
                for (let beam of state.beams) {
                    const tolerance = 0.3;
                    const minX = Math.min(beam.x1, beam.x2) - tolerance;
                    const maxX = Math.max(beam.x1, beam.x2) + tolerance;
                    const minY = Math.min(beam.y1, beam.y2) - tolerance;
                    const maxY = Math.max(beam.y1, beam.y2) + tolerance;

                    // Check if click is within beam bounds and near the line
                    if (worldX >= minX && worldX <= maxX && worldY >= minY && worldY <= maxY) {
                        // Additional check: distance from beam line
                        let distToBeam;
                        if (beam.direction === 'X') {
                            // Horizontal beam - check Y distance
                            const beamY = (beam.y1 + beam.y2) / 2;
                            distToBeam = Math.abs(worldY - beamY);
                        } else {
                            // Vertical beam - check X distance
                            const beamX = (beam.x1 + beam.x2) / 2;
                            distToBeam = Math.abs(worldX - beamX);
                        }

                        if (distToBeam < tolerance * 2) {
                            // v3.0: If in planted column placement mode, show offset dialog
                            if (placingPlantedColumn) {
                                console.log(`v3.0: Clicked beam ${ beam.id } for planted column placement`);
                                showBeamOffsetDialog(beam);
                                return;
                            }

                            // v3.2: Block deletion if beam is locked
                            const floor = state.floors[state.currentFloorIndex];
                            if (floor?.lockedBeams?.includes(beam.id)) {
                                console.log(`v3.2: Beam ${ beam.id } is LOCKED - cannot delete via left - click`);
                                return;
                            }

                            // Normal mode: toggle beam deletion
                            console.log(`v3.0: Clicked structural beam ${ beam.id } - toggling(per - floor)`);
                            toggleBeamDeleted(beam.id);
                            return;
                        }

                    }
                }

                // 4. Check slabs (lowest priority - largest areas)
                // v3.2: Only toggle to VOID if not already void (no accidental restore)
                for (let slab of state.slabs) {
                    if (worldX >= slab.x1 && worldX <= slab.x2 &&
                        worldY >= slab.y1 && worldY <= slab.y2) {
                        const floor = state.floors[state.currentFloorIndex];
                        const isVoid = floor?.voidSlabs?.includes(slab.id);
                        const isLocked = floor?.lockedSlabs?.includes(slab.id);

                        // v3.2: Block deletion if slab is locked
                        if (isLocked) {
                            console.log(`v3.2: Slab ${ slab.id } is LOCKED - cannot delete via left - click`);
                            return;
                        }

                        if (isVoid) {
                            console.log(`v3.2: Clicked void slab ${ slab.id } - already deleted, use right - click to restore`);
                        } else {
                            console.log(`v3.0: Clicked slab ${ slab.id } - marking as VOID`);
                            toggleSlabVoid(slab.id);
                        }
                        return;
                    }
                }
            });

            // v3.2: RIGHT-CLICK context menu handler for easier deletion
            canvas.addEventListener('contextmenu', (e) => {
                e.preventDefault();  // Prevent default browser menu

                // Skip if panning or adding beam
                if (state.isPanning || state.addingBeam) return;

                const rect = canvas.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;

                // Convert to world coordinates
                const worldX = (clickX - state.offsetX) / state.scale;
                const worldY = (clickY - state.offsetY) / state.scale;

                // 1. Check columns first
                for (let col of state.columns) {
                    const dx = Math.abs(worldX - col.x);
                    const dy = Math.abs(worldY - col.y);
                    const hitRadius = 0.5;

                    if (dx < hitRadius && dy < hitRadius) {
                        showColumnMenu(col.id, e.clientX, e.clientY);
                        return;
                    }
                }

                // 2. Check beams
                for (let beam of state.beams) {
                    const tolerance = 0.4;
                    const minX = Math.min(beam.x1, beam.x2) - tolerance;
                    const maxX = Math.max(beam.x1, beam.x2) + tolerance;
                    const minY = Math.min(beam.y1, beam.y2) - tolerance;
                    const maxY = Math.max(beam.y1, beam.y2) + tolerance;

                    if (worldX >= minX && worldX <= maxX && worldY >= minY && worldY <= maxY) {
                        let distToBeam;
                        if (beam.direction === 'X') {
                            distToBeam = Math.abs(worldY - (beam.y1 + beam.y2) / 2);
                        } else {
                            distToBeam = Math.abs(worldX - (beam.x1 + beam.x2) / 2);
                        }

                        if (distToBeam < tolerance * 2) {
                            showMemberMenu('beam', beam.id, e.clientX, e.clientY);
                            return;
                        }
                    }
                }

                // 3. Check slabs
                for (let slab of state.slabs) {
                    if (worldX >= slab.x1 && worldX <= slab.x2 &&
                        worldY >= slab.y1 && worldY <= slab.y2) {
                        showMemberMenu('slab', slab.id, e.clientX, e.clientY);
                        return;
                    }
                }
            });
        }


        function exportResults() {
            const data = {
                parameters: {
                    xSpans: state.xSpans,
                    ySpans: state.ySpans,
                    dlSuper: state.dlSuper,
                    liveLoad: state.liveLoad,
                    slabThickness: state.slabThickness,
                    numFloors: state.numFloors
                },
                columns: state.columns.map(c => ({
                    id: c.id,
                    type: c.type,
                    loadPerFloor: c.loadPerFloor,
                    totalLoad: c.totalLoad
                })),
                beams: state.beams.map(b => ({
                    id: b.id,
                    w: b.w,
                    R: b.Rleft
                }))
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'tributary_pro_v2_results.json';
            a.click();
        }

// ========== v3.11: NEW TAB FUNCTIONS ==========

// --- BLOCKWALL DESIGN ---
function calculateBlockwalls() {
    const chbSize = parseInt(document.getElementById('chbSize')?.value || 150);
    const wallH = parseFloat(document.getElementById('bwHeight')?.value || 3.0);
    const plaster = parseInt(document.getElementById('plasterThk')?.value || 15);
    const openPct = parseInt(document.getElementById('openingPct')?.value || 20);

    // CHB unit weights per NSCP (kN/m² of wall face)
    const chbWeights = { 100: 1.77, 150: 2.33, 200: 3.39 }; // kN/m²
    const chbWt = chbWeights[chbSize] || 2.33;

    // Plaster: 23 kN/m³ * thickness (both sides)
    const plasterWt = 2 * (plaster / 1000) * 23; // kN/m²

    const grossWt = chbWt + plasterWt; // kN/m² of wall face
    const netWt = grossWt * (1 - openPct / 100); // less openings

    // Line load = net weight × height
    const lineLoad = netWt * wallH; // kN/m

    // Update display
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('bwUnitWt', chbWt.toFixed(2));
    set('bwPlasterWt', plasterWt.toFixed(2));
    set('bwGrossWt', grossWt.toFixed(2));
    set('bwNetWt', netWt.toFixed(2));
    set('bwLineLoad', lineLoad.toFixed(2));
}

// --- LOAD SUMMARY ---
function populateLoadSummary() {
    const tbody = document.getElementById('loadSummaryBody');
    if (!tbody) return;

    let html = '';
    const currentFloorId = state.floors[state.currentFloorIndex]?.id;

    state.columns.forEach(col => {
        if (col.active === false) return;
        const type = (typeof getColumnTypeForFloor === 'function')
            ? getColumnTypeForFloor(col, currentFloorId) : (col.type || '-');
        const trib = col.tributaryArea || 0;
        const slabDL = col.slabLoad || 0;
        const live = col.liveLoad || 0;
        const beamDL = col.beamLoad || 0;
        const colDL = col.columnDL || 0;
        const wall = col.wallContrib || 0;
        const total = col.totalLoadWithDL || col.totalLoad || 0;

        html += `< tr                     rong > ${ col.id }</strong ></td >
                type
        }</td >
            <td>${trib.toFixed(1)}</td>
            <td>${slabDL.toFixed(1)}</td>
            <td>${live.toFixed(1)}</td>
            <td>${beamDL.toFixed(1)}</td>
            <td>${colDL.toFixed(1)}</td>
            <td>${wall.toFixed(1)}</td>
            <td><strong>${total.toFixed(1)}</strong></td>
        </tr > `;
    });
    tbody.innerHTML = html || '<tr><td colspan="9">Run calculation first</td></tr>';
}

// --- REBAR SCHEDULE ---
function populateRebarSchedule() {
    const fc = state.fc || 21;
    const fy = state.fy || 415;

    // Footing rebar
    const ftBody = document.getElementById('rebarFootingBody');
    if (ftBody) { const footingTypes = {};
        state.columns.forEach(col => {
            if (col.active === false || !col.footingSize || col.isPlanted) return;
            const key = col.footingSize.toFixed(2);
            if (!footingTypes[key]) {
                footingTypes[key] = { size: col.footingSize, design: col.footingDesign, count: 0 };
            }
            footingTypes[key].count++;
        });

        let html = '';
        let typeIdx = 1;
        Object.values(footingTypes).forEach(ft => {
            const fd = ft.design;
            html += `< tr >
                <td>F${typeIdx} (×${ft.count})</td>
                <td>${ft.size.toFixed(2)}×${ft.size.toFixed(2)}</td>
                <td>${fd ? fd.h : 300}</td>
                <td>${fd ? fd.nBars + '-ø' + fd.barDia : '-'}</td>
                <td>${fd ? fd.spacing + 'mm' : '-'}</td>
                <td>${fd ? fd.As : '-'}</td>
            </tr > `;
            typeIdx++;
        });
        ftBody.innerHTML = html || '<tr><td colspan="6">No footings designed</td></tr>';
    }

    // Column rebar (preliminary - 1% min)
    const colBody = document.getElementById('rebarColumnBody');
    if (colBody) {
        const colTypes = {};
        state.columns.forEach(col => {
            if (col.active === false) return;
            const b = col.suggestedB || 250;
            const h = col.suggestedH || 250;
            const key = b + 'x' + h;
            if (!colTypes[key]) {
                colTypes[key] = { b, h, maxPu: 0, count: 0 };
            }
            colTypes[key].count++;
            colTypes[key].maxPu = Math.max(colTypes[key].maxPu, col.totalLoadWithDL || col.totalLoad || 0);
        });

        let html = '';
        Object.values(colTypes).forEach(ct => {
            const Ag = ct.b * ct.h; // mm²
            const rho_min = 0.01; // 1% minimum
            const As = rho_min * Ag;
            const barDia = ct.b >= 350 ? 20 : 16;
            const Ab = Math.PI * barDia * barDia / 4;
            const nBars = Math.max(4, Math.ceil(As / Ab));
            const tieSize = barDia >= 20 ? 10 : 10;
            const tieSpacing = Math.min(16 * barDia, Math.min(ct.b, ct.h), 300);

            html += `< tr >
                <td>C-${ct.b}×${ct.h} (×${ct.count})</td>
                <td>${ct.b}×${ct.h}</td>
                <td>${ct.maxPu.toFixed(0)}</td>
                <td>${(rho_min * 100).toFixed(1)}</td>
                <td>${nBars}-ø${barDia}mm</td>
                <td>ø${tieSize}mm @ ${tieSpacing}mm</td>
            </tr>`;
        });
        colBody.innerHTML = html || '<tr><td colspan="6">No columns found</td></tr>';
    }
}

// --- BILL OF MATERIALS ---
function populateBOM() {
    const tbody = document.getElementById('bomBody');
    if (!tbody) return;

    const floorGeometryById = typeof collect3DFloorGeometry === 'function'
        ? collect3DFloorGeometry()
        : new Map();

    // Columns
    const activeCols = state.columns.filter(c => c.active !== false && !c.isPlanted);
    let colVol = 0;
    let colCount = 0;
    activeCols.forEach(col => {
        const size = getColumnSizeMm(col);
        state.floors.forEach(floor => {
            if (!isColumnActiveOnFloor(col, floor.id)) return;
            colVol += (size.b / 1000) * (size.h / 1000) * (floor.height || 3.0);
            colCount++;
        });
    });

    // Beams by actual floor geometry, including cantilever and custom beams.
    let beamVol = 0;
    let beamCount = 0;
    state.floors.forEach(floor => {
        if (floor.id === 'GF' && !state.gfSuspended) return;
        const beams = floorGeometryById.get(floor.id)?.beams || [];
        beams.forEach(beam => {
            const size = getBeamSizeMm(beam, floor.id);
            beamVol += (size.b / 1000) * (size.h / 1000) * (beam.span || 0);
            beamCount++;
        });
    });

    // Footings
    let footingVol = 0;
    activeCols.forEach(col => {
        if (col.footingSize) {
            const h = col.footingDesign ? col.footingDesign.h / 1000 : (col.footingThick || 0.3);
            footingVol += col.footingSize * col.footingSize * h;
        }
    });

    // Slabs
    let slabVol = 0;
    let slabCount = 0;
    state.floors.forEach(floor => {
        if (floor.id === 'GF' && !state.gfSuspended) return;
        const t = (floor.slabThickness || 150) / 1000;
        const slabs = floorGeometryById.get(floor.id)?.slabs || [];
        slabs.forEach(slab => {
            if (!slab.isVoid) {
                slabVol += (slab.netArea || slab.area || 0) * t;
                slabCount++;
            }
        });
    });

    // Tie beams
    const avgSpan = (state.xSpans.reduce((a,b) => a+b, 0) + state.ySpans.reduce((a,b) => a+b, 0)) /
        (state.xSpans.length + state.ySpans.length);
    const tieBeamW = (state.tieBeamWidth || Math.round((state.tieBeamW || 0.2) * 1000)) / 1000;
    const tieBeamH = (state.tieBeamDepth || Math.round((state.tieBeamH || 0.35) * 1000)) / 1000;
    const tbVol = tieBeamW * tieBeamH * avgSpan * activeCols.length;

    const totalVol = colVol + beamVol + footingVol + slabVol + tbVol;

    let html = '';
    html += `< tr ><td>1</td><td>Columns (actual B×H)</td><td>${colCount}</td><td>pcs</td><td>${colVol.toFixed(2)}</td></tr > `;
    html += `< tr ><td>2</td><td>Beams (actual B×H)</td><td>${beamCount}</td><td>pcs</td><td>${beamVol.toFixed(2)}</td></tr > `;
    html += `< tr ><td>3</td><td>Slabs</td><td>${slabCount}</td><td>panels</td><td>${slabVol.toFixed(2)}</td></tr > `;
    html += `< tr ><td>4</td><td>Footings</td><td>${activeCols.length}</td><td>pcs</td><td>${footingVol.toFixed(2)}</td></tr > `;
    html += `< tr ><td>5</td><td>Tie Beams (${(tieBeamW*1000).toFixed(0)}×${(tieBeamH*1000).toFixed(0)}mm)</td><td>${activeCols.length}</td><td>pcs</td><td>${tbVol.toFixed(2)}</td></tr > `;

    tbody.innerHTML = html;
    document.getElementById('bomTotalConcrete').textContent = totalVol.toFixed(2);
    document.getElementById('bomTotalRebar').textContent = (totalVol * 80).toFixed(0);
}


        // ========== INIT ==========

        window.onload = function () {
            const steps = [
                ['initCanvas', initCanvas],
                ['initPan', initPan],
                ['renderSpans', renderSpans],
                ['renderCantileverInputs', renderCantileverInputs],
                ['renderFloorTabs', renderFloorTabs],
                ['syncColumnAlignmentButton', syncColumnAlignmentButton],
                ['calculate', calculate],
                ['fitView', fitView]
            ];
            let failed = false;
            for (const [name, fn] of steps) {
                try {
                    fn();
                } catch (err) {
                    console.error(`Init step "${name}" failed:`, err);
                    failed = true;
                }
            }
            if (failed) {
                const sb = document.getElementById('statusText');
                if (sb) { sb.textContent = 'Init error — check console'; sb.style.color = 'var(--danger)'; }
            }
        };

        // ========== UI LOGIC ==========
        document.addEventListener('DOMContentLoaded', () => {
            const fab = document.getElementById('ethosFab');
            const panel = document.getElementById('ethosPanel');
            const closeBtn = document.getElementById('ethosClose');
            const clearBtn = document.getElementById('ethosClear');
            const settingsBtn = document.getElementById('ethosSettings');
            const sendBtn = document.getElementById('ethosSend');
            const input = document.getElementById('ethosInput');
            const messages = document.getElementById('ethosMessages');
            const apiSetup = document.getElementById('ethosApiSetup');
            const inputArea = document.getElementById('ethosInputArea');
            const apiSaveBtn = document.getElementById('ethosApiKeySave');

            if (!RESIDENT_ETHOS_ENABLED) {
                if (fab) fab.style.display = 'none';
                if (panel) panel.style.display = 'none';
            } else {
            // Open/Close panel
            fab.onclick = () => { panel.classList.add('open'); fab.classList.add('hidden'); input.focus(); };
            closeBtn.onclick = () => { panel.classList.remove('open'); fab.classList.remove('hidden'); };

            // Clear chat
            clearBtn.onclick = () => {
                ETHOS.history = [];
                messages.innerHTML = '<div class="ethos-welcome"><p>👋 Chat cleared! How can I help?</p></div>';
            };

            // Settings
            settingsBtn.onclick = () => {
                apiSetup.style.display = 'block';
                inputArea.style.display = 'none';
            };

            // Save API key
            apiSaveBtn.onclick = () => {
                const key = document.getElementById('ethosApiKeyInput').value.trim();
                if (key) {
                    ETHOS.apiKey = key;
                    localStorage.setItem('residentEthosApiKey', key);
                    apiSetup.style.display = 'none';
                    inputArea.style.display = 'flex';
                    addMsg('assistant', '✅ API key saved! Ready to help.');
                }
            };

            // Check API key on load
            if (!ETHOS.apiKey) {
                apiSetup.style.display = 'block';
                inputArea.style.display = 'none';
            }

            // Send message
            const sendMessage = async () => {
                if (ETHOS.isLoading) return;
                const text = input.value.trim();
                if (!text) return;
                if (!ETHOS.apiKey) { settingsBtn.click(); return; }

                input.value = '';
                addMsg('user', text);

                ETHOS.isLoading = true;
                sendBtn.disabled = true;
                const loading = addMsg('loading', 'Thinking');

                const result = await ETHOS.chat(text);
                loading.remove();

                if (result.success) addMsg('assistant', result.message);
                else addMsg('error', '❌ ' + result.error);

                ETHOS.isLoading = false;
                sendBtn.disabled = false;
                input.focus();
            };

            sendBtn.onclick = sendMessage;
            input.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };

            function addMsg(type, text) {
                const div = document.createElement('div');
                div.className = 'ethos-message ' + type;
                div.textContent = text;
                messages.appendChild(div);
                messages.scrollTop = messages.scrollHeight;
                return div;
            }

            console.log('🤖 Resident Ethos initialized');
            }

            // v3.3: Hamburger Dropdown Logic
            window.toggleDropdown = function () {
                const dd = document.getElementById('settingsDropdown');
                if (dd) dd.classList.toggle('hidden');
            };

            // v3.4: Patch setTheme to ensure Grid Visibility (Fix "Grid Missing" bug)
            const _originalSetTheme = window.setTheme || function () { };
            window.setTheme = function (mode) {
                // Call original logic if it exists (handles active buttons etc)
                _originalSetTheme(mode);

                // FORCE Attributes & Grid
                if (mode === 'blueprint') {
                    document.body.setAttribute('data-theme', 'blueprint');
                    // Ensure Structural Grid is enabled (if user turned it off)
                    if (typeof layerVisibility !== 'undefined') {
                        layerVisibility.grid = true;
                    }
                } else {
                    document.body.setAttribute('data-theme', 'midnight');
                }

                // Force Redraw
                if (typeof draw === 'function') draw();
                console.log("Theme enforced:", mode);
            };

            // v3.8: Schedule Tab Population Functions
            // ========================================

            // Mark system: group members by size
            const columnMarks = {};  // {sizeKey: "C1", ...}
            const footingMarks = {}; // {sizeKey: "F1", ...}
            let nextColMark = 1;
            let nextFootingMark = 1;

            function getColumnMark(width, depth) {
                const key = `${width}x${depth}`;
                if (!columnMarks[key]) {
                    columnMarks[key] = `C${nextColMark++}`;
                }
                return columnMarks[key];
            }

            function getFootingMark(width, depth) {
                const key = `${width}x${depth}`;
                if (!footingMarks[key]) {
                    footingMarks[key] = `F${nextFootingMark++}`;
                }
                return footingMarks[key];
            }

            // Reset marks on calculate
            function resetMarks() {
                Object.keys(columnMarks).forEach(k => delete columnMarks[k]);
                Object.keys(footingMarks).forEach(k => delete footingMarks[k]);
                nextColMark = 1;
                nextFootingMark = 1;
            }

            // v3.8: Populate Column Schedule
            window.populateColumnSchedule = function () {
                const tbody = document.getElementById('colScheduleBody');
                const summary = document.getElementById('colScheduleSummary');
                if (!tbody) return;

                resetMarks();
                tbody.innerHTML = '';

                let rowNum = 0;
                // Use global state.columns (filter for active columns only)
                const columns = (state.columns || []).filter(c => c.active !== false);

                columns.forEach(col => {
                    rowNum++;
                    const { b: colW, h: colD } = getColumnSizeMm(col);
                    const mark = getColumnMark(colW, colD);
                    const colID = `C-${col.id}`;
                    const load = col.totalLoad ? col.totalLoad.toFixed(1) : '0';
                    const footingID = col.isPlanted ? 'planted' : `F-${col.id}`;

                    tbody.innerHTML += `
                        <tr>
                            <td class="row-num">${rowNum}</td>
                            <td>${colID}</td>
                            <td><strong>${mark}</strong></td>
                            <td><input type="number" value="${colW}" onchange="updateColumnParam('${col.id}', 'webB', this.value)" style="width:45px;"></td>
                            <td><input type="number" value="${colD}" onchange="updateColumnParam('${col.id}', 'webD', this.value)" style="width:45px;"></td>
                            <td>${load}</td>
                            <td class="non-mvp">${footingID}</td>
                        </tr>
                    `;
                });

                if (summary) summary.textContent = `Total: ${rowNum} columns`;
            };

            // v3.8: Populate Beams Schedule
            window.populateBeamSchedule = function () {
                const tbody = document.getElementById('beamScheduleBody');
                const summary = document.getElementById('beamScheduleSummary');
                if (!tbody) return;

                tbody.innerHTML = '';
                let rowNum = 0;
                const floorGeometryById = typeof collect3DFloorGeometry === 'function'
                    ? collect3DFloorGeometry()
                    : new Map();

                // v3.8: Iterate through all floors to show beams for each floor
                state.floors.forEach(floor => {
                    // Skip ground floor if not suspended
                    if (floor.id === 'GF' && !state.gfSuspended) return;

                    const floorID = floor.id;
                    const beams = floorGeometryById.get(floorID)?.beams || state.beams || [];

                    beams.forEach(beam => {
                        if (beam.deleted) return;
                        rowNum++;

                        const { b: bW, h: bD } = getBeamSizeMm(beam, floorID);
                        const spanVal = beam.span || 4.0;
                        const typeKey = getBeamGovernanceType(beam);
                        const typeLabel = getBeamGovernanceLabel(beam);
                        const bID = getBeamScheduleId(beam, floorID, rowNum);
                        const dirLabel = getBeamDirectionLabel(beam);
                        const w = Number(beam.w || 0);
                        const reaction = beam.isCantilever
                            ? w * spanVal
                            : (Number(beam.Rleft || 0) || Number(beam.Rright || 0) || (w * spanVal / 2));
                        const actionHtml = (typeKey === 'custom' || typeKey === 'stair')
                            ? `<button class="mini-action-btn remove" onclick="removeScheduledBeam('${escapeJsString(beam.id)}', '${escapeJsString(floorID)}')">Remove</button>`
                            : `<span class="schedule-note">${typeKey === 'cantilever_edge' ? 'from cantilever' : 'generated'}</span>`;

                        tbody.innerHTML += `
                        <tr>
                            <td class="row-num">${rowNum}</td>
                            <td>${escapeInfoText(bID)}</td>
                            <td>${escapeInfoText(typeLabel)}</td>
                            <td>${escapeInfoText(dirLabel)}</td>
                            <td>${spanVal.toFixed(2)}</td>
                            <td><input type="number" value="${bW}" onchange="updateBeamParam('${beam.id}', 'webW', this.value, '${floorID}')" style="width:45px;"></td>
                            <td><input type="number" value="${bD}" onchange="updateBeamParam('${beam.id}', 'webD', this.value, '${floorID}')" style="width:45px;"></td>
                            <td>${w.toFixed(2)}</td>
                            <td>${reaction.toFixed(1)}</td>
                            <td data-export="skip">${actionHtml}</td>
                        </tr>
                    `;
                    });  // end beams.forEach
                });  // end state.floors.forEach

                if (state.tieBeamW && state.tieBeamH) {
                    rowNum++;
                    const tbW = state.tieBeamWidth || Math.round(state.tieBeamW * 1000);
                    const tbD = state.tieBeamDepth || Math.round(state.tieBeamH * 1000);
                    tbody.innerHTML += `
                        <tr>
                            <td class="row-num">${rowNum}</td>
                            <td>TB-GND</td>
                            <td>tie</td>
                            <td>X/Y</td>
                            <td>-</td>
                            <td><input type="number" value="${tbW}" onchange="updateBeamParam('__TIE_BEAMS__', 'webW', this.value, 'GND')" style="width:45px;"></td>
                            <td><input type="number" value="${tbD}" onchange="updateBeamParam('__TIE_BEAMS__', 'webD', this.value, 'GND')" style="width:45px;"></td>
                            <td>-</td>
                            <td>-</td>
                            <td data-export="skip"><span class="schedule-note">foundation</span></td>
                        </tr>
                    `;
                }

                if (summary) summary.textContent = `Total: ${rowNum} beams`;
            };

            window.removeScheduledBeam = function (beamId, floorId) {
                const floor = state.floors.find(f => f.id === floorId);
                const beam = floor?.customBeams?.find(b => b.id === beamId);
                if (!floor || !beam) {
                    alert('Only added/stair beams can be removed safely from this schedule right now.');
                    return;
                }
                if (!confirm(`Remove added beam ${beamId} from ${floorId}?`)) return;
                deleteCustomBeamFromFloor(beamId, floorId);
                if (typeof populateBeamSchedule === 'function') populateBeamSchedule();
                if (typeof renderScheduleBeams === 'function') renderScheduleBeams();
                if (typeof populateBOM === 'function') populateBOM();
            };

            // v3.8: Populate Footing Schedule
            window.populateFootingSchedule = function () {
                const tbody = document.getElementById('footingScheduleBody');
                const summary = document.getElementById('footingScheduleSummary');
                if (!tbody) return;

                resetMarks();
                tbody.innerHTML = '';
                let rowNum = 0;

                // Use global state.columns - footings are for non-planted active columns
                const columns = (state.columns || []).filter(c => c.active !== false && !c.isPlanted);

                columns.forEach(col => {
                    rowNum++;

                    const footingSize = col.footingSize || 1.0;  // meters
                    const ftL = col.footingL ? Math.round(col.footingL * 1000) : Math.round(footingSize * 1000);  // mm
                    const ftW = col.footingW ? Math.round(col.footingW * 1000) : Math.round(footingSize * 1000);  // mm
                    const ftD = Math.round((col.footingD || col.footingThick || RESIDENTIAL_FOOTING_THICKNESS_MM / 1000) * 1000);  // mm

                    const mark = getFootingMark(ftL, ftW);
                    const ftID = `F-${col.id}`;
                    const colID = `C-${col.id}`;

                    tbody.innerHTML += `
                        <tr>
                            <td class="row-num">${rowNum}</td>
                            <td>${ftID}</td>
                            <td><strong>${mark}</strong></td>
                            <td><input type="number" value="${ftL}" onchange="updateFootingParam('${col.id}', 'footingL', this.value)" style="width:45px;"></td>
                            <td><input type="number" value="${ftW}" onchange="updateFootingParam('${col.id}', 'footingW', this.value)" style="width:45px;"></td>
                            <td><input type="number" value="${ftD}" onchange="updateFootingParam('${col.id}', 'footingD', this.value)" style="width:45px;"></td>
                            <td>${colID}</td>
                        </tr>
                    `;
                });

                if (summary) summary.textContent = `Total: ${rowNum} footings`;
            };

            // v3.9: Populate Slab Schedule - World-Class Feature
            // Slabs are auto-detected from grid bays (each rectangular bay = 1 slab panel)
            let slabMarks = {};  // Track slab marks by size
            let nextSlabMark = 1;

            function getSlabMark(thickness) {
                const key = `T${thickness}`;
                if (!slabMarks[key]) {
                    slabMarks[key] = `S${nextSlabMark++}`;
                }
                return slabMarks[key];
            }

            function resetSlabMarks() {
                slabMarks = {};
                nextSlabMark = 1;
            }

            window.populateSlabSchedule = function () {
                const tbody = document.getElementById('slabScheduleBody');
                const summary = document.getElementById('slabScheduleSummary');
                if (!tbody) return;

                resetSlabMarks();
                tbody.innerHTML = '';
                let rowNum = 0;

                // Initialize slabs array if not exists
                if (!state.slabs) {
                    state.slabs = [];

                    // Auto-generate slabs from grid bays for each floor
                    state.floors.forEach(floor => {
                        if (floor.id === 'GF' && !state.gfSuspended) return;

                        // Generate slabs for each bay (space between grid lines)
                        for (let i = 0; i < state.xSpans.length; i++) {
                            for (let j = 0; j < state.ySpans.length; j++) {
                                const xSpan = state.xSpans[i] || 4.0;
                                const ySpan = state.ySpans[j] || 4.0;
                                const area = xSpan * ySpan;

                                state.slabs.push({
                                    id: `${floor.id}-${i + 1}-${j + 1}`,
                                    floorId: floor.id,
                                    xIndex: i,
                                    yIndex: j,
                                    xSpan: xSpan,
                                    ySpan: ySpan,
                                    area: area,
                                    thickness: state.slabThickness || 150,  // Default 150mm
                                    deleted: false
                                });
                            }
                        }
                    });
                }

                // Filter active slabs and display
                const slabs = state.slabs.filter(s => !s.deleted);

                slabs.forEach(slab => {
                    rowNum++;
                    const slabID = `SL-${slab.id}`;
                    const thickness = slab.thickness || 150;
                    const mark = getSlabMark(thickness);

                    // Handle both engine properties (lx, ly) and generated properties (xSpan, ySpan)
                    const xSpan = slab.lx || slab.xSpan || 4.0;
                    const ySpan = slab.ly || slab.ySpan || 4.0;
                    const area = slab.area || (xSpan * ySpan);
                    const floorId = slab.floorId || slab.floor || '2F';

                    tbody.innerHTML += `
                        <tr>
                            <td class="row-num">${rowNum}</td>
                            <td>${slabID}</td>
                            <td><strong>${mark}</strong></td>
                            <td>${floorId}</td>
                            <td><input type="number" value="${thickness}" onchange="updateSlabParam('${slab.id}', 'thickness', this.value)" style="width:45px;"></td>
                            <td>${xSpan.toFixed(2)}</td>
                            <td>${ySpan.toFixed(2)}</td>
                            <td>${area.toFixed(2)}</td>
                        </tr>
                    `;
                });

                if (summary) summary.textContent = `Total: ${rowNum} slabs`;
            };


            // v3.9: Schedule Update Functions - Update member parameters from schedule inputs
            // These update the state and refresh both 2D and 3D views

            window.updateColumnParam = function (colId, param, value) {
                const col = state.columns.find(c => c.id === colId);
                if (!col) return;

                const size = getColumnSizeMm(col);
                if (param === 'webB' || param === 'b') {
                    applyColumnSizeMm(col, value, size.h);
                } else if (param === 'webD' || param === 'h') {
                    applyColumnSizeMm(col, size.b, value);
                } else if (param === 'footingW' || param === 'footingL' || param === 'footingThick') {
                    const n = Number(value);
                    if (Number.isFinite(n) && n > 0) col[param] = n;
                    draw();
                    if (typeof render3DFrame === 'function') render3DFrame();
                    return;
                }

                console.log(`v3.9: Column ${colId} ${param} = ${value}mm`);
                refreshMemberSizeDependents();
            };

            window.updateBeamParam = function (beamId, param, value, floorId = null) {
                if (beamId === '__TIE_BEAMS__') {
                    if (param === 'webW' || param === 'b') state.tieBeamWidth = normalizeMemberSizeMm(value, state.tieBeamWidth || 200, 150, 1500, 25);
                    if (param === 'webD' || param === 'h') state.tieBeamDepth = normalizeMemberSizeMm(value, state.tieBeamDepth || 350, 200, 2000, 25);
                    state.tieBeamW = state.tieBeamWidth / 1000;
                    state.tieBeamH = state.tieBeamDepth / 1000;
                    const widthInput = document.getElementById('tieBeamWidth');
                    const depthInput = document.getElementById('tieBeamDepth');
                    if (widthInput) widthInput.value = state.tieBeamWidth;
                    if (depthInput) depthInput.value = state.tieBeamDepth;
                    refreshMemberSizeDependents();
                    return;
                }

                const activeFloorId = floorId || state.floors[state.currentFloorIndex]?.id;
                const floor = state.floors.find(f => f.id === activeFloorId);
                const customBeam = floor?.customBeams?.find(b => b.id === beamId);
                const beam = customBeam || state.beams.find(b => b.id === beamId);
                if (!beam) return;

                const current = getBeamSizeMm(beam, activeFloorId);
                const nextB = (param === 'webW' || param === 'b') ? value : current.b;
                const nextH = (param === 'webD' || param === 'h') ? value : current.h;
                const normalizedB = normalizeMemberSizeMm(nextB, current.b, 150, 1500, 25);
                const normalizedH = normalizeMemberSizeMm(nextH, current.h, 200, 2000, 25);

                applyBeamSizeMm(beam, activeFloorId, normalizedB, normalizedH);
                if (!customBeam) {
                    if (!state.beamSizeOverrides) state.beamSizeOverrides = {};
                    state.beamSizeOverrides[getBeamSizeKey(beamId, activeFloorId)] = {
                        webW: normalizedB,
                        webD: normalizedH
                    };
                }

                console.log(`v3.9: Beam ${beamId} on ${activeFloorId} size = ${normalizedB}×${normalizedH}mm`);
                refreshMemberSizeDependents();
            };

            window.updateFootingParam = function (colId, param, value) {
                const col = state.columns.find(c => c.id === colId);
                if (!col) return;

                const numValue = parseInt(value) || 0;
                if (param === 'footingL') {
                    col.footingL = Math.max(600, numValue) / 1000;  // Convert to meters, min 600mm
                } else if (param === 'footingW') {
                    col.footingW = Math.max(600, numValue) / 1000;  // Convert to meters, min 600mm
                } else if (param === 'footingD') {
                    col.footingD = Math.max(300, numValue) / 1000;  // Convert to meters, min 300mm
                    col.footingThick = col.footingD;
                }

                console.log(`v3.9: Footing for ${colId} ${param} = ${numValue}mm`);
                draw();
                if (typeof render3DFrame === 'function') render3DFrame();
            };

            window.updateSlabParam = function (slabId, param, value) {
                const slab = state.slabs.find(s => s.id === slabId);
                if (!slab) return;

                const numValue = parseInt(value) || 0;
                if (param === 'thickness') {
                    slab.thickness = Math.max(100, Math.min(300, numValue));  // 100-300mm range

                    // Also update floor default if this is first slab on floor
                    const floor = state.floors[state.currentFloorIndex];
                    if (floor) floor.slabThickness = slab.thickness;
                }

                console.log(`v3.9: Slab ${slabId} ${param} = ${numValue}mm`);
                draw();
                if (typeof render3DFrame === 'function') render3DFrame();
            };

            // v3.8: CSV Export Functions

            window.exportColumnScheduleCSV = function () {
                let csv = 'No.,ID,Mark,Size (mm),Load (kN),Footing ID\n';
                const rows = document.querySelectorAll('#colScheduleBody tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    csv += Array.from(cells).map(c => c.textContent.trim()).join(',') + '\n';
                });
                downloadCSV(csv, 'column_schedule.csv');
            };

            window.exportBeamScheduleCSV = function () {
                let csv = 'No.,ID,Type,Dir,Span,Width,Depth,w (kN/m),R (kN)\n';
                const rows = document.querySelectorAll('#beamScheduleBody tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td:not([data-export="skip"])');
                    const values = Array.from(cells).map(c => {
                        const input = c.querySelector('input');
                        return input ? input.value : c.textContent.trim();
                    });
                    csv += values.join(',') + '\n';
                });
                downloadCSV(csv, 'beam_schedule.csv');
            };

            window.exportFootingScheduleCSV = function () {
                let csv = 'No.,ID,Mark,Size (mm),Depth,Column ID\n';
                const rows = document.querySelectorAll('#footingScheduleBody tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    csv += Array.from(cells).map(c => c.textContent.trim()).join(',') + '\n';
                });
                downloadCSV(csv, 'footing_schedule.csv');
            };

            function downloadCSV(content, filename) {
                const blob = new Blob([content], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            }

            // Delete Selected Columns - marks as inactive and refreshes drawings
            window.deleteSelectedColumns = function () {
                const checkboxes = document.querySelectorAll('#colScheduleBody .delete-cb:checked');
                if (checkboxes.length === 0) {
                    alert('Please select columns to delete');
                    return;
                }
                if (!confirm(`Delete ${checkboxes.length} column(s)? This will remove them from drawings.`)) return;

                checkboxes.forEach(cb => {
                    const colId = cb.dataset.id;
                    const col = state.columns.find(c => c.id === colId || c.id === parseInt(colId));
                    if (col) col.active = false;
                });

                populateColumnSchedule();
                draw();
                render3DFrame();
                console.log(`Deleted ${checkboxes.length} columns`);
            };

            // Delete Selected Beams - marks as deleted and refreshes drawings
            window.deleteSelectedBeams = function () {
                const checkboxes = document.querySelectorAll('#beamScheduleBody .delete-cb:checked');
                if (checkboxes.length === 0) {
                    alert('Please select beams to delete');
                    return;
                }
                if (!confirm(`Delete ${checkboxes.length} beam(s)? This will remove them from drawings.`)) return;

                checkboxes.forEach(cb => {
                    const beamId = cb.dataset.id;
                    const beam = state.beams.find(b => b.id === beamId || b.id === parseInt(beamId));
                    if (beam) beam.deleted = true;
                });

                populateBeamSchedule();
                draw();
                render3DFrame();
                console.log(`Deleted ${checkboxes.length} beams`);
            };

            // Delete Selected Footings - marks column footing as deleted
            window.deleteSelectedFootings = function () {
                const checkboxes = document.querySelectorAll('#footingScheduleBody .delete-cb:checked');
                if (checkboxes.length === 0) {
                    alert('Please select footings to delete');
                    return;
                }
                if (!confirm(`Delete ${checkboxes.length} footing(s)? This will remove them from drawings.`)) return;

                checkboxes.forEach(cb => {
                    const colId = cb.dataset.id;
                    const col = state.columns.find(c => c.id === colId || c.id === parseInt(colId));
                    if (col) col.footingDeleted = true;
                });

                populateFootingSchedule();
                draw();
                render3DFrame();
                console.log(`Deleted ${checkboxes.length} footings`);
            };

            // Delete Selected Slabs - marks as deleted and refreshes drawings
            window.deleteSelectedSlabs = function () {
                const checkboxes = document.querySelectorAll('#slabScheduleBody .delete-cb:checked');
                if (checkboxes.length === 0) {
                    alert('Please select slabs to delete');
                    return;
                }
                if (!confirm(`Delete ${checkboxes.length} slab(s)? This can be used to create openings for stairs.`)) return;

                checkboxes.forEach(cb => {
                    const slabId = cb.dataset.id;
                    const slab = state.slabs.find(s => s.id === slabId);
                    if (slab) slab.deleted = true;
                });

                populateSlabSchedule();
                draw();
                render3DFrame();
                console.log(`Deleted ${checkboxes.length} slabs (openings created)`);
            };

            // Update Slab Parameters - refreshes drawings when thickness changes
            window.updateSlabParam = function (slabId, param, value) {
                const slab = state.slabs?.find(s => s.id === slabId);
                if (slab) {
                    slab[param] = parseInt(value) || 150;
                    draw();
                    render3DFrame();
                }
            };

            // Export Slab Schedule to CSV
            window.exportSlabScheduleCSV = function () {
                let csv = 'No.,ID,Mark,Floor,Thickness (mm),X Span (m),Y Span (m),Area (m²)\n';
                const rows = document.querySelectorAll('#slabScheduleBody tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    const values = Array.from(cells).slice(1).map(c => {  // Skip checkbox column
                        const input = c.querySelector('input[type="number"]');
                        return input ? input.value : c.textContent.trim();
                    });
                    csv += values.join(',') + '\n';
                });
                downloadCSV(csv, 'slab_schedule.csv');
            };

            // v3.5: Schedules Feature Implementation (LEGACY - kept for compatibility)
            // ========================================
            window.showSchedules = function () {
                const modal = document.getElementById('schedulesModal');
                if (modal) {
                    modal.style.display = 'flex';
                    switchScheduleTab('columns'); // Default view
                }
            };

            window.hideSchedulesModal = function () {
                const modal = document.getElementById('schedulesModal');
                if (modal) modal.style.display = 'none';
            };

            window.switchScheduleTab = function (tab) {
                // Update Tabs
                document.querySelectorAll('.sched-tab').forEach(t => t.classList.remove('active'));
                const tabBtn = document.getElementById('schedTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
                if (tabBtn) tabBtn.classList.add('active');

                const appContainer = document.getElementById('app-container');
                if (appContainer) appContainer.classList.add('schedule-mode');

                // Update Panels
                const beamPanel = document.getElementById('scheduleBeamsPanel');
                const colPanel = document.getElementById('scheduleColumnsPanel');
                const ftPanel = document.getElementById('scheduleFootingsPanel');

                // Reset all
                if (beamPanel) beamPanel.style.display = 'none';
                if (colPanel) colPanel.style.display = 'none';
                if (ftPanel) ftPanel.style.display = 'none';

                if (tab === 'columns') {
                    if (colPanel) colPanel.style.display = 'block';
                    renderScheduleColumns();
                } else if (tab === 'footings') {
                    if (ftPanel) ftPanel.style.display = 'block';
                    renderScheduleFootings();
                } else {
                    if (beamPanel) beamPanel.style.display = 'block';
                    renderScheduleBeams();
                }
            };

            window.renderScheduleColumns = function () {
                const tbody = document.getElementById('scheduleColumnsBody');
                if (!tbody) return;
                tbody.innerHTML = '';

                // Sort by ID
                const visibleCols = state.columns.slice().sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

                visibleCols.forEach(col => {
                    const tr = document.createElement('tr');
                    const colSize = getColumnSizeMm(col);
                    // Excel Look
                    const inputStyle = "width:100%; border:none; background:transparent; text-align:center; font-family:Arial; font-size:0.9rem; color:black;";
                    const cellStyle = "border:1px solid #ccc; padding:4px;";

                    tr.innerHTML = `
                        <td style="${cellStyle} font-weight:bold;">${col.id}</td>
                        <td style="${cellStyle}">${(col.type || 'Corner').toUpperCase()}</td>
                        <td style="${cellStyle} width:80px;">
                            <input type="number" value="${colSize.b}" step="50" min="150" style="${inputStyle}"
                                   onchange="updateColumnParam('${col.id}', 'b', this.value)">
                        </td>
                        <td style="${cellStyle} width:80px;">
                            <input type="number" value="${colSize.h}" step="50" min="150" style="${inputStyle}"
                                   onchange="updateColumnParam('${col.id}', 'h', this.value)">
                        </td>
                        <td style="${cellStyle}">${(col.P_total || 0).toFixed(1)}</td>
                        <td style="${cellStyle}">${col.isPlanted ? 'YES' : 'NO'}</td>
                        <td style="${cellStyle}">${col.activeFloors ? col.activeFloors.join(', ') : 'ALL'}</td>
                    `;
                    tbody.appendChild(tr);
                });
            };

            window.renderScheduleFootings = function () {
                const tbody = document.getElementById('scheduleFootingsBody');
                if (!tbody) return;
                tbody.innerHTML = '';

                const visibleCols = state.columns.slice().sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

                visibleCols.forEach(col => {
                    if (col.isPlanted) return;

                    const tr = document.createElement('tr');
                    const inputStyle = "width:100%; border:none; background:transparent; text-align:center; font-family:Arial; font-size:0.9rem; color:black;";
                    const cellStyle = "border:1px solid #ccc; padding:4px;";
                    const area = (col.footingW || 1) * (col.footingL || col.footingW || 1);

                    // Naming Convention: F- + ColID (e.g. F-C1)
                    const fID = "F-" + col.id;

                    tr.innerHTML = `
                        <td style="${cellStyle} font-weight:bold;">${fID}</td>
                        <td style="${cellStyle}">ISOLATED</td>
                        <td style="${cellStyle} width:80px;">
                            <input type="number" value="${col.footingW || 1.0}" step="0.1" min="0.5" style="${inputStyle}"
                                   onchange="updateColumnParam('${col.id}', 'footingW', this.value)">
                        </td>
                         <td style="${cellStyle} width:80px;">
                            <input type="number" value="${col.footingL || col.footingW || 1.0}" step="0.1" min="0.5" style="${inputStyle}"
                                   onchange="updateColumnParam('${col.id}', 'footingL', this.value)">
                        </td>
                         <td style="${cellStyle} width:80px;">
                            <input type="number" value="${col.footingThick || 0.3}" step="0.05" min="0.2" style="${inputStyle}"
                                   onchange="updateColumnParam('${col.id}', 'footingThick', this.value)">
                        </td>
                        <td style="${cellStyle}">${area.toFixed(2)}</td>
                    `;
                    tbody.appendChild(tr);
                });
            };

            window.renderScheduleBeams = function () {
                const tbody = document.getElementById('scheduleBeamsBody');
                if (!tbody) return;
                tbody.innerHTML = '';

                // v3.7: Loop through ALL floors and display beams with floor-specific naming
                // Each floor's beams are the same set (structural grid), but with floor ID in name
                const floorGeometryById = typeof collect3DFloorGeometry === 'function'
                    ? collect3DFloorGeometry()
                    : new Map();
                state.floors.forEach((floor, floorIdx) => {

                    const floorBeams = floorGeometryById.get(floor.id)?.beams || state.beams || [];
                    floorBeams.forEach(beam => {
                        const tr = document.createElement('tr');
                        // Excel Look - Paper Matte style
                        const inputStyle = "width:100%; border:none; background:transparent; text-align:center; font-family:Arial; font-size:0.85rem; color:black;";
                        const cellStyle = "border:1px solid #ccc; padding:4px; text-align:center;";

                        const { b: bW, h: bD } = getBeamSizeMm(beam, floor.id);

                        // Handle startCol/endCol - could be object with .id or string
                        const startColID = beam.startCol ? (typeof beam.startCol === 'object' ? beam.startCol.id : beam.startCol) : '';
                        const endColID = beam.endCol ? (typeof beam.endCol === 'object' ? beam.endCol.id : beam.endCol) : '';

                        // v3.7: New naming convention: B-{Floor}-{StartCol}{EndCol}
                        // Example: B-2F-A1B1 (X direction), B-2F-A1A2 (Y direction)
                        const floorID = floor.id || '1F';
                        const bID = startColID && endColID ? `B-${floorID}-${startColID}${endColID}` : `B-${floorID}-${beam.id}`;

                        // Derive direction: same letter = Y, same number = X
                        const isYDir = startColID && endColID && startColID.charAt(0) === endColID.charAt(0);
                        const dirLabel = isYDir ? 'Y' : 'X';

                        // v3.7: Calculate reactions R = wL/2 for simply supported beam
                        const w_load = beam.w_total || beam.w || 0;
                        const span = beam.span || 0;
                        const R1 = beam.R1 || (w_load * span / 2);
                        const R2 = beam.R2 || (w_load * span / 2);

                        tr.innerHTML = `
                            <td style="${cellStyle} font-weight:bold; width:110px;">${bID}</td>
                            <td style="${cellStyle} width:50px;">${dirLabel}</td>
                            <td style="${cellStyle} width:55px;">${(beam.span || 0).toFixed(2)}</td>
                            <td style="${cellStyle} width:60px;">
                                <input type="number" value="${bW}" step="25" min="150" style="${inputStyle}"
                                       onchange="updateBeamParam('${beam.id}', 'webW', this.value, '${floorID}')">
                            </td>
                            <td style="${cellStyle} width:60px;">
                                <input type="number" value="${bD}" step="50" min="200" style="${inputStyle}"
                                       onchange="updateBeamParam('${beam.id}', 'webD', this.value, '${floorID}')">
                            </td>
                            <td style="${cellStyle} width:70px;">${w_load.toFixed(2)}</td>
                            <td style="${cellStyle} width:90px;">${R1.toFixed(1)} / ${R2.toFixed(1)}</td>
                         `;
                        tbody.appendChild(tr);
                    });
                });

                // If no floors, fallback to current floor only
                if (state.floors.length === 0) {
                    const floorID = '1F';
                    state.beams.forEach(beam => {
                        const tr = document.createElement('tr');
                        const inputStyle = "width:100%; border:none; background:transparent; text-align:center; font-family:Arial; font-size:0.85rem; color:black;";
                        const cellStyle = "border:1px solid #ccc; padding:4px; text-align:center;";
                        const { b: bW, h: bD } = getBeamSizeMm(beam, floorID);
                        const startColID = beam.startCol ? (typeof beam.startCol === 'object' ? beam.startCol.id : beam.startCol) : '';
                        const endColID = beam.endCol ? (typeof beam.endCol === 'object' ? beam.endCol.id : beam.endCol) : '';
                        const bID = startColID && endColID ? `B-${floorID}-${startColID}${endColID}` : `B-${floorID}-${beam.id}`;
                        const isYDir = startColID && endColID && startColID.charAt(0) === endColID.charAt(0);
                        const dirLabel = isYDir ? 'Y' : 'X';
                        tr.innerHTML = `
                            <td style="${cellStyle} font-weight:bold;">${bID}</td>
                            <td style="${cellStyle} width:40px;">${dirLabel}</td>
                            <td style="${cellStyle} width:60px;">${(beam.span || 0).toFixed(2)}</td>
                            <td style="${cellStyle} width:70px;">
                                <input type="number" value="${bW}" step="25" min="150" style="${inputStyle}"
                                       onchange="updateBeamParam('${beam.id}', 'webW', this.value, '${floorID}')">
                            </td>
                            <td style="${cellStyle} width:70px;">
                                <input type="number" value="${bD}" step="50" min="200" style="${inputStyle}"
                                       onchange="updateBeamParam('${beam.id}', 'webD', this.value, '${floorID}')">
                            </td>
                            <td style="${cellStyle} width:80px;">${(beam.w_total || beam.w || 0).toFixed(2)}</td>
                            <td style="${cellStyle} width:100px;">${(beam.R1 || 0).toFixed(1)} / ${(beam.R2 || 0).toFixed(1)}</td>
                         `;
                        tbody.appendChild(tr);
                    });
                }
            };

            // v3.5: Close modal when clicking outside
            window.onclick = function (event) {
                const modal = document.getElementById('schedulesModal');
                if (event.target == modal) {
                    modal.style.display = "none";
                }
                // Handle Dropdown close too
                if (!event.target.closest('.settings-gear') && !event.target.closest('.settings-dropdown')) {
                    const dd = document.getElementById('settingsDropdown');
                    if (dd && !dd.classList.contains('hidden')) dd.classList.add('hidden');
                }
            };

            // Init
            // If user previously opened it, keeps state... no need.

            // v3.7: Toggle permanent grid visibility
            window.toggleSubGrid = function () {
                // Initialize if undefined
                if (state.gridVisible === undefined) state.gridVisible = true;

                // Toggle
                state.gridVisible = !state.gridVisible;

                // Update button styling
                const btn = document.getElementById('gridToggleBtn');
                if (btn) {
                    if (state.gridVisible) {
                        btn.classList.add('active');
                        btn.textContent = 'Grid: ON';
                    } else {
                        btn.classList.remove('active');
                        btn.textContent = 'Grid: OFF';
                    }
                }

                // Redraw
                draw();
                console.log('Grid visibility:', state.gridVisible);
            };

        });
        // SolverLink Reactions & Tributary Expansion Population Logic

        window.populateReactions = function() {
            const tbody = document.getElementById('tbodyReactions');
            if (!tbody) return;
            tbody.innerHTML = '';

            let hasColumns = false;

            if (state.columns) {
                state.columns.forEach(col => {
                    if (col.active === false) return;

                    hasColumns = true;
                    const tr = document.createElement('tr');

                    let baseP = (col.receivedLoad || 0).toFixed(1);
                    if (baseP === "0.0" && col.load) baseP = col.load.toFixed(1); // Use col.load if receivedLoad is 0

                    tr.innerHTML = `
                        <td><strong>${col.id}</strong></td>
                        <td>Node Base-${col.id}</td>
                        <td>Fixed</td>
                        <td style="color:#0ea5e9;">${baseP} kN</td>
                        <td style="color:#64748b;">[TBD]</td>
                        <td style="color:#64748b;">[TBD]</td>
                        <td style="color:#64748b;">[TBD]</td>
                        <td style="color:#64748b;">[TBD]</td>
                        <td><span style="font-size:0.7rem;background:#fef08a;color:#854d0e;padding:2px 6px;border-radius:4px;">Preliminary</span></td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            if (!hasColumns) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#64748b;padding:20px;">No columns found in model.</td></tr>';
            }
        };

        window.populateTribBeams = function() {
            const tbody = document.getElementById('tbodyTribBeams');
            if (!tbody) return;
            tbody.innerHTML = '';

            let hasBeams = false;

            if (state.beams) {
                state.beams.forEach(beam => {
                    if (beam.deleted) return;
                    hasBeams = true;
                    const tr = document.createElement('tr');

                    const span = (beam.span || 0).toFixed(2);
                    let tribLoad = (beam.receivedAreaLoad || 0).toFixed(1);
                    let wallLoad = (beam.customLoad || beam.blockwallLoad || 0).toFixed(1);

                    tr.innerHTML = `
                        <td><strong>${beam.id || 'B-?'}</strong></td>
                        <td>${state.floors[state.currentFloorIndex]?.name || 'Current'}</td>
                        <td>${span}</td>
                        <td style="color:#0ea5e9;">${tribLoad} kN/m</td>
                        <td>${wallLoad} kN/m</td>
                        <td>[TBD] kN/m</td>
                        <td><strong>[TBD] kN/m</strong></td>
                        <td>[TBD] kN</td>
                        <td>[TBD] kN</td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            if (!hasBeams) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#64748b;padding:20px;">No active beams found on current floor.</td></tr>';
            }
        };

        window.populateTribCols = function() {
            const tbody = document.getElementById('tbodyTribCols');
            if (!tbody) return;
            tbody.innerHTML = '';

            let hasColumns = false;

            if (state.columns) {
                state.columns.forEach(col => {
                    if (col.active === false) return;
                    hasColumns = true;
                    const tr = document.createElement('tr');

                    let classification = "Interior";
                    if (col.positionType) classification = col.positionType;

                    tr.innerHTML = `
                        <td><strong>${col.id}</strong></td>
                        <td>${state.floors[state.currentFloorIndex]?.name || 'Current'}</td>
                        <td>${classification}</td>
                        <td style="color:#0ea5e9;">[TBD] kN</td>
                        <td>[TBD] kN</td>
                        <td>[TBD] kN</td>
                        <td>[TBD] kN</td>
                        <td><strong>[TBD] kN</strong></td>
                        <td style="color:#ef4444;"><strong>[TBD] kN</strong></td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            if (!hasColumns) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#64748b;padding:20px;">No columns found in model.</td></tr>';
            }
        };
