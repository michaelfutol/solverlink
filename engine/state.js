        // ========== SFFA MVP GLOBAL ERROR HANDLING ==========
        window.onerror = function (message, source, lineno, colno, error) {
            console.error('Global Error:', message, 'at', source, lineno + ':' + colno);
            const statusText = document.getElementById('statusText');
            if (statusText) {
                statusText.textContent = `Crash: ${message} (Line ${lineno})`;
                statusText.style.color = 'var(--danger)';
            }
            const modal = document.getElementById('errorModal');
            const msgDiv = document.getElementById('errorMessage');
            if (modal && msgDiv) {
                msgDiv.textContent = `Error: ${message}\nSource: ${source}:${lineno}`;
                modal.style.display = 'flex';
            }
        };

        window.addEventListener('unhandledrejection', function (event) {
            console.error('Unhandled Promise Rejection:', event.reason);
            const statusText = document.getElementById('statusText');
            if (statusText) {
                statusText.textContent = `Promise Error: ${event.reason}`;
                statusText.style.color = 'var(--danger)';
            }
            const modal = document.getElementById('errorModal');
            const msgDiv = document.getElementById('errorMessage');
            if (modal && msgDiv) {
                msgDiv.textContent = `Promise Rejection: ${event.reason}`;
                modal.style.display = 'flex';
            }
        });

        // ========================================
        // FUTOLSTRUCTURE - CORE ENGINE
        // ========================================
        // Load Path: SLAB → BEAMS → COLUMNS
        // By FutolTech | Engineering & Project Systems
        // ========================================

        // Production mode: suppress verbose debug logs, keep errors/warnings
        const DEBUG = false;
        const _origLog = console.log;
        if (!DEBUG) console.log = function() {};

        // Safe number parsing with fallback — prevents NaN from corrupting state
        function safeFloat(val, fallback) { const n = parseFloat(val); return isNaN(n) ? fallback : n; }
        function safeInt(val, fallback) { const n = parseInt(val, 10); return isNaN(n) ? fallback : n; }
        function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

        const FSTR_FILE_TYPE = 'FutolStructure.StructuralModel';
        const FSTR_SCHEMA_VERSION = '0.1.0';

        const PLOT_PAPER_SIZES = Object.freeze({
            A4: { label: 'A4', css: 'A4', widthMm: 210, heightMm: 297 },
            A3: { label: 'A3', css: 'A3', widthMm: 297, heightMm: 420 },
            A2: { label: 'A2', css: 'A2', widthMm: 420, heightMm: 594 },
            Letter: { label: 'Letter', css: 'letter', widthMm: 216, heightMm: 279 },
            Legal: { label: 'Legal', css: 'legal', widthMm: 216, heightMm: 356 }
        });

        function normalizePlotSettings(settings = {}) {
            const paperSize = PLOT_PAPER_SIZES[settings.paperSize] ? settings.paperSize : 'A4';
            const orientation = settings.orientation === 'landscape' ? 'landscape' : 'portrait';
            return {
                paperSize,
                orientation,
                marginMm: clamp(Number(settings.marginMm ?? settings.margin ?? 15) || 15, 5, 40),
                scaleMode: settings.scaleMode || 'fit'
            };
        }

        function getPlotSettings() {
            state.plotSettings = normalizePlotSettings(state.plotSettings);
            return state.plotSettings;
        }

        function getPlotPageCss(settings = getPlotSettings()) {
            const paper = PLOT_PAPER_SIZES[settings.paperSize] || PLOT_PAPER_SIZES.A4;
            return `${paper.css} ${settings.orientation}`;
        }

        // v3.17: Build parameters object for EngineLoads module calls
        function getLoadParams() {
            return {
                fc: state.fc,
                fy: state.fy,
                defaultColumnB: state.defaultColumnB,
                defaultColumnH: state.defaultColumnH,
                defaultBeamB: state.defaultBeamB,
                defaultBeamH: state.defaultBeamH,
                minColumnSideMm: COLUMN_CODE_MIN_MM,
                practicalColumnSideMm: COLUMN_PRACTICAL_MIN_MM,
                concreteDensity: state.concreteDensity,
                floorHeight: state.floors[0]?.height || 3.0,
                soilBearing: state.soilBearing,
                numFloors: state.floors.length,
                xSpans: state.xSpans,
                ySpans: state.ySpans,
                tieBeamWidth: state.tieBeamWidth,
                tieBeamDepth: state.tieBeamDepth,
                fixedFootingThicknessMm: RESIDENTIAL_FOOTING_THICKNESS_MM,
                preferFootingWidthOverDepth: true
            };
        }

        const WALL_LOAD_TYPE_DEFAULTS = Object.freeze({
            external: {
                supportMode: 'on_beam',
                thicknessMm: 150,
                defaultHeightMode: 'floor',
                finishAllowance: 0.69,
                openingDeductionMode: 'ratio',
                openingFactor: 0.15,
                lintelAllowance: 0
            },
            internal: {
                supportMode: 'on_beam',
                thicknessMm: 150,
                defaultHeightMode: 'floor',
                finishAllowance: 0.69,
                openingDeductionMode: 'ratio',
                openingFactor: 0,
                lintelAllowance: 0
            },
            parapet: {
                supportMode: 'on_beam',
                thicknessMm: 150,
                defaultHeightMode: 'fixed',
                heightM: 1.0,
                finishAllowance: 0.69,
                openingDeductionMode: 'ratio',
                openingFactor: 0,
                lintelAllowance: 0
            },
            partition: {
                supportMode: 'on_slab_support_strip',
                thicknessMm: 100,
                defaultHeightMode: 'floor',
                finishAllowance: 0.69,
                openingDeductionMode: 'ratio',
                openingFactor: 0,
                lintelAllowance: 0
            }
        });

        function getWallLoadTypeDefaults(type, floorHeight = 3) {
            const key = String(type || 'external').toLowerCase();
            const defaults = WALL_LOAD_TYPE_DEFAULTS[key] || WALL_LOAD_TYPE_DEFAULTS.external;
            return {
                ...defaults,
                type: key,
                heightM: defaults.defaultHeightMode === 'fixed'
                    ? defaults.heightM
                    : (Number(floorHeight) > 0 ? Number(floorHeight) : 3)
            };
        }

        function normalizeWallLoadReference(reference, wall = {}) {
            const ref = reference || {};
            const toMaybeNumber = value => {
                const n = Number(value);
                return Number.isFinite(n) ? n : null;
            };

            return {
                kind: ref.kind || (wall.beamId ? 'beam' : (wall.slabId ? 'slab' : (wall.edge ? 'edge' : 'unresolved'))),
                beamId: ref.beamId || wall.beamId || '',
                slabId: ref.slabId || wall.slabId || '',
                edge: ref.edge || wall.edge || '',
                label: ref.label || wall.referenceLabel || '',
                x1: toMaybeNumber(ref.x1 ?? wall.x1),
                y1: toMaybeNumber(ref.y1 ?? wall.y1),
                x2: toMaybeNumber(ref.x2 ?? wall.x2),
                y2: toMaybeNumber(ref.y2 ?? wall.y2),
                note: ref.note || wall.note || ''
            };
        }

        function normalizeWallLoadObject(wallLoad, context = {}) {
            const wall = wallLoad || {};
            const floorHeight = Number(context.floorHeight || context.height || 3) > 0
                ? Number(context.floorHeight || context.height || 3)
                : 3;
            const rawType = String(wall.type || wall.wallType || 'external').toLowerCase();
            const type = ['external', 'internal', 'parapet', 'partition'].includes(rawType)
                ? rawType
                : 'external';
            const defaults = getWallLoadTypeDefaults(type, floorHeight);
            const rawThickness = Number(wall.thicknessMm ?? wall.thickness ?? wall.chbSize ?? defaults.thicknessMm);
            const thicknessInput = rawThickness > 0 && rawThickness < 10 ? rawThickness * 1000 : rawThickness;
            const normalizedOpening = Number(wall.openingFactor ?? wall.openingPct ?? defaults.openingFactor);

            return {
                id: wall.id || `WL-${context.floorId || 'F'}-${(context.index ?? 0) + 1}`,
                type,
                supportMode: wall.supportMode || defaults.supportMode,
                thicknessMm: normalizeMemberSizeMm(thicknessInput, defaults.thicknessMm, 75, 300),
                heightM: Math.max(0, Number(wall.heightM ?? wall.height ?? defaults.heightM)),
                unitWeight: Math.max(0, Number(wall.unitWeight || wall.density || 0)),
                faceWeightKPa: Number(wall.faceWeightKPa ?? wall.faceWeight ?? 0) || null,
                finishAllowance: Math.max(0, Number(wall.finishAllowance ?? wall.finishKPa ?? defaults.finishAllowance)),
                openingDeductionMode: wall.openingDeductionMode || defaults.openingDeductionMode,
                openingFactor: Math.min(Math.max(normalizedOpening > 1 ? normalizedOpening / 100 : normalizedOpening, 0), 0.9),
                openingArea: Math.max(0, Number(wall.openingArea || 0)),
                lintelAllowance: Math.max(0, Number(wall.lintelAllowance ?? wall.lintelLoad ?? defaults.lintelAllowance)),
                loadCase: wall.loadCase || 'WALL',
                reference: normalizeWallLoadReference(wall.reference, wall),
                notes: wall.notes || wall.note || ''
            };
        }

        function normalizeWallLoadList(wallLoads, context = {}) {
            const list = Array.isArray(wallLoads) ? wallLoads : [];
            return list.map((wall, index) => normalizeWallLoadObject(wall, { ...context, index }));
        }

        /**
         * Floor factory — single source of truth for floor object shape.
         * @param {string} id - Floor ID (e.g. 'GF', '2F', 'RF')
         * @param {string} name - Display name
         * @param {number} numX - Number of X spans (for cantilever arrays)
         * @param {number} numY - Number of Y spans (for cantilever arrays)
         * @param {object} [opts] - Optional overrides (dlSuper, liveLoad, slabThickness, height, wallLoad, isRoof)
         * @returns {object} A complete floor object
         */
        function createFloor(id, name, numX, numY, opts) {
            const o = opts || {};
            const floorHeight = o.height !== undefined ? o.height : 3.0;
            return {
                id: id,
                name: name,
                dlSuper: o.dlSuper !== undefined ? o.dlSuper : 2.0,
                liveLoad: o.liveLoad !== undefined ? o.liveLoad : 2.0,
                slabThickness: o.slabThickness !== undefined ? o.slabThickness : 150,
                height: floorHeight,
                wallLoad: o.wallLoad !== undefined ? o.wallLoad : 6.0,
                isRoof: !!o.isRoof,
                cantilevers: {
                    top: new Array(numX).fill(0),
                    bottom: new Array(numX).fill(0),
                    left: new Array(numY).fill(0),
                    right: new Array(numY).fill(0)
                },
                customBeams: [],
                voidSlabs: [],
                slabOpenings: cloneSerializable(o.slabOpenings, []),
                wallLoads: normalizeWallLoadList(cloneSerializable(o.wallLoads, []), { floorId: id, floorHeight }),
                pointLoads: cloneSerializable(o.pointLoads, []),
                deletedBeams: [],
                deletedColumns: [],
                lockedBeams: [],
                lockedSlabs: []
            };
        }

        function cloneSerializable(value, fallback) {
            return JSON.parse(JSON.stringify(value != null ? value : fallback));
        }

        function normalizeCantileverEdge(values, length) {
            const source = Array.isArray(values) ? values : [];
            return Array.from({ length: length }, (_, index) => {
                const raw = Number(source[index]);
                return Number.isFinite(raw) ? raw : 0;
            });
        }

        function hydrateFloor(floorData, numX, numY) {
            const data = floorData || {};
            const floor = createFloor(data.id, data.name, numX, numY, {
                dlSuper: data.dlSuper,
                liveLoad: data.liveLoad,
                slabThickness: data.slabThickness,
                height: data.height,
                wallLoad: data.wallLoad,
                isRoof: data.isRoof,
                slabOpenings: data.slabOpenings,
                wallLoads: data.wallLoads,
                pointLoads: data.pointLoads
            });

            floor.cantilevers = {
                top: normalizeCantileverEdge(data.cantilevers?.top, numX),
                bottom: normalizeCantileverEdge(data.cantilevers?.bottom, numX),
                left: normalizeCantileverEdge(data.cantilevers?.left, numY),
                right: normalizeCantileverEdge(data.cantilevers?.right, numY)
            };
            floor.customBeams = cloneSerializable(data.customBeams, []);
            floor.voidSlabs = cloneSerializable(data.voidSlabs, []);
            floor.slabOpenings = cloneSerializable(data.slabOpenings, []);
            floor.wallLoads = normalizeWallLoadList(data.wallLoads, { floorId: floor.id, floorHeight: floor.height });
            floor.pointLoads = cloneSerializable(data.pointLoads, []);
            floor.deletedBeams = cloneSerializable(data.deletedBeams, []);
            floor.deletedColumns = cloneSerializable(data.deletedColumns, []);
            floor.lockedBeams = cloneSerializable(data.lockedBeams, []);
            floor.lockedSlabs = cloneSerializable(data.lockedSlabs, []);

            return floor;
        }

        function hydrateFloors(floorsData, xSpans, ySpans) {
            return (floorsData || []).map(floorData =>
                hydrateFloor(floorData, xSpans.length, ySpans.length)
            );
        }

        function getCustomBeams(floorId) {
            const floor = state.floors.find(f => f.id === floorId);
            return floor && floor.customBeams ? floor.customBeams : [];
        }

        function getFloorCustomBeams() {
            const currentFloor = state.floors[state.currentFloorIndex];
            return currentFloor && currentFloor.customBeams ? currentFloor.customBeams : [];
        }

        // ========== STATE ==========
        const state = {
            xSpans: [4.0, 4.0],      // X-direction bay sizes (m)
            ySpans: [5.0, 5.0],      // Y-direction bay sizes (m)

            // v3.0: Cantilever configuration per edge span
            // Each array element = cantilever length for that span index (0 = no cantilever)
            cantilevers: {
                top: [0, 0],      // Length matching xSpans - cantilever above first row
                bottom: [0, 0],   // Length matching xSpans - cantilever below last row
                left: [0, 0],     // Length matching ySpans - cantilever left of first column
                right: [0, 0]     // Length matching ySpans - cantilever right of last column
            },

            // v2.3: Floors array - per floor configurations
            // v2.7: Corrected floor logic:
            //   Without GF Suspended: 2F | RF (2 tabs = 2 suspended slabs)
            //   With GF Suspended: GF | 2F | RF (3 tabs = 3 suspended slabs)
            //   GF tab is added dynamically when checkbox is checked
            // v3.0 FIX: Each floor has its own cantilevers, customBeams, voidSlabs, deletedBeams, deletedColumns
            floors: [
                createFloor('2F', '2nd Floor', 2, 2),
                createFloor('RF', 'Roof', 2, 2, { dlSuper: 1.5, liveLoad: 1.0, slabThickness: 120, wallLoad: 0, isRoof: true })
            ],
            currentFloorIndex: 0,    // Which floor is selected

            // Generated data
            columns: [],             // Column objects
            beams: [],               // Beam objects
            slabs: [],               // Slab panel objects

            // View state
            scale: 50,
            offsetX: 100,
            offsetY: 100,
            showLabels: true,
            showAreas: true,  // v2.2: show slice polygons by default
            isPanning: false, // v2.4: pan mode
            isDragging: false,
            lastMouseX: 0,
            lastMouseY: 0,

            // v2.5: Footing state
            footingDepth: 1.5,
            soilBearing: 150,  // kPa
            plotSettings: normalizePlotSettings(),

            // v2.6: GF suspended toggle
            gfSuspended: false,  // If false, GF slab loads excluded (ground-bearing)

            // v3.0: Tie beam sizing (calculated from longest span)
            // Depth = max(longestSpan/10, 0.3m), Width = max(largestFooting, 0.25m)
            tieBeamH: 0.4,   // m - will be calculated
            tieBeamW: 0.25,  // m - will be calculated
            tieBeamWidth: 200,   // mm, plan X/width
            tieBeamDepth: 350,   // mm, plan Y/depth

            // v3.0: Material properties for member sizing
            fc: 21,            // Concrete f'c in MPa (21, 24, 28, 35)
            fy: 415,           // Steel fy in MPa (275 = Grade 40, 415 = Grade 60)
            concreteDensity: 24,  // kN/m³ for self-weight calculation
            defaultColumnB: 0,    // Default column width (mm), 0 = auto (NSCP)
            defaultColumnH: 0,    // Default column depth (mm), 0 = same as b (square)
            defaultBeamB: 250,    // Default beam width (mm), 0 = auto
            defaultBeamH: 0,      // Default beam depth (mm), 0 = auto (L/16 rule)
            beamSizeOverrides: {}, // floorId::beamId -> { webW, webD }

            // v3.0: Custom beams for staircase framing (per floor - stored in floor object)
            addingBeam: false,     // Mode flag for adding beams
            beamDrawStart: null,   // Start point when drawing beam
            nextCustomBeamId: 1,   // Counter for unique beam IDs

            // v3.0: Void slabs for U-shape/L-shape layouts (per floor - stored in floor object)
            voidSlabs: [],          // Legacy global - now per floor
            openings: [],            // Legacy click-to-place openings; disabled in favor of slab opening data
            addingOpening: false,
            nextOpeningId: 1,

            // v3.0: Grid and snap settings for precise element placement
            showSubGrid: false,     // Toggle for 1m sub-gridlines overlay
            snapEnabled: false,     // Toggle for snap-to-grid
            snapSize: 0.1,          // Snap increment in meters (0.1m = 10cm default)

            // v3.0: Undo stack for restoring deleted items
            undoStack: [],           // Array of {type, data, floorId} for undo operations

            // v3.1: Column alignment relative to gridlines
            // 'center' = column center on gridline
            // 'outer' = outer face of edge columns on gridline
            // 'inner' = inner face on gridline
            columnAlignment: 'outer'
        };

        function normalizeMemberSizeMm(value, fallback, min, max, step = 1) {
            const parsed = Number(value);
            const base = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
            const stepped = step > 1 ? Math.round(base / step) * step : base;
            return Math.max(min, Math.min(max, Math.round(stepped)));
        }

        function firstPositive(...values) {
            for (const value of values) {
                const n = Number(value);
                if (Number.isFinite(n) && n > 0) return n;
            }
            return null;
        }

        const COLUMN_CODE_MIN_MM = 200;
        const COLUMN_PRACTICAL_MIN_MM = 300;
        const RESIDENTIAL_FOOTING_THICKNESS_MM = 300;

        function getColumnSizeMm(col) {
            const b = normalizeMemberSizeMm(
                firstPositive(col?.webB, col?.overrideB, col?.b, col?.suggestedB, state.defaultColumnB),
                COLUMN_PRACTICAL_MIN_MM,
                COLUMN_CODE_MIN_MM,
                1200
            );
            const h = normalizeMemberSizeMm(
                firstPositive(col?.webD, col?.overrideH, col?.h, col?.suggestedH, state.defaultColumnH, b),
                b,
                COLUMN_CODE_MIN_MM,
                1200
            );
            return { b, h };
        }

        function applyColumnSizeMm(col, b, h) {
            if (!col) return;
            const nextB = normalizeMemberSizeMm(b, getColumnSizeMm(col).b, COLUMN_CODE_MIN_MM, 1200);
            const nextH = normalizeMemberSizeMm(h, getColumnSizeMm(col).h, COLUMN_CODE_MIN_MM, 1200);
            col.webB = nextB;
            col.webD = nextH;
            col.overrideB = nextB;
            col.overrideH = nextH;
            col.suggestedB = nextB;
            col.suggestedH = nextH;
            col.b = nextB;
            col.h = nextH;
        }

        const WALL_FACE_WEIGHTS_KPA = { 100: 1.77, 150: 2.33, 200: 3.39 };

        function computeWallLineLoad(wallLoad) {
            const wall = normalizeWallLoadObject(wallLoad);
            const rawThickness = Number(wall.thicknessMm ?? wall.thickness ?? wall.chbSize ?? 150);
            const thicknessInput = rawThickness > 0 && rawThickness < 10 ? rawThickness * 1000 : rawThickness;
            const thickness = normalizeMemberSizeMm(thicknessInput, 150, 75, 300);
            const height = Math.max(0, Number(wall.heightM ?? wall.height ?? 0));
            const faceWeight = Number(wall.faceWeightKPa ?? wall.faceWeight ?? WALL_FACE_WEIGHTS_KPA[thickness] ?? 0);
            const unitWeight = Number(wall.unitWeight || wall.density || 0);
            const thicknessWeight = unitWeight > 0 ? unitWeight * (thickness / 1000) : 0;
            const finishAllowance = Math.max(0, Number(wall.finishAllowance || wall.finishKPa || 0));
            const grossFaceWeight = Math.max(faceWeight, thicknessWeight) + finishAllowance;
            const openingArea = Math.max(0, Number(wall.openingArea || 0));
            const length = Math.max(0, Number(wall.length || wall.lengthM || 0));
            const grossArea = length > 0 && height > 0 ? length * height : 0;
            const openingRatioFromArea = grossArea > 0 ? Math.min(openingArea / grossArea, 0.9) : 0;
            const rawOpening = Number(wall.openingFactor ?? wall.openingPct ?? 0);
            const normalizedOpening = rawOpening > 1 ? rawOpening / 100 : rawOpening;
            const openingFactor = wall.openingDeductionMode === 'area'
                ? openingRatioFromArea
                : Math.min(Math.max(normalizedOpening, 0), 0.9);
            const netFaceWeight = grossFaceWeight * (1 - openingFactor);
            const lintelAllowance = Math.max(0, Number(wall.lintelAllowance || wall.lintelLoad || 0));
            const serviceLineLoad = (netFaceWeight * height) + lintelAllowance;

            return {
                type: wall.type,
                supportMode: wall.supportMode,
                thickness,
                height,
                grossFaceWeight,
                openingFactor,
                netFaceWeight,
                lintelAllowance,
                serviceLineLoad,
                reference: wall.reference || normalizeWallLoadReference(null, wall)
            };
        }

        function getWallLoadReferenceLabel(wallLoad) {
            const reference = wallLoad?.reference || normalizeWallLoadReference(null, wallLoad);
            if (reference.label) return reference.label;
            if (reference.kind === 'beam' && reference.beamId) return `beam:${reference.beamId}`;
            if (reference.kind === 'slab' && reference.slabId) return `slab:${reference.slabId}`;
            if (reference.kind === 'edge' && reference.edge) return `edge:${reference.edge}`;
            if ([reference.x1, reference.y1, reference.x2, reference.y2].every(v => Number.isFinite(v))) {
                return `line(${reference.x1.toFixed(2)},${reference.y1.toFixed(2)})-(${reference.x2.toFixed(2)},${reference.y2.toFixed(2)})`;
            }
            return reference.kind || 'unresolved';
        }

        function computePointLoad(pointLoad) {
            const load = pointLoad || {};
            const magnitude = Math.max(0, Number(load.magnitude || load.serviceLoad || load.load || 0));
            const factor = Number(load.factor || load.loadFactor || 1);
            const cleanFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
            return {
                magnitude,
                factor: cleanFactor,
                designMagnitude: magnitude * cleanFactor
            };
        }

        function collectLoadGovernanceWarnings(floor) {
            const warnings = [];
            if (!floor) return warnings;

            if ((floor.wallLoad || 0) > 0 && !(floor.wallLoads || []).length) {
                warnings.push({
                    code: 'legacy_floor_wall_load',
                    floorId: floor.id,
                    message: 'Floor uses one coarse wall load value applied broadly to regular beams.'
                });
            }

            (floor.wallLoads || []).forEach(wall => {
                const normalizedWall = normalizeWallLoadObject(wall, { floorId: floor.id, floorHeight: floor.height });
                const supportMode = normalizedWall.supportMode || 'unresolved';
                const wallType = normalizedWall.type || 'wall';
                const thickness = Number(normalizedWall.thicknessMm || 0);
                const reference = normalizedWall.reference || normalizeWallLoadReference(null, normalizedWall);
                if (supportMode === 'on_slab' || supportMode === 'slab_only' || supportMode === 'on_slab_support_strip') {
                    warnings.push({
                        code: 'wall_on_slab_support_check',
                        floorId: floor.id,
                        loadId: normalizedWall.id,
                        message: 'Wall load is not directly on a beam/support line; slab strip or hidden-beam check is required.'
                    });
                }
                if (supportMode === 'unresolved') {
                    warnings.push({
                        code: 'wall_support_unresolved',
                        floorId: floor.id,
                        loadId: normalizedWall.id,
                        message: 'Wall support path is not resolved yet.'
                    });
                }
                if ((reference.kind || 'unresolved') === 'unresolved') {
                    warnings.push({
                        code: 'wall_reference_unresolved',
                        floorId: floor.id,
                        loadId: normalizedWall.id,
                        message: 'Wall geometry/support reference is not set yet.'
                    });
                }
                if (thickness > 0 && thickness < 200 && ['external', 'bearing', 'parapet'].includes(wallType)) {
                    warnings.push({
                        code: 'wall_thickness_caution',
                        floorId: floor.id,
                        loadId: normalizedWall.id,
                        message: 'Selected wall thickness may need engineering/code review for this wall role.'
                    });
                }
            });

            (floor.pointLoads || []).forEach(point => {
                const target = point.target || point.supportMode || 'unresolved';
                if (target === 'slab-warning-only' || target === 'slab_only' || target === 'unresolved') {
                    warnings.push({
                        code: 'point_load_support_unresolved',
                        floorId: floor.id,
                        loadId: point.id,
                        message: 'Point load needs a resolved beam, column, or joint support path before analysis/export.'
                    });
                }
            });

            return warnings;
        }

        function collectLoadGovernanceSummary() {
            return (state.floors || []).map(floor => ({
                floorId: floor.id,
                legacyWallLoad: Number(floor.wallLoad || 0),
                wallLoads: (floor.wallLoads || []).map(wall => {
                    const normalizedWall = normalizeWallLoadObject(wall, { floorId: floor.id, floorHeight: floor.height });
                    const calc = computeWallLineLoad(normalizedWall);
                    return {
                        id: normalizedWall.id || '',
                        type: normalizedWall.type || 'wall',
                        supportMode: normalizedWall.supportMode || 'unresolved',
                        serviceLineLoad: +calc.serviceLineLoad.toFixed(4),
                        thickness: calc.thickness,
                        height: calc.height,
                        finishAllowance: +Number(normalizedWall.finishAllowance || 0).toFixed(4),
                        openingDeductionMode: normalizedWall.openingDeductionMode || 'ratio',
                        openingFactor: +Number(normalizedWall.openingFactor || 0).toFixed(4),
                        openingArea: +Number(normalizedWall.openingArea || 0).toFixed(4),
                        lintelAllowance: +Number(normalizedWall.lintelAllowance || 0).toFixed(4),
                        referenceLabel: getWallLoadReferenceLabel(normalizedWall)
                    };
                }),
                pointLoads: (floor.pointLoads || []).map(point => {
                    const calc = computePointLoad(point);
                    return {
                        id: point.id || '',
                        type: point.type || 'point',
                        target: point.target || point.supportMode || 'unresolved',
                        magnitude: +calc.magnitude.toFixed(4),
                        designMagnitude: +calc.designMagnitude.toFixed(4),
                        loadCase: point.loadCase || 'DEAD'
                    };
                }),
                warnings: collectLoadGovernanceWarnings(floor)
            }));
        }

        function addModelReadinessWarning(warnings, area, message, level = 'warning') {
            warnings.push({ area, message, level });
        }

        function collectModelReadinessWarnings() {
            const warnings = [];

            addModelReadinessWarning(
                warnings,
                'ETABS',
                'ETABS export is experimental and has not yet been validated against ETABS 22.6 import. Use STAAD first for the current baseline workflow.'
            );

            let nonRegularCount = 0;
            let customCandidateCount = 0;
            let ambiguousCustomCount = 0;
            let cantileverCount = 0;
            const floors = state.floors || [];

            let floorGeometryById = null;
            if (typeof collect3DFloorGeometry === 'function') {
                try {
                    floorGeometryById = collect3DFloorGeometry();
                } catch (err) {
                    floorGeometryById = null;
                }
            }

            floors.forEach(floor => {
                if (floor.id === 'GF' && !state.gfSuspended) return;
                const beams = floorGeometryById?.get(floor.id)?.beams || state.beams || [];
                beams.forEach(beam => {
                    if (!beam || beam.deleted) return;
                    const type = typeof getBeamGovernanceType === 'function' ? getBeamGovernanceType(beam) : 'regular';
                    if (type !== 'regular') nonRegularCount++;
                    if (type === 'cantilever' || type === 'cantilever_edge') cantileverCount++;
                    if (type === 'custom' || type === 'stair') {
                        const readiness = beam.exportReadiness || (typeof classifyCustomBeamExportReadiness === 'function'
                            ? classifyCustomBeamExportReadiness(beam)
                            : null);
                        if (readiness?.status === 'candidate_column_to_column') customCandidateCount++;
                        else ambiguousCustomCount++;
                    }
                });
            });

            if (nonRegularCount > 0) {
                addModelReadinessWarning(
                    warnings,
                    'Solver Handoff',
                    `${nonRegularCount} non-regular beam(s) exist. Schedule/report visibility is ahead of solver export truth; verify solver file coverage before use.`
                );
            }
            if (customCandidateCount > 0) {
                addModelReadinessWarning(
                    warnings,
                    'Custom Beams',
                    `${customCandidateCount} custom/stair beam(s) are column-to-column export candidates, but export inclusion is still intentionally limited.`
                );
            }
            if (ambiguousCustomCount > 0) {
                addModelReadinessWarning(
                    warnings,
                    'Custom Beams',
                    `${ambiguousCustomCount} custom/stair beam(s) still need endpoint or beam-intersection resolution before solver export.`
                );
            }
            if (cantileverCount > 0) {
                addModelReadinessWarning(
                    warnings,
                    'Cantilevers',
                    `${cantileverCount} cantilever/cantilever-edge beam(s) require explicit load/export doctrine before they can be treated as full solver-truth members.`
                );
            }

            const loadGovernance = typeof collectLoadGovernanceSummary === 'function' ? collectLoadGovernanceSummary() : [];
            loadGovernance.forEach(entry => {
                (entry.warnings || []).forEach(warning => {
                    addModelReadinessWarning(
                        warnings,
                        `Loads ${entry.floorId}`,
                        warning.message,
                        'warning'
                    );
                });
            });

            const currentFloor = state.floors?.[state.currentFloorIndex];
            const openingCount = (currentFloor?.slabOpenings || []).filter(o => Number(o.openingW || 0) > 0 || Number(o.openingH || 0) > 0).length;
            if (openingCount > 0) {
                addModelReadinessWarning(
                    warnings,
                    'Slab Openings',
                    `${openingCount} slab opening(s) are modeled as area deductions only. Local edge beams, lintels, and trimming design are still manual checks.`
                );
            }

            return warnings;
        }

        function updateModelReadinessPanel() {
            const list = document.getElementById('modelReadinessList');
            const count = document.getElementById('modelReadinessCount');
            if (!list || !count) return;

            const warnings = collectModelReadinessWarnings();
            count.textContent = `${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'}`;
            if (!warnings.length) {
                list.innerHTML = '<li><strong>Baseline:</strong> No readiness warnings for the current regular-grid model.</li>';
                return;
            }

            list.innerHTML = warnings.slice(0, 8).map(warning =>
                `<li><strong>${escapeInfoText(warning.area)}:</strong> ${escapeInfoText(warning.message)}</li>`
            ).join('');
        }

        function getPlanBounds() {
            return {
                totalX: (state.xSpans || []).reduce((sum, span) => sum + Number(span || 0), 0),
                totalY: (state.ySpans || []).reduce((sum, span) => sum + Number(span || 0), 0)
            };
        }

        function getColumnPlanOffset(col) {
            if (!col || state.columnAlignment !== 'outer') return { dx: 0, dy: 0 };
            const { totalX, totalY } = getPlanBounds();
            const size = getColumnSizeMm(col);
            const bM = size.b / 1000;
            const hM = size.h / 1000;
            const tol = 0.01;
            let dx = 0;
            let dy = 0;

            if (Math.abs((Number(col.x) || 0)) < tol) dx = bM / 2;
            else if (Math.abs((Number(col.x) || 0) - totalX) < tol) dx = -bM / 2;

            if (Math.abs((Number(col.y) || 0)) < tol) dy = hM / 2;
            else if (Math.abs((Number(col.y) || 0) - totalY) < tol) dy = -hM / 2;

            return { dx, dy };
        }

        function getColumnPlanPosition(col) {
            const offset = getColumnPlanOffset(col);
            return {
                x: (Number(col?.x) || 0) + offset.dx,
                y: (Number(col?.y) || 0) + offset.dy
            };
        }

        function getColumnHalfAlongBeam(col, direction) {
            if (!col) return 0;
            const size = getColumnSizeMm(col);
            return ((direction === 'X' ? size.b : size.h) / 1000) / 2;
        }

        function getBeamPlanOffset(beam, beamWidthM) {
            let offsetX = 0;
            let offsetY = 0;
            if (!beam || state.columnAlignment !== 'outer') return { offsetX, offsetY };

            const { totalX, totalY } = getPlanBounds();
            const halfWidth = Number(beamWidthM || 0) / 2;
            if (beam.direction === 'X') {
                if (Math.abs((Number(beam.y1) || 0)) < 0.01) offsetY = halfWidth;
                else if (Math.abs((Number(beam.y1) || 0) - totalY) < 0.01) offsetY = -halfWidth;
            } else {
                if (Math.abs((Number(beam.x1) || 0)) < 0.01) offsetX = halfWidth;
                else if (Math.abs((Number(beam.x1) || 0) - totalX) < 0.01) offsetX = -halfWidth;
            }

            return { offsetX, offsetY };
        }

        function getBeamSizeKey(beamId, floorId) {
            const activeFloorId = floorId || state.floors[state.currentFloorIndex]?.id || 'GLOBAL';
            return `${activeFloorId}::${beamId}`;
        }

        function getBeamSizeOverride(beamId, floorId) {
            const overrides = state.beamSizeOverrides || {};
            return overrides[getBeamSizeKey(beamId, floorId)] || overrides[beamId] || null;
        }

        function getBeamSizeMm(beam, floorId) {
            const override = getBeamSizeOverride(beam?.id, floorId);
            const autoDepth = Math.max(300, Math.ceil(((beam?.span || 4) * 1000) / 16 / 50) * 50);
            const b = normalizeMemberSizeMm(
                firstPositive(override?.webW, override?.overrideB, beam?.webW, beam?.overrideB, beam?.b, beam?.suggestedB, state.defaultBeamB),
                250,
                150,
                1500
            );
            const h = normalizeMemberSizeMm(
                firstPositive(override?.webD, override?.overrideH, beam?.webD, beam?.overrideH, beam?.h, beam?.suggestedH, state.defaultBeamH),
                autoDepth,
                200,
                2000
            );
            return { b, h };
        }

        function applyBeamSizeMm(beam, floorId, b, h) {
            if (!beam) return;
            const current = getBeamSizeMm(beam, floorId);
            const nextB = normalizeMemberSizeMm(b, current.b, 150, 1500);
            const nextH = normalizeMemberSizeMm(h, current.h, 200, 2000);
            beam.webW = nextB;
            beam.webD = nextH;
            beam.overrideB = nextB;
            beam.overrideH = nextH;
            beam.suggestedB = nextB;
            beam.suggestedH = nextH;
            beam.b = nextB;
            beam.h = nextH;
        }

        function applyBeamSizeOverridesToBeams(floorId) {
            (state.beams || []).forEach(beam => {
                const override = getBeamSizeOverride(beam.id, floorId);
                if (override) {
                    applyBeamSizeMm(beam, floorId, override.webW, override.webD);
                } else if (beam.webW || beam.webD || beam.overrideB || beam.overrideH) {
                    const size = getBeamSizeMm(beam, floorId);
                    applyBeamSizeMm(beam, floorId, size.b, size.h);
                }
            });
        }

        function getGridCoordinatesForLabels() {
            const xCoords = [0];
            (state.xSpans || []).forEach(span => xCoords.push(xCoords[xCoords.length - 1] + span));
            const yCoords = [0];
            (state.ySpans || []).forEach(span => yCoords.push(yCoords[yCoords.length - 1] + span));
            return { xCoords, yCoords };
        }

        function getNearestGridLabel(x, y) {
            const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
            const { xCoords, yCoords } = getGridCoordinatesForLabels();
            let xi = 0;
            let yi = 0;
            xCoords.forEach((gx, idx) => {
                if (Math.abs(gx - x) < Math.abs(xCoords[xi] - x)) xi = idx;
            });
            yCoords.forEach((gy, idx) => {
                if (Math.abs(gy - y) < Math.abs(yCoords[yi] - y)) yi = idx;
            });
            return `${letters[xi] || '?'}${yi + 1}`;
        }

        function getBeamGovernanceType(beam) {
            if (!beam) return 'regular';
            if (beam.beamType) return beam.beamType;
            if (beam.isEdgeBeam) return 'cantilever_edge';
            if (beam.isCantilever) return 'cantilever';
            if (beam.isStair || beam.source === 'stair' || /stair/i.test(String(beam.id || ''))) return 'stair';
            if (beam.isCustom) return 'custom';
            return 'regular';
        }

        function getBeamGovernanceLabel(beam) {
            const type = getBeamGovernanceType(beam);
            if (type === 'cantilever_edge') return 'cantilever edge';
            if (type === 'custom') return 'added';
            return type;
        }

        function getBeamDirectionLabel(beam) {
            return beam?.direction || beam?.dir || '-';
        }

        function isPointOnBeamSegment(point, beam, tolerance = 0.05) {
            if (!point || !beam) return false;
            const x1 = Number(beam.x1);
            const y1 = Number(beam.y1);
            const x2 = Number(beam.x2);
            const y2 = Number(beam.y2);
            if (![x1, y1, x2, y2].every(Number.isFinite)) return false;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const lenSq = dx * dx + dy * dy;
            if (lenSq <= 0) return false;

            const t = ((point.x - x1) * dx + (point.y - y1) * dy) / lenSq;
            if (t < -tolerance || t > 1 + tolerance) return false;

            const clampedT = Math.max(0, Math.min(1, t));
            const projX = x1 + clampedT * dx;
            const projY = y1 + clampedT * dy;
            return Math.hypot(point.x - projX, point.y - projY) <= tolerance;
        }

        function resolveBeamEndpointTopology(point, floorId, candidateBeams = [], selfBeamId = null) {
            const tolerance = 0.05;
            const column = (state.columns || []).find(col => {
                if (col.active === false) return false;
                if (floorId && !isColumnActiveOnFloor(col, floorId)) return false;
                return Math.hypot((col.x || 0) - point.x, (col.y || 0) - point.y) <= tolerance;
            });
            if (column) {
                return { kind: 'column', id: column.id, x: column.x, y: column.y };
            }

            const supportBeam = (candidateBeams || []).find(beam => {
                if (!beam || beam.id === selfBeamId || beam.deleted || beam.isCustom) return false;
                return isPointOnBeamSegment(point, beam, tolerance);
            });
            if (supportBeam) {
                return {
                    kind: 'beam',
                    id: supportBeam.id,
                    beamType: getBeamGovernanceType(supportBeam),
                    x: point.x,
                    y: point.y
                };
            }

            return { kind: 'free', x: point.x, y: point.y };
        }

        function resolveBeamTopology(beam, floorId, candidateBeams = []) {
            const start = { x: Number(beam?.x1) || 0, y: Number(beam?.y1) || 0 };
            const end = { x: Number(beam?.x2) || 0, y: Number(beam?.y2) || 0 };
            return {
                start: resolveBeamEndpointTopology(start, floorId, candidateBeams, beam?.id),
                end: resolveBeamEndpointTopology(end, floorId, candidateBeams, beam?.id)
            };
        }

        function classifyCustomBeamExportReadiness(beam) {
            const type = getBeamGovernanceType(beam);
            if (!(beam?.isCustom || type === 'custom' || type === 'stair')) {
                return { status: 'not_applicable', candidate: false, reason: 'not a custom or stair beam' };
            }

            const topology = beam.topology;
            if (!topology?.start || !topology?.end) {
                return { status: 'ambiguous_missing_topology', candidate: false, reason: 'endpoint topology has not been resolved' };
            }

            const span = Number(beam.span || 0);
            if (!(span > 0)) {
                return { status: 'unsupported_zero_length', candidate: false, reason: 'beam span is zero or invalid' };
            }

            const startKind = topology.start.kind;
            const endKind = topology.end.kind;

            if (startKind === 'column' && endKind === 'column') {
                if (topology.start.id === topology.end.id) {
                    return { status: 'unsupported_same_column', candidate: false, reason: 'both endpoints resolve to the same column' };
                }
                return {
                    status: 'candidate_column_to_column',
                    candidate: true,
                    reason: 'both endpoints resolve to existing column joints',
                    startCol: topology.start.id,
                    endCol: topology.end.id
                };
            }

            if (startKind === 'free' || endKind === 'free') {
                return {
                    status: 'unsupported_free_endpoint',
                    candidate: false,
                    reason: 'one or both endpoints are free and require solver node/support doctrine'
                };
            }

            if (startKind === 'beam' || endKind === 'beam') {
                return {
                    status: 'ambiguous_beam_intersection',
                    candidate: false,
                    reason: 'beam endpoint lands on another beam and requires node creation/splitting'
                };
            }

            return {
                status: 'ambiguous_endpoint_type',
                candidate: false,
                reason: `unrecognized endpoint topology ${startKind}-${endKind}`
            };
        }

        function getCantileverEdgeScheduleLabels(beam) {
            const { yCoords, xCoords } = getGridCoordinatesForLabels();
            const maxX = xCoords[xCoords.length - 1] || 0;
            const maxY = yCoords[yCoords.length - 1] || 0;
            if (beam.cantileverEdge === 'top') {
                return getNearestGridLabel(beam.x1, 0) + getNearestGridLabel(beam.x2, 0);
            }
            if (beam.cantileverEdge === 'bottom') {
                return getNearestGridLabel(beam.x1, maxY) + getNearestGridLabel(beam.x2, maxY);
            }
            if (beam.cantileverEdge === 'left') {
                return getNearestGridLabel(0, beam.y1) + getNearestGridLabel(0, beam.y2);
            }
            if (beam.cantileverEdge === 'right') {
                return getNearestGridLabel(maxX, beam.y1) + getNearestGridLabel(maxX, beam.y2);
            }
            return String(beam.id || '').replace(/\s+/g, '');
        }

        function getBeamScheduleId(beam, floorId, rowNum) {
            const type = getBeamGovernanceType(beam);
            const cleanId = String(beam?.id || rowNum).replace(/\s+/g, '');
            if (type === 'cantilever') {
                const supportCol = beam.startCol || beam.endCol || cleanId;
                return `CB-${floorId}-${supportCol}`;
            }
            if (type === 'cantilever_edge') {
                return `EB-${floorId}-${getCantileverEdgeScheduleLabels(beam)}`;
            }
            if (type === 'stair') return `SB-${floorId}-${cleanId}`;
            if (type === 'custom') return `AB-${floorId}-${cleanId}`;

            const startColID = beam.startCol ? (typeof beam.startCol === 'object' ? beam.startCol.id : beam.startCol) : '';
            const endColID = beam.endCol ? (typeof beam.endCol === 'object' ? beam.endCol.id : beam.endCol) : '';
            return startColID && endColID ? `B-${floorId}-${startColID}${endColID}` : `B-${floorId}-${cleanId}`;
        }

        function escapeJsString(value) {
            return String(value ?? '')
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\r?\n/g, ' ');
        }

        function refreshMemberSizeDependents() {
            calculate();
            if (typeof populateColumnSchedule === 'function') populateColumnSchedule();
            if (typeof populateBeamSchedule === 'function') populateBeamSchedule();
            if (typeof populateFootingSchedule === 'function') populateFootingSchedule();
            if (typeof populateBOM === 'function') populateBOM();
            if (typeof renderScheduleColumns === 'function') renderScheduleColumns();
            if (typeof renderScheduleBeams === 'function') renderScheduleBeams();
            if (typeof renderScheduleFootings === 'function') renderScheduleFootings();
            if (typeof render3DFrame === 'function' && view3DInitialized) render3DFrame();
        }

        // v3.10: UNDO/REDO SYSTEM - External stacks (not in state to avoid circular refs)
        const undoHistory = [];    // Array of state snapshots
        const redoHistory = [];    // Array of undone snapshots
        const MAX_UNDO_HISTORY = 10;

        /**
         * Save current state before mutations
         * Call this BEFORE any state-changing operation
         */
        function saveStateSnapshot() {
            const snapshot = {
                floors: JSON.parse(JSON.stringify(state.floors)),
                xSpans: [...state.xSpans],
                ySpans: [...state.ySpans],
                cantilevers: JSON.parse(JSON.stringify(state.cantilevers)),
                gfSuspended: state.gfSuspended,
                currentFloorIndex: state.currentFloorIndex
            };

            undoHistory.push(snapshot);
            if (undoHistory.length > MAX_UNDO_HISTORY) {
                undoHistory.shift();  // Remove oldest
            }

            // Clear redo stack on new action (standard behavior)
            redoHistory.length = 0;

            console.log(`v3.10: State saved (${undoHistory.length}/${MAX_UNDO_HISTORY} in history)`);
        }

        /**
         * Undo last action - restore previous state
         */
        function undo() {
            if (undoHistory.length === 0) {
                console.log('v3.10: Nothing to undo');
                return;
            }

            // Save current state to redo stack BEFORE restoring
            const currentSnapshot = {
                floors: JSON.parse(JSON.stringify(state.floors)),
                xSpans: [...state.xSpans],
                ySpans: [...state.ySpans],
                cantilevers: JSON.parse(JSON.stringify(state.cantilevers)),
                gfSuspended: state.gfSuspended,
                currentFloorIndex: state.currentFloorIndex
            };
            redoHistory.push(currentSnapshot);

            // Restore from undo stack
            const snapshot = undoHistory.pop();
            state.xSpans = snapshot.xSpans;
            state.ySpans = snapshot.ySpans;
            state.floors = hydrateFloors(snapshot.floors, snapshot.xSpans, snapshot.ySpans);
            state.cantilevers = snapshot.cantilevers;
            state.gfSuspended = snapshot.gfSuspended;
            state.currentFloorIndex = snapshot.currentFloorIndex;

            // Regenerate and refresh
            calculate();
            if (typeof render3DFrame === 'function') render3DFrame();

            console.log(`v3.10: Undo completed (${undoHistory.length} remaining)`);
        }

        /**
         * Redo last undone action
         */
        function redo() {
            if (redoHistory.length === 0) {
                console.log('v3.10: Nothing to redo');
                return;
            }

            // Save current to undo stack
            const currentSnapshot = {
                floors: JSON.parse(JSON.stringify(state.floors)),
                xSpans: [...state.xSpans],
                ySpans: [...state.ySpans],
                cantilevers: JSON.parse(JSON.stringify(state.cantilevers)),
                gfSuspended: state.gfSuspended,
                currentFloorIndex: state.currentFloorIndex
            };
            undoHistory.push(currentSnapshot);

            // Restore from redo stack
            const snapshot = redoHistory.pop();
            state.xSpans = snapshot.xSpans;
            state.ySpans = snapshot.ySpans;
            state.floors = hydrateFloors(snapshot.floors, snapshot.xSpans, snapshot.ySpans);
            state.cantilevers = snapshot.cantilevers;
            state.gfSuspended = snapshot.gfSuspended;
            state.currentFloorIndex = snapshot.currentFloorIndex;

            // Regenerate and refresh
            calculate();
            if (typeof render3DFrame === 'function') render3DFrame();

            console.log(`v3.10: Redo completed (${redoHistory.length} remaining)`);
        }

        // v3.10: Global keyboard shortcuts for Undo/Redo
        document.addEventListener('keydown', (e) => {
            // Ctrl+Z = Undo
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            // Ctrl+Y or Ctrl+Shift+Z = Redo
            if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
                e.preventDefault();
                redo();
            }
        });

        // ========== v3.0: SAVE/LOAD PROJECT ==========
        let currentProjectFileHandle = null;
        let currentProjectFileName = '';

        function withFstrExtension(filename) {
            const clean = String(filename || '').trim() || `FutolStructure_${new Date().toISOString().split('T')[0]}`;
            if (/\.(fstr|json)$/i.test(clean)) return clean;
            return `${clean}.fstr`;
        }

        function getProjectFileNameForSave(saveAs = false) {
            if (!saveAs && currentProjectFileName) return currentProjectFileName;
            const base = currentProjectFileName
                ? currentProjectFileName.replace(/\.[^.]+$/, '')
                : `FutolStructure_${new Date().toISOString().split('T')[0]}`;
            return withFstrExtension(base);
        }

        function getDefaultProjectFileName() {
            return getProjectFileNameForSave(false);
        }

        function validateProjectData(projectData) {
            if (!projectData || typeof projectData !== 'object') {
                throw new Error('Project file is empty or invalid.');
            }
            if (projectData.fileType && projectData.fileType !== FSTR_FILE_TYPE) {
                throw new Error(`Unsupported FutolStructure file type: ${projectData.fileType}`);
            }
            return projectData;
        }

        function buildProjectData() {
            return {
                fileType: FSTR_FILE_TYPE,
                schemaVersion: FSTR_SCHEMA_VERSION,
                format: 'FSTR_JSON',
                version: '2.8',
                savedAt: new Date().toISOString(),
                xSpans: state.xSpans || [4.0, 4.0],
                ySpans: state.ySpans || [5.0, 5.0],
                cantilevers: state.cantilevers || { top: [], bottom: [], left: [], right: [] },
                floors: (state.floors || []).map(f => ({
                    id: f.id,
                    name: f.name,
                    dlSuper: f.dlSuper,
                    liveLoad: f.liveLoad,
                    slabThickness: f.slabThickness,
                    height: f.height,
                    wallLoad: f.wallLoad,
                    isRoof: f.isRoof,
                    cantilevers: f.cantilevers || { top: [], bottom: [], left: [], right: [] },
                    customBeams: f.customBeams || [],
                    voidSlabs: f.voidSlabs || [],
                    slabOpenings: f.slabOpenings || [],
                    wallLoads: normalizeWallLoadList(f.wallLoads, { floorId: f.id, floorHeight: f.height }),
                    pointLoads: f.pointLoads || [],
                    deletedBeams: f.deletedBeams || [],
                    deletedColumns: f.deletedColumns || [],
                    lockedBeams: f.lockedBeams || [],
                    lockedSlabs: f.lockedSlabs || []
                })),
                currentFloorIndex: state.currentFloorIndex || 0,
                columnOverrides: (state.columns || []).map(c => ({
                    id: c.id,
                    active: c.active,
                    activePerFloor: c.activePerFloor || {},
                    startFloor: c.startFloor,
                    overrideB: c.overrideB,
                    overrideH: c.overrideH,
                    webB: c.webB,
                    webD: c.webD
                })),
                slabOpenings: (state.slabs || []).map(s => ({
                    id: s.id,
                    openingW: s.openingW,
                    openingH: s.openingH
                })).filter(s => s.openingW || s.openingH),
                beamOverrides: (state.beams || []).map(b => ({
                    id: b.id,
                    overrideB: b.overrideB,
                    overrideH: b.overrideH
                })).filter(b => b.overrideB || b.overrideH),
                beamSizeOverrides: state.beamSizeOverrides || {},
                gfSuspended: state.gfSuspended,
                fc: state.fc,
                fy: state.fy,
                soilBearing: state.soilBearing,
                concreteDensity: state.concreteDensity,
                defaultColumnB: state.defaultColumnB,
                defaultColumnH: state.defaultColumnH,
                defaultBeamB: state.defaultBeamB,
                defaultBeamH: state.defaultBeamH,
                tieBeamWidth: state.tieBeamWidth,
                tieBeamDepth: state.tieBeamDepth,
                plotSettings: normalizePlotSettings(state.plotSettings)
            };
        }

        function downloadProjectJson(json, filename) {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        async function writeProjectToHandle(fileHandle, json) {
            const writable = await fileHandle.createWritable();
            await writable.write(json);
            await writable.close();
        }

        async function saveProject(saveAs = false) {
            try {
                const projectData = buildProjectData();
                const json = JSON.stringify(projectData, null, 2);

                if (window.showSaveFilePicker) {
                    if (saveAs || !currentProjectFileHandle) {
                        currentProjectFileHandle = await window.showSaveFilePicker({
                            suggestedName: getProjectFileNameForSave(saveAs),
                            types: [{
                                description: 'FutolStructure Project',
                                accept: {
                                    'application/json': ['.fstr', '.json'],
                                    'application/octet-stream': ['.fstr']
                                }
                            }]
                        });
                    }

                    currentProjectFileName = currentProjectFileHandle?.name || getDefaultProjectFileName();
                    await writeProjectToHandle(currentProjectFileHandle, json);
                    console.log('v3.0: Project saved!', projectData);
                    alert(`Project saved: ${ currentProjectFileName }`);
                    return;
                }

                const fallbackName = getProjectFileNameForSave(saveAs);
                downloadProjectJson(json, fallbackName);
                console.log('v3.0: Project downloaded!', projectData);
                alert('Project downloaded as .fstr. Browser file-handle save is not available in this session.');
            } catch (err) {
                if (err?.name === 'AbortError') return;
                console.error('Save failed:', err);
                alert('Failed to save project: ' + err.message);
            }
        }

        function applyLoadedProject(projectData, sourceName = '') {
            state.xSpans = projectData.xSpans || state.xSpans;
            state.ySpans = projectData.ySpans || state.ySpans;
            state.cantilevers = projectData.cantilevers || state.cantilevers;

            if (projectData.floors) {
                state.floors = hydrateFloors(projectData.floors, state.xSpans, state.ySpans);
            }
            state.currentFloorIndex = projectData.currentFloorIndex || 0;

            state.gfSuspended = projectData.gfSuspended != null
                ? !!projectData.gfSuspended
                : state.floors.some(f => f.id === 'GF');
            if (projectData.fc != null) state.fc = projectData.fc;
            if (projectData.fy != null) state.fy = projectData.fy;
            if (projectData.soilBearing != null) state.soilBearing = projectData.soilBearing;
            if (projectData.concreteDensity != null) state.concreteDensity = projectData.concreteDensity;
            if (projectData.defaultColumnB != null) state.defaultColumnB = projectData.defaultColumnB;
            if (projectData.defaultColumnH != null) state.defaultColumnH = projectData.defaultColumnH;
            if (projectData.defaultBeamB != null) state.defaultBeamB = projectData.defaultBeamB;
            if (projectData.defaultBeamH != null) state.defaultBeamH = projectData.defaultBeamH;
            state.beamSizeOverrides = projectData.beamSizeOverrides || {};
            if (projectData.tieBeamWidth != null) state.tieBeamWidth = projectData.tieBeamWidth;
            if (projectData.tieBeamDepth != null) state.tieBeamDepth = projectData.tieBeamDepth;
            state.tieBeamW = (state.tieBeamWidth || Math.round((state.tieBeamW || 0.25) * 1000)) / 1000;
            state.tieBeamH = (state.tieBeamDepth || Math.round((state.tieBeamH || 0.35) * 1000)) / 1000;
            state.plotSettings = normalizePlotSettings(projectData.plotSettings || state.plotSettings);

            const gfSuspendedEl = document.getElementById('gfSuspended');
            if (gfSuspendedEl) gfSuspendedEl.checked = state.gfSuspended;

            const elevSection = document.getElementById('elevationSection');
            if (elevSection) {
                elevSection.style.display = state.gfSuspended ? 'block' : 'none';
            }

            const gfFloor = state.floors.find(f => f.id === 'GF');
            const elevationHeightEl = document.getElementById('elevationHeight');
            if (elevationHeightEl && gfFloor?.height != null) {
                elevationHeightEl.value = String(gfFloor.height);
            }

            const fcInput = document.getElementById('fcInput');
            if (fcInput) fcInput.value = String(state.fc);
            const fyInput = document.getElementById('fyInput');
            if (fyInput) fyInput.value = String(state.fy);
            const soilBearingInput = document.getElementById('soilBearing');
            if (soilBearingInput) soilBearingInput.value = String(state.soilBearing);
            const columnWidthInput = document.getElementById('columnWidthInput');
            if (columnWidthInput) columnWidthInput.value = String(state.defaultColumnB);
            const columnDepthInput = document.getElementById('columnDepthInput');
            if (columnDepthInput) columnDepthInput.value = String(state.defaultColumnH);
            const beamWidthInput = document.getElementById('beamWidthInput');
            if (beamWidthInput) beamWidthInput.value = String(state.defaultBeamB);
            const beamDepthInput = document.getElementById('beamDepthInput');
            if (beamDepthInput) beamDepthInput.value = String(state.defaultBeamH);
            const tieBeamWidthInput = document.getElementById('tieBeamWidth');
            if (tieBeamWidthInput) tieBeamWidthInput.value = String(state.tieBeamWidth);
            const tieBeamDepthInput = document.getElementById('tieBeamDepth');
            if (tieBeamDepthInput) tieBeamDepthInput.value = String(state.tieBeamDepth);
            loadSettings();
            syncDimensionTable();

            renderSpans();
            renderCantileverInputs();
            renderFloorTabs();
            calculate();

            if (projectData.columnOverrides) {
                for (let override of projectData.columnOverrides) {
                    const col = state.columns.find(c => c.id === override.id);
                    if (col) {
                        col.active = override.active;
                        col.activePerFloor = override.activePerFloor;
                        col.startFloor = override.startFloor;
                        const colB = override.webB || override.overrideB;
                        const colH = override.webD || override.overrideH;
                        if (colB || colH) applyColumnSizeMm(col, colB || getColumnSizeMm(col).b, colH || getColumnSizeMm(col).h);
                    }
                }
            }

            if (projectData.slabOpenings) {
                const floor = state.floors[state.currentFloorIndex];
                if (floor && !floor.slabOpenings?.length) {
                    floor.slabOpenings = cloneSerializable(projectData.slabOpenings, []);
                }
                for (let opening of projectData.slabOpenings) {
                    const slab = state.slabs.find(s => s.id === opening.id);
                    if (slab) {
                        slab.openingW = opening.openingW;
                        slab.openingH = opening.openingH;
                        slab.netArea = slab.area - (slab.openingW || 0) * (slab.openingH || 0);
                    }
                }
            }

            if (projectData.beamOverrides) {
                for (let override of projectData.beamOverrides) {
                    const beam = state.beams.find(b => b.id === override.id);
                    if (beam) {
                        const floorId = state.floors[state.currentFloorIndex]?.id;
                        const b = override.webW || override.overrideB;
                        const h = override.webD || override.overrideH;
                        if (b || h) {
                            if (!state.beamSizeOverrides) state.beamSizeOverrides = {};
                            state.beamSizeOverrides[getBeamSizeKey(override.id, floorId)] = {
                                webW: b || getBeamSizeMm(beam, floorId).b,
                                webD: h || getBeamSizeMm(beam, floorId).h
                            };
                            applyBeamSizeMm(beam, floorId, b || getBeamSizeMm(beam, floorId).b, h || getBeamSizeMm(beam, floorId).h);
                        }
                    }
                }
            }

            calculate();
            draw();
            if (typeof render3DFrame === 'function' && view3DInitialized) render3DFrame();
            fitView();

            currentProjectFileName = sourceName || currentProjectFileName || getDefaultProjectFileName();
            console.log('v3.0: Project loaded!', projectData);
            alert(`Project loaded${ currentProjectFileName ? ': ' + currentProjectFileName : ' successfully!' }`);
        }

        async function openProject() {
            if (window.showOpenFilePicker) {
                try {
                    const [fileHandle] = await window.showOpenFilePicker({
                        multiple: false,
                        types: [{
                            description: 'FutolStructure Project',
                            accept: {
                                'application/json': ['.fstr', '.json'],
                                'application/octet-stream': ['.fstr']
                            }
                        }]
                    });
                    if (!fileHandle) return;

                    const file = await fileHandle.getFile();
                    const projectData = validateProjectData(JSON.parse(await file.text()));
                    currentProjectFileHandle = fileHandle;
                    currentProjectFileName = file.name || fileHandle.name || '';
                    applyLoadedProject(projectData, currentProjectFileName);
                    return;
                } catch (err) {
                    if (err?.name === 'AbortError') return;
                    console.warn('Open via File System Access API failed, falling back to file input:', err);
                }
            }

            document.getElementById('loadProjectInput').click();
        }

        function loadProject(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const projectData = validateProjectData(JSON.parse(e.target.result));
                    currentProjectFileHandle = null;
                    currentProjectFileName = file.name || '';
                    applyLoadedProject(projectData, currentProjectFileName);
                } catch (err) {
                    console.error('Failed to load project:', err);
                    alert('Failed to load project: ' + err.message);
                }
            };
            reader.readAsText(file);

            event.target.value = '';
        }

        // ========== v3.0: RESET & REFRESH ==========

        /**
         * Reset project to default values
         */
        function resetProject() {
            if (!confirm('🔄 Reset all values to defaults?\n\nThis will clear your current project and cannot be undone.')) {
                return;
            }

            // Reset state to defaults
            state.xSpans = [4.0, 4.0];
            state.ySpans = [5.0, 5.0];
            state.cantilevers = { top: [0, 0], bottom: [0, 0], left: [0, 0], right: [0, 0] };
            state.floors = [
                createFloor('2F', '2nd Floor', 2, 2),
                createFloor('RF', 'Roof', 2, 2, { dlSuper: 1.5, liveLoad: 1.0, slabThickness: 120, wallLoad: 0, isRoof: true })
            ];
            state.currentFloorIndex = 0;
            state.gfSuspended = false;
            currentProjectFileHandle = null;
            currentProjectFileName = '';
            state.columns = [];
            state.beams = [];
            state.slabs = [];
            state.nextCustomBeamId = 1;
            state.beamSizeOverrides = {};
            state.tieBeamWidth = 200;
            state.tieBeamDepth = 350;
            state.tieBeamW = 0.2;
            state.tieBeamH = 0.35;

            // Reset UI inputs
            document.getElementById('gfSuspended').checked = false;
            document.getElementById('elevationSection').style.display = 'none';
            document.getElementById('buildingType').value = 'residential';
            document.getElementById('fcInput').value = '21';
            document.getElementById('fyInput').value = '415';
            document.getElementById('columnWidthInput').value = '0';
            document.getElementById('columnDepthInput').value = '0';
            document.getElementById('beamWidthInput').value = '250';
            document.getElementById('beamDepthInput').value = '0';
            document.getElementById('footingDepth').value = '1.5';
            document.getElementById('soilBearing').value = '150';
            const tieBeamWidthInput = document.getElementById('tieBeamWidth');
            const tieBeamDepthInput = document.getElementById('tieBeamDepth');
            if (tieBeamWidthInput) tieBeamWidthInput.value = '200';
            if (tieBeamDepthInput) tieBeamDepthInput.value = '350';

            // Re-render UI
            renderSpans();
            renderCantileverInputs();
            renderFloorTabs();
            calculate();
            fitView();

            console.log('v3.0: Project reset to defaults');
            alert('✅ Project reset to defaults!');
        }

        /**
         * Refresh view - recalculate and redraw
         */
        function refreshView() {
            calculate();

            // Refresh 3D if active
            if (typeof render3DFrame === 'function') {
                try { render3DFrame(); } catch (e) { console.warn('3D refresh skipped'); }
            }

            // Force canvas redraw
            if (typeof draw === 'function') {
                draw();
            }

            console.log('v3.0: View refreshed');
        }








// ========== v3.14: SAVE/LOAD (.tpro) + UNDO + FINAL FEATURES ==========

// saveProject/loadProject defined earlier (~line 9943)
// Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y/Ctrl+Shift+Z redo, Ctrl+S save, Escape cancel modes
document.addEventListener('keydown', function(e) {
    // Skip if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); if (typeof undo === 'function') undo(); }
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) { e.preventDefault(); if (typeof redo === 'function') redo(); }
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); if (typeof saveProject === 'function') saveProject(); }
    if (e.key === 'Escape') {
        // Cancel beam drawing mode
        if (state.addingBeam) { state.addingBeam = false; state.beamDrawStart = null; if (typeof draw === 'function') draw(); }
        // Cancel planted column mode
        if (state.placingPlantedColumn) { state.placingPlantedColumn = false; document.body.style.cursor = 'default'; }
    }
    if (e.key === 'Delete') {
        // Delete selected members via context menu
        if (typeof deleteSelectedMember === 'function') deleteSelectedMember();
    }
    // F key = fit view
    if (e.key === 'f' && !e.ctrlKey) { if (typeof fitView === 'function') fitView(); }
});

// Duplicate undo system removed — using the one defined at ~line 3355
// Hook into calculate to auto-push undo (removed — no-op wrapper was dead code)

// --- DASHBOARD ---
function populateDashboard() {
    const el = document.getElementById('dashboardContent');
    if (!el) return;

    const activeCols = state.columns.filter(c => c.active !== false);
    const activeBeams = state.beams.filter(b => !b.isCustom && !b.isCantilever);
    const numFloors = state.floors.length;

    // Quick checks
    let colOK = 0, colNG = 0;
    const fc = state.fc || 21, fy = state.fy || 415;
    activeCols.forEach(col => {
        const b = col.suggestedB || 250, h = col.suggestedH || 250;
        const Ag = b * h;
        const Ast = 0.01 * Ag;
        const Pn = 0.80 * (0.85 * fc * (Ag - Ast) + fy * Ast) / 1000;
        const phiPn = 0.65 * Pn;
        const Pu = col.totalLoadWithDL || col.totalLoad || 0;
        if (Pu <= phiPn) colOK++; else colNG++;
    });

    let ftgOK = 0, ftgNG = 0;
    activeCols.forEach(col => {
        if (!col.footingSize || col.isPlanted) return;
        const fd = col.footingDesign;
        if (fd && fd.punchOK && fd.shearOK) ftgOK++; else ftgNG++;
    });

    const makeCard = (icon, title, ok, ng) => {
        const total = ok + ng;
        const pct = total > 0 ? Math.round(ok/total*100) : 0;
        const color = ng === 0 ? '#10b981' : '#ef4444';
        return '<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; text-align:center;">' +
            '<div style="font-size:1.5em;">' + icon + '</div>' +
            '<div style="font-weight:bold; margin:4px 0;">' + title + '</div>' +
            '<div style="font-size:2em; font-weight:bold; color:' + color + ';">' + pct + '%</div>' +
            '<div style="font-size:0.7rem; color:#64748b;">' + ok + ' OK / ' + ng + ' NG</div>' +
            '</div>';
    };

    let html = '<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:16px;">';
    html += makeCard('🏛️', 'Columns', colOK, colNG);
    html += makeCard('🏗️', 'Footings', ftgOK, ftgNG);
    html += makeCard('📐', 'Beams', activeBeams.length, 0);
    html += makeCard('🧱', 'Slabs', state.slabs.filter(s => !s.isVoid).length, 0);
    html += '</div>';

    // Summary stats
    html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">';
    html += '<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">';
    html += '<h4 style="margin:0 0 8px; font-size:0.8rem;">Project Stats</h4>';
    html += '<div style="font-size:0.75rem; line-height:1.8;">';
    html += 'Floors: <strong>' + numFloors + '</strong><br>';
    html += 'Columns: <strong>' + activeCols.length + '</strong><br>';
    html += 'Beams: <strong>' + activeBeams.length + '</strong><br>';
    html += 'Grid: <strong>' + state.xSpans.length + ' x ' + state.ySpans.length + '</strong><br>';
    html += "f'c: <strong>" + (state.fc || 21) + ' MPa</strong><br>';
    html += 'fy: <strong>' + (state.fy || 415) + ' MPa</strong>';
    html += '</div></div>';

    html += '<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">';
    html += '<h4 style="margin:0 0 8px; font-size:0.8rem;">Quick Actions</h4>';
    html += '<div style="display:flex; flex-direction:column; gap:6px;">';
    html += '<button onclick="saveProject()" style="padding:6px 12px; background:#2563eb; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:0.75rem;">Save Project (.fstr)</button>';
    html += '<button onclick="openProject()" style="padding:6px 12px; background:#059669; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:0.75rem;">Open Project (.fstr/.json)</button>';
    html += '<button onclick="generatePDFReport()" style="padding:6px 12px; background:#7c3aed; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:0.75rem;">PDF Report</button>';
    html += '<button onclick="undo()" style="padding:6px 12px; background:#64748b; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:0.75rem;">Undo (Ctrl+Z)</button>';
    html += '</div></div></div>';

    el.innerHTML = html;
}

// --- SETTINGS ---
function loadSettings() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('settFc', state.fc || 21);
    set('settFy', state.fy || 415);
    set('settSoilBearing', state.soilBearing || 100);
    const plotSettings = getPlotSettings();
    set('settPaperSize', plotSettings.paperSize);
    set('settPlotOrientation', plotSettings.orientation);
    set('settPlotMargin', plotSettings.marginMm);
}

function applySettings() {
    pushUndo();
    state.fc = parseFloat(document.getElementById('settFc')?.value || 21);
    state.fy = parseFloat(document.getElementById('settFy')?.value || 415);
    state.soilBearing = parseFloat(document.getElementById('settSoilBearing')?.value || 100);
    state.plotSettings = normalizePlotSettings({
        paperSize: document.getElementById('settPaperSize')?.value,
        orientation: document.getElementById('settPlotOrientation')?.value,
        marginMm: document.getElementById('settPlotMargin')?.value
    });
    if (typeof calculate === 'function') calculate();
    alert('Settings applied and recalculated!');
}

// --- COST ESTIMATOR ---
function calculateCost() {
    const unitConcrete = parseFloat(document.getElementById('costConcrete')?.value || 6500);
    const unitRebar = parseFloat(document.getElementById('costRebar')?.value || 55);
    const unitFormwork = parseFloat(document.getElementById('costFormwork')?.value || 450);
    const tbody = document.getElementById('costBody');
    if (!tbody) return;

    const numFloors = state.floors.length;
    const floorH = state.floors[0]?.height || 3.0;
    const activeCols = state.columns.filter(c => c.active !== false && !c.isPlanted);

    // Concrete volumes
    const colB = (activeCols[0]?.suggestedB || 250) / 1000;
    const colH = (activeCols[0]?.suggestedH || 250) / 1000;
    const colVol = colB * colH * floorH * activeCols.length * numFloors;

    let beamVol = 0;
    state.beams.forEach(beam => {
        if (beam.isCustom || beam.isCantilever) return;
        beamVol += ((beam.suggestedB || 250) / 1000) * ((beam.suggestedH || 400) / 1000) * (beam.span || 0);
    });
    beamVol *= numFloors;

    let ftgVol = 0;
    activeCols.forEach(col => {
        if (col.footingSize) ftgVol += col.footingSize * col.footingSize * (col.footingDesign ? col.footingDesign.h / 1000 : 0.3);
    });

    let slabVol = 0;
    state.floors.forEach(floor => {
        const t = (floor.slabThickness || 150) / 1000;
        state.slabs.forEach(slab => { if (!slab.isVoid) slabVol += slab.width * slab.height * t; });
    });

    const totalVol = colVol + beamVol + ftgVol + slabVol;
    const rebarWt = totalVol * 80; // 80 kg/m3 estimate

    // Formwork area
    const fwCol = 2 * (colB + colH) * floorH * activeCols.length * numFloors;
    let fwBeam = 0;
    state.beams.forEach(beam => {
        if (beam.isCustom || beam.isCantilever) return;
        const bw = (beam.suggestedB || 250) / 1000;
        const bh = (beam.suggestedH || 400) / 1000;
        fwBeam += (bw + 2 * bh) * (beam.span || 0);
    });
    fwBeam *= numFloors;
    const fwSlab = state.slabs.reduce((s, sl) => s + (sl.isVoid ? 0 : sl.width * sl.height), 0) * numFloors;
    const totalFW = fwCol + fwBeam + fwSlab;

    const concreteCost = totalVol * unitConcrete;
    const rebarCost = rebarWt * unitRebar;
    const fwCost = totalFW * unitFormwork;
    const total = concreteCost + rebarCost + fwCost;

    let html = '';
    html += '<tr><td>Concrete</td><td>' + totalVol.toFixed(1) + '</td><td>m3</td><td>' + unitConcrete.toLocaleString() + '</td><td>' + concreteCost.toLocaleString() + '</td></tr>';
    html += '<tr><td>Rebar (~80kg/m3)</td><td>' + rebarWt.toFixed(0) + '</td><td>kg</td><td>' + unitRebar.toLocaleString() + '</td><td>' + rebarCost.toLocaleString() + '</td></tr>';
    html += '<tr><td>Formworks</td><td>' + totalFW.toFixed(1) + '</td><td>m2</td><td>' + unitFormwork.toLocaleString() + '</td><td>' + fwCost.toLocaleString() + '</td></tr>';
    tbody.innerHTML = html;
    document.getElementById('costTotal').textContent = 'PHP ' + total.toLocaleString();
}

// --- STEEL SUMMARY BY DIAMETER ---
function populateSteelSummary() {
    const barWt = {10: 0.617, 12: 0.888, 16: 1.578, 20: 2.466, 25: 3.853, 28: 4.834, 32: 6.313};
    const summary = {};
    const numFloors = state.floors.length;
    const floorH = state.floors[0]?.height || 3.0;

    const addBar = (dia, len) => {
        if (!summary[dia]) summary[dia] = { len: 0, wt: 0 };
        summary[dia].len += len;
        summary[dia].wt += len * (barWt[dia] || 1.0);
    };

    // Column main bars
    state.columns.forEach(col => {
        if (col.active === false) return;
        const b = col.suggestedB || 250;
        const dia = b >= 350 ? 20 : 16;
        const nBars = b >= 350 ? 8 : 4;
        const lap = 40 * dia / 1000;
        addBar(dia, nBars * (floorH + lap) * numFloors);
    });

    // Column ties
    state.columns.forEach(col => {
        if (col.active === false) return;
        const b = col.suggestedB || 250, h = col.suggestedH || 250;
        const nTies = Math.ceil((floorH * 1000) / 200);
        const perimeter = 2 * ((b - 80) + (h - 80) + 135 * 2) / 1000;
        addBar(10, nTies * perimeter * numFloors);
    });

    // Beam bars
    state.beams.forEach(beam => {
        if (beam.isCustom || beam.isCantilever) return;
        const bh = beam.suggestedH || 400;
        const dia = bh >= 500 ? 20 : 16;
        const span = beam.span || 4.0;
        addBar(dia, (3 * span + 2 * 2 * span * 0.3) * numFloors); // 3 bot + 2 top per end
    });

    // Beam stirrups
    state.beams.forEach(beam => {
        if (beam.isCustom || beam.isCantilever) return;
        const b = beam.suggestedB || 250, h = beam.suggestedH || 400;
        const span = beam.span || 4.0;
        const nStirr = Math.ceil((span * 1000) / 150);
        const stirrLen = 2 * ((b - 80) + (h - 80) + 135 * 2) / 1000;
        addBar(10, nStirr * stirrLen * numFloors);
    });

    // Footing bars
    state.columns.forEach(col => {
        if (col.active === false || !col.footingSize || col.isPlanted) return;
        const fd = col.footingDesign;
        const dia = fd ? fd.barDia : 16;
        const nBars = fd ? fd.nBars * 2 : 8; // both ways
        const cutLen = (col.footingSize * 1000 - 150 + 2 * 12 * dia) / 1000;
        addBar(dia, nBars * cutLen);
    });

    // Slab bars (12mm)
    state.slabs.forEach(slab => {
        if (slab.isVoid) return;
        const area = slab.width * slab.height;
        addBar(12, area * 2 * (1000 / 200) * numFloors); // both ways @ 200mm
    });

    let html = '', totalLen = 0, totalWt = 0, total6m = 0, total9m = 0;
    Object.keys(summary).sort((a,b) => a - b).forEach(dia => {
        const s = summary[dia];
        const n6m = Math.ceil(s.len / 6);
        const n9m = Math.ceil(s.len / 9);
        totalLen += s.len; totalWt += s.wt; total6m += n6m; total9m += n9m;
        html += '<tr><td>D' + dia + '</td><td>' + s.len.toFixed(1) + '</td><td>' + s.wt.toFixed(0) + '</td><td>' + n6m + '</td><td>' + n9m + '</td></tr>';
    });
    const tbody = document.getElementById('steelSummaryBody');
    if (tbody) tbody.innerHTML = html;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('steelTotalLen', totalLen.toFixed(0));
    set('steelTotalWt', totalWt.toFixed(0));
    set('steelTotal6m', total6m);
    set('steelTotal9m', total9m);
}

// --- RETAINING WALL DESIGN ---
function designRetainingWall() {
    const H = parseFloat(document.getElementById('rwHeight')?.value || 3.0);
    const gamma = parseFloat(document.getElementById('rwGammaSoil')?.value || 18);
    const phi = parseFloat(document.getElementById('rwPhi')?.value || 30);
    const fc = state.fc || 21, fy = state.fy || 415;

    // Rankine Ka
    const Ka = (1 - Math.sin(phi * Math.PI / 180)) / (1 + Math.sin(phi * Math.PI / 180));
    const Kp = 1 / Ka;

    // Active pressure
    const Pa = 0.5 * Ka * gamma * H * H; // kN/m
    const armPa = H / 3; // from base

    // Preliminary dimensions
    const tBase = Math.max(0.6 * H, 1.5); // base width ~0.6H
    const tStem = Math.max(200, H * 50 + 150); // mm
    const tFoot = Math.max(300, H * 80); // mm

    // Resisting (concrete self-weight + soil)
    const gammaC = 24;
    const Wstem = (tStem / 1000) * H * gammaC; // kN/m
    const Wfoot = tBase * (tFoot / 1000) * gammaC; // kN/m
    const Wsoil = (tBase - tStem / 1000) * 0.6 * H * gamma; // soil on heel (approx)
    const W = Wstem + Wfoot + Wsoil;

    // Overturning
    const RM = W * tBase / 2;
    const OTM = Pa * armPa;
    const FS_otm = RM / OTM;

    // Sliding
    const mu = Math.tan(phi * Math.PI / 180 * 0.67); // base friction ~2/3 phi
    const Pp = 0.5 * Kp * gamma * (tFoot / 1000) * (tFoot / 1000); // passive (small)
    const Fr = mu * W + Pp;
    const FS_slide = Fr / Pa;

    // Eccentricity
    const e = tBase / 2 - (RM - OTM) / W;
    const eLimit = tBase / 6;

    // Stem design (cantilever)
    const Mu_stem = Pa * armPa; // kN.m/m
    const d = tStem - 50; // mm
    const Rn = (Mu_stem * 1e6) / (0.9 * 1000 * d * d);
    const disc = 1 - (2 * Rn) / (0.85 * fc);
    let rho = disc > 0 ? (0.85 * fc / fy) * (1 - Math.sqrt(disc)) : 0.002;
    rho = Math.max(rho, 0.0018);
    const As = rho * 1000 * d;
    const barDia = 16;
    const spacing = Math.min(Math.floor(Math.PI * barDia * barDia / 4 * 1000 / As), 300);

    let html = '';
    html += '<tr><td>Rankine Ka</td><td>' + Ka.toFixed(3) + '</td><td></td></tr>';
    html += '<tr><td>Active Force Pa</td><td>' + Pa.toFixed(1) + '</td><td>kN/m</td></tr>';
    html += '<tr style="border-top:1px solid #ccc;"><td>Base Width</td><td>' + tBase.toFixed(2) + '</td><td>m</td></tr>';
    html += '<tr><td>Stem Thickness</td><td>' + tStem.toFixed(0) + '</td><td>mm</td></tr>';
    html += '<tr><td>Footing Depth</td><td>' + tFoot.toFixed(0) + '</td><td>mm</td></tr>';
    html += '<tr style="border-top:1px solid #ccc;"><td>FS Overturning</td><td style="font-weight:bold;' + (FS_otm >= 1.5 ? 'color:green;' : 'color:red;') + '">' + FS_otm.toFixed(2) + '</td><td>Req 1.50</td></tr>';
    html += '<tr><td>FS Sliding</td><td style="font-weight:bold;' + (FS_slide >= 1.5 ? 'color:green;' : 'color:red;') + '">' + FS_slide.toFixed(2) + '</td><td>Req 1.50</td></tr>';
    html += '<tr><td>Eccentricity e</td><td style="font-weight:bold;' + (Math.abs(e) < eLimit ? 'color:green;' : 'color:red;') + '">' + e.toFixed(3) + ' m</td><td>Limit ' + eLimit.toFixed(3) + ' m</td></tr>';
    html += '<tr style="border-top:2px solid #000; font-weight:bold;"><td>Stem Rebar</td><td>D' + barDia + ' @ ' + spacing + 'mm</td><td>As=' + As.toFixed(0) + ' mm2/m</td></tr>';

    const tbody = document.getElementById('retainingWallBody');
    if (tbody) tbody.innerHTML = html;
}

// --- COMBINED FOOTING DESIGN ---
function designCombinedFooting() {
    const P1 = parseFloat(document.getElementById('cfP1')?.value || 500);
    const P2 = parseFloat(document.getElementById('cfP2')?.value || 700);
    const S = parseFloat(document.getElementById('cfDist')?.value || 4.0);
    const qa = state.soilBearing || 100;
    const fc = state.fc || 21, fy = state.fy || 415;

    const Ptotal = P1 + P2;
    const xBar = (P2 * S) / Ptotal; // from col 1

    // Length: centroid at center
    const L = 2 * (xBar + 0.3); // extend 0.3m beyond col 1
    const B = Ptotal / (qa * L);
    const Bround = Math.ceil(B * 10) / 10;
    const Lround = Math.ceil(L * 10) / 10;

    // Soil pressure
    const q = Ptotal / (Lround * Bround); // kPa

    // Bending moment at midspan
    const qu = 1.4 * q; // factored
    const wu = qu * Bround; // kN/m
    const Mu = (wu * Lround * Lround) / 8;

    // Footing depth
    const d_min = Math.max(300, Math.ceil(Math.sqrt(Mu * 1e6 / (0.138 * fc * Bround * 1000))));
    const h = d_min + 75;

    // Reinforcement
    const d = h - 75;
    const Rn = (Mu * 1e6) / (0.9 * Bround * 1000 * d * d);
    const disc = 1 - (2 * Rn) / (0.85 * fc);
    let rho = disc > 0 ? (0.85 * fc / fy) * (1 - Math.sqrt(disc)) : 0.002;
    rho = Math.max(rho, 0.0018);
    const As = rho * Bround * 1000 * d;
    const barDia = 20;
    const Ab = Math.PI * barDia * barDia / 4;
    const nBars = Math.max(4, Math.ceil(As / Ab));

    let html = '';
    html += '<tr><td>P1 + P2</td><td>' + Ptotal + ' kN</td><td></td></tr>';
    html += '<tr><td>Centroid from Col1</td><td>' + xBar.toFixed(2) + ' m</td><td></td></tr>';
    html += '<tr style="border-top:1px solid #ccc;"><td>Footing Size</td><td>' + Lround.toFixed(1) + ' x ' + Bround.toFixed(1) + ' m</td><td></td></tr>';
    html += '<tr><td>Depth h</td><td>' + h + ' mm</td><td>d = ' + d + ' mm</td></tr>';
    html += '<tr><td>Soil Pressure q</td><td>' + q.toFixed(1) + ' kPa</td><td>qa = ' + qa + ' kPa</td></tr>';
    html += '<tr><td>q check</td><td style="font-weight:bold;' + (q <= qa ? 'color:green;' : 'color:red;') + '">' + (q <= qa ? 'OK' : 'NG') + '</td><td></td></tr>';
    html += '<tr style="border-top:2px solid #000; font-weight:bold;"><td>Main Rebar</td><td>' + nBars + '-D' + barDia + '</td><td>As = ' + As.toFixed(0) + ' mm2</td></tr>';

    const tbody = document.getElementById('combinedFtgBody');
    if (tbody) tbody.innerHTML = html;
}

// --- TORSION CHECK (ACI 318 S22.7) ---
function checkTorsion() {
    const fc = state.fc || 21;
    const tbody = document.getElementById('torsionBody');
    if (!tbody) return;
    let html = '';

    state.beams.forEach(beam => {
        if (beam.isCustom || beam.isCantilever) return;
        const b = beam.suggestedB || 250, h = beam.suggestedH || 400;
        const Acp = b * h; // mm2
        const pcp = 2 * (b + h); // mm

        // Threshold torsion ACI S22.7.4
        const Tcr = (0.083 * Math.sqrt(fc) * Acp * Acp / pcp) / 1e6; // kN.m

        // Estimated torsion (spandrel beams get ~10% of span moment)
        const L = beam.span || 4.0;
        const wu = beam.uniformLoad || 15;
        const Mu = (wu * L * L) / 8;
        const Tu = beam.torsion || (Mu * 0.05); // ~5% eccentricity

        const ok = Tu < Tcr;

        html += '<tr>' +
            '<td>' + (beam.id || '-') + '</td>' +
            '<td>' + b + 'x' + h + '</td>' +
            '<td>' + Acp + '</td>' +
            '<td>' + pcp + '</td>' +
            '<td>' + Tcr.toFixed(2) + '</td>' +
            '<td>' + Tu.toFixed(2) + '</td>' +
            '<td style="font-weight:bold;' + (ok ? 'color:green;' : 'color:#d97706;') + '">' + (ok ? 'Negligible' : 'Design Required') + '</td>' +
            '</tr>';
    });
    tbody.innerHTML = html || '<tr><td colspan="7">No beams</td></tr>';
}

// --- CONCRETE MIX DESIGN (ACI 211.1) ---
function calculateMixDesign() {
    const fc = parseFloat(document.getElementById('mixFc')?.value || 21);
    const maxAgg = parseInt(document.getElementById('mixAgg')?.value || 20);

    // Required average strength f'cr (ACI Table 5.3.2.1)
    const fcr = fc < 21 ? fc + 7.0 : (fc < 35 ? fc + 8.3 : 1.1 * fc + 5.0);

    // Water-cement ratio (ACI Table 9.3)
    // Approximate: w/c = 0.70 for 21 MPa, 0.55 for 28, 0.45 for 35
    const wc = Math.max(0.35, 0.80 - 0.012 * fc);

    // Water content (ACI Table 9.5, non-air-entrained, 75-100mm slump)
    const waterTable = {10: 207, 20: 190, 40: 163};
    const water = waterTable[maxAgg] || 190; // kg/m3

    // Cement
    const cement = water / wc;

    // Coarse aggregate (dry-rodded volume)
    const caVolTable = {10: 0.65, 20: 0.71, 40: 0.75};
    const caVol = caVolTable[maxAgg] || 0.71;
    const caDryRod = 1550; // kg/m3 typical
    const ca = caVol * caDryRod;

    // Fine aggregate by absolute volume method
    const Vc = cement / 3150; // specific gravity 3.15
    const Vw = water / 1000;
    const Vca = ca / 2700; // SG 2.7
    const Vair = 0.02; // 2% entrapped air
    const Vfa = 1.0 - Vc - Vw - Vca - Vair;
    const fa = Vfa * 2650; // SG 2.65

    let html = '';
    html += '<tr><td>Target f\'c</td><td>' + fc + '</td><td>MPa</td></tr>';
    html += '<tr><td>Required f\'cr</td><td>' + fcr.toFixed(1) + '</td><td>MPa</td></tr>';
    html += '<tr><td>W/C Ratio</td><td>' + wc.toFixed(2) + '</td><td></td></tr>';
    html += '<tr style="border-top:2px solid #000; font-weight:bold;"><td colspan="3">Mix Proportions per m3</td></tr>';
    html += '<tr><td>Cement</td><td>' + cement.toFixed(0) + '</td><td>kg</td></tr>';
    html += '<tr><td>Water</td><td>' + water + '</td><td>kg (liters)</td></tr>';
    html += '<tr><td>Fine Aggregate</td><td>' + fa.toFixed(0) + '</td><td>kg</td></tr>';
    html += '<tr><td>Coarse Aggregate</td><td>' + ca.toFixed(0) + '</td><td>kg</td></tr>';
    html += '<tr style="border-top:1px solid #ccc;"><td>Bags of Cement (40kg)</td><td>' + Math.ceil(cement / 40) + '</td><td>bags</td></tr>';
    html += '<tr><td>Ratio (C:FA:CA)</td><td>1 : ' + (fa / cement).toFixed(1) + ' : ' + (ca / cement).toFixed(1) + '</td><td>by weight</td></tr>';

    const tbody = document.getElementById('mixDesignBody');
    if (tbody) tbody.innerHTML = html;
}
