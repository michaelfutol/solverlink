        // ========== STRUCTURAL EXPORT FUNCTIONS ==========
        // Production-grade STAAD Pro / ETABS / IFC Exporters
        // Written for Tributary Pro by Antigravity Engineering

        /**
         * Helper: chunk an array into groups of `size` to respect STAAD 79-char line limit
         */
        function chunkArray(arr, size) {
            const result = [];
            for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
            return result;
        }

        /**
         * Helper: check if column is active on a given floor
         */
        function isColumnActiveForExport(col, floorId) {
            if (typeof EngineLoads !== 'undefined' && EngineLoads && typeof EngineLoads.isColumnActiveOnFloor === 'function') {
                return EngineLoads.isColumnActiveOnFloor(col, floorId, state.floors);
            }
            if (typeof isColumnActiveOnFloor === 'function') {
                return isColumnActiveOnFloor(col, floorId);
            }
            if (!col) return false;
            if (col.startFloor || col.isPlanted) {
                const floorIdx = state.floors.findIndex(f => f.id === floorId);
                const startIdx = state.floors.findIndex(f => f.id === col.startFloor);
                if (startIdx >= 0 && floorIdx < startIdx) return false;
            }
            if (col.active === false) return false;
            if (col.activePerFloor && col.activePerFloor[floorId] === false) return false;
            return true;
        }

        /**
         * Helper: cumulative story elevations from base.
         */
        function getExportStoryElevations(floors) {
            const elevations = [0];
            let current = 0;
            floors.forEach(floor => {
                current += (floor.height || 3.0);
                elevations.push(current);
            });
            return elevations;
        }

        /**
         * Helper: regenerate beams floor-by-floor for export, then restore UI state.
         */
        function collectExportFloorBeamData() {
            const originalBeams = Array.isArray(state.beams) ? [...state.beams] : [];
            const originalSlabs = Array.isArray(state.slabs) ? [...state.slabs] : [];
            const floorBeamData = [];

            try {
                state.floors.forEach(floor => {
                    if (typeof generateSlabs === 'function') generateSlabs(floor.id);
                    if (typeof generateBeams === 'function') generateBeams(1.0, floor.wallLoad || 0, floor);
                    if (typeof sizeMembers === 'function') sizeMembers();

                    const deletedBeams = new Set(floor.deletedBeams || []);
                    const beams = (state.beams || []).filter(beam => {
                        if (!beam || beam.deleted || beam.isCantilever || beam.isCustom) return false;
                        if (!beam.startCol || !beam.endCol) return false;
                        return !deletedBeams.has(beam.id);
                    }).map(beam => ({
                        id: beam.id,
                        direction: beam.direction,
                        startCol: beam.startCol,
                        endCol: beam.endCol,
                        span: beam.span,
                        suggestedB: beam.suggestedB,
                        suggestedH: beam.suggestedH
                    }));

                    floorBeamData.push({
                        floorId: floor.id,
                        wallLoad: floor.wallLoad || 0,
                        beams: beams
                    });
                });
            } finally {
                state.beams = originalBeams;
                state.slabs = originalSlabs;
            }

            return floorBeamData;
        }

        /**
         * Helper: download a blob as a file
         */
        function downloadBlob(content, filename, mimeType) {
            const blob = new Blob([content], { type: mimeType || 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        }

        // ================================================================
        //  SOLVERBRIDGE PRE-EXPORT VALIDATION
        // ================================================================
        function getEffectiveBeamSize(beam) {
            const b = beam.b || beam.suggestedB || state.defaultBeamB || 250;
            const h = beam.h || beam.suggestedH || state.defaultBeamH || 400;
            if (b <= 0 || isNaN(b) || h <= 0 || isNaN(h)) return null;
            return { b, h };
        }

        function getEffectiveColumnSize(col) {
            const b = col.b || col.suggestedB || state.defaultColumnB || 300;
            const h = col.h || col.suggestedH || state.defaultColumnH || 300;
            if (b <= 0 || isNaN(b) || h <= 0 || isNaN(h)) return null;
            return { b, h };
        }

        function validateSolverBridgeModel() {
            let overallStatus = 'ok';
            const checks = [];

            function addCheck(id, label, isOk, isWarn, msg, affectedIds = []) {
                let status = 'ok';
                if (!isOk) {
                    if (isWarn) {
                        status = 'warning';
                        if (overallStatus === 'ok') overallStatus = 'warning';
                    } else {
                        status = 'blocked';
                        overallStatus = 'blocked';
                    }
                }
                checks.push({ id, label, status, message: !isOk ? msg : 'OK', affectedIds });
            }

            // Project/model exists
            addCheck('model_exists', 'Model Data Exists', state.xSpans && state.xSpans.length > 0 && state.ySpans && state.ySpans.length > 0, false, 'No grid spans defined.');

            // Floor count 1-10
            addCheck('storeys', 'Storey Count (1-10)', state.floors && state.floors.length >= 1 && state.floors.length <= 10, false, `Unsupported floor count: ${state.floors ? state.floors.length : 0}. SolverLink supports 1-10 storeys.`);

            // Grid spans valid
            const invalidSpans = [...(state.xSpans || []), ...(state.ySpans || [])].filter(s => s <= 0);
            addCheck('spans', 'Grid Spans Valid', invalidSpans.length === 0, false, 'Negative or zero grid spans found.');

            // Columns/beams/slabs exist
            const colCount = (state.columns || []).filter(c => c.active !== false).length;
            const beamCount = (state.beams || []).filter(b => !b.deleted).length;
            const slabCount = (state.slabs || []).length;
            addCheck('members_exist', 'Members Exist', colCount > 0 && beamCount > 0 && slabCount > 0, false, `Missing core members (Cols: ${colCount}, Beams: ${beamCount}, Slabs: ${slabCount}).`);

            // Base supports
            const baseCols = (state.columns || []).filter(c => c.active !== false && !c.startFloor && !c.isPlanted);
            addCheck('supports', 'Base Supports Exist', baseCols.length > 0, false, 'No base-level columns found.');

            // Materials valid
            addCheck('materials', 'Material Properties', state.fc > 0 && state.fy > 0, false, `Invalid materials (fc': ${state.fc}, fy: ${state.fy}).`);

            // Beam sizes valid
            const invalidBeams = (state.beams || []).filter(b => !b.deleted && !getEffectiveBeamSize(b));
            addCheck('beam_sizes', 'Beam Sizes Assigned', invalidBeams.length === 0, false, 'Some beams have missing/invalid sizes.', invalidBeams.map(b => b.id));

            // Column sizes valid
            const invalidCols = (state.columns || []).filter(c => c.active !== false && !getEffectiveColumnSize(c));
            addCheck('col_sizes', 'Column Sizes Assigned', invalidCols.length === 0, false, 'Some columns have missing/invalid sizes.', invalidCols.map(c => c.id));

            // No cantilevers
            const cantilevers = (state.beams || []).filter(b => !b.deleted && b.isCantilever);
            addCheck('cantilevers', 'No Cantilever Members', cantilevers.length === 0, false, 'Cantilevers are unsupported in MVP.', cantilevers.map(b => b.id));

            // No custom/added/stair beams
            const customBeams = (state.beams || []).filter(b => !b.deleted && (b.isCustom || b.isStair));
            addCheck('custom_beams', 'No Custom/Stair Beams', customBeams.length === 0, false, 'Custom topology/stair beams unsupported.', customBeams.map(b => b.id));

            // Deleted/ghost members
            const deletedBeams = (state.beams || []).filter(b => b.deleted);
            addCheck('ghosts', 'No Deleted/Ghost Members', deletedBeams.length === 0, false, 'Model contains deleted members. Please purge them or use full version.', deletedBeams.map(b => b.id));

            // Basic gravity loads present
            const missingLoads = (state.floors || []).filter(f => !f.dlSuper && !f.liveLoad);
            addCheck('loads', 'Gravity Loads Present', missingLoads.length === 0, false, 'Some floors are missing dead/live loads.', missingLoads.map(f => f.id));

            return { status: overallStatus, checks };
        }

        function renderValidationPanel() {
            const contentDiv = document.getElementById('validationContent');
            if (!contentDiv) return;

            const result = validateSolverBridgeModel();

            let html = `
                <div style="font-family: var(--font-base);">
                    <div style="margin-bottom: 16px; padding: 12px; border-radius: 6px; background: ${result.status === 'ok' ? 'rgba(40, 167, 69, 0.1)' : result.status === 'warning' ? 'rgba(255, 193, 7, 0.1)' : 'rgba(220, 53, 69, 0.1)'}; border: 1px solid ${result.status === 'ok' ? 'var(--success)' : result.status === 'warning' ? 'var(--warning)' : 'var(--danger)'};">
                        <h4 style="margin: 0 0 8px 0; color: ${result.status === 'ok' ? 'var(--success)' : result.status === 'warning' ? 'var(--warning)' : 'var(--danger)'};">
                            EXPORT READINESS: ${result.status.toUpperCase()}
                        </h4>
                        <div style="font-size: 0.85rem; color: var(--text-primary);">
                            ${result.status === 'ok' ? 'Model is ready for STAAD export.' : result.status === 'warning' ? 'Model has warnings but can be exported.' : 'Model contains unsupported features. STAAD export is blocked.'}
                        </div>
                    </div>

                    <table class="schedule-table" style="width: 100%;">
                        <thead>
                            <tr>
                                <th style="width: 100px;">Status</th>
                                <th style="width: 200px;">Check</th>
                                <th>Message</th>
                                <th style="width: 150px;">Affected Members</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            result.checks.forEach(check => {
                const badgeColor = check.status === 'ok' ? 'var(--success)' : check.status === 'warning' ? 'var(--warning)' : 'var(--danger)';
                html += `
                    <tr>
                        <td><span style="padding: 3px 6px; border-radius: 3px; background: ${badgeColor}; color: #fff; font-size: 0.7rem; font-weight: bold;">${check.status.toUpperCase()}</span></td>
                        <td style="font-weight: 500;">${check.label}</td>
                        <td style="color: ${check.status === 'ok' ? 'var(--text-muted)' : 'var(--text-primary)'};">${check.message}</td>
                        <td style="font-size: 0.75rem; color: var(--text-muted);">${check.affectedIds && check.affectedIds.length > 0 ? check.affectedIds.join(', ') : '-'}</td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>

                    <div style="margin-top: 20px;">
                        <button class="action-btn" onclick="exportToSTAAD()" ${result.status === 'blocked' ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                            Export to STAAD.Pro
                        </button>
                    </div>
                </div>
            `;

            contentDiv.innerHTML = html;
        }

        // ================================================================
        //  STAAD PRO EXPORT (.std)
        //  Compatible with STAAD.Pro 2024 (QA&R)
        // ================================================================
        function generateSTAADContent() {
            const getNodeId = (colIdx, floorIdx) => (floorIdx * 1000) + colIdx + 1;
            const existingNodes = new Set();
            const columnMembers = [];
            const beamMembers = [];
            const wallLoads = [];
            let memId = 1;

            // --- HEADER ---
            let std = "STAAD SPACE\n";
            std += "START JOB INFORMATION\n";
            std += "ENGINEER DATE " + new Date().toDateString().toUpperCase() + "\n";
            std += "JOB NAME " + state.floors.length + " STOREY BUILDING\n";
            std += "JOB CLIENT FUTOLSTRUCTURE - TRIBUTARY PRO\n";
            std += "END JOB INFORMATION\n";
            std += "INPUT WIDTH 79\n";
            std += "UNIT METER KN\n\n";

            // --- 1. JOINT COORDINATES ---
            std += "JOINT COORDINATES\n";

            // Ground level nodes (base supports)
            state.columns.forEach((col, ci) => {
                if (col.active === false) return;
                if (!col.startFloor && !col.isPlanted) {
                    const nid = getNodeId(ci, 0);
                    existingNodes.add(nid);
                    std += nid + " " + col.x.toFixed(3) + " 0.000 " + col.y.toFixed(3) + "\n";
                }
            });

            // Upper level nodes
            let currentY = 0;
            state.floors.forEach((floor, fi) => {
                currentY += (floor.height || 3.0);
                const floorIdx = fi + 1;
                state.columns.forEach((col, ci) => {
                    if (col.active === false) return;
                    if (isColumnActiveForExport(col, floor.id)) {
                        const nid = getNodeId(ci, floorIdx);
                        existingNodes.add(nid);
                        std += nid + " " + col.x.toFixed(3) + " " + currentY.toFixed(3) + " " + col.y.toFixed(3) + "\n";
                    }
                });
            });
            std += "\n";

            // --- 2. MEMBER INCIDENCES ---
            std += "MEMBER INCIDENCES\n";

            // Column members
            state.floors.forEach((floor, fi) => {
                const topIdx = fi + 1;
                const botIdx = fi;
                state.columns.forEach((col, ci) => {
                    if (col.active === false) return;
                    const topNode = getNodeId(ci, topIdx);
                    const botNode = getNodeId(ci, botIdx);
                    if (existingNodes.has(topNode) && existingNodes.has(botNode)) {
                        std += memId + " " + botNode + " " + topNode + "\n";
                        columnMembers.push(memId);
                        memId++;
                    }
                });
            });

            // Beams - regenerate per floor
            const oldBeams = [...state.beams];
            const oldSlabs = [...state.slabs];
            const processedBeams = new Set();

            state.floors.forEach((floor, fi) => {
                const floorIdx = fi + 1;
                // v3.17: Cantilevers resolved per-floor inside generateSlabs/generateBeams
                if (typeof generateSlabs === 'function') generateSlabs(floor.id);
                if (typeof generateBeams === 'function') generateBeams(1.0, floor.wallLoad || 0, floor);

                state.beams.forEach(beam => {
                    if (beam.isCantilever || beam.deleted) return;
                    if (!beam.startCol || !beam.endCol) return;
                    const beamKey = floorIdx + "-" + beam.startCol + "-" + beam.endCol;
                    if (processedBeams.has(beamKey)) return;
                    processedBeams.add(beamKey);

                    const sci = state.columns.findIndex(c => c.id === beam.startCol);
                    const eci = state.columns.findIndex(c => c.id === beam.endCol);
                    if (sci >= 0 && eci >= 0) {
                        const sn = getNodeId(sci, floorIdx);
                        const en = getNodeId(eci, floorIdx);
                        if (existingNodes.has(sn) && existingNodes.has(en)) {
                            std += memId + " " + sn + " " + en + "\n";
                            beamMembers.push(memId);
                            if ((floor.wallLoad || 0) > 0) {
                                wallLoads.push({ id: memId, load: -(floor.wallLoad) });
                            }
                            memId++;
                        }
                    }
                });
            });
            std += "\n";

            // --- 3. MEMBER PROPERTIES (chunked for 79-char limit) ---
            std += "MEMBER PROPERTY AMERICAN\n";
            if (columnMembers.length > 0) {
                const colB = (state.columns[0]?.suggestedB || 300) / 1000;
                const colH = (state.columns[0]?.suggestedH || 300) / 1000;
                chunkArray(columnMembers, 8).forEach(chunk => {
                    std += chunk.join(' ') + " PRIS YD " + colH.toFixed(3) + " ZD " + colB.toFixed(3) + "\n";
                });
            }
            if (beamMembers.length > 0) {
                const beamB = (state.beams[0]?.suggestedB || state.defaultBeamB || 250) / 1000;
                const beamH = (state.beams[0]?.suggestedH || 400) / 1000;
                chunkArray(beamMembers, 8).forEach(chunk => {
                    std += chunk.join(' ') + " PRIS YD " + beamH.toFixed(3) + " ZD " + beamB.toFixed(3) + "\n";
                });
            }
            std += "\n";

            // --- 4. MATERIAL DEFINITION ---
            std += "DEFINE MATERIAL START\n";
            std += "ISOTROPIC CONCRETE\n";
            const Ec = (4700 * Math.sqrt(state.fc || 21) * 1000);
            std += "E " + Ec.toFixed(0) + "\n";
            std += "POISSON 0.17\n";
            std += "DENSITY 23.5\n";
            std += "ALPHA 1E-5\n";
            std += "DAMP 0.05\n";
            std += "TYPE CONCRETE\n";
            std += "STRENGTH FCU " + ((state.fc || 21) * 1000) + "\n";
            std += "END DEFINE MATERIAL\n\n";

            std += "CONSTANTS\n";
            std += "MATERIAL CONCRETE ALL\n\n";

            // --- 5. SUPPORTS ---
            std += "SUPPORTS\n";
            const supportNodes = [];
            state.columns.forEach((col, ci) => {
                if (col.active === false) return;
                if (!col.startFloor && !col.isPlanted) {
                    const nid = getNodeId(ci, 0);
                    if (existingNodes.has(nid)) supportNodes.push(nid);
                }
            });
            if (supportNodes.length > 0) {
                chunkArray(supportNodes, 10).forEach(chunk => {
                    std += chunk.join(' ') + " FIXED\n";
                });
            }
            std += "\n";

            // --- 6. LOAD CASES ---
            // Dead Load
            std += "LOAD 1 LOADTYPE Dead TITLE DEAD LOAD\n";
            std += "SELFWEIGHT Y -1.0\n";
            if (wallLoads && wallLoads.length > 0) {
                std += "MEMBER LOAD\n";
                wallLoads.forEach(wl => {
                    std += wl.id + " UNI GY " + wl.load.toFixed(2) + "\n";
                });
            }
            std += "FLOOR LOAD\n";
            let elev = 0;
            state.floors.forEach(floor => {
                elev += (floor.height || 3.0);
                const slabT = (floor.slabThickness || 150) / 1000;
                const dlS = floor.dlSuper || 1.5;
                const dl = -(dlS + (24 * slabT));
                std += "YRANGE " + (elev - 0.1).toFixed(3) + " " + (elev + 0.1).toFixed(3);
                std += " FLOAD " + dl.toFixed(3) + " GY\n";
            });

            // Live Load
            std += "\nLOAD 2 LOADTYPE Live TITLE LIVE LOAD\n";
            std += "FLOOR LOAD\n";
            elev = 0;
            state.floors.forEach(floor => {
                elev += (floor.height || 3.0);
                const ll = floor.liveLoad || 2.0;
                std += "YRANGE " + (elev - 0.1).toFixed(3) + " " + (elev + 0.1).toFixed(3);
                std += " FLOAD " + (-ll).toFixed(3) + " GY\n";
            });

            // Load Combinations (NSCP 2015)
            std += "\nLOAD COMBINATION 3 1.2DL + 1.6LL\n";
            std += "1 1.2 2 1.6\n";

            std += "\nLOAD COMBINATION 4 1.4DL\n";
            std += "1 1.4\n";

            // Analysis and Design
            std += "\nPERFORM ANALYSIS\n";
            std += "PRINT MEMBER FORCES\n";
            std += "PRINT SUPPORT REACTIONS\n";

            // Concrete design per NSCP/ACI
            std += "\nSTART CONCRETE DESIGN\n";
            std += "CODE ACI\n";
            std += "FC " + ((state.fc || 21) * 1000) + " ALL\n";
            std += "FYMAIN " + ((state.fy || 415) * 1000) + " ALL\n";
            std += "DESIGN COLUMN " + columnMembers.join(' ') + "\n";
            std += "DESIGN BEAM " + beamMembers.join(' ') + "\n";
            std += "END CONCRETE DESIGN\n";

            std += "\nFINISH\n";

            // Restore state
            state.beams = oldBeams;
            state.slabs = oldSlabs;
            if (typeof draw === 'function') draw();

            console.log("STAAD Export: " + existingNodes.size + " nodes, " + (memId - 1) + " members");
            return std;
        }


        // ========== MVP VALIDATION GATING ==========
        function validateModelForExport() {
            const errors = [];

            // 1. Envelope constraints
            if (!state.floors || state.floors.length === 0) {
                errors.push("No floors defined in the model.");
            } else if (state.floors.length > 4) {
                errors.push(`Model exceeds maximum 4 storeys limit (Current: ${state.floors.length} storeys).`);
            }

            // 2. Geometry check - Beams
            if (state.beams) {
                const invalidBeams = state.beams.filter(b => !b.deleted && (!b.startNode || !b.endNode || b.span <= 0.1));
                if (invalidBeams.length > 0) {
                    errors.push(`Found ${invalidBeams.length} beam(s) with invalid geometry (missing nodes or zero span).`);
                }
            } else {
                errors.push("No beams defined in the model.");
            }

            // 3. Geometry check - Columns
            if (state.columns) {
                const invalidCols = state.columns.filter(c => c.active !== false && (!c.nodeId || !state.nodes[c.nodeId]));
                if (invalidCols.length > 0) {
                    errors.push(`Found ${invalidCols.length} column(s) with invalid base nodes or ghost geometry.`);
                }
            } else {
                errors.push("No columns defined in the model.");
            }

            if (errors.length > 0) {
                const modal = document.getElementById('validationModal');
                const list = document.getElementById('validationErrors');
                if (modal && list) {
                    list.innerHTML = '';
                    errors.forEach(err => {
                        const li = document.createElement('li');
                        li.textContent = err;
                        li.style.marginBottom = '6px';
                        list.appendChild(li);
                    });
                    modal.style.display = 'flex';
                } else {
                    alert("EXPORT BLOCKED\n" + errors.join("\n"));
                }
                return false;
            }
            return true;
        }

        function exportToSTAAD() {
            if (!validateModelForExport()) return;
            const validation = validateSolverBridgeModel();
            if (validation.status === 'blocked') {
                const blockers = validation.checks.filter(c => c.status === 'blocked').map(c => `- ${c.label}: ${c.message}`).join('\n');
                alert('STAAD Export Blocked\n\nThe model contains unsupported features for SolverBridge MVP:\n\n' + blockers + '\n\nUnsupported in SolverBridge MVP; model manually or use full FutolStructure.');
                return;
            }
            if (validation.status === 'warning') {
                const warnings = validation.checks.filter(c => c.status === 'warning').map(c => `- ${c.label}: ${c.message}`).join('\n');
                const proceed = confirm('STAAD Export Warnings\n\nThe model contains warnings:\n\n' + warnings + '\n\nDo you want to proceed with export?');
                if (!proceed) return;
            }

            try {
                const std = generateSTAADContent();
                downloadBlob(std, 'SolverLink_SFFA_' + new Date().toISOString().split('T')[0] + '.std');
                alert('STAAD Pro model exported!\n\n⚠️ DOCTRINE WARNING: STAAD export is a baseline starter model only. The engineer must rigorously verify all topology, incidences, and tributary loads before proceeding to final design.\n\nFile includes:\n- Joint coordinates\n- Member incidences\n- Prismatic sections\n- Fixed supports\n- Dead + Live loads\n- NSCP load combinations');
            } catch (err) {
                console.error('STAAD export failed:', err);
                alert('Export failed: ' + err.message);
            }
        }

        // (First ETABS definition removed — superseded by later generateETABSContent/exportToETABS)
        // (First IFC definition removed — superseded by later generateIFCGUID/generateIFCContent/exportToIFC)

        function _superseded_generateETABSContent_v1() {
            let e2k = '';
            e2k += '$ ETABS MODEL FILE\n';
            e2k += '$ Generated by FutolStructure / Tributary Pro\n';
            e2k += '$ Date: ' + new Date().toISOString().split('T')[0] + '\n\n';

            e2k += '$ PROGRAM INFORMATION\n';
            e2k += '  PROGRAM  "ETABS"  VERSION "21.0.0"\n\n';
            e2k += '$ UNITS\n';
            e2k += '  UNITS  "KN"  "m"  "C"\n\n';

            // Stories
            e2k += '$ STORIES - IN SEQUENCE FROM TOP TO BOTTOM\n';
            let elevations = [0];
            let elev = 0;
            state.floors.forEach(floor => {
                elev += (floor.height || 3.0);
                elevations.push(elev);
            });
            for (let i = state.floors.length - 1; i >= 0; i--) {
                const f = state.floors[i];
                const h = f.height || 3.0;
                e2k += '  STORY  "' + f.id + '"  ' + h.toFixed(4) + '  ' + elevations[i + 1].toFixed(4) + '  Yes\n';
            }
            e2k += '  STORY  "BASE"  0  0  No\n\n';

            // Materials
            e2k += '$ MATERIAL PROPERTIES\n';
            const Ec = 4700 * Math.sqrt(state.fc || 21) * 1000;
            e2k += '  MATERIAL  "CONC"  "CONCRETE"  "Isotropic"\n';
            e2k += '  MATERIAL  "CONC"  E ' + Ec.toFixed(0) + '  U 0.17  A 1.0E-05  W 23.5\n\n';

            // Frame Sections
            const colB = (state.columns[0]?.suggestedB || state.defaultColumnB || 300) / 1000;
            const colH = (state.columns[0]?.suggestedH || state.defaultColumnH || colB * 1000) / 1000;
            const beamB = (state.beams[0]?.suggestedB || state.defaultBeamB || 250) / 1000;
            const beamH = (state.beams[0]?.suggestedH || 400) / 1000;
            const colSec = 'C' + Math.round(colB * 1000) + 'x' + Math.round(colH * 1000);
            const beamSec = 'B' + Math.round(beamB * 1000) + 'x' + Math.round(beamH * 1000);

            e2k += '$ FRAME SECTION PROPERTIES\n';
            e2k += '  FRAMESECTION  "' + colSec + 'ATERIAL "CONC"  SHAPE "Rectangular"\n';
            e2k += '  FRAMESECTION  "' + colSec + '"  D ' + colH.toFixed(4) + '  B ' + colB.toFixed(4) + '\n';
            e2k += '  FRAMESECTION  "' + beamSec + '"  MATERIAL "CONC"  SHAPE "Rectangular"\n';
            e2k += '  FRAMESECTION  "' + beamSec + '"  D ' +ed(4) + '  B ' + beamB.toFixed(4) + '\n\n';

            // Grid lines
            const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
            e2k += '$ GRID LINES\n';
            let xPos = 0;
            for (let xi = 0; xi <= state.xSpans.length; xi++) {
                e2k += '  GRID  "' + letters[xi] + '"  "X"  ' + xPos.toFixed(4) + '  "Yes"  "End"\n';
                if (xi < state.xSpans.length) xPos += state.xSpans[xi];
            }
            let yPos = 0;
            for (let yi = 0; yi <= state.ySpans.length; yi++) {
                e2k += '  GRID  "' + (yi + 1) + '"  "Y"  ' + yPos.toFixed(4) + '  "Yes"  "End"\n';
                if (yi < state.ySpans.length) yPos += state.ySpans[yi];
            }
            e2k += '\n';

            // Points & Lines
            e2k += '$ POINT COORDINATES\n';
            let pointId = 1;
            const pointMap = {};

            state.columns.forEach(col => {
                if (col.active === false) return;
                if (!col.startFloor && !col.isPlanted) {
                    pointMap[col.id + '_BASE'] = pointId;
                    e2k += '  POINT  "' + pointId + '"  ' + col.x.toFixed(4) + '  ' + col.y.toFixed(4) + '  "BASE"\n';
                    pointId++;
                }
                state.floors.forEach(floor => {
                    if (isColumnActiveForExport(col, floor.id)) {
                        pointMap[col.id + '_' + floor.id] = pointId;
                        e2k += '  POINT  "' + pointId + '"  ' + col.x.toFixed(4) + '  ' + col.y.toFixed(4) + '  "' + floor.id + '"\n';
                        pointId++;
                    }
                });
            });
            e2k += '\n';

            e2k += '$ LINE CONNECTIVITY\n';
            let lineId = 1;
            const colLines = [];
            const beamLines = [];

            // Columns
            state.floors.forEach((floor, fi) => {
                const botId = fi === 0 ? 'BASE' : state.floors[fi - 1].id;
                state.columns.forEach(col => {
                    if (col.active === false) return;
                    const p1 = pointMap[col.id + '_' + botId];
                    const p2 = pointMap[col.id + '_' + floor.id];
                    if (p1 && p2) {
                        e2k += '  LINE  "C' + lineId + '"  "' + p1 + '"  "' + p2 + '"\n';
                        colLines.push('C' + lineId);
                        lineId++;
                    }
                });
            });

            // Beams
            const processedBeamsE = new Set();
            state.floors.forEach(floor => {
                state.beams.forEach(beam => {
                    if (beam.isCantilever || beam.deleted || !beam.startCol || !beam.endCol) return;
                    const key = floor.id + '-' + beam.startCol + '-' + beam.endCol;
                    if (processedBeamsE.has(key)) return;
                    processedBeamsE.add(key);
                    const p1 = pointMap[beam.startCol + '_' + floor.id];
                    const p2 = pointMap[beam.endCol + '_' + floor.id];
                    if (p1 && p2) {
                        e2k += '  LINE  "B' + lineId + '"  "' + p1 + '"  "' + p2 + '"\n';
                        beamLines.push({ id: 'B' + lineId, wallLoad: floor.wallLoad || 0 });
                        lineId++;
                    }
                });
            });
            e2k += '\n';

            // Assignments
            e2k += '$ LINE ASSIGNMENTS\n';
            colLines.forEach(id => {
                e2k += '  LINEASSIGN  "' + id + '"  "' + colSec + '"  0  0  0\n';
            });
            beamLines.forEach(bl => {
                e2k += '  LINEASSIGN  "' + bl.id + '"  "' + beamSec + '"  0  0  0\n';
            });
            e2k += '\n';

            // Supports
            e2k += '$ POINT ASSIGNMENTS\n';
            state.columns.forEach(col => {
                if (col.active === false || col.startFloor || col.isPlanted) return;
                const p = pointMap[col.id + '_BASE'];
                if (p) e2k += '  POINTASSIGN  "' + p + '"  RESTRAINT  "Fixed"\n';
            });
            e2k += '\n';

            // Loads
            e2k += '$ LOAD PATTERNS\n';
            e2k += '  LOADPATTERN  "DEAD"  "Dead"  1.0\n';
            e2k += '  LOADPATTERN  "SDL"  "Super Dead"  0.0\n';
            e2k += '  LOADPATTERN  "LIVE"  "Live"  0.0\n';
            e2k += '  LOADPATTERN  "WALL"  "Other"  0.0\n\n';

            // Wall loads on beams
            const wallBeams = beamLines.filter(bl => bl.wallLoad > 0);
            if (wallBeams.length > 0) {
                e2k += '$ FRAME LOADS - WALL LINE LOADS\n';
                wallBeams.forEach(bl => {
                    e2k += '  LINELOAD  "' + bl.id + '"  "WALL"  1  ' + (-bl.wallLoad).toFixed(2) + '  0  1  ' + (-bl.wallLoad).toFixed(2) + '  0  "GLOBAL"  "Y"  "FORCE"\n';
                });
                e2k += '\n';
            }

            // Load combos
            e2k += '$ LOAD COMBINATIONS\n';
            e2k += '  COMBO  "1.2DL+1.6LL"  "Linear Add"\n';
            e2k += '    COMBO  "1.2DL+1.6LL"  "DEAD"  1.2\n';
            e2k += '    COMBO  "1.2DL+1.6LL"  "SDL"  1.2\n';
            e2k += '    COMBO  "1.2DL+1.6LL"  "WALL"  1.2\n';
            e2k += '    COMBO  "1.2DL+1.6LL"  "LIVE"  1.6\n';
            e2k += '  COMBO  "1.4DL"  "Linear Add"\n';
            e2k += '    COMBO  "1.4DL"  "DEAD"  1.4\n';
            e2k += '    COMBO  "1.4DL"  "SDL"  1.4\n';
            e2k += '    COMBO  "1.4DL"  "WALL"  1.4\n\n';

            e2k += '  END\n';
            return e2k;
        }

        function _superseded_exportToETABS_v1() {
            // Superseded by later exportToETABS definition
        }

        function _superseded_generateIFCGUID_v1() {
            // Superseded by later generateIFCGUID definition
        }

        function _superseded_generateIFCContent_v1() {
            const ts = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
            let id = 1;
            const nid = () => '#' + (id++);

            let ifc = 'ISO-10303-21;\n';
            ifc += 'HEADER;\n';
            ifc += "FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\n";
            ifc += "FILE_NAME('TributaryPro_Model.ifc','" + ts + "',('FutolStructure'),('Tributary Pro'),'IFC Generator','Tributary Pro v3.0','');\n";
            ifc += "FILE_SCHEMA(('IFC2X3'));\n";
            ifc += 'ENDSEC;\nDATA;\n';

            // Basic setup entities
            const personId = nid();
            ifc += personId + "= IFCPERSON($,$,'Engineer',$,$,$,$,$);\n";
            const orgId = nid();
            ifc += orgId + "= IFCORGANIZATION($,'FutolStructure','Tributary Pro',$,$);\n";
            const personOrgId = nid();
            ifc += personOrgId + "= IFCPERSONANDORGANIZATION(" + personId + "," + orgId + ",$);\n";
            const appDevId = nid();
            ifc += appDevId + "= IFCORGANIZATION($,'FutolTech','FutolStructure',$,$);\n";
            const appId = nid();
            ifc += appId + "= IFCAPPLICATION(" + appDevId + ",'3.0','Tributary Pro','TributaryPro');\n";
            const ownerHistoryId = nid();
            ifc += ownerHistoryId + "= IFCOWNERHISTORY(" + personOrgId + "," + appId + ",$,.NOCHANGE.,$,$,$," + Math.floor(Date.now() / 1000) + ");\n";

            const dirZ = nid();
            ifc += dirZ + "= IFCDIRECTION((0.,0.,1.));\n";
            const dirX = nid();
            ifc += dirX + "= IFCDIRECTION((1.,0.,0.));\n";
            const dirY = nid();
            ifc += dirY + "= IFCDIRECTION((0.,1.,0.));\n";
            const origin = nid();
            ifc += origin + "= IFCCARTESIANPOINT((0.,0.,0.));\n";
            const worldCoord = nid();
            ifc += worldCoord + "= IFCAXIS2PLACEMENT3D(" + origin + "," + dirZ + "," + dirX + ");\n";

            const context = nid();
            ifc += context + "= IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05," + worldCoord + ",$);\n";

            // Units
            const muLen = nid();
            ifc += muLen + "= IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);\n";
            const muArea = nid();
            ifc += muArea + "= IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);\n";
            const muVol = nid();
            ifc += muVol + "= IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);\n";
            const muForce = nid();
            ifc += muForce + "= IFCSIUNIT(*,.FORCEUNIT.,.KILO.,.NEWTON.);\n";
            const muAngle = nid();
            ifc += muAngle + "= IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);\n";
            const unitAssign = nid();
            ifc += unitAssign + "= IFCUNITASSIGNMENT((" + muLen + "," + muArea + "," + muVol + "," + muForce + "," + muAngle + "));\n";

            // Project
            const projectId = nid();
            ifc += projectId + "= IFCPROJECT('" + generateIFCGUID() + "'," + ownerHistoryId + ",'Tributary Pro Model',$,$,$,$,(" + context + ")," + unitAssign + ");\n";

            // Site
            const sitePlace = nid();
            ifc += sitePlace + "= IFCLOCALPLACEMENT($," + worldCoord + ");\n";
            const siteId = nid();
            ifc += siteId + "= IFCSITE('" + generateIFCGUID() + "'," + ownerHistoryId + ",'Site',$,$," + sitePlace + ",$,$,.ELEMENT.,$,$,$,$,$);\n";

            // Building
            const buildPlace = nid();
            ifc += buildPlace + "= IFCLOCALPLACEMENT(" + sitePlace + "," + worldCoord + ");\n";
            const buildId = nid();
            ifc += buildId + "= IFCBUILDING('" + generateIFCGUID() + "'," + ownerHistoryId + ",'Building',$,$," + buildPlace + ",$,$,.ELEMENT.,$,$,$);\n";

            // Relationships
            const relSite = nid();
            ifc += relSite + "= IFCRELAGGREGATES('" + generateIFCGUID() + "'," + ownerHistoryId + ",$,$," + projectId + ",(" + siteId + "));\n";
            const relBuild = nid();
            ifc += relBuild + "= IFCRELAGGREGATES('" + generateIFCGUID() + "'," + ownerHistoryId + ",$,$," + siteId + ",(" + buildId + "));\n";

            // Storeys & Columns
            const storeyIds = [];
            const memberIds = [];
            let currentElev = 0;

            state.floors.forEach((floor, fi) => {
                const floorElev = currentElev;
                currentElev += (floor.height || 3.0);

                const ep = nid();
                ifc += ep + "= IFCCARTESIANPOINT((0.,0.," + floorElev.toFixed(3) + "));\n";
                const sp = nid();
                ifc += sp + "= IFCAXIS2PLACEMENT3D(" + ep + "," + dirZ + "," + dirX + ");\n";
                const slp = nid();
                ifc += slp + "= IFCLOCALPLACEMENT(" + buildPlace + "," + sp + ");\n";
                const storeyId = nid();
                ifc += storeyId + "= IFCBUILDINGSTOREY('" + generateIFCGUID() + "'," + ownerHistoryId + ",'" + floor.name + "',$,$," + slp + ",$,$,.ELEMENT.," + floorElev.toFixed(3) + ");\n";
                storeyIds.push(storeyId);

                // Columns on this floor
                const floorMembers = [];
                state.columns.forEach(col => {
                    if (col.active === false) return;
                    if (!isColumnActiveForExport(col, floor.id)) return;

                    const colBm = (col.suggestedB || 300) / 1000;
                    const colHm = (col.suggestedH || 300) / 1000;
                    const colHeight = floor.height || 3.0;

                    const cp = nid();
                    ifc += cp + "= IFCCARTESIANPOINT((" + col.x.toFixed(3) + "," + col.y.toFixed(3) + ",0.));\n";
                    const ca = nid();
                    ifc += ca + "= IFCAXIS2PLACEMENT3D(" + cp + "," + dirZ + "," + dirX + ");\n";
                    const clp = nid();
                    ifc += clp + "= IFCLOCALPLACEMENT(" + slp + "," + ca + ");\n";

                    // Rectangle profile
                    const rp = nid();
                    ifc += rp + "= IFCRECTANGLEPROFILEDEF(.AREA.,$,$," + colBm.toFixed(3) + "," + colHm.toFixed(3) + ");\n";

                    // Extrusion direction
                    const ed = nid();
                    ifc += ed + "= IFCDIRECTION((0.,0.,1.));\n";

                    // Extruded solid
                    const es = nid();
                    ifc += es + "= IFCEXTRUDEDAREASOLID(" + rp + "," + worldCoord + "," + ed + "," + colHeight.toFixed(3) + ");\n";

                    // Shape representation
                    const sr = nid();
                    ifc += sr + "= IFCSHAPEREPRESENTATION(" + context + ",'Body','SweptSolid',(" + es + "));\n";
                    const ps = nid();
                    ifc += ps + "= IFCPRODUCTDEFINITIONSHAPE($,$,(" + sr + "));\n";

                    // Column entity
                    const colId = nid();
                    ifc += colId + "= IFCCOLUMN('" + generateIFCGUID() + "'," + ownerHistoryId + ",'" + col.id + "',$,$," + clp + "," + ps + ",$);\n";
            const relMat = nid();
            ifc += relMat + "= IFCRELASSOCIATESMATERIAL('" + generateIFCGUID() + "'," + ownerHistoryId + ",$,$,(" + colId + ")," + matConcrete + ");\n";
                    floorMembers.push(colId);
                    memberIds.push(colId);
                });

                // Relate members to storey
                if (floorMembers.length > 0) {
                    const relContain = nid();
                    ifc += relContain + "= IFCRELCONTAINEDINSPATIALSTRUCTURE('" + generateIFCGUID() + "'," + ownerHistoryId + ",$,$,(" + floorMembers.join(',') + ")," + storeyId + ");\n";
                }
            });

            // Relate storeys to building
            if (storeyIds.length > 0) {
                const relStoreys = nid();
                ifc += relStoreys + "= IFCRELAGGREGATES('" + generateIFCGUID() + "'," + ownerHistoryId + ",$,$," + buildId + ",(" + storeyIds.join(',') + "));\n";
            }

            ifc += 'ENDSEC;\nEND-ISO-10303-21;\n';
            return ifc;
        }

        function _superseded_exportToIFC_v1() {
            // Superseded by later exportToIFC definition
        }


        // ========== v3.0: ETABS EXPORT ==========

        /**
         * Generate ETABS .e2k file content
         */
        function generateETABSContent() {
            let e2k = '';
            const storyElevations = getExportStoryElevations(state.floors);
            const floorBeamData = collectExportFloorBeamData();

            // Header
            e2k += '$ ETABS MODEL FILE\n';
            e2k += '$ Generated by FutolStructure\n';
            e2k += `$ Date: ${new Date().toISOString().split('T')[0]}\n\n`;
            e2k += '$ PROGRAM INFORMATION\n';
            e2k += '  PROGRAM  "ETABS 2022"  VERSION "22.6.0"\n\n';

            // Units
            e2k += '$ UNITS\n';
            e2k += '  UNITS  "KN"  "m"  "C"\n\n';

            // Stories
            e2k += '$ STORIES - IN SEQUENCE FROM TOP TO BOTTOM\n';
            for (let i = state.floors.length - 1; i >= 0; i--) {
                const floor = state.floors[i];
                const height = floor.height || 3.0;
                e2k += `  STORY  "${floor.id}"  ${height.toFixed(4)}  ${storyElevations[i + 1].toFixed(4)}  Yes\n`;
            }
            e2k += '  STORY  "BASE"  0  0  No\n\n';

            // Materials
            e2k += '$ MATERIAL PROPERTIES\n';
            e2k += '  MATERIAL  "CONC"  "CONCRETE"  "Isotropic"\n';
            const E_concrete = 4700 * Math.sqrt(state.fc || 21) * 1000;
            e2k += `  MATERIAL  "CONC"  E ${E_concrete.toFixed(0)}  U 0.17  A 1.0E-05  W 23.5\n\n`;

            // Frame Sections
            const colB = (state.columns[0]?.suggestedB || state.defaultColumnB || 300) / 1000;
            const colH = (state.columns[0]?.suggestedH || state.defaultColumnH || 300) / 1000;
            const defaultBeam = floorBeamData.flatMap(entry => entry.beams).find(Boolean);
            const beamB = ((defaultBeam && defaultBeam.suggestedB) || state.defaultBeamB || 250) / 1000;
            const beamH = ((defaultBeam && defaultBeam.suggestedH) || state.defaultBeamH || 400) / 1000;
            const colSec = `C${Math.round(colB * 1000)}x${Math.round(colH * 1000)}`;
            const beamSec = `B${Math.round(beamB * 1000)}x${Math.round(beamH * 1000)}`;

            e2k += '$ FRAME SECTION PROPERTIES\n';
            e2k += `  FRAMESECTION  "${colSec}"  MATERIAL "CONC"  SHAPE "Rectangular"\n`;
            e2k += `  FRAMESECTION  "${colSec}"  D ${colH.toFixed(4)}  B ${colB.toFixed(4)}\n`;
            e2k += `  FRAMESECTION  "${beamSec}"  MATERIAL "CONC"  SHAPE "Rectangular"\n`;
            e2k += `  FRAMESECTION  "${beamSec}"  D ${beamH.toFixed(4)}  B ${beamB.toFixed(4)}\n\n`;

            // Grid Lines
            const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
            e2k += '$ GRID LINES\n';
            let xPos = 0;
            for (let xi = 0; xi <= state.xSpans.length; xi++) {
                e2k += `  GRID  "${letters[xi]}"  "X"  ${xPos.toFixed(4)}  "Yes"  "End"\n`;
                if (xi < state.xSpans.length) xPos += state.xSpans[xi];
            }
            let yPos = 0;
            for (let yi = 0; yi <= state.ySpans.length; yi++) {
                e2k += `  GRID  "${yi + 1}"  "Y"  ${yPos.toFixed(4)}  "Yes"  "End"\n`;
                if (yi < state.ySpans.length) yPos += state.ySpans[yi];
            }
            e2k += '\n';

            // Point Coordinates
            e2k += '$ POINT COORDINATES\n';
            let pointId = 1;
            const pointMap = {};

            state.columns.forEach((col) => {
                if (col.active === false) return;
                if (!col.startFloor && !col.isPlanted) {
                    pointMap[`${col.id}_BASE`] = pointId;
                    e2k += `  POINT  "${pointId}"  ${col.x.toFixed(4)}  ${col.y.toFixed(4)}  "BASE"\n`;
                    pointId++;
                }
                state.floors.forEach((floor) => {
                    if (isColumnActiveForExport(col, floor.id)) {
                        pointMap[`${col.id}_${floor.id}`] = pointId;
                        e2k += `  POINT  "${pointId}"  ${col.x.toFixed(4)}  ${col.y.toFixed(4)}  "${floor.id}"\n`;
                        pointId++;
                    }
                });
            });
            e2k += '\n';

            // Line Connectivity
            e2k += '$ LINE CONNECTIVITY\n';
            let lineId = 1;
            const colLines = [];
            const beamLines = [];

            state.floors.forEach((floor, fi) => {
                const bottomStoryId = fi === 0 ? 'BASE' : state.floors[fi - 1].id;
                state.columns.forEach(col => {
                    if (col.active === false) return;
                    const p1 = pointMap[`${col.id}_${bottomStoryId}`];
                    const p2 = pointMap[`${col.id}_${floor.id}`];
                    if (!p1 || !p2) return;

                    const lineName = `C${lineId}`;
                    e2k += `  LINE  "${lineName}"  "${p1}"  "${p2}"\n`;
                    colLines.push(lineName);
                    lineId++;
                });
            });

            floorBeamData.forEach(entry => {
                entry.beams.forEach(beam => {
                    const p1 = pointMap[`${beam.startCol}_${entry.floorId}`];
                    const p2 = pointMap[`${beam.endCol}_${entry.floorId}`];
                    if (!p1 || !p2) return;

                    const lineName = `B${lineId}`;
                    e2k += `  LINE  "${lineName}"  "${p1}"  "${p2}"\n`;
                    beamLines.push({ id: lineName, wallLoad: entry.wallLoad });
                    lineId++;
                });
            });
            e2k += '\n';

            // Assignments
            e2k += '$ LINE ASSIGNMENTS\n';
            colLines.forEach(id => {
                e2k += `  LINEASSIGN  "${id}"  "${colSec}"  0  0  0\n`;
            });
            beamLines.forEach(line => {
                e2k += `  LINEASSIGN  "${line.id}"  "${beamSec}"  0  0  0\n`;
            });
            e2k += '\n';

            // Supports
            e2k += '$ POINT ASSIGNMENTS\n';
            state.columns.forEach(col => {
                if (col.active === false || col.startFloor || col.isPlanted) return;
                const basePoint = pointMap[`${col.id}_BASE`];
                if (basePoint) {
                    e2k += `  POINTASSIGN  "${basePoint}"  RESTRAINT  "Fixed"\n`;
                }
            });
            e2k += '\n';

            // Load Patterns
            e2k += '$ LOAD PATTERNS\n';
            e2k += '  LOADPATTERN  "DEAD"  "Dead"  1.0\n';
            e2k += '  LOADPATTERN  "SDL"  "Super Dead"  0.0\n';
            e2k += '  LOADPATTERN  "LIVE"  "Live"  0.0\n';
            e2k += '  LOADPATTERN  "WALL"  "Other"  0.0\n\n';

            const wallBeams = beamLines.filter(line => line.wallLoad > 0);
            if (wallBeams.length > 0) {
                e2k += '$ FRAME LOADS - WALL LINE LOADS\n';
                wallBeams.forEach(line => {
                    e2k += `  LINELOAD  "${line.id}"  "WALL"  1  ${(-line.wallLoad).toFixed(2)}  0  1  ${(-line.wallLoad).toFixed(2)}  0  "GLOBAL"  "Z"  "FORCE"\n`;
                });
                e2k += '\n';
            }

            // Load Combinations
            e2k += '$ LOAD COMBINATIONS (NSCP 2015)\n';
            e2k += '  COMBO  "1.2DL+1.6LL"  "Linear Add"\n';
            e2k += '    COMBO  "1.2DL+1.6LL"  "DEAD"  1.2\n';
            e2k += '    COMBO  "1.2DL+1.6LL"  "SDL"  1.2\n';
            e2k += '    COMBO  "1.2DL+1.6LL"  "WALL"  1.2\n';
            e2k += '    COMBO  "1.2DL+1.6LL"  "LIVE"  1.6\n';
            e2k += '  COMBO  "1.4DL"  "Linear Add"\n';
            e2k += '    COMBO  "1.4DL"  "DEAD"  1.4\n';
            e2k += '    COMBO  "1.4DL"  "SDL"  1.4\n';
            e2k += '    COMBO  "1.4DL"  "WALL"  1.4\n\n';

            e2k += '  END\n';

            return e2k;
        }

        function exportToETABS() {
            if (!validateModelForExport()) return;
            try {
                const proceed = confirm('ETABS export is experimental and is not yet validated against ETABS 22.6 import.\n\nUse STAAD export for the current baseline workflow. Continue downloading the experimental .e2k file?');
                if (!proceed) return;
                const e2k = generateETABSContent();
                downloadBlob(e2k, `FutolStructure_Model_${new Date().toISOString().split('T')[0]}.e2k`);
                alert('Experimental ETABS text model exported.\n\nKnown limitation: ETABS 22.6 import is not validated yet. Treat this file as development output, not solver-truth.');
            } catch (err) {
                alert('Export failed: ' + err.message);
            }
        }

        function copyETABSToClipboard() {
            try {
                const e2k = generateETABSContent();
                navigator.clipboard.writeText(e2k).then(() => {
                    alert('Experimental ETABS code copied to clipboard.\n\nKnown limitation: ETABS 22.6 import is not validated yet.');
                }).catch(err => {
                    const textArea = document.createElement("textarea");
                    textArea.value = e2k;
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        alert('Experimental ETABS code copied to clipboard (legacy mode).');
                    } catch (err) {
                        alert('Unable to copy. Please try Export button.');
                    }
                    document.body.removeChild(textArea);
                });
            } catch (err) {
                alert('Copy failed: ' + err.message);
            }
        }
