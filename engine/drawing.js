        // ========== DRAWING ==========

        // v3.0: Toggle opening placement mode
        function toggleOpeningMode() {
            const btn = document.getElementById('addOpeningBtn');
            if (!btn) {
                state.addingOpening = false;
                if (canvas) canvas.style.cursor = 'default';
                alert('Click-to-place openings are disabled for this validation branch. Use slab opening dimensions or void-slab tools instead.');
                return;
            }
            state.addingOpening = !state.addingOpening;
            if (state.addingOpening) {
                btn.style.background = 'var(--warning)';
                btn.style.color = 'black';
                canvas.style.cursor = 'crosshair';
            } else {
                btn.style.background = '';
                btn.style.color = '';
                canvas.style.cursor = 'default';
            }
        }

        // v3.0: Place an opening at canvas coordinates
        function placeOpening(worldX, worldY) {
            if (!document.getElementById('addOpeningBtn')) {
                state.addingOpening = false;
                return;
            }
            const type = document.getElementById('openingType').value;

            // Default sizes based on type
            const sizes = {
                stair: { width: 2.5, depth: 3.0 },
                elevator: { width: 2.0, depth: 2.0 },
                duct: { width: 0.6, depth: 0.6 }
            };
            const size = sizes[type] || sizes.stair;

            const opening = {
                id: `O${ state.nextOpeningId++ } `,
                x: worldX,           // Center X position (m)
                y: worldY,           // Center Y position (m)
                width: size.width,   // Width in X direction (m)
                depth: size.depth,   // Depth in Y direction (m)
                type: type
            };

            state.openings.push(opening);
            console.log(`v3.0: Added ${ type } opening at(${ worldX.toFixed(1) }, ${ worldY.toFixed(1) })`);

            // Exit opening mode after placing
            toggleOpeningMode();

            // Recalculate to update areas
            calculate();
        }

        // v3.0: Delete opening by ID
        function deleteOpening(id) {
            state.openings = state.openings.filter(o => o.id !== id);
            calculate();
        }

        // v2.7/v3.0: Handle canvas click - beam mode, beam deletion, slab void, column toggle, context menu, click-to-place
        function handleCanvasClick(event) {
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const clickY = event.clientY - rect.top;

            // Convert to world coordinates
            const worldX = (clickX - state.offsetX) / state.scale;
            const worldY = (clickY - state.offsetY) / state.scale;

            // v3.0: Shift+Click to place planted column at custom location (check first)
            if (event.shiftKey && !state.addingBeam) {
                const totalX = state.xSpans.reduce((a, b) => a + b, 0);
                const totalY = state.ySpans.reduce((a, b) => a + b, 0);

                if (worldX >= 0 && worldX <= totalX && worldY >= 0 && worldY <= totalY) {
                    console.log(`v3.0: Click - to - place at(${ worldX.toFixed(2) }, ${ worldY.toFixed(2) })`);
                    showPlantedColumnDialog(worldX, worldY);
                    return;
                } else {
                    console.log('v3.0: Click-to-place ignored - outside grid bounds');
                }
            }

            // v3.0: If in beam adding mode, this click starts drawing
            if (state.addingBeam) {
                // Start drawing beam - snap to grid for precise placement
                const snappedX = snapToGrid(worldX);
                const snappedY = snapToGrid(worldY);
                state.beamDrawStart = { x: snappedX, y: snappedY };
                console.log(`v3.0: Beam draw started at(${ snappedX.toFixed(2) }, ${ snappedY.toFixed(2) })[snapped]`);
                return;
            }

            // v3.0: Only handle beam deletion and slab void when NOT in Add Beam mode
            if (!state.addingBeam) {
                // v3.0: Check if clicked on a custom beam (for deletion)
                const customBeams = getFloorCustomBeams();
                const beamHitTolerance = 30 / state.scale; // 30px tolerance in world units (increased from 15)
                console.log(`v3.0 BEAM DEBUG: Floor = ${ state.floors[state.currentFloorIndex]?.id }, customBeams.length = ${ customBeams.length }, click = (${ worldX.toFixed(2) }, ${ worldY.toFixed(2) }), tol = ${ beamHitTolerance.toFixed(2) } `);
                console.log(`v3.0 BEAM DEBUG: customBeams = `, JSON.stringify(customBeams));

                const beamHit = customBeams.find(beam => {
                    if (beam.dir === 'Y') {
                        // Horizontal beam at Y = beam.pos, X from start to end
                        const hit = Math.abs(worldY - beam.pos) < beamHitTolerance &&
                            worldX >= beam.start - beamHitTolerance &&
                            worldX <= beam.end + beamHitTolerance;
                        console.log(`v3.0: Beam ${ beam.id } (Y = ${ beam.pos.toFixed(2) }, X:${ beam.start.toFixed(2) } -${ beam.end.toFixed(2) }) hit = ${ hit } `);
                        return hit;
                    } else {
                        // Vertical beam at X = beam.pos, Y from start to end
                        const hit = Math.abs(worldX - beam.pos) < beamHitTolerance &&
                            worldY >= beam.start - beamHitTolerance &&
                            worldY <= beam.end + beamHitTolerance;
                        console.log(`v3.0: Beam ${ beam.id } (X = ${ beam.pos.toFixed(2) }, Y:${ beam.start.toFixed(2) } -${ beam.end.toFixed(2) }) hit = ${ hit } `);
                        return hit;
                    }
                });

                if (beamHit) {
                    if (confirm(`Delete beam ${ beamHit.id }?`)) {
                        deleteCustomBeam(beamHit.id);
                        console.log(`v3.0: Deleted beam ${ beamHit.id } by click`);
                    }
                    return;
                }

                // v3.0: Check if clicked on a slab panel (for void toggle)
                const slabHit = state.slabs.find(slab => {
                    if (slab.isCantilever) return false; // Can't void cantilever slabs
                    return worldX >= slab.x1 && worldX <= slab.x2 &&
                        worldY >= slab.y1 && worldY <= slab.y2;
                });

                if (slabHit) {
                    toggleSlabVoid(slabHit.id);
                    return;
                }
            }

            // v3.0: Check if clicked on column - show context menu instead of direct toggle
            const hitRadius = 15 / state.scale;
            for (const col of state.columns) {
                const dx = worldX - (col.gridX || col.x);
                const dy = worldY - (col.gridY || col.y);
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < hitRadius) {
                    // Column hit! Show context menu
                    showColumnMenu(col.id, event.clientX, event.clientY);
                    event.preventDefault();
                    return;
                }
            }

            // Close any open menu if clicking elsewhere
            hideColumnMenu();
        }

        // v3.0: Toggle beam adding mode
        function toggleBeamMode() {
            state.addingBeam = !state.addingBeam;
            state.beamDrawStart = null;
            const btn = document.getElementById('addBeamBtn');
            if (state.addingBeam) {
                btn.style.background = 'var(--primary)';
                btn.style.color = 'white';
                canvas.style.cursor = 'crosshair';
                console.log('v3.0: Beam drawing mode ON');
            } else {
                btn.style.background = '';
                btn.style.color = '';
                canvas.style.cursor = 'default';
                console.log('v3.0: Beam drawing mode OFF');
            }
        }

        // v3.0: Get floor void slabs (per floor)
        function getFloorVoidSlabs() {
            const floor = state.floors[state.currentFloorIndex];
            if (!floor.voidSlabs) floor.voidSlabs = [];
            return floor.voidSlabs;
        }

        // v3.0: Finish drawing beam on mouseup
        function finishBeamDraw(event) {
            if (!state.addingBeam || !state.beamDrawStart) return;

            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // v3.0: Use configurable snap-to-grid (respects state.snapSize when enabled)
            const endX = snapToGrid((mouseX - state.offsetX) / state.scale);
            const endY = snapToGrid((mouseY - state.offsetY) / state.scale);
            const startX = snapToGrid(state.beamDrawStart.x);
            const startY = snapToGrid(state.beamDrawStart.y);

            // Determine if horizontal or vertical based on drag direction
            const dx = Math.abs(endX - startX);
            const dy = Math.abs(endY - startY);

            // Minimum beam length check (0.5m)
            if (Math.max(dx, dy) < 0.5) {
                state.beamDrawStart = null;
                console.log('v3.0: Beam too short, cancelled');
                return;
            }

            // Create custom beam
            const customBeams = getFloorCustomBeams();
            const beamId = `CB${ state.nextCustomBeamId++ } `;

            if (dx > dy) {
                // Horizontal beam running along X, at constant Y.
                const y = (startY + endY) / 2; // Average Y position
                customBeams.push({
                    id: beamId,
                    dir: 'X',
                    beamType: 'custom',
                    pos: y,    // Y coordinate
                    start: Math.min(startX, endX),
                    end: Math.max(startX, endX),
                    span: Math.abs(endX - startX),
                    isCustom: true
                });
                console.log(`v3.0: Added horizontal beam ${ beamId } at Y = ${ y.toFixed(2) } `);
            } else {
                // Vertical beam running along Y, at constant X.
                const x = (startX + endX) / 2; // Average X position
                customBeams.push({
                    id: beamId,
                    dir: 'Y',
                    beamType: 'custom',
                    pos: x,    // X coordinate
                    start: Math.min(startY, endY),
                    end: Math.max(startY, endY),
                    span: Math.abs(endY - startY),
                    isCustom: true
                });
                console.log(`v3.0: Added vertical beam ${ beamId } at X = ${ x.toFixed(2) } `);
            }

            state.beamDrawStart = null;
            toggleBeamMode(); // Exit beam mode
            calculate(); // Recalculate with new beam
        }

        // v3.0: Delete custom beam by ID
        function deleteCustomBeamFromFloor(beamId, floorId) {
            const floor = state.floors.find(f => f.id === floorId) || state.floors[state.currentFloorIndex];
            if (!floor) return false;
            const customBeams = floor.customBeams || [];
            const idx = customBeams.findIndex(b => b.id === beamId);
            if (idx >= 0) {
                const deletedBeam = customBeams[idx];

                // v3.0: Push to undo stack before deleting
                state.undoStack.push({
                    type: 'beam',
                    data: { ...deletedBeam },
                    floorId: floorId,
                    timestamp: Date.now()
                });

                customBeams.splice(idx, 1);
                console.log(`v3.0: Deleted custom beam ${ beamId } (saved to undo stack)`);
                updateUndoButton();
                calculate();
                return true;
            }
            return false;
        }

        function deleteCustomBeam(beamId) {
            const floorId = state.floors[state.currentFloorIndex]?.id;
            return deleteCustomBeamFromFloor(beamId, floorId);
        }

        // v3.0: Toggle structural beam deleted state (PER-FLOOR)
        function toggleBeamDeleted(beamId) {
            const currentFloor = state.floors[state.currentFloorIndex];
            if (!currentFloor) return;

            // Initialize per-floor deleted beams array if needed
            if (!currentFloor.deletedBeams) currentFloor.deletedBeams = [];

            // Toggle in floor's deleted list
            const idx = currentFloor.deletedBeams.indexOf(beamId);
            if (idx >= 0) {
                currentFloor.deletedBeams.splice(idx, 1); // Restore
                console.log(`v3.0: Beam ${ beamId } restored on floor ${ currentFloor.id } `);
            } else {
                currentFloor.deletedBeams.push(beamId); // Delete
                console.log(`v3.0: Beam ${ beamId } DELETED on floor ${ currentFloor.id } `);
            }

            calculate();
        }

        function draw() {

            if (!ctx) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1;
            ctx.setLineDash([]);
            ctx.lineCap = 'butt';
            ctx.lineJoin = 'miter';
            ctx.textBaseline = 'alphabetic';

            // v3.9: Simple 1m GRID (optimized for performance)
            // Toggleable via state.gridVisible
            if (state.gridVisible === undefined) state.gridVisible = true;

            if (state.gridVisible) {
                const gridSpacingM = 1.0;
                const gridSpacingPx = gridSpacingM * state.scale;

                // Only draw if grid lines won't be too dense (performance)
                if (gridSpacingPx > 8) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();

                    // Vertical lines
                    const startX = ((state.offsetX % gridSpacingPx) + gridSpacingPx) % gridSpacingPx;
                    for (let x = startX; x <= canvas.width; x += gridSpacingPx) {
                        ctx.moveTo(x, 0);
                        ctx.lineTo(x, canvas.height);
                    }

                    // Horizontal lines
                    const startY = ((state.offsetY % gridSpacingPx) + gridSpacingPx) % gridSpacingPx;
                    for (let y = startY; y <= canvas.height; y += gridSpacingPx) {
                        ctx.moveTo(0, y);
                        ctx.lineTo(canvas.width, y);
                    }
                    ctx.stroke();
                    ctx.restore();
                }
            }

            // v3.0: Check if structural plan tab is active - draw actual member sizes
            if (currentPlanTab === 'structural') {
                drawStructuralPlan();
                return; // Skip wireframe mode
            }

            // v3.2: Check if foundation plan tab is active - draw footings and tie beams
            if (currentPlanTab === 'foundation') {
                drawFoundationPlan();
                return; // Skip wireframe mode
            }

            // MVP-010: Beam Tributary plan view
            if (currentPlanTab === 'tribBeams') {
                drawBeamTributaryPlan();
                return;
            }

            // MVP-010: Column Tributary plan view
            if (currentPlanTab === 'tribCols') {
                drawColumnTributaryPlan();
                return;
            }

            // MVP-010: Base Reactions plan view
            if (currentPlanTab === 'reactions') {
                drawReactionsPlan();
                return;
            }

            // v3.0: Draw gridlines when in beam adding mode OR grid toggle is ON (and layer is visible)
            if ((state.addingBeam || state.showSubGrid) && layerVisibility.grid) {
                const gridSpacing = 1.0; // 1m spacing
                const totalWidth = state.xSpans.reduce((a, b) => a + b, 0);
                const totalHeight = state.ySpans.reduce((a, b) => a + b, 0);

                // Extend grid 5m beyond building in all directions
                const gridExtend = 5;
                const gridStartX = -gridExtend;
                const gridEndX = totalWidth + gridExtend;
                const gridStartY = -gridExtend;
                const gridEndY = totalHeight + gridExtend;

                // Draw fine grid (configurable snap size when snap enabled)
                const fineSpacing = state.snapEnabled ? state.snapSize : 0.5;

                // Fine grid (subtle)
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
                ctx.lineWidth = 0.5;
                ctx.setLineDash([]);

                for (let x = gridStartX; x <= gridEndX; x += fineSpacing) {
                    const px = x * state.scale + state.offsetX;
                    ctx.beginPath();
                    ctx.moveTo(px, gridStartY * state.scale + state.offsetY);
                    ctx.lineTo(px, gridEndY * state.scale + state.offsetY);
                    ctx.stroke();
                }
                for (let y = gridStartY; y <= gridEndY; y += fineSpacing) {
                    const py = y * state.scale + state.offsetY;
                    ctx.beginPath();
                    ctx.moveTo(gridStartX * state.scale + state.offsetX, py);
                    ctx.lineTo(gridEndX * state.scale + state.offsetX, py);
                    ctx.stroke();
                }

                // Major grid (1m spacing - more visible)
                ctx.strokeStyle = 'rgba(100, 116, 139, 0.32)';
                ctx.lineWidth = 1;

                for (let x = Math.floor(gridStartX); x <= gridEndX; x += gridSpacing) {
                    const px = x * state.scale + state.offsetX;
                    ctx.beginPath();
                    ctx.moveTo(px, gridStartY * state.scale + state.offsetY);
                    ctx.lineTo(px, gridEndY * state.scale + state.offsetY);
                    ctx.stroke();
                }
                for (let y = Math.floor(gridStartY); y <= gridEndY; y += gridSpacing) {
                    const py = y * state.scale + state.offsetY;
                    ctx.beginPath();
                    ctx.moveTo(gridStartX * state.scale + state.offsetX, py);
                    ctx.lineTo(gridEndX * state.scale + state.offsetX, py);
                    ctx.stroke();
                }
            }

            // v3.0: Draw gridline bubbles (A, B, C... for X-axis and 1, 2, 3... for Y-axis)
            const totalWidth = state.xSpans.reduce((a, b) => a + b, 0);
            const totalHeight = state.ySpans.reduce((a, b) => a + b, 0);
            const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

            // v3.9: Zoom-aware scaling for text and bubbles
            // Base scale is 50px/m - scale text proportionally
            const textScaleFactor = Math.max(0.6, Math.min(2.0, state.scale / 50));
            const bubbleRadius = 14 * textScaleFactor;

            // Calculate X coordinates
            let xCoords = [0];
            for (let span of state.xSpans) xCoords.push(xCoords[xCoords.length - 1] + span);

            // Calculate Y coordinates
            let yCoords = [0];
            for (let span of state.ySpans) yCoords.push(yCoords[yCoords.length - 1] + span);

            // Draw X-axis gridlines (vertical lines) with letter bubbles at TOP
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            for (let i = 0; i < xCoords.length; i++) {
                const px = xCoords[i] * state.scale + state.offsetX;
                // Draw gridline
                ctx.beginPath();
                ctx.moveTo(px, state.offsetY - 30);
                ctx.lineTo(px, totalHeight * state.scale + state.offsetY + 30);
                ctx.stroke();

                // Draw bubble at top - OUTER edge (further from grid)
                const by = state.offsetY - 70;  // v3.1: Moved to outer edge
                ctx.fillStyle = '#475569';
                ctx.beginPath();
                ctx.arc(px, by, bubbleRadius, 0, Math.PI * 2);
                ctx.fill();
                // Letter label
                ctx.fillStyle = 'white';
                ctx.font = `bold ${ Math.round(12 * textScaleFactor) }px Inter, Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(letters[i], px, by);
            }

            // Draw Y-axis gridlines (horizontal lines) with number bubbles at LEFT
            for (let i = 0; i < yCoords.length; i++) {
                const py = yCoords[i] * state.scale + state.offsetY;
                // Draw gridline
                ctx.beginPath();
                ctx.moveTo(state.offsetX - 30, py);
                ctx.lineTo(totalWidth * state.scale + state.offsetX + 30, py);
                ctx.stroke();

                // Draw bubble at left - OUTER edge (further from grid)
                const bx = state.offsetX - 80;  // v3.1: Moved to outer edge
                ctx.fillStyle = '#475569';
                ctx.beginPath();
                ctx.arc(bx, py, bubbleRadius, 0, Math.PI * 2);
                ctx.fill();
                // Number label
                ctx.fillStyle = 'white';
                ctx.font = `bold ${ Math.round(12 * textScaleFactor) }px Inter, Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText((i + 1).toString(), bx, py);
            }
            ctx.setLineDash([]);

            // ========== v3.1: DIMENSION LABELS ==========
            // Draw X-span dimensions (between X gridlines, at top)
            ctx.font = `bold ${ Math.round(11 * textScaleFactor) }px Inter, Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let i = 0; i < state.xSpans.length; i++) {
                const x1 = xCoords[i] * state.scale + state.offsetX;
                const x2 = xCoords[i + 1] * state.scale + state.offsetX;
                const midX = (x1 + x2) / 2;
                const topY = state.offsetY - 45; // v3.1: Between bubbles and grid

                // Dimension line
                ctx.strokeStyle = 'rgba(71, 85, 105, 0.65)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x1, topY);
                ctx.lineTo(x2, topY);
                ctx.stroke();

                // End ticks
                ctx.beginPath();
                ctx.moveTo(x1, topY - 4);
                ctx.lineTo(x1, topY + 4);
                ctx.moveTo(x2, topY - 4);
                ctx.lineTo(x2, topY + 4);
                ctx.stroke();

                const dimText = state.xSpans[i].toFixed(1) + 'm';
                ctx.fillStyle = '#334155';
                ctx.fillText(dimText, midX, topY);
            }

            // Draw Y-span dimensions (between Y gridlines, at left)
            for (let i = 0; i < state.ySpans.length; i++) {
                const y1 = yCoords[i] * state.scale + state.offsetY;
                const y2 = yCoords[i + 1] * state.scale + state.offsetY;
                const midY = (y1 + y2) / 2;
                const leftX = state.offsetX - 50; // v3.1: Between bubbles and grid

                // Dimension line
                ctx.strokeStyle = 'rgba(71, 85, 105, 0.65)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(leftX, y1);
                ctx.lineTo(leftX, y2);
                ctx.stroke();

                // End ticks
                ctx.beginPath();
                ctx.moveTo(leftX - 4, y1);
                ctx.lineTo(leftX + 4, y1);
                ctx.moveTo(leftX - 4, y2);
                ctx.lineTo(leftX + 4, y2);
                ctx.stroke();

                const dimText = state.ySpans[i].toFixed(1) + 'm';
                ctx.fillStyle = '#334155';
                ctx.fillText(dimText, leftX, midY);
            }

            // Draw slabs (filled)
            for (let slab of state.slabs) {
                const x1 = slab.x1 * state.scale + state.offsetX;
                const y1 = slab.y1 * state.scale + state.offsetY;
                const w = slab.lx * state.scale;
                const h = slab.ly * state.scale;

                // v3.0: Void slabs - show red X pattern
                if (slab.isVoid) {
                    ctx.fillStyle = 'rgba(220, 38, 38, 0.18)';
                    ctx.fillRect(x1, y1, w, h);
                    // Dashed border
                    ctx.strokeStyle = '#b91c1c';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.strokeRect(x1, y1, w, h);
                    ctx.setLineDash([]);
                    // Draw solid X (more visible)
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x1 + w, y1 + h);
                    ctx.moveTo(x1 + w, y1);
                    ctx.lineTo(x1, y1 + h);
                    ctx.stroke();
                    // Label
                    if (state.showLabels) {
                        const cx = x1 + w / 2;
                        const cy = y1 + h / 2;
                        ctx.fillStyle = '#991b1b';
                        ctx.font = `bold ${ Math.round(9 * textScaleFactor) }px Inter, Arial, sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.fillText('VOID', cx, cy + 3);
                    }
                    continue;  // Skip normal rendering
                }

                // v3.0: Special styling for cantilever slabs
                if (slab.isCantilever) {
                    ctx.fillStyle = 'rgba(217, 119, 6, 0.16)';
                    ctx.fillRect(x1, y1, w, h);
                    ctx.setLineDash([5, 5]);  // Dashed border
                    ctx.strokeStyle = '#b45309';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x1, y1, w, h);
                    ctx.setLineDash([]);  // Reset

                    // Cantilever label
                    if (state.showLabels) {
                        const cx = x1 + w / 2;
                        const cy = y1 + h / 2;
                        ctx.fillStyle = '#92400e';
                        ctx.font = `600 ${ Math.round(9 * textScaleFactor) }px Inter, Arial, sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.fillText(`C:${ slab.area.toFixed(1) } m²`, cx, cy + 3);
                    }
                } else {
                    ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
                    ctx.fillRect(x1, y1, w, h);

                    // v3.2: Check if slab is locked
                    const floorNow = state.floors[state.currentFloorIndex];
                    const isSlabLocked = floorNow?.lockedSlabs?.includes(slab.id);

                    if (isSlabLocked) {
                        // Locked slab: blue border
                        ctx.strokeStyle = '#2563eb';
                        ctx.lineWidth = 2.4;
                    } else {
                        ctx.strokeStyle = '#94a3b8';
                        ctx.lineWidth = 1.4;
                    }
                    ctx.strokeRect(x1, y1, w, h);

                    // v3.2: Draw lock icon for locked slabs
                    if (isSlabLocked && state.showLabels) {
                        const cx = x1 + w / 2;
                        const cy = y1 + h / 2;
                        ctx.fillStyle = '#3b82f6';
                        ctx.font = `${ Math.round(12 * textScaleFactor) }px Inter, Arial, sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.fillText('🔒', cx, cy);
                    }
                }
            }

            // v2.2: Draw slice polygons when Areas is ON
            if (state.showAreas) {
                for (let beam of state.beams) {
                    for (let slice of beam.slices) {
                        // v3.0: Skip slices for voided slabs - don't cover void pattern
                        const parentSlab = state.slabs.find(s => s.id === slice.slabId);
                        if (parentSlab && parentSlab.isVoid) continue;

                        // Draw polygon
                        ctx.beginPath();
                        const firstPt = slice.poly[0];
                        ctx.moveTo(
                            firstPt.x * state.scale + state.offsetX,
                            firstPt.y * state.scale + state.offsetY
                        );
                        for (let i = 1; i < slice.poly.length; i++) {
                            const pt = slice.poly[i];
                            ctx.lineTo(
                                pt.x * state.scale + state.offsetX,
                                pt.y * state.scale + state.offsetY
                            );
                        }
                        ctx.closePath();

                        // Color by beam direction, kept in a restrained engineering palette.
                        const isXBeam = beam.direction === 'X';
                        ctx.fillStyle = isXBeam ? 'rgba(14, 116, 144, 0.18)' : 'rgba(15, 118, 110, 0.14)';
                        ctx.fill();
                        ctx.strokeStyle = isXBeam ? 'rgba(14, 116, 144, 0.42)' : 'rgba(15, 118, 110, 0.36)';
                        ctx.lineWidth = 1;
                        ctx.stroke();

                        // Centroid marker and label
                        const cx = slice.cx * state.scale + state.offsetX;
                        const cy = slice.cy * state.scale + state.offsetY;

                        ctx.beginPath();
                        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
                        ctx.fillStyle = '#475569';
                        ctx.fill();

                        // Label at centroid
                        if (state.showLabels) {
                            ctx.font = `600 ${ Math.round(9 * textScaleFactor) }px Inter, Arial, sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.lineWidth = Math.max(2, 3 * textScaleFactor);
                            ctx.strokeStyle = 'rgba(248, 250, 252, 0.92)';
                            const areaText = `A = ${ slice.area.toFixed(1) } m²`;
                            const loadText = `w = ${ slice.w.toFixed(1) } kN/m`;
                            ctx.strokeText(areaText, cx, cy - 6);
                            ctx.fillStyle = '#0f172a';
                            ctx.fillText(areaText, cx, cy - 6);
                            ctx.strokeText(loadText, cx, cy + 6);
                            ctx.fillStyle = '#475569';
                            ctx.fillText(loadText, cx, cy + 6);
                        }
                    }
                }
            }

            // Draw beams (with per-floor deleted check)
            const currentFloor = state.floors[state.currentFloorIndex];
            const deletedBeams = currentFloor?.deletedBeams || [];
            const lockedBeams = currentFloor?.lockedBeams || [];  // v3.2: Get locked beams
            ctx.lineWidth = Math.max(1, 1.2 * textScaleFactor);
            ctx.textBaseline = 'alphabetic';

            // v3.10: Draw beams as scaled rectangles (actual beam width)
            for (let beam of state.beams) {
                // v3.0 FIX: Skip custom beams - they are drawn separately below
                if (beam.isCustom) continue;

                const x1 = beam.x1 * state.scale + state.offsetX;
                const y1 = beam.y1 * state.scale + state.offsetY;
                const x2 = beam.x2 * state.scale + state.offsetX;
                const y2 = beam.y2 * state.scale + state.offsetY;
                const beamBpx = ((beam.suggestedB || 250) / 1000) * state.scale; // scaled width

                // v3.0: Check if beam is deleted on THIS floor
                const isDeleted = deletedBeams.includes(beam.id);
                // v3.2: Check if beam is locked on THIS floor
                const isLocked = lockedBeams.includes(beam.id);

                if (isDeleted) {
                    // Draw deleted beam as red dashed outline
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';  // Red transparent
                    ctx.strokeStyle = '#ef4444';
                    ctx.setLineDash([6, 4]);
                } else if (isLocked) {
                    // v3.2: Locked beam - blue fill
                    ctx.fillStyle = 'rgba(59, 130, 246, 0.6)';
                    ctx.strokeStyle = '#3b82f6';
                    ctx.setLineDash([]);
                } else {
                    ctx.fillStyle = 'rgba(30, 41, 59, 0.68)';
                    ctx.strokeStyle = '#0f172a';
                    ctx.setLineDash([]);
                }

                // v3.10: Draw as filled rectangle with actual beam width
                if (beam.direction === 'X') {
                    ctx.fillRect(Math.min(x1, x2), y1 - beamBpx / 2, Math.abs(x2 - x1), beamBpx);
                    ctx.strokeRect(Math.min(x1, x2), y1 - beamBpx / 2, Math.abs(x2 - x1), beamBpx);
                } else {
                    ctx.fillRect(x1 - beamBpx / 2, Math.min(y1, y2), beamBpx, Math.abs(y2 - y1));
                    ctx.strokeRect(x1 - beamBpx / 2, Math.min(y1, y2), beamBpx, Math.abs(y2 - y1));
                }

                // v3.2: Draw lock icon for locked beams
                if (isLocked && state.showLabels) {
                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    ctx.fillStyle = '#3b82f6';
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('🔒', midX, midY - 8);
                }
            }
            ctx.setLineDash([]);  // Reset

            // v3.0: Draw custom beams (intermediate framing beams)
            const customBeams = getFloorCustomBeams();
            ctx.lineWidth = 4;
            ctx.setLineDash([8, 4]);
            for (let cb of customBeams) {
                ctx.strokeStyle = '#b45309';
                // v3.0 FIX: dir=X means horizontal beam (runs along X), dir=Y means vertical
                if (cb.dir === 'X') {
                    // Horizontal beam at Y = cb.pos, running from x1 to x2
                    const y = cb.pos * state.scale + state.offsetY;
                    const x1 = cb.start * state.scale + state.offsetX;
                    const x2 = cb.end * state.scale + state.offsetX;
                    ctx.beginPath();
                    ctx.moveTo(x1, y);
                    ctx.lineTo(x2, y);
                    ctx.stroke();
                } else {
                    // Vertical beam at X = cb.pos, running from y1 to y2
                    const x = cb.pos * state.scale + state.offsetX;
                    const y1 = cb.start * state.scale + state.offsetY;
                    const y2 = cb.end * state.scale + state.offsetY;
                    ctx.beginPath();
                    ctx.moveTo(x, y1);
                    ctx.lineTo(x, y2);
                    ctx.stroke();
                }
                // Label
                if (state.showLabels) {
                    const lx = cb.dir === 'X' ? ((cb.start + cb.end) / 2) * state.scale + state.offsetX : cb.pos * state.scale + state.offsetX;
                    const ly = cb.dir === 'X' ? cb.pos * state.scale + state.offsetY : ((cb.start + cb.end) / 2) * state.scale + state.offsetY;
                    ctx.fillStyle = '#78350f';
                    ctx.font = 'bold 10px Inter, Arial, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(cb.id, lx, ly - 5);
                }
            }
            ctx.setLineDash([]);

            // v3.0: Draw slab voids (any slab or sub-slab marked as void)
            for (let slab of state.slabs) {
                if (!slab.isVoid) continue;

                const px1 = slab.x1 * state.scale + state.offsetX;
                const py1 = slab.y1 * state.scale + state.offsetY;
                const pw = (slab.x2 - slab.x1) * state.scale;
                const ph = (slab.y2 - slab.y1) * state.scale;

                // Red fill with transparency
                ctx.fillStyle = 'rgba(220, 38, 38, 0.18)';
                ctx.fillRect(px1, py1, pw, ph);

                // Dashed red border
                ctx.strokeStyle = '#b91c1c';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(px1, py1, pw, ph);
                ctx.setLineDash([]);

                // Draw X pattern
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(px1, py1);
                ctx.lineTo(px1 + pw, py1 + ph);
                ctx.moveTo(px1 + pw, py1);
                ctx.lineTo(px1, py1 + ph);
                ctx.stroke();

                // Label
                if (state.showLabels) {
                    const cx = px1 + pw / 2;
                    const cy = py1 + ph / 2;
                    ctx.fillStyle = '#991b1b';
                    ctx.font = 'bold 8px Inter, Arial, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`VOID`, cx, cy);
                }
            }

            // Draw columns
            for (let col of state.columns) {
                const pos = getColumnPlanPosition(col);
                const x = pos.x * state.scale + state.offsetX;
                const y = pos.y * state.scale + state.offsetY;
                const colSize = getColumnSizeMm(col);
                const colBpx = (colSize.b / 1000) * state.scale;
                const colHpx = (colSize.h / 1000) * state.scale;
                const size = Math.max(colBpx, 6); // min 6px for visibility

                // v3.0: Use per-floor active state for current floor
                const currentFloorId = state.floors[state.currentFloorIndex]?.id;
                const isActiveOnThisFloor = isColumnActiveOnFloor(col, currentFloorId);

                // v3.0: Draw red X for columns inactive on THIS floor
                if (!isActiveOnThisFloor) {
                    ctx.strokeStyle = '#ef4444'; // Red
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(x - size, y - size);
                    ctx.lineTo(x + size, y + size);
                    ctx.moveTo(x - size, y + size);
                    ctx.lineTo(x + size, y - size);
                    ctx.stroke();

                    // Show ID label even for inactive
                    if (state.showLabels) {
                        ctx.fillStyle = '#ef4444';
                        ctx.font = '10px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(col.id, x, y - 16);
                    }
                    continue; // Skip normal drawing
                }

                // v3.0: Get column type for THIS floor
                const colType = getColumnTypeForFloor(col, currentFloorId);

                // Keep active columns in a professional neutral hierarchy.
                let color = '#0f172a'; // Interior
                if (colType === 'corner') color = '#334155';
                else if (colType === 'edge') color = '#1f2937';

                ctx.fillStyle = color;
                ctx.fillRect(x - colBpx / 2, y - colHpx / 2, colBpx, colHpx);

                // Label
                if (state.showLabels) {
                    ctx.fillStyle = '#fff';
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(col.id, x, y);
                }
            }

            // Draw slab hatching (layer: areas)
            if (layerVisibility.areas) {
                for (let slab of state.slabs) {
                    if (slab.isVoid) continue;

                    const x1 = slab.x1 * state.scale + state.offsetX;
                    const y1 = slab.y1 * state.scale + state.offsetY;
                    const w = slab.width * state.scale;
                    const h = slab.height * state.scale;

                    // Light slab fill
                    ctx.fillStyle = 'rgba(200, 220, 240, 0.3)';
                    ctx.fillRect(x1, y1, w, h);

                    // Diagonal hatching
                    ctx.strokeStyle = 'rgba(100, 150, 200, 0.2)';
                    ctx.lineWidth = 0.5;
                    const spacing = 15;
                    ctx.beginPath();
                    for (let d = 0; d < w + h; d += spacing) {
                        const startX = Math.max(0, d - h);
                        const startY = Math.min(d, h);
                        const endX = Math.min(d, w);
                        const endY = Math.max(0, d - w);
                        ctx.moveTo(x1 + startX, y1 + startY);
                        ctx.lineTo(x1 + endX, y1 + endY);
                    }
                    ctx.stroke();
                }
            }
        }

        // ========== v3.0: STRUCTURAL PLAN RENDERING (AutoCAD STYLE) ==========
        // Clean wireframe like real AutoCAD drawings
        function drawStructuralPlan() {
            if (!ctx) return;

            const currentFloor = state.floors[state.currentFloorIndex];
            const deletedBeams = currentFloor?.deletedBeams || [];
            const deletedColumns = currentFloor?.deletedColumns || [];
            const currentFloorId = currentFloor?.id;

            // Calculate grid coordinates
            let xCoords = [0];
            state.xSpans.forEach(s => xCoords.push(xCoords[xCoords.length - 1] + s));
            let yCoords = [0];
            state.ySpans.forEach(s => yCoords.push(yCoords[yCoords.length - 1] + s));
            const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
            const maxX = xCoords[xCoords.length - 1];
            const maxY = yCoords[yCoords.length - 1];

            // v3.7: Background handling moved to draw() function
            // Grid is now drawn permanently in draw() before this function
            // No fillRect/clearRect here - we want to preserve the grid

            // v3.7: Grid is now drawn permanently in draw() function - removed duplicate grid code here

            // Classic engineering drawing colors (black ink on white paper)
            const COLOR_GRID = '#888888';     // Gray for centerlines
            const COLOR_BEAM = '#000000';     // Black for beams
            const COLOR_COL = '#000000';      // Black for columns (filled)
            const COLOR_SLAB = '#999999';     // Light gray for slab outlines
            const COLOR_TEXT = '#000000';     // Black for text
            const COLOR_BUBBLE = '#000000';   // Black for grid bubbles

            // ===== GRIDLINES (thin solid lines - structural centerlines) =====
            if (layerVisibility.grid) {
                ctx.setLineDash([]);  // v3.1: Solid lines, no centerline pattern
                ctx.strokeStyle = COLOR_GRID;
                ctx.lineWidth = 0.5;

                // Vertical gridlines (extend beyond building)
                xCoords.forEach(x => {
                    const px = x * state.scale + state.offsetX;
                    ctx.beginPath();
                    ctx.moveTo(px, state.offsetY - 60);
                    ctx.lineTo(px, maxY * state.scale + state.offsetY + 60);
                    ctx.stroke();
                });

                // Horizontal gridlines
                yCoords.forEach(y => {
                    const py = y * state.scale + state.offsetY;
                    ctx.beginPath();
                    ctx.moveTo(state.offsetX - 60, py);
                    ctx.lineTo(maxX * state.scale + state.offsetX + 60, py);
                    ctx.stroke();
                });
                ctx.setLineDash([]);

                // v3.1: Scale-relative sizing for text and bubbles
                const baseScale = 50;  // Reference scale
                const scaleFactor = Math.max(state.scale / baseScale, 0.5);  // Min 50% size
                const bubbleR = 12 * scaleFactor;
                const fontSize = Math.round(11 * scaleFactor);
                const bubbleOffset = 70 * scaleFactor;  // Distance from grid to bubbles
                const dimOffset = 45 * scaleFactor;     // Distance from grid to dimensions

                // Grid bubbles (CAD style circles with text)
                ctx.font = `bold ${ fontSize }px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // X-axis bubbles (top, letters) - OUTER edge
                xCoords.forEach((x, i) => {
                    const px = x * state.scale + state.offsetX;
                    const py = state.offsetY - bubbleOffset;  // v3.1: Scale-relative
                    // Circle outline (no fill)
                    ctx.strokeStyle = COLOR_BUBBLE;
                    ctx.lineWidth = 1.5 * scaleFactor;
                    ctx.beginPath();
                    ctx.arc(px, py, bubbleR, 0, Math.PI * 2);
                    ctx.stroke();
                    // Letter
                    ctx.fillStyle = COLOR_BUBBLE;
                    ctx.fillText(letters[i], px, py);
                });

                // Y-axis bubbles (left, numbers) - OUTER edge
                yCoords.forEach((y, i) => {
                    const px = state.offsetX - bubbleOffset - 10 * scaleFactor;  // v3.1: Scale-relative
                    const py = y * state.scale + state.offsetY;
                    ctx.strokeStyle = COLOR_BUBBLE;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(px, py, bubbleR, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fillStyle = COLOR_BUBBLE;
                    ctx.fillText((i + 1).toString(), px, py);
                });

                // v3.1: DIMENSION LABELS (between bubbles and grid) - scale-relative
                const dimFontSize = Math.round(10 * scaleFactor);
                ctx.font = `bold ${ dimFontSize }px Arial`;

                // X-span dimensions
                for (let i = 0; i < state.xSpans.length; i++) {
                    const x1 = xCoords[i] * state.scale + state.offsetX;
                    const x2 = xCoords[i + 1] * state.scale + state.offsetX;
                    const midX = (x1 + x2) / 2;
                    const topY = state.offsetY - dimOffset;  // Scale-relative

                    // Dimension line
                    ctx.strokeStyle = COLOR_TEXT;
                    ctx.lineWidth = 0.5 * scaleFactor;
                    ctx.beginPath();
                    ctx.moveTo(x1, topY);
                    ctx.lineTo(x2, topY);
                    ctx.stroke();

                    // End ticks
                    const tickSize = 3 * scaleFactor;
                    ctx.beginPath();
                    ctx.moveTo(x1, topY - tickSize);
                    ctx.lineTo(x1, topY + tickSize);
                    ctx.moveTo(x2, topY - tickSize);
                    ctx.lineTo(x2, topY + tickSize);
                    ctx.stroke();

                    // Dimension text (offset half text height above line)
                    const dimText = (state.xSpans[i] * 1000).toFixed(0);  // mm
                    const textOffsetX = 7 * scaleFactor;  // Half text height offset
                    ctx.fillStyle = COLOR_TEXT;
                    ctx.fillText(dimText, midX, topY - textOffsetX);
                }

                // Y-span dimensions (rotated text like CAD)
                const leftDimX = state.offsetX - dimOffset - 5 * scaleFactor;
                const textOffsetY = 7 * scaleFactor;  // Half text height offset
                for (let i = 0; i < state.ySpans.length; i++) {
                    const y1 = yCoords[i] * state.scale + state.offsetY;
                    const y2 = yCoords[i + 1] * state.scale + state.offsetY;
                    const midY = (y1 + y2) / 2;

                    // Dimension line
                    ctx.strokeStyle = COLOR_TEXT;
                    ctx.lineWidth = 0.5 * scaleFactor;
                    ctx.beginPath();
                    ctx.moveTo(leftDimX, y1);
                    ctx.lineTo(leftDimX, y2);
                    ctx.stroke();

                    // End ticks
                    const tickSize = 3 * scaleFactor;
                    ctx.beginPath();
                    ctx.moveTo(leftDimX - tickSize, y1);
                    ctx.lineTo(leftDimX + tickSize, y1);
                    ctx.moveTo(leftDimX - tickSize, y2);
                    ctx.lineTo(leftDimX + tickSize, y2);
                    ctx.stroke();

                    // Dimension text (rotated horizontal like CAD, no mask)
                    const dimText = (state.ySpans[i] * 1000).toFixed(0);  // mm

                    ctx.save();
                    ctx.translate(leftDimX - textOffsetY, midY);
                    ctx.rotate(-Math.PI / 2);  // Rotate text 90° counter-clockwise

                    // Text (no white background)
                    ctx.fillStyle = COLOR_TEXT;
                    ctx.fillText(dimText, 0, 0);
                    ctx.restore();
                }
            }

            // ===== SLAB OUTLINES (tributary areas) =====
            ctx.strokeStyle = COLOR_SLAB;
            ctx.lineWidth = 0.5;
            ctx.setLineDash([2, 2]); // Dashed for slab boundary
            for (let slab of state.slabs) {
                if (slab.isVoid) continue;
                const x1 = slab.x1 * state.scale + state.offsetX;
                const y1 = slab.y1 * state.scale + state.offsetY;
                const w = slab.width * state.scale;
                const h = slab.height * state.scale;
                ctx.strokeRect(x1, y1, w, h);
            }
            ctx.setLineDash([]);

            // ===== BEAMS (wireframe outlines - terminate at column faces) =====
            if (layerVisibility.beams) {
                // v3.1: Scale-relative sizing for beam labels
                const baseScale = 50;
                const beamScaleFactor = Math.max(state.scale / baseScale, 0.5);
                const beamLabelFontSize = Math.round(8 * beamScaleFactor);
                const beamLabelOffset = 6 * beamScaleFactor;

                // v3.1: Calculate grid boundaries for edge beam detection
                const totalX = state.xSpans.reduce((a, b) => a + b, 0);
                const totalY = state.ySpans.reduce((a, b) => a + b, 0);

                // v3.1: Helper to get beam alignment offset for edge beams
                function getBeamAlignmentOffset(beam, beamWidthM) {
                    let offsetY = 0;
                    let offsetX = 0;

                    // Only apply alignment if edge alignment is enabled
                    if (state.columnAlignment !== 'outer') {
                        return { offsetX: 0, offsetY: 0 };
                    }

                    if (beam.direction === 'X') {
                        // Horizontal beam - check Y position
                        if (Math.abs(beam.y1) < 0.01) {
                            offsetY = beamWidthM / 2;  // Top edge - shift down
                        } else if (Math.abs(beam.y1 - totalY) < 0.01) {
                            offsetY = -beamWidthM / 2;  // Bottom edge - shift up
                        }
                    } else {
                        // Vertical beam - check X position
                        if (Math.abs(beam.x1) < 0.01) {
                            offsetX = beamWidthM / 2;  // Left edge - shift right
                        } else if (Math.abs(beam.x1 - totalX) < 0.01) {
                            offsetX = -beamWidthM / 2;  // Right edge - shift left
                        }
                    }

                    return { offsetX, offsetY };
                }

                ctx.strokeStyle = COLOR_BEAM;
                ctx.lineWidth = 1 * beamScaleFactor;

                for (let beam of state.beams) {
                    if (beam.isCustom) continue;

                    const isDeleted = deletedBeams.includes(beam.id);
                    // v3.9: Draw deleted beams as red dashed so they can be restored
                    if (isDeleted) {
                        ctx.strokeStyle = '#ef4444';
                        ctx.setLineDash([4, 4]);
                    } else {
                        ctx.strokeStyle = COLOR_BEAM;
                        ctx.setLineDash([]);
                    }
                    const beamSize = getBeamSizeMm(beam, currentFloorId);
                    const beamWidthM = beamSize.b / 1000;
                    const beamWidthPx = beamWidthM * state.scale;
                    const beamAlignOffset = getBeamAlignmentOffset(beam, beamWidthM);
                    const startCol = state.columns.find(c => c.id === beam.startCol);
                    const endCol = state.columns.find(c => c.id === beam.endCol);
                    const startPos = startCol ? getColumnPlanPosition(startCol) : { x: beam.x1, y: beam.y1 };
                    const endPos = endCol ? getColumnPlanPosition(endCol) : { x: beam.x2, y: beam.y2 };
                    const startTrim = getColumnHalfAlongBeam(startCol, beam.direction);
                    const endTrim = getColumnHalfAlongBeam(endCol, beam.direction);

                    // v3.2: Dash pattern scales with zoom
                    const dashLength = 6 * beamScaleFactor;
                    const gapLength = 3 * beamScaleFactor;

                    // v3.2: Get floor ID for beam naming
                    const floorId = currentFloor?.id || '2F';

                    // v3.2: Determine if beam is on edge and which edge
                    let isTopEdge = false, isBottomEdge = false, isLeftEdge = false, isRightEdge = false;
                    if (beam.direction === 'X') {
                        isTopEdge = Math.abs(beam.y1) < 0.01;
                        isBottomEdge = Math.abs(beam.y1 - totalY) < 0.01;
                    } else {
                        isLeftEdge = Math.abs(beam.x1) < 0.01;
                        isRightEdge = Math.abs(beam.x1 - totalX) < 0.01;
                    }

                    // v3.1: Terminate beams at column faces (offset by half column)
                    // v3.2: Account for column alignment offset when in Flush mode
                    if (beam.direction === 'X') {
                        // Horizontal beam
                        let y1 = (beam.y1 + beamAlignOffset.offsetY) * state.scale + state.offsetY;
                        let x1 = (startPos.x + startTrim) * state.scale + state.offsetX;
                        let x2 = (endPos.x - endTrim) * state.scale + state.offsetX;

                        const beamTop = y1 - beamWidthPx / 2;
                        const beamBottom = y1 + beamWidthPx / 2;

                        // v3.2: Draw beam with proper line styles
                        // Edge beams: SOLID outside, DASHED inside
                        ctx.beginPath();

                        if (isTopEdge) {
                            // Top edge beam: TOP line = SOLID, BOTTOM line = DASHED
                            ctx.setLineDash([]);  // Solid for outer edge
                            ctx.moveTo(x1, beamTop); ctx.lineTo(x2, beamTop);  // Top (outer)
                            ctx.stroke();
                            ctx.beginPath();
                            ctx.setLineDash([dashLength, gapLength]);  // Dashed for inner
                            ctx.moveTo(x1, beamBottom); ctx.lineTo(x2, beamBottom);  // Bottom (inner/slab side)
                            ctx.moveTo(x1, beamTop); ctx.lineTo(x1, beamBottom);  // Left end
                            ctx.moveTo(x2, beamTop); ctx.lineTo(x2, beamBottom);  // Right end
                            ctx.stroke();
                        } else if (isBottomEdge) {
                            // Bottom edge beam: BOTTOM line = SOLID, TOP line = DASHED
                            ctx.setLineDash([]);  // Solid for outer edge
                            ctx.moveTo(x1, beamBottom); ctx.lineTo(x2, beamBottom);  // Bottom (outer)
                            ctx.stroke();
                            ctx.beginPath();
                            ctx.setLineDash([dashLength, gapLength]);  // Dashed for inner
                            ctx.moveTo(x1, beamTop); ctx.lineTo(x2, beamTop);  // Top (inner/slab side)
                            ctx.moveTo(x1, beamTop); ctx.lineTo(x1, beamBottom);  // Left end
                            ctx.moveTo(x2, beamTop); ctx.lineTo(x2, beamBottom);  // Right end
                            ctx.stroke();
                        } else {
                            // Interior beam: ALL dashed
                            ctx.setLineDash([dashLength, gapLength]);
                            ctx.strokeRect(x1, beamTop, x2 - x1, beamWidthPx);
                        }

                        // v3.1: Beam label ABOVE horizontal beam
                        const row = getGridRow(beam.y1);
                        const startCol = getGridCol(beam.x1);
                        const endCol = getGridCol(beam.x2);
                        const beamLabel = `B - ${ floorId } -${ startCol }${ row }${ endCol }${ row } `;
                        ctx.font = `${ beamLabelFontSize }px Arial`;
                        ctx.fillStyle = COLOR_TEXT;
                        ctx.textAlign = 'center';
                        const labelY = beamTop - beamLabelOffset;
                        ctx.setLineDash([]);
                        ctx.fillText(beamLabel, (x1 + x2) / 2, labelY);
                    } else {
                        // Vertical beam
                        let x1 = (beam.x1 + beamAlignOffset.offsetX) * state.scale + state.offsetX;
                        let y1 = (startPos.y + startTrim) * state.scale + state.offsetY;
                        let y2 = (endPos.y - endTrim) * state.scale + state.offsetY;

                        const beamLeft = x1 - beamWidthPx / 2;
                        const beamRight = x1 + beamWidthPx / 2;

                        // v3.2: Draw beam with proper line styles
                        ctx.beginPath();

                        if (isLeftEdge) {
                            // Left edge beam: LEFT line = SOLID, RIGHT line = DASHED
                            ctx.setLineDash([]);  // Solid for outer edge
                            ctx.moveTo(beamLeft, y1); ctx.lineTo(beamLeft, y2);  // Left (outer)
                            ctx.stroke();
                            ctx.beginPath();
                            ctx.setLineDash([dashLength, gapLength]);  // Dashed for inner
                            ctx.moveTo(beamRight, y1); ctx.lineTo(beamRight, y2);  // Right (inner/slab side)
                            ctx.moveTo(beamLeft, y1); ctx.lineTo(beamRight, y1);  // Top end
                            ctx.moveTo(beamLeft, y2); ctx.lineTo(beamRight, y2);  // Bottom end
                            ctx.stroke();
                        } else if (isRightEdge) {
                            // Right edge beam: RIGHT line = SOLID, LEFT line = DASHED
                            ctx.setLineDash([]);  // Solid for outer edge
                            ctx.moveTo(beamRight, y1); ctx.lineTo(beamRight, y2);  // Right (outer)
                            ctx.stroke();
                            ctx.beginPath();
                            ctx.setLineDash([dashLength, gapLength]);  // Dashed for inner
                            ctx.moveTo(beamLeft, y1); ctx.lineTo(beamLeft, y2);  // Left (inner/slab side)
                            ctx.moveTo(beamLeft, y1); ctx.lineTo(beamRight, y1);  // Top end
                            ctx.moveTo(beamLeft, y2); ctx.lineTo(beamRight, y2);  // Bottom end
                            ctx.stroke();
                        } else {
                            // Interior beam: ALL dashed
                            ctx.setLineDash([dashLength, gapLength]);
                            ctx.strokeRect(beamLeft, y1, beamWidthPx, y2 - y1);
                        }

                        // v3.2: Beam label LEFT of vertical beam (for all edge cases)
                        const col = getGridCol(beam.x1);
                        const startRow = getGridRow(beam.y1);
                        const endRow = getGridRow(beam.y2);
                        const beamLabel = `B - ${ floorId } -${ col }${ startRow }${ col }${ endRow } `;
                        ctx.font = `${ beamLabelFontSize }px Arial`;
                        ctx.fillStyle = COLOR_TEXT;
                        ctx.save();
                        ctx.translate(beamLeft - beamLabelOffset, (y1 + y2) / 2);
                        ctx.rotate(-Math.PI / 2);
                        ctx.textAlign = 'center';
                        ctx.setLineDash([]);
                        ctx.fillText(beamLabel, 0, 0);
                        ctx.restore();
                    }
                }
                ctx.setLineDash([]);  // Reset line dash after beams
            }

            // v3.1: Helper functions to get grid labels from coordinates
            function getGridCol(x) {
                const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
                let cumX = 0;
                for (let i = 0; i < state.xSpans.length; i++) {
                    if (Math.abs(x - cumX) < 0.1) return letters[i];
                    cumX += state.xSpans[i];
                }
                if (Math.abs(x - cumX) < 0.1) return letters[state.xSpans.length];
                return '?';
            }

            function getGridRow(y) {
                let cumY = 0;
                for (let i = 0; i < state.ySpans.length; i++) {
                    if (Math.abs(y - cumY) < 0.1) return (i + 1).toString();
                    cumY += state.ySpans[i];
                }
                if (Math.abs(y - cumY) < 0.1) return (state.ySpans.length + 1).toString();
                return '?';
            }

            function isFoundationBeamDeleted(direction, x1, y1, x2, y2) {
                const beam = state.beams.find(b =>
                    !b.isCustom &&
                    b.direction === direction &&
                    Math.abs(b.x1 - x1) < 0.01 &&
                    Math.abs(b.y1 - y1) < 0.01 &&
                    Math.abs(b.x2 - x2) < 0.01 &&
                    Math.abs(b.y2 - y2) < 0.01
                );
                return beam ? deletedBeams.includes(beam.id) : false;
            }

            // ===== COLUMNS (with ANSI31 hatch for regular, different for planted/terminated) =====
            if (layerVisibility.cols) {
                for (let col of state.columns) {
                    const colSize = getColumnSizeMm(col);
                    const colBM = colSize.b / 1000;
                    const colHM = colSize.h / 1000;
                    const colWPx = colBM * state.scale;
                    const colHPx = colHM * state.scale;
                    const colPos = getColumnPlanPosition(col);
                    const x = colPos.x * state.scale + state.offsetX;
                    const y = colPos.y * state.scale + state.offsetY;
                    const isActive = isColumnActiveOnFloor(col, currentFloorId);
                    const isDeleted = deletedColumns.includes(col.id);
                    const isPlanted = col.isPlanted || false;

                    const left = x - colWPx / 2;
                    const top = y - colHPx / 2;

                    if (isDeleted) {
                        // Deleted column - Red dashed outline
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([4, 4]);
                        ctx.strokeRect(left, top, colWPx, colHPx);
                        ctx.setLineDash([]);

                        // Red X
                        ctx.beginPath();
                        ctx.moveTo(left, top);
                        ctx.lineTo(left + colWPx, top + colHPx);
                        ctx.moveTo(left + colWPx, top);
                        ctx.lineTo(left, top + colHPx);
                        ctx.stroke();
                        continue;
                    }

                    if (!isActive) {
                        // v3.1: TERMINATED COLUMN - Hidden line (dashed), no hatch
                        ctx.strokeStyle = '#aaa';
                        ctx.lineWidth = 1;
                        ctx.setLineDash([4, 4]);
                        ctx.strokeRect(left, top, colWPx, colHPx);
                        ctx.setLineDash([]);
                    } else if (isPlanted) {
                        // v3.1: PLANTED COLUMN - Cross-hatch pattern (X pattern)
                        // Scale-relative hatch spacing
                        const baseScale = 50;
                        const hatchScaleFactor = Math.max(state.scale / baseScale, 0.5);

                        ctx.strokeStyle = COLOR_COL;
                        ctx.lineWidth = 1.5 * hatchScaleFactor;
                        ctx.strokeRect(left, top, colWPx, colHPx);

                        // Cross-hatch (both diagonals)
                        ctx.lineWidth = 0.5 * hatchScaleFactor;
                        const hatchSpacing = 4 * hatchScaleFactor;
                        ctx.beginPath();
                        for (let d = -colWPx - colHPx; d < colWPx + colHPx; d += hatchSpacing) {
                            // 45° lines
                            ctx.moveTo(left + d, top);
                            ctx.lineTo(left + d + colHPx, top + colHPx);
                            // -45° lines
                            ctx.moveTo(left + d + colHPx, top);
                            ctx.lineTo(left + d, top + colHPx);
                        }
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(left, top, colWPx, colHPx);
                        ctx.clip();
                        ctx.stroke();
                        ctx.restore();
                    } else {
                        // v3.1: REGULAR COLUMN - ANSI31 hatch (45° diagonal lines)
                        // Scale-relative hatch spacing
                        const baseScale = 50;
                        const hatchScaleFactor = Math.max(state.scale / baseScale, 0.5);

                        ctx.strokeStyle = COLOR_COL;
                        ctx.lineWidth = 1.5 * hatchScaleFactor;
                        ctx.strokeRect(left, top, colWPx, colHPx);

                        // ANSI31 diagonal hatch pattern (45° lines)
                        ctx.lineWidth = 0.5 * hatchScaleFactor;
                        const hatchSpacing = 3 * hatchScaleFactor;
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(left, top, colWPx, colHPx);
                        ctx.clip();

                        ctx.beginPath();
                        for (let d = -colWPx; d < colWPx + colHPx; d += hatchSpacing) {
                            ctx.moveTo(left + d, top);
                            ctx.lineTo(left + d + colHPx, top + colHPx);
                        }
                        ctx.stroke();
                        ctx.restore();
                    }

                    // Column ID label (only for active columns) - scale-relative
                    if (isActive) {
                        const baseScale = 50;
                        const colScaleFactor = Math.max(state.scale / baseScale, 0.5);
                        const colLabelFontSize = Math.round(8 * colScaleFactor);
                        const colLabelOffset = 10 * colScaleFactor;

                        ctx.fillStyle = COLOR_TEXT;
                        ctx.font = `${ colLabelFontSize }px Arial`;
                        ctx.textAlign = 'center';
                        ctx.fillText(col.id, x, y + colHPx / 2 + colLabelOffset);
                    }
                }
            }
        }

        // ========== MVP-010: SHARED PLAN GRID HELPER ==========
        function drawPlanGrid(title) {
            if (!ctx) return;
            const scaleFactor = Math.max(0.6, Math.min(2.0, state.scale / 50));
            const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
            const totalWidth = state.xSpans.reduce((a, b) => a + b, 0);
            const totalHeight = state.ySpans.reduce((a, b) => a + b, 0);

            // Background
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Title banner
            ctx.fillStyle = 'rgba(30, 58, 95, 0.92)';
            ctx.fillRect(0, 0, canvas.width, 32);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 13px Inter, Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(title, 12, 16);

            // Grid coordinates
            let xCoords = [0];
            for (let s of state.xSpans) xCoords.push(xCoords[xCoords.length - 1] + s);
            let yCoords = [0];
            for (let s of state.ySpans) yCoords.push(yCoords[yCoords.length - 1] + s);

            // Gridlines
            const bubbleR = 14 * scaleFactor;
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
            ctx.lineWidth = 0.8;
            ctx.setLineDash([6, 4]);
            xCoords.forEach((x, i) => {
                const px = x * state.scale + state.offsetX;
                ctx.beginPath(); ctx.moveTo(px, state.offsetY - 30); ctx.lineTo(px, totalHeight * state.scale + state.offsetY + 30); ctx.stroke();
                // Bubble
                const by = state.offsetY - 60;
                ctx.setLineDash([]);
                ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(px, by, bubbleR, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(12 * scaleFactor)}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(letters[i] || '', px, by);
                ctx.setLineDash([6, 4]);
            });
            yCoords.forEach((y, i) => {
                const py = y * state.scale + state.offsetY;
                ctx.beginPath(); ctx.moveTo(state.offsetX - 30, py); ctx.lineTo(totalWidth * state.scale + state.offsetX + 30, py); ctx.stroke();
                const bx = state.offsetX - 70;
                ctx.setLineDash([]);
                ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(bx, py, bubbleR, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(12 * scaleFactor)}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText((i + 1).toString(), bx, py);
                ctx.setLineDash([6, 4]);
            });
            ctx.setLineDash([]);

            // Dimension labels
            ctx.font = `bold ${Math.round(10 * scaleFactor)}px Inter`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#334155';
            for (let i = 0; i < state.xSpans.length; i++) {
                const x1 = xCoords[i] * state.scale + state.offsetX;
                const x2 = xCoords[i + 1] * state.scale + state.offsetX;
                const topY = state.offsetY - 38;
                ctx.strokeStyle = 'rgba(71,85,105,0.5)'; ctx.lineWidth = 0.8;
                ctx.beginPath(); ctx.moveTo(x1, topY); ctx.lineTo(x2, topY); ctx.stroke();
                ctx.fillText(state.xSpans[i].toFixed(1) + 'm', (x1 + x2) / 2, topY - 8);
            }
            for (let i = 0; i < state.ySpans.length; i++) {
                const y1 = yCoords[i] * state.scale + state.offsetY;
                const y2 = yCoords[i + 1] * state.scale + state.offsetY;
                const leftX = state.offsetX - 42;
                ctx.strokeStyle = 'rgba(71,85,105,0.5)'; ctx.lineWidth = 0.8;
                ctx.beginPath(); ctx.moveTo(leftX, y1); ctx.lineTo(leftX, y2); ctx.stroke();
                ctx.save(); ctx.translate(leftX - 8, (y1 + y2) / 2); ctx.rotate(-Math.PI / 2);
                ctx.fillText(state.ySpans[i].toFixed(1) + 'm', 0, 0); ctx.restore();
            }

            return { xCoords, yCoords, scaleFactor, totalWidth, totalHeight };
        }

        // ========== MVP-010: BEAM TRIBUTARY PLAN VIEW ==========
        function drawBeamTributaryPlan() {
            const grid = drawPlanGrid('Beam Tributary — Line Loads & Reactions');
            if (!grid) return;
            const { xCoords, yCoords, scaleFactor } = grid;
            const currentFloor = state.floors[state.currentFloorIndex];
            const deletedBeams = currentFloor?.deletedBeams || [];

            // Slab fills (light)
            for (let slab of state.slabs) {
                if (slab.isVoid) continue;
                const x1 = slab.x1 * state.scale + state.offsetX;
                const y1 = slab.y1 * state.scale + state.offsetY;
                const w = (slab.lx || slab.width) * state.scale;
                const h = (slab.ly || slab.height) * state.scale;
                ctx.fillStyle = 'rgba(200, 220, 240, 0.2)';
                ctx.fillRect(x1, y1, w, h);
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'; ctx.lineWidth = 0.5;
                ctx.strokeRect(x1, y1, w, h);
            }

            // Column markers (small gray squares)
            for (let col of state.columns) {
                if (col.active === false) continue;
                const pos = getColumnPlanPosition(col);
                const px = pos.x * state.scale + state.offsetX;
                const py = pos.y * state.scale + state.offsetY;
                const sz = 6 * scaleFactor;
                ctx.fillStyle = '#64748b'; ctx.fillRect(px - sz, py - sz, sz * 2, sz * 2);
            }

            // Find max load for color scaling
            const allBeams = state.beams || [];
            let maxW = 1;
            allBeams.forEach(b => { if (b.totalLineLoad > maxW) maxW = b.totalLineLoad; });

            // Draw beams with load intensity
            const fontSize = Math.max(8, Math.round(9 * scaleFactor));
            for (let beam of allBeams) {
                if (beam.deleted || deletedBeams.includes(beam.id)) continue;
                const startCol = state.columns.find(c => c.id === beam.startCol);
                const endCol = state.columns.find(c => c.id === beam.endCol);
                if (!startCol || !endCol) continue;
                const sp = getColumnPlanPosition(startCol);
                const ep = getColumnPlanPosition(endCol);
                const sx = sp.x * state.scale + state.offsetX;
                const sy = sp.y * state.scale + state.offsetY;
                const ex = ep.x * state.scale + state.offsetX;
                const ey = ep.y * state.scale + state.offsetY;

                // Load intensity color (blue→orange→red)
                const w = beam.totalLineLoad || beam.w || 0;
                const ratio = maxW > 0 ? Math.min(w / maxW, 1) : 0;
                const r = Math.round(30 + 200 * ratio);
                const g = Math.round(120 - 60 * ratio);
                const b2 = Math.round(200 - 180 * ratio);
                const lineW = Math.max(3, 2 + 6 * ratio) * scaleFactor;

                ctx.strokeStyle = `rgb(${r},${g},${b2})`;
                ctx.lineWidth = lineW;
                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

                // Beam ID label
                const mx = (sx + ex) / 2, my = (sy + ey) / 2;
                const isX = beam.direction === 'X';
                ctx.save();
                ctx.font = `bold ${fontSize}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                // Background pill
                const id = beam.id || '';
                const idStr = typeof id === 'number' ? `BX-${id}` : id;
                const tw = ctx.measureText(idStr).width + 8;
                const labelOff = isX ? -lineW - 10 : lineW + 10;
                const lx = mx + (isX ? 0 : labelOff), ly = my + (isX ? labelOff : 0);
                ctx.fillStyle = 'rgba(255,255,255,0.88)';
                ctx.fillRect(lx - tw / 2, ly - fontSize / 2 - 2, tw, fontSize + 4);
                ctx.fillStyle = '#1e3a5f'; ctx.fillText(idStr, lx, ly);

                // Line load label
                const wStr = w > 0 ? `w=${w.toFixed(1)} kN/m` : 'w=TBD';
                const tw2 = ctx.measureText(wStr).width + 6;
                const ly2 = ly + fontSize + 4;
                ctx.font = `${fontSize - 1}px Inter`;
                ctx.fillStyle = 'rgba(255,255,255,0.85)';
                ctx.fillRect(lx - tw2 / 2, ly2 - fontSize / 2, tw2, fontSize + 2);
                ctx.fillStyle = w > 0 ? '#b45309' : '#94a3b8'; ctx.fillText(wStr, lx, ly2);

                // Reaction arrows at ends
                const arrowLen = 12 * scaleFactor;
                ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2 * scaleFactor;
                // Left reaction
                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + arrowLen); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(sx - 3, sy + arrowLen - 4); ctx.lineTo(sx, sy + arrowLen); ctx.lineTo(sx + 3, sy + arrowLen - 4); ctx.stroke();
                if (beam.Rleft !== undefined) {
                    ctx.font = `bold ${Math.max(7, fontSize - 2)}px Inter`;
                    ctx.fillStyle = '#10b981';
                    ctx.textAlign = 'left';
                    ctx.fillText(`${beam.Rleft.toFixed(1)} kN`, sx + 4, sy + arrowLen / 2);
                }

                // Right reaction
                ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex, ey + arrowLen); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(ex - 3, ey + arrowLen - 4); ctx.lineTo(ex, ey + arrowLen); ctx.lineTo(ex + 3, ey + arrowLen - 4); ctx.stroke();
                if (beam.Rright !== undefined) {
                    ctx.font = `bold ${Math.max(7, fontSize - 2)}px Inter`;
                    ctx.fillStyle = '#10b981';
                    ctx.textAlign = 'left';
                    ctx.fillText(`${beam.Rright.toFixed(1)} kN`, ex + 4, ey + arrowLen / 2);
                }

                ctx.restore();
            }
        }

        // ========== MVP-010c: COLUMN TRIBUTARY PLAN VIEW (Real Structural Sketch) ==========
        function drawColumnTributaryPlan() {
            const grid = drawPlanGrid('Column Tributary Areas — Load Takedown');
            if (!grid) return;
            const { xCoords, yCoords, scaleFactor } = grid;
            const fontSize = Math.max(8, Math.round(9 * scaleFactor));
            const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

            // Build mid-span coordinate arrays (boundaries between tributary zones)
            // Mid-X: halfway between each pair of X gridlines, plus 0 and totalWidth
            const midX = [0];
            for (let i = 0; i < state.xSpans.length; i++) {
                midX.push(xCoords[i] + state.xSpans[i] / 2);
            }
            midX.push(xCoords[xCoords.length - 1]); // last gridline = boundary

            const midY = [0];
            for (let i = 0; i < state.ySpans.length; i++) {
                midY.push(yCoords[i] + state.ySpans[i] / 2);
            }
            midY.push(yCoords[yCoords.length - 1]);

            // Color palette for tributary zones (soft, distinct per column)
            const tribColors = [
                'rgba(59, 130, 246, 0.14)',   // blue
                'rgba(16, 185, 129, 0.14)',   // green
                'rgba(245, 158, 11, 0.14)',   // amber
                'rgba(239, 68, 68, 0.12)',    // red
                'rgba(139, 92, 246, 0.14)',   // violet
                'rgba(236, 72, 153, 0.12)',   // pink
                'rgba(20, 184, 166, 0.14)',   // teal
                'rgba(251, 146, 60, 0.14)',   // orange
                'rgba(99, 102, 241, 0.14)',   // indigo
            ];
            const tribStrokeColors = [
                'rgba(59, 130, 246, 0.45)',
                'rgba(16, 185, 129, 0.45)',
                'rgba(245, 158, 11, 0.45)',
                'rgba(239, 68, 68, 0.4)',
                'rgba(139, 92, 246, 0.45)',
                'rgba(236, 72, 153, 0.4)',
                'rgba(20, 184, 166, 0.45)',
                'rgba(251, 146, 60, 0.45)',
                'rgba(99, 102, 241, 0.45)',
            ];

            // Draw tributary area regions for each column
            let colIndex = 0;
            for (let col of state.columns) {
                if (col.active === false) continue;
                const pos = getColumnPlanPosition(col);

                // Find the column's grid indices
                let xi = -1, yi = -1;
                for (let i = 0; i < xCoords.length; i++) {
                    if (Math.abs(pos.x - xCoords[i]) < 0.05) { xi = i; break; }
                }
                for (let i = 0; i < yCoords.length; i++) {
                    if (Math.abs(pos.y - yCoords[i]) < 0.05) { yi = i; break; }
                }
                if (xi < 0 || yi < 0) { colIndex++; continue; }

                // Tributary boundaries: half-span to adjacent gridlines in each direction
                const leftBound = xi === 0 ? xCoords[0] : xCoords[xi] - state.xSpans[xi - 1] / 2;
                const rightBound = xi === xCoords.length - 1 ? xCoords[xi] : xCoords[xi] + state.xSpans[xi] / 2;
                const topBound = yi === 0 ? yCoords[0] : yCoords[yi] - state.ySpans[yi - 1] / 2;
                const bottomBound = yi === yCoords.length - 1 ? yCoords[yi] : yCoords[yi] + state.ySpans[yi] / 2;

                // Convert to pixels
                const lx = leftBound * state.scale + state.offsetX;
                const rx = rightBound * state.scale + state.offsetX;
                const ty = topBound * state.scale + state.offsetY;
                const by = bottomBound * state.scale + state.offsetY;
                const tw = rx - lx;
                const th = by - ty;

                // Tributary area in m²
                const tribArea = (rightBound - leftBound) * (bottomBound - topBound);

                // Fill tributary zone with color
                const ci = colIndex % tribColors.length;
                ctx.fillStyle = tribColors[ci];
                ctx.fillRect(lx, ty, tw, th);

                // Draw tributary boundary (dashed)
                ctx.strokeStyle = tribStrokeColors[ci];
                ctx.lineWidth = 1.5 * scaleFactor;
                ctx.setLineDash([6 * scaleFactor, 4 * scaleFactor]);
                ctx.strokeRect(lx, ty, tw, th);
                ctx.setLineDash([]);

                // Diagonal hatching inside tributary zone (light, 45°)
                ctx.save();
                ctx.beginPath();
                ctx.rect(lx, ty, tw, th);
                ctx.clip();
                ctx.strokeStyle = tribStrokeColors[ci];
                ctx.lineWidth = 0.4 * scaleFactor;
                const hatchSpacing = 18 * scaleFactor;
                ctx.beginPath();
                for (let d = -tw; d < tw + th; d += hatchSpacing) {
                    ctx.moveTo(lx + d, ty);
                    ctx.lineTo(lx + d + th, ty + th);
                }
                ctx.stroke();
                ctx.restore();

                // Tributary area label (centered in zone)
                const cx = (lx + rx) / 2;
                const cy = (ty + by) / 2;
                const areaStr = `${tribArea.toFixed(1)} m²`;
                ctx.font = `bold ${fontSize}px Inter`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                const atw = ctx.measureText(areaStr).width + 10;
                ctx.fillStyle = 'rgba(255,255,255,0.85)';
                ctx.fillRect(cx - atw / 2, cy + 14 * scaleFactor, atw, fontSize + 4);
                ctx.fillStyle = '#475569';
                ctx.fillText(areaStr, cx, cy + 14 * scaleFactor + (fontSize + 4) / 2);

                colIndex++;
            }

            // Draw mid-span boundary lines across the full plan (dashed red)
            ctx.strokeStyle = 'rgba(220, 38, 38, 0.35)';
            ctx.lineWidth = 1 * scaleFactor;
            ctx.setLineDash([4 * scaleFactor, 4 * scaleFactor]);
            // Vertical mid-span lines
            for (let i = 0; i < state.xSpans.length; i++) {
                const mx = (xCoords[i] + state.xSpans[i] / 2) * state.scale + state.offsetX;
                const yTop = yCoords[0] * state.scale + state.offsetY - 10;
                const yBot = yCoords[yCoords.length - 1] * state.scale + state.offsetY + 10;
                ctx.beginPath(); ctx.moveTo(mx, yTop); ctx.lineTo(mx, yBot); ctx.stroke();
            }
            // Horizontal mid-span lines
            for (let i = 0; i < state.ySpans.length; i++) {
                const my = (yCoords[i] + state.ySpans[i] / 2) * state.scale + state.offsetY;
                const xLeft = xCoords[0] * state.scale + state.offsetX - 10;
                const xRight = xCoords[xCoords.length - 1] * state.scale + state.offsetX + 10;
                ctx.beginPath(); ctx.moveTo(xLeft, my); ctx.lineTo(xRight, my); ctx.stroke();
            }
            ctx.setLineDash([]);

            // Draw beam lines (solid, subtle)
            const currentFloor = state.floors[state.currentFloorIndex];
            const deletedBeams = currentFloor?.deletedBeams || [];
            for (let beam of (state.beams || [])) {
                if (beam.deleted || deletedBeams.includes(beam.id)) continue;
                const sc = state.columns.find(c => c.id === beam.startCol);
                const ec = state.columns.find(c => c.id === beam.endCol);
                if (!sc || !ec) continue;
                const sp = getColumnPlanPosition(sc), ep = getColumnPlanPosition(ec);
                ctx.strokeStyle = 'rgba(30, 58, 95, 0.35)'; ctx.lineWidth = 2 * scaleFactor;
                ctx.beginPath();
                ctx.moveTo(sp.x * state.scale + state.offsetX, sp.y * state.scale + state.offsetY);
                ctx.lineTo(ep.x * state.scale + state.offsetX, ep.y * state.scale + state.offsetY);
                ctx.stroke();
            }

            // Draw column markers on top (hatched squares like structural plan)
            let maxLoad = 1;
            state.columns.forEach(c => { const l = c.totalLoad || 0; if (l > maxLoad) maxLoad = l; });

            for (let col of state.columns) {
                if (col.active === false) continue;
                const pos = getColumnPlanPosition(col);
                const px = pos.x * state.scale + state.offsetX;
                const py = pos.y * state.scale + state.offsetY;
                const load = col.totalLoad || 0;

                // Column type classification
                const totalWidth = state.xSpans.reduce((a, b) => a + b, 0);
                const totalHeight = state.ySpans.reduce((a, b) => a + b, 0);
                const onLeft = Math.abs(pos.x) < 0.05;
                const onRight = Math.abs(pos.x - totalWidth) < 0.05;
                const onTop = Math.abs(pos.y) < 0.05;
                const onBottom = Math.abs(pos.y - totalHeight) < 0.05;
                const isCorner = (onLeft || onRight) && (onTop || onBottom);
                const isEdge = !isCorner && (onLeft || onRight || onTop || onBottom);
                let colType = isCorner ? 'Corner' : isEdge ? 'Edge' : 'Interior';

                // Column marker (filled square with hatch)
                const colSz = 8 * scaleFactor;
                ctx.fillStyle = '#1e3a5f';
                ctx.fillRect(px - colSz, py - colSz, colSz * 2, colSz * 2);
                // Hatch
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8;
                ctx.beginPath();
                for (let d = -colSz * 2; d < colSz * 2; d += 3 * scaleFactor) {
                    ctx.moveTo(px - colSz + d, py - colSz);
                    ctx.lineTo(px - colSz + d + colSz * 2, py + colSz);
                }
                ctx.save(); ctx.beginPath();
                ctx.rect(px - colSz, py - colSz, colSz * 2, colSz * 2);
                ctx.clip();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.6;
                ctx.beginPath();
                for (let d = -colSz * 2; d < colSz * 4; d += 3 * scaleFactor) {
                    ctx.moveTo(px - colSz + d, py - colSz);
                    ctx.lineTo(px - colSz + d + colSz * 2, py + colSz);
                }
                ctx.stroke(); ctx.restore();

                // Column ID label
                ctx.font = `bold ${fontSize}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = 'rgba(255,255,255,0.92)';
                const idStr = col.id;
                const idW = ctx.measureText(idStr).width + 8;
                ctx.fillRect(px - idW / 2, py - colSz - fontSize - 6, idW, fontSize + 4);
                ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 0.6;
                ctx.strokeRect(px - idW / 2, py - colSz - fontSize - 6, idW, fontSize + 4);
                ctx.fillStyle = '#1e3a5f';
                ctx.fillText(idStr, px, py - colSz - fontSize / 2 - 4);

                // Type + Load label below
                const loadStr = load > 0 ? `${colType} · ${load.toFixed(0)} kN` : `${colType} · TBD`;
                ctx.font = `${fontSize - 1}px Inter`;
                const lw = ctx.measureText(loadStr).width + 8;
                ctx.fillStyle = 'rgba(255,255,255,0.88)';
                ctx.fillRect(px - lw / 2, py + colSz + 3, lw, fontSize + 2);
                ctx.fillStyle = load > 0 ? '#b45309' : '#94a3b8';
                ctx.fillText(loadStr, px, py + colSz + 3 + (fontSize + 2) / 2);
            }

            // Legend
            ctx.font = `${fontSize - 1}px Inter`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            const legY = 44;
            ctx.fillStyle = 'rgba(220, 38, 38, 0.5)'; ctx.fillRect(12, legY - 1, 20, 2);
            ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(220, 38, 38, 0.5)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(12, legY); ctx.lineTo(32, legY); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = '#475569'; ctx.fillText('Mid-span boundary (tributary limit)', 38, legY);

            ctx.fillStyle = tribColors[0]; ctx.fillRect(12, legY + 16, 20, 12);
            ctx.strokeStyle = tribStrokeColors[0]; ctx.lineWidth = 1; ctx.strokeRect(12, legY + 16, 20, 12);
            ctx.fillStyle = '#475569'; ctx.fillText('Tributary area zone (per column)', 38, legY + 22);
        }

        // ========== MVP-010d: BASE REACTIONS PLAN VIEW (Industry Standard) ==========
        function drawReactionsPlan() {
            const grid = drawPlanGrid(`Base Reactions — ${state.numFloors || state.floors.length} Storey Cumulative`);
            if (!grid) return;
            const { xCoords, yCoords, scaleFactor } = grid;
            const numFloors = state.numFloors || state.floors.length || 1;
            const fontSize = Math.max(9, Math.round(10 * scaleFactor));

            // Beam lines (subtle structural frame context)
            for (let beam of (state.beams || [])) {
                if (beam.deleted) continue;
                const sc = state.columns.find(c => c.id === beam.startCol);
                const ec = state.columns.find(c => c.id === beam.endCol);
                if (!sc || !ec) continue;
                const sp = getColumnPlanPosition(sc), ep = getColumnPlanPosition(ec);
                ctx.strokeStyle = 'rgba(30, 58, 95, 0.2)'; ctx.lineWidth = 2 * scaleFactor;
                ctx.beginPath();
                ctx.moveTo(sp.x * state.scale + state.offsetX, sp.y * state.scale + state.offsetY);
                ctx.lineTo(ep.x * state.scale + state.offsetX, ep.y * state.scale + state.offsetY);
                ctx.stroke();
            }

            // Collect reactions data
            let maxP = 1, totalP = 0, colCount = 0;
            const supportCols = [];
            for (let col of state.columns) {
                if (col.active === false) continue;
                if (col.startFloor || col.isPlanted) continue;
                const P = col.totalLoadWithDL || col.totalLoad || 0;
                if (P > maxP) maxP = P;
                totalP += P;
                colCount++;
                supportCols.push(col);
            }

            // Draw each support node
            for (let col of supportCols) {
                const pos = getColumnPlanPosition(col);
                const px = pos.x * state.scale + state.offsetX;
                const py = pos.y * state.scale + state.offsetY;
                const P = col.totalLoadWithDL || col.totalLoad || 0;
                const perFloor = col.loadPerFloor || 0;
                const selfWt = col.selfWeight || 0;
                const ratio = maxP > 0 ? Math.min(P / maxP, 1) : 0;

                // === Column stub (hatched square like structural plans) ===
                const colSz = 7 * scaleFactor;
                ctx.fillStyle = '#1e3a5f';
                ctx.fillRect(px - colSz, py - colSz, colSz * 2, colSz * 2);
                ctx.save();
                ctx.beginPath();
                ctx.rect(px - colSz, py - colSz, colSz * 2, colSz * 2);
                ctx.clip();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5;
                ctx.beginPath();
                for (let d = -colSz * 2; d < colSz * 4; d += 3 * scaleFactor) {
                    ctx.moveTo(px - colSz + d, py - colSz);
                    ctx.lineTo(px - colSz + d + colSz * 2, py + colSz);
                }
                ctx.stroke();
                ctx.restore();

                // === Column ID label (above column stub) ===
                ctx.font = `bold ${fontSize}px Inter`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                const idStr = col.id;
                const idW = ctx.measureText(idStr).width + 10;
                const idY = py - colSz - fontSize - 2;
                ctx.fillStyle = 'rgba(255,255,255,0.92)';
                ctx.fillRect(px - idW / 2, idY - fontSize / 2 - 2, idW, fontSize + 4);
                ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 0.8;
                ctx.strokeRect(px - idW / 2, idY - fontSize / 2 - 2, idW, fontSize + 4);
                ctx.fillStyle = '#1e3a5f';
                ctx.fillText(idStr, px, idY);

                // === Reaction annotation box (right side of support) ===
                const boxX = px + colSz + 8 * scaleFactor;
                const boxY = py - 8 * scaleFactor;
                const smallFont = Math.max(7, fontSize - 2);
                ctx.font = `${smallFont}px Inter`;
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';

                // Build annotation lines
                const lines = [];
                lines.push({ text: `P = ${P.toFixed(1)} kN`, bold: true, color: '#b91c1c' });
                if (numFloors > 1) {
                    lines.push({ text: `(${perFloor.toFixed(1)} kN/floor × ${numFloors}F)`, bold: false, color: '#64748b' });
                }
                if (selfWt > 0) {
                    lines.push({ text: `Col SW = ${(selfWt * numFloors).toFixed(1)} kN`, bold: false, color: '#64748b' });
                }
                lines.push({ text: `Vx, Vy = solver`, bold: false, color: '#94a3b8' });
                lines.push({ text: `Mx, My = solver`, bold: false, color: '#94a3b8' });

                // Background box
                let maxTextW = 0;
                lines.forEach(l => {
                    ctx.font = l.bold ? `bold ${smallFont}px Inter` : `${smallFont}px Inter`;
                    const tw = ctx.measureText(l.text).width;
                    if (tw > maxTextW) maxTextW = tw;
                });
                const boxW = maxTextW + 10;
                const lineH = smallFont + 3;
                const boxH = lines.length * lineH + 6;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
                ctx.fillRect(boxX, boxY, boxW, boxH);
                ctx.strokeStyle = 'rgba(30, 58, 95, 0.3)'; ctx.lineWidth = 0.6;
                ctx.strokeRect(boxX, boxY, boxW, boxH);

                // Annotation text
                lines.forEach((l, i) => {
                    ctx.font = l.bold ? `bold ${smallFont}px Inter` : `${smallFont}px Inter`;
                    ctx.fillStyle = l.color;
                    ctx.fillText(l.text, boxX + 5, boxY + 3 + i * lineH);
                });
            }

            // === Summary info box (top-right of canvas) ===
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            const infoX = canvas.width - 240;
            const infoY = 42;
            ctx.fillStyle = 'rgba(30, 58, 95, 0.06)';
            ctx.fillRect(infoX, infoY, 230, 82);
            ctx.strokeStyle = 'rgba(30, 58, 95, 0.2)'; ctx.lineWidth = 0.8;
            ctx.strokeRect(infoX, infoY, 230, 82);

            ctx.font = `bold ${fontSize}px Inter`; ctx.fillStyle = '#1e3a5f';
            ctx.fillText('REACTION SUMMARY', infoX + 8, infoY + 6);

            ctx.font = `${fontSize - 1}px Inter`; ctx.fillStyle = '#475569';
            ctx.fillText(`Floors: ${numFloors} (${state.floors.map(f => f.id).join(' + ')})`, infoX + 8, infoY + 22);
            ctx.fillText(`Supports: ${colCount}`, infoX + 8, infoY + 36);
            ctx.fillText(`ΣP = ${totalP.toFixed(1)} kN (all supports)`, infoX + 8, infoY + 50);
            ctx.fillText(`P range: ${supportCols.length ? Math.min(...supportCols.map(c => c.totalLoadWithDL || c.totalLoad || 0)).toFixed(0) : 0} — ${maxP.toFixed(0)} kN`, infoX + 8, infoY + 64);

            // === Legend ===
            const legY = 44;
            ctx.font = `${fontSize - 1}px Inter`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';

            // Support symbol legend (Hatched Square)
            ctx.fillStyle = '#1e3a5f';
            ctx.fillRect(12, legY - 4, 8, 8);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(10, legY - 4); ctx.lineTo(18, legY + 4);
            ctx.moveTo(14, legY - 4); ctx.lineTo(22, legY + 4);
            ctx.stroke();
            ctx.fillStyle = '#475569'; ctx.fillText('Base Support / Column Stub (Plan View)', 28, legY);

            // Reaction load text legend
            ctx.font = `bold ${fontSize - 1}px Inter`;
            ctx.fillStyle = '#b91c1c';
            ctx.fillText('P', 12, legY + 16);
            ctx.font = `${fontSize - 1}px Inter`;
            ctx.fillStyle = '#475569'; ctx.fillText(`= Cumulative vertical reaction P (${numFloors}F)`, 24, legY + 16);
        }

        // ========== v2.4: THREE.JS 3D VIEW ==========
        let scene3D, camera3D, renderer3D, controls3D;
        let meshes3D = [];
        let memberInfo3D = null;
        let view3DInitialized = false;

        const VIEW3D_COLORS = {
            backgroundDark: 0x111827,
            backgroundLight: 0xf5f7fa,
            backgroundBlueprint: 0xf3f4ee,
            groundDark: 0x1f2937,
            groundLight: 0xe5e7eb,
            gridLine: 0x94a3b8,
            gridBubble: 0x334155,
            column: 0x334155,
            plantedColumn: 0x5b6472,
            beam: 0x475569,
            cantileverBeam: 0x64748b,
            edgeBeam: 0x3f6f7a,
            customBeam: 0x8a6f3d,
            slab: 0x7dd3fc,
            oneWaySlab: 0xa5b4fc,
            footing: 0x9ca3af,
            pedestal: 0x6b7280,
            tieBeam: 0x70757f
        };

        function get3DThemeBackground() {
            const theme = document.documentElement.getAttribute('data-theme') || 'dark';
            if (theme === 'light') return VIEW3D_COLORS.backgroundLight;
            if (theme === 'blueprint') return VIEW3D_COLORS.backgroundBlueprint;
            return VIEW3D_COLORS.backgroundDark;
        }

        function clone3DArray(items) {
            return (items || []).map(item => ({
                ...item,
                slices: Array.isArray(item.slices) ? item.slices.map(slice => ({ ...slice })) : item.slices
            }));
        }

        function collect3DFloorGeometry() {
            const originalBeams = Array.isArray(state.beams) ? state.beams : [];
            const originalSlabs = Array.isArray(state.slabs) ? state.slabs : [];
            const originalTotalColumnSelfWeight = state.totalColumnSelfWeight;
            const originalTotalBeamSelfWeight = state.totalBeamSelfWeight;
            const originalTotalOpeningArea = state.totalOpeningArea;
            const floorGeometry = new Map();

            try {
                state.floors.forEach(floor => {
                    const slabWeight = 24 * ((floor.slabThickness || 150) / 1000);
                    const pu = 1.2 * ((floor.dlSuper || 0) + slabWeight) + 1.6 * (floor.liveLoad || 0);
                    if (typeof generateSlabs === 'function') generateSlabs(floor.id);
                    if (typeof generateBeams === 'function') generateBeams(pu, floor.wallLoad || 0, floor);
                    if (typeof sizeMembers === 'function') sizeMembers();
                    if (typeof calculateBeamReactions === 'function') calculateBeamReactions();

                    const deletedBeams = new Set(floor.deletedBeams || []);
                    const voidSlabs = new Set(floor.voidSlabs || []);

                    floorGeometry.set(floor.id, {
                        beams: clone3DArray(state.beams).filter(beam => !deletedBeams.has(beam.id)),
                        slabs: clone3DArray(state.slabs).filter(slab => !voidSlabs.has(slab.id))
                    });
                });
            } finally {
                state.beams = originalBeams;
                state.slabs = originalSlabs;
                state.totalColumnSelfWeight = originalTotalColumnSelfWeight;
                state.totalBeamSelfWeight = originalTotalBeamSelfWeight;
                state.totalOpeningArea = originalTotalOpeningArea;
            }

            return floorGeometry;
        }

        function get3DColumnSize(col) {
            const size = getColumnSizeMm(col);
            return { b: size.b / 1000, d: size.h / 1000 };
        }

        function getColumnTrimAlongBeam(col, direction) {
            if (!col) return 0;
            const size = get3DColumnSize(col);
            return ((direction === 'X') ? size.b : size.d) / 2;
        }

        function getRenderedBeamSegment(beam, startCol, endCol) {
            const x1 = Number(beam.x1) || 0;
            const y1 = Number(beam.y1) || 0;
            const x2 = Number(beam.x2) || 0;
            const y2 = Number(beam.y2) || 0;
            const startPos = startCol ? getColumnPlanPosition(startCol) : { x: x1, y: y1 };
            const endPos = endCol ? getColumnPlanPosition(endCol) : { x: x2, y: y2 };
            const rawLength = Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y);
            if (rawLength <= 0) {
                return { length: 0.1, midX: startPos.x, midY: startPos.y };
            }

            const ux = (endPos.x - startPos.x) / rawLength;
            const uy = (endPos.y - startPos.y) / rawLength;
            const startTrim = getColumnTrimAlongBeam(startCol, beam.direction);
            const endTrim = getColumnTrimAlongBeam(endCol, beam.direction);
            const sx = startPos.x + ux * startTrim;
            const sy = startPos.y + uy * startTrim;
            const ex = endPos.x - ux * endTrim;
            const ey = endPos.y - uy * endTrim;
            const length = Math.max(0.1, Math.hypot(ex - sx, ey - sy));

            return {
                length,
                midX: (sx + ex) / 2,
                midY: (sy + ey) / 2
            };
        }

        function format3DMetric(value, unit = '', decimals = 2) {
            const n = Number(value);
            if (!Number.isFinite(n)) return '-';
            return `${n.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
        }

        function escapeInfoText(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function getFloorDisplayName(floorId) {
            const floor = state.floors.find(f => f.id === floorId);
            return floor?.name || floor?.label || floorId || '-';
        }

        function build3DMemberInfo(userData) {
            const data = userData || {};
            const member = data.member || {};
            const rows = [];
            const typeLabel = String(data.type || 'member').replace(/([A-Z])/g, ' $1').toUpperCase();

            rows.push(['Floor', getFloorDisplayName(data.floorId)]);

            if (data.type === 'column') {
                rows.push(['Class', member.isPlanted ? 'planted' : (member.type || 'column')]);
                rows.push(['Size B x H', `${member.webB || member.suggestedB || 300} x ${member.webD || member.suggestedH || member.webB || member.suggestedB || 300} mm`]);
                rows.push(['Load', format3DMetric(member.totalLoad || member.floorLoad || 0, 'kN', 1)]);
            } else if (data.type === 'beam' || data.type === 'customBeam' || data.type === 'elevatedBeam' || data.type === 'tieBeam') {
                const beamClass = member.isCantilever ? `cantilever ${member.cantileverEdge || ''}` :
                    member.isEdgeBeam ? `edge ${member.cantileverEdge || ''}` :
                        data.type === 'customBeam' ? 'custom' : member.direction || 'beam';
                rows.push(['Class', beamClass.trim()]);
                rows.push(['Span', format3DMetric(member.span || member.length, 'm', 2)]);
                rows.push(['Size B x H', `${member.webW || member.suggestedB || 250} x ${member.webD || member.suggestedH || 500} mm`]);
                if (Number.isFinite(Number(member.w))) rows.push(['w', format3DMetric(member.w, 'kN/m', 2)]);
                if (Number.isFinite(Number(member.Rleft)) || Number.isFinite(Number(member.Rright))) {
                    rows.push(['R left/right', `${format3DMetric(member.Rleft || 0, 'kN', 1)} / ${format3DMetric(member.Rright || 0, 'kN', 1)}`]);
                }
            } else if (data.type === 'slab') {
                rows.push(['Class', member.isCantilever ? `cantilever ${member.cantileverEdge || ''}` : (member.isTwoWay ? 'two-way' : 'one-way')]);
                rows.push(['Panel', `${format3DMetric(member.lx, 'm', 2)} x ${format3DMetric(member.ly, 'm', 2)}`]);
                rows.push(['Area', format3DMetric(member.netArea || member.area, 'm2', 2)]);
                rows.push(['Thickness', `${member.thicknessMm || 150} mm`]);
            } else if (data.type === 'footing') {
                rows.push(['Column', member.columnId || data.id]);
                rows.push(['Size', format3DMetric(member.size, 'm', 2)]);
                rows.push(['Thickness', format3DMetric(member.thick, 'm', 2)]);
            }

            const rowHtml = rows.map(([label, value]) => `
                <div class="info-row">
                    <span class="info-label">${escapeInfoText(label)}</span>
                    <span class="info-value">${escapeInfoText(value)}</span>
                </div>
            `).join('');

            return `<div class="info-title">${escapeInfoText(typeLabel)} ${escapeInfoText(data.id || '')}</div>${rowHtml}`;
        }

        function show3DMemberInfo(event, userData) {
            const container = document.getElementById('container3D');
            if (!container) return;

            if (!memberInfo3D) {
                memberInfo3D = document.createElement('div');
                memberInfo3D.className = 'member-info-3d';
                memberInfo3D.style.display = 'none';
                container.appendChild(memberInfo3D);
            }

            memberInfo3D.innerHTML = build3DMemberInfo(userData);
            memberInfo3D.style.display = 'block';

            const rect = container.getBoundingClientRect();
            const popupRect = memberInfo3D.getBoundingClientRect();
            const left = Math.min(event.clientX - rect.left + 14, Math.max(8, rect.width - popupRect.width - 8));
            const top = Math.min(event.clientY - rect.top + 14, Math.max(8, rect.height - popupRect.height - 8));
            memberInfo3D.style.left = `${Math.max(8, left)}px`;
            memberInfo3D.style.top = `${Math.max(8, top)}px`;
        }

        function hide3DMemberInfo() {
            if (memberInfo3D) memberInfo3D.style.display = 'none';
        }

        function init3D() {
            if (view3DInitialized) return;

            const container = document.getElementById('container3D');

            // Scene
            scene3D = new THREE.Scene();
            scene3D.background = new THREE.Color(get3DThemeBackground());

            // Camera
            camera3D = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
            camera3D.position.set(25, 30, 25);
            camera3D.lookAt(0, 5, 0);

            // Renderer
            renderer3D = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
            renderer3D.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
            renderer3D.setSize(container.clientWidth, container.clientHeight);
            renderer3D.outputEncoding = THREE.sRGBEncoding;

            // v3.0 FIX: Set initial background color based on current theme
            renderer3D.setClearColor(get3DThemeBackground());

            container.appendChild(renderer3D.domElement);

            // Orbit Controls - v3.0: Restored to default (LEFT = rotate, like v2.8)
            controls3D = new THREE.OrbitControls(camera3D, renderer3D.domElement);
            controls3D.enableDamping = true;
            controls3D.dampingFactor = 0.04;
            controls3D.target.set(0, 5, 0);

            // Lights
            scene3D.add(new THREE.AmbientLight(0xffffff, 0.72));
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.62);
            dirLight.position.set(20, 30, 20);
            scene3D.add(dirLight);

            // v3.0: Raycaster for 3D click detection
            const raycaster3D = new THREE.Raycaster();
            const mouse3D = new THREE.Vector2();

            // ========== v3.0: AutoCAD-Style Box Selection ==========
            // Create selection overlay canvas
            const selectionOverlay = document.createElement('canvas');
            selectionOverlay.id = 'selectionOverlay3D';
            selectionOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';
            container.appendChild(selectionOverlay);
            const selCtx = selectionOverlay.getContext('2d');

            // Box selection state
            let boxSelecting = false;
            let boxStart = { x: 0, y: 0 };
            let boxEnd = { x: 0, y: 0 };
            let isWindowSelection = true; // Left-to-right = window, Right-to-left = crossing
            let ignoreNextClick3D = false;

            // Resize overlay with container
            function resizeSelectionOverlay() {
                selectionOverlay.width = container.clientWidth;
                selectionOverlay.height = container.clientHeight;
            }
            resizeSelectionOverlay();
            window.addEventListener('resize', resizeSelectionOverlay);

            // Draw selection box
            function drawSelectionBox() {
                selCtx.clearRect(0, 0, selectionOverlay.width, selectionOverlay.height);
                if (!boxSelecting) return;

                const x = Math.min(boxStart.x, boxEnd.x);
                const y = Math.min(boxStart.y, boxEnd.y);
                const w = Math.abs(boxEnd.x - boxStart.x);
                const h = Math.abs(boxEnd.y - boxStart.y);

                if (w < 5 && h < 5) return; // Too small to draw

                // v3.0: AutoCAD-style colors
                // Window (left-to-right): Blue with dashed border
                // Crossing (right-to-left): Green with solid border
                if (isWindowSelection) {
                    selCtx.fillStyle = 'rgba(0, 120, 255, 0.15)';
                    selCtx.strokeStyle = '#0078ff';
                    selCtx.setLineDash([8, 4]);
                } else {
                    selCtx.fillStyle = 'rgba(0, 255, 100, 0.15)';
                    selCtx.strokeStyle = '#00ff64';
                    selCtx.setLineDash([]);
                }
                selCtx.lineWidth = 2;
                selCtx.fillRect(x, y, w, h);
                selCtx.strokeRect(x, y, w, h);

                // Label
                selCtx.font = 'bold 12px Inter, system-ui, sans-serif';
                selCtx.fillStyle = isWindowSelection ? '#0078ff' : '#00ff64';
                selCtx.fillText(isWindowSelection ? '⬜ WINDOW' : '🔲 CROSSING', x + 5, y - 5);
            }

            // Project 3D mesh to 2D screen coordinates
            function getMeshScreenBounds(mesh) {
                if (!mesh.geometry) return null;

                mesh.geometry.computeBoundingBox();
                const box = mesh.geometry.boundingBox;
                if (!box) return null;

                // Get 8 corners of bounding box
                const corners = [
                    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
                    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
                    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
                    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
                    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
                    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
                    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
                    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
                ];

                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

                mesh.updateMatrixWorld(true);
                for (const corner of corners) {
                    const worldPos = corner.clone().applyMatrix4(mesh.matrixWorld);
                    worldPos.project(camera3D);

                    const screenX = (worldPos.x * 0.5 + 0.5) * selectionOverlay.width;
                    const screenY = (-worldPos.y * 0.5 + 0.5) * selectionOverlay.height;

                    minX = Math.min(minX, screenX);
                    minY = Math.min(minY, screenY);
                    maxX = Math.max(maxX, screenX);
                    maxY = Math.max(maxY, screenY);
                }

                return { minX, minY, maxX, maxY };
            }

            // Check if mesh is inside selection box
            function isMeshInSelection(mesh, selBox, windowMode) {
                const meshBounds = getMeshScreenBounds(mesh);
                if (!meshBounds) return false;

                if (windowMode) {
                    // Window: mesh must be fully enclosed
                    return meshBounds.minX >= selBox.minX && meshBounds.maxX <= selBox.maxX &&
                        meshBounds.minY >= selBox.minY && meshBounds.maxY <= selBox.maxY;
                } else {
                    // Crossing: mesh just needs to intersect
                    return !(meshBounds.maxX < selBox.minX || meshBounds.minX > selBox.maxX ||
                        meshBounds.maxY < selBox.minY || meshBounds.minY > selBox.maxY);
                }
            }

            // Handle box selection completion
            function completeBoxSelection() {
                const selBox = {
                    minX: Math.min(boxStart.x, boxEnd.x),
                    minY: Math.min(boxStart.y, boxEnd.y),
                    maxX: Math.max(boxStart.x, boxEnd.x),
                    maxY: Math.max(boxStart.y, boxEnd.y)
                };

                // Only process if box is large enough
                if (selBox.maxX - selBox.minX < 10 || selBox.maxY - selBox.minY < 10) {
                    return;
                }

                // Find all selected meshes with valid userData.type
                const selectedItems = [];
                for (const mesh of meshes3D) {
                    if (mesh.userData && mesh.userData.type && isMeshInSelection(mesh, selBox, isWindowSelection)) {
                        selectedItems.push({
                            mesh: mesh,
                            type: mesh.userData.type,
                            id: mesh.userData.id,
                            floorId: mesh.userData.floorId
                        });
                    }
                }

                if (selectedItems.length === 0) {
                    console.log('v3.0: No items selected');
                    return;
                }

                // Group by type for display
                const columns = selectedItems.filter(i => i.type === 'column');
                const beams = selectedItems.filter(i => i.type === 'beam');
                const customBeams = selectedItems.filter(i => i.type === 'customBeam');

                // Build confirmation message
                let msg = `🗑️ Delete ${ selectedItems.length } item(s) ?\n\n`;
                if (columns.length > 0) {
                    msg += `📍 Columns(${ columns.length }): ${ columns.map(c => c.id).join(', ') } \n`;
                }
                if (beams.length > 0) {
                    msg += `📏 Beams(${ beams.length }): ${ beams.slice(0, 10).map(b => b.id).join(', ') }${ beams.length > 10 ? '...' : '' } \n`;
                }
                if (customBeams.length > 0) {
                    msg += `🪜 Custom Beams(${ customBeams.length }): ${ customBeams.map(b => b.id).join(', ') } \n`;
                }

                if (confirm(msg)) {
                    // Delete columns
                    for (const item of columns) {
                        toggleColumn(item.id);
                        console.log(`v3.0: Column ${ item.id } deleted via box selection`);
                    }

                    // Delete beams
                    for (const item of beams) {
                        const floor = state.floors.find(f => f.id === item.floorId);
                        if (floor) {
                            if (!floor.deletedBeams) floor.deletedBeams = [];
                            if (!floor.deletedBeams.includes(item.id)) {
                                floor.deletedBeams.push(item.id);
                            }
                        }
                    }

                    // Delete custom beams
                    for (const item of customBeams) {
                        const floor = state.floors.find(f => f.id === item.floorId);
                        if (floor && floor.customBeams) {
                            floor.customBeams = floor.customBeams.filter(b => b.id !== item.id);
                        }
                    }

                    // Refresh
                    calculate();
                    render3DFrame();
                    console.log(`v3.0: Deleted ${ selectedItems.length } items via ${ isWindowSelection ? 'window' : 'crossing' } selection`);
                }
            }

            // Mouse event handlers for box selection
            renderer3D.domElement.addEventListener('mousedown', (event) => {
                // Only left mouse button
                if (event.button !== 0) return;

                const rect = renderer3D.domElement.getBoundingClientRect();
                boxStart = {
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top
                };
                boxEnd = { ...boxStart };
                boxSelecting = true;

                // v3.0 FIX: Do NOT disable OrbitControls here - let orbit work by default
                // Only disable after significant drag in mousemove (see below)
                isWindowSelection = true;
            });

            renderer3D.domElement.addEventListener('mousemove', (event) => {
                if (!boxSelecting) return;

                const rect = renderer3D.domElement.getBoundingClientRect();
                boxEnd = {
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top
                };

                // AutoCAD-style: left-to-right = window, right-to-left = crossing
                isWindowSelection = boxEnd.x >= boxStart.x;

                // Disable orbit controls while box selecting (if box is large enough)
                if (Math.abs(boxEnd.x - boxStart.x) > 5 || Math.abs(boxEnd.y - boxStart.y) > 5) {
                    controls3D.enabled = false;
                }

                drawSelectionBox();
            });

            renderer3D.domElement.addEventListener('mouseup', (event) => {
                if (!boxSelecting) return;

                const wasBoxSelection = Math.abs(boxEnd.x - boxStart.x) > 10 || Math.abs(boxEnd.y - boxStart.y) > 10;

                boxSelecting = false;
                controls3D.enabled = true;
                selCtx.clearRect(0, 0, selectionOverlay.width, selectionOverlay.height);

                if (wasBoxSelection) {
                    ignoreNextClick3D = true;
                    setTimeout(() => { ignoreNextClick3D = false; }, 0);
                    completeBoxSelection();
                }
            });

            function get3DMemberHit(event) {
                const rect = renderer3D.domElement.getBoundingClientRect();

                mouse3D.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                mouse3D.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

                raycaster3D.setFromCamera(mouse3D, camera3D);
                const intersects = raycaster3D.intersectObjects(meshes3D, false);
                const structuralHit = intersects.find(i => {
                    const type = i.object.userData?.type;
                    return type === 'column' || type === 'beam' || type === 'customBeam' ||
                        type === 'elevatedBeam' || type === 'tieBeam' || type === 'footing';
                });
                return structuralHit || intersects.find(i => i.object.userData?.type === 'slab') || null;
            }

            renderer3D.domElement.addEventListener('click', (event) => {
                if (ignoreNextClick3D || boxSelecting) return;

                const hit = get3DMemberHit(event);
                if (!hit) {
                    hide3DMemberInfo();
                    return;
                }

                show3DMemberInfo(event, hit.object.userData);
            });

            // v3.0: Double-click to delete individual 3D members
            renderer3D.domElement.addEventListener('dblclick', (event) => {
                hide3DMemberInfo();
                const hit = get3DMemberHit(event);

                if (!hit) {
                    console.log('v3.0: No object detected at click position');
                    return;
                }

                const userData = hit.object.userData;

                console.log(`v3.0: Double - clicked ${ userData.type }: ${ userData.id } `);

                // Confirm and delete
                if (userData.type === 'column') {
                    if (confirm(`🗑️ Delete column ${ userData.id }?`)) {
                        toggleColumn(userData.id);
                        calculate();
                        render3DFrame();
                        console.log(`v3.0: Column ${ userData.id } deleted`);
                    }
                } else if (userData.type === 'beam') {
                    if (confirm(`🗑️ Delete beam ${ userData.id }?`)) {
                        const floor = state.floors.find(f => f.id === userData.floorId);
                        if (floor) {
                            if (!floor.deletedBeams) floor.deletedBeams = [];
                            if (!floor.deletedBeams.includes(userData.id)) {
                                floor.deletedBeams.push(userData.id);
                            }
                            calculate();
                            render3DFrame();
                            console.log(`v3.0: Beam ${ userData.id } deleted`);
                        }
                    }
                } else if (userData.type === 'customBeam') {
                    if (confirm(`🗑️ Delete custom beam ${ userData.id }?`)) {
                        const floor = state.floors.find(f => f.id === userData.floorId);
                        if (floor && floor.customBeams) {
                            floor.customBeams = floor.customBeams.filter(b => b.id !== userData.id);
                            calculate();
                            render3DFrame();
                            console.log(`v3.0: Custom beam ${ userData.id } deleted`);
                        }
                    }
                }
            });

            // ESC to cancel selection
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && boxSelecting) {
                    boxSelecting = false;
                    controls3D.enabled = true;
                    selCtx.clearRect(0, 0, selectionOverlay.width, selectionOverlay.height);
                    console.log('v3.0: Box selection cancelled');
                } else if (event.key === 'Escape') {
                    hide3DMemberInfo();
                }
            });

            view3DInitialized = true;
            animate3D();
        }

        function animate3D() {
            requestAnimationFrame(animate3D);
            // v3.9: Only render if 3D container is visible (performance optimization)
            const container = document.getElementById('container3D');
            if (!container || !container.classList.contains('active')) return;

            if (controls3D) controls3D.update();
            if (renderer3D && scene3D && camera3D) {
                renderer3D.render(scene3D, camera3D);
            }
        }

        function render3DFrame() {
            if (!scene3D) return;

            // Clear previous meshes
            meshes3D.forEach(m => scene3D.remove(m));
            meshes3D = [];

            // v3.10: Default member sizes in METERS (fallbacks for undefined properties)
            const colSize = 0.3;   // Default column size 300mm
            const beamW = 0.25;    // Default beam width 250mm
            const beamH = 0.5;     // Default beam height 500mm

            // v3.9: Member sizes are now read from individual column/beam objects
            // col.webB, col.webD for columns (mm) - default 300mm
            // beam.webW, beam.webD for beams (mm) - default 250x500mm

            // Calculate grid bounds for centering
            const totalX = state.xSpans.reduce((a, b) => a + b, 0);
            const totalY = state.ySpans.reduce((a, b) => a + b, 0);
            const offsetX = -totalX / 2;
            const offsetZ = -totalY / 2;
            const floorGeometryById = collect3DFloorGeometry();
            const showMemberTags = false;
            hide3DMemberInfo();

            // Track cumulative height for proper floor stacking
            let cumulativeY = 0;
            const currentViewFloor = state.floors[state.currentFloorIndex];
            const currentViewDeletedBeams = currentViewFloor?.deletedBeams || [];
            const currentViewDeletedColumns = currentViewFloor?.deletedColumns || [];

            // For each floor
            state.floors.forEach((floor, fi) => {
                const baseY = cumulativeY;  // Use cumulative height, not fi * height
                const floorGeometry = floorGeometryById.get(floor.id) || { beams: state.beams || [], slabs: state.slabs || [] };

                // COLUMNS - vertical boxes (skip inactive on THIS floor)
                for (let col of state.columns) {
                    // v3.0: Skip columns inactive on THIS floor (not global col.active)
                    if (!isColumnActiveOnFloor(col, floor.id)) continue;

                    // v3.9: Skip deleted columns on this floor
                    if (floor.deletedColumns && floor.deletedColumns.includes(col.id)) continue;

                    // v3.0: Skip planted columns on floors BELOW their startFloor
                    if (col.startFloor && !isFloorAtOrAbove(floor.id, col.startFloor)) {
                        continue; // Don't render this column segment on floors below startFloor
                    }

                    // v3.0: Custom planted columns (placed on beams) - check isPlanted and startFloor
                    if (col.isPlanted && col.startFloor && !isFloorAtOrAbove(floor.id, col.startFloor)) {
                        continue; // Don't render beam-placed planted columns below their start floor
                    }

                    // v3.9: Use actual column sizes from state (mm to meters)
                    const colSizeActual = get3DColumnSize(col);
                    const colB = colSizeActual.b;
                    const colD = colSizeActual.d;
                    const geo = new THREE.BoxGeometry(colB, floor.height, colD);

                    let colColor = VIEW3D_COLORS.column;
                    if (col.isPlanted) colColor = VIEW3D_COLORS.plantedColumn;

                    const mat = new THREE.MeshStandardMaterial({
                        color: colColor,
                        roughness: 0.72,
                        metalness: 0.02
                    });
                    const mesh = new THREE.Mesh(geo, mat);
                    const colPos = getColumnPlanPosition(col);
                    mesh.position.set(colPos.x + offsetX, baseY + floor.height / 2, colPos.y + offsetZ);

                    // v3.0: Store data for click detection
                    mesh.userData = { type: 'column', id: col.id, floorId: floor.id, isPlanted: col.isPlanted, member: { ...col } };

                    scene3D.add(mesh);
                    meshes3D.push(mesh);

                    // v3.10: Add column label (only on first floor to avoid duplicates)
                    if (showMemberTags && fi === 0) {
                        const colLabel = createMemberLabel(col.id, VIEW3D_COLORS.column);
                        colLabel.position.set(colPos.x + offsetX, baseY + floor.height + 0.5, colPos.y + offsetZ);
                        scene3D.add(colLabel);
                        meshes3D.push(colLabel);
                    }
                }

                // Note: cumulativeY updated at end of forEach iteration

                // BEAMS - at top of each floor (skip if connected to inactive columns OR deleted on this floor)
                const floorDeletedBeams = floor.deletedBeams || [];  // v3.0: Per-floor deleted beams

                for (let beam of floorGeometry.beams) {
                    // v3.0 FIX: Skip custom beams - they are drawn separately below
                    if (beam.isCustom) continue;

                    // v3.0: Skip beams deleted on THIS floor
                    if (floorDeletedBeams.includes(beam.id)) continue;

                    // v2.7: Skip beams connected to inactive columns
                    const startCol = state.columns.find(c => c.id === beam.startCol);
                    const endCol = state.columns.find(c => c.id === beam.endCol);
                    if ((startCol && startCol.active === false) || (endCol && endCol.active === false)) {
                        continue;
                    }


                    const renderedSegment = getRenderedBeamSegment(beam, startCol, endCol);
                    const length = renderedSegment.length;

                    // v3.9: Use actual beam sizes from state (mm to meters)
                    const beamSize = getBeamSizeMm(beam, floor.id);
                    const beamWidth = beamSize.b / 1000;
                    const beamDepth = beamSize.h / 1000;
                    const beamPlanOffset = getBeamPlanOffset(beam, beamWidth);

                    // Create beam geometry with correct length and actual sizes
                    const geo = beam.direction === 'X'
                        ? new THREE.BoxGeometry(length, beamDepth, beamWidth)
                        : new THREE.BoxGeometry(beamWidth, beamDepth, length);

                    const beamColor = beam.isEdgeBeam ? VIEW3D_COLORS.edgeBeam :
                        beam.isCantilever ? VIEW3D_COLORS.cantileverBeam : VIEW3D_COLORS.beam;
                    const mat = new THREE.MeshStandardMaterial({
                        color: beamColor,
                        roughness: 0.68,
                        metalness: 0.03
                    });
                    const mesh = new THREE.Mesh(geo, mat);

                    // Position at midpoint
                    const mx = (beam.direction === 'Y'
                        ? beam.x1 + beamPlanOffset.offsetX
                        : renderedSegment.midX) + offsetX;
                    const mz = (beam.direction === 'X'
                        ? beam.y1 + beamPlanOffset.offsetY
                        : renderedSegment.midY) + offsetZ;
                    mesh.position.set(mx, baseY + floor.height - beamDepth / 2, mz);

                    // v3.0: Store data for click detection
                    mesh.userData = { type: 'beam', id: beam.id, floorId: floor.id, member: { ...beam, length } };

                    scene3D.add(mesh);
                    meshes3D.push(mesh);

                    // v3.10: Add beam label (only on first floor to avoid duplicates)
                    if (showMemberTags && fi === 0) {
                        const beamLabel = createMemberLabel(beam.id, beamColor);
                        beamLabel.position.set(mx, baseY + floor.height + 0.3, mz);
                        scene3D.add(beamLabel);
                        meshes3D.push(beamLabel);
                    }
                }

                // v3.0: CUSTOM BEAMS - orange intermediate framing beams
                const customBeams = floor.customBeams || [];
                for (let cb of customBeams) {
                    let length, cbX, cbZ;
                    // v3.0 FIX: dir='X' means beam runs horizontally (along X axis), constant Y
                    // dir='Y' means beam runs vertically (along Y axis), constant X
                    if (cb.dir === 'X') {
                        // Horizontal beam at Y = cb.pos, runs from cb.start to cb.end in X
                        length = cb.end - cb.start;
                        cbX = (cb.start + cb.end) / 2 + offsetX;
                        cbZ = cb.pos + offsetZ;
                    } else {
                        // Vertical beam at X = cb.pos, runs from cb.start to cb.end in Y
                        length = cb.end - cb.start;
                        cbX = cb.pos + offsetX;
                        cbZ = (cb.start + cb.end) / 2 + offsetZ;
                    }

                    // v3.10: Use custom beam's own dimensions or defaults
                    const cbSize = getBeamSizeMm({ id: cb.id, span: length, ...cb }, floor.id);
                    const cbW = cbSize.b / 1000;
                    const cbH = cbSize.h / 1000;

                    // Geometry: X beams are wide in X, Y beams are wide in Z
                    const geo = cb.dir === 'X'
                        ? new THREE.BoxGeometry(length, cbH, cbW)
                        : new THREE.BoxGeometry(cbW, cbH, length);

                    const mat = new THREE.MeshStandardMaterial({
                        color: VIEW3D_COLORS.customBeam,
                        roughness: 0.7,
                        metalness: 0.02
                    });
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.position.set(cbX, baseY + floor.height - cbH / 2, cbZ);
                    mesh.userData = {
                        type: 'customBeam',
                        id: cb.id,
                        floorId: floor.id,
                        member: { ...cb, span: length, webW: cbSize.b, webD: cbSize.h }
                    };

                    scene3D.add(mesh);
                    meshes3D.push(mesh);
                }

                // SLABS - 3D boxes with actual thickness (skip void slabs on THIS floor)
                const floorVoidSlabs = floor.voidSlabs || [];  // v3.0: Per-floor void slabs
                const slabThickness = (floor.slabThickness || 150) / 1000;  // v3.9: Actual thickness in meters

                for (let slab of floorGeometry.slabs) {
                    // v3.0: Skip void slabs on THIS floor (not slab.isVoid which is current floor only)
                    if (floorVoidSlabs.includes(slab.id)) continue;

                    // v3.9: Use BoxGeometry with actual slab thickness instead of flat plane
                    const slabInset = Math.min(0.12, Math.min(slab.lx, slab.ly) * 0.06);
                    const geo = new THREE.BoxGeometry(
                        Math.max(0.05, slab.lx - slabInset * 2),
                        slabThickness,
                        Math.max(0.05, slab.ly - slabInset * 2)
                    );
                    const mat = new THREE.MeshStandardMaterial({
                        color: slab.isTwoWay ? VIEW3D_COLORS.slab : VIEW3D_COLORS.oneWaySlab,
                        transparent: true,
                        opacity: 0.28,
                        roughness: 0.82,
                        metalness: 0,
                        depthWrite: false,
                        polygonOffset: true,
                        polygonOffsetFactor: -1,
                        polygonOffsetUnits: -1
                    });
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.position.set(
                        slab.x1 + slab.lx / 2 + offsetX,
                        baseY + floor.height - slabThickness / 2 + 0.015,
                        slab.y1 + slab.ly / 2 + offsetZ
                    );
                    mesh.renderOrder = 1;
                    mesh.userData = {
                        type: 'slab',
                        id: slab.id,
                        floorId: floor.id,
                        member: { ...slab, thicknessMm: floor.slabThickness || 150 }
                    };
                    scene3D.add(mesh);
                    meshes3D.push(mesh);
                }

                // Update cumulative height for next floor
                cumulativeY += floor.height;
            });

            // v2.6: ELEVATED GF BEAMS - when gfSuspended is checked
            const elevationHeight = state.gfSuspended
                ? (parseFloat(document.getElementById('elevationHeight')?.value) || 1.2)
                : 0;

            if (state.gfSuspended && elevationHeight > 0) {
                const currentViewFloorGeometry = floorGeometryById.get(currentViewFloor?.id) || { beams: state.beams || [] };
                for (let beam of currentViewFloorGeometry.beams) {
                    // v3.0 FIX: Skip custom beams - they belong to specific floors only
                    if (beam.isCustom) continue;
                    if (currentViewDeletedBeams.includes(beam.id)) continue;

                    const startCol = state.columns.find(c => c.id === beam.startCol);
                    const endCol = state.columns.find(c => c.id === beam.endCol);
                    const renderedSegment = getRenderedBeamSegment(beam, startCol, endCol);
                    const length = renderedSegment.length;

                    const geo = beam.direction === 'X'
                        ? new THREE.BoxGeometry(length, beamH, beamW)
                        : new THREE.BoxGeometry(beamW, beamH, length);

                    const mat = new THREE.MeshStandardMaterial({
                        color: VIEW3D_COLORS.beam,
                        roughness: 0.7,
                        metalness: 0.02
                    });
                    const mesh = new THREE.Mesh(geo, mat);

                    const mx = renderedSegment.midX + offsetX;
                    const mz = renderedSegment.midY + offsetZ;
                    // Position at elevation height (below GF floor)
                    mesh.position.set(mx, elevationHeight - beamH / 2, mz);
                    mesh.userData = { type: 'elevatedBeam', id: beam.id, floorId: currentViewFloor?.id, member: { ...beam, length } };

                    scene3D.add(mesh);
                    meshes3D.push(mesh);
                }
            }

            // v2.6: FOOTINGS - residential baseline uses bearing-sized plan dimensions with 300mm thickness.
            // SolverLink MVP: Skip footing/pedestal rendering, show base support markers instead
            const isSolverLinkMode = document.body.classList.contains('solverbridge-mode');
            const footingDepth = state.footingDepth;
            const residentialFootingThick = RESIDENTIAL_FOOTING_THICKNESS_MM / 1000;

            if (!isSolverLinkMode) {
            // --- Original footing rendering (hidden in SolverLink) ---
            for (let col of state.columns) {
                // v2.7: Skip footings for inactive columns
                if (col.active === false) continue;
                if (currentViewDeletedColumns.includes(col.id)) continue;

                // v3.0 FIX: Skip footings for planted columns (they sit on beams, not ground)
                if (col.startFloor || col.isPlanted) continue;

                const size = col.footingSize || 0.8;
                const adjustedThick = col.footingD || col.footingThick || residentialFootingThick;

                // Footing geometry
                const geo = new THREE.BoxGeometry(size, adjustedThick, size);
                const mat = new THREE.MeshStandardMaterial({
                    color: VIEW3D_COLORS.footing,
                    transparent: true,
                    opacity: 0.58,
                    roughness: 0.86,
                    metalness: 0
                });
                const mesh = new THREE.Mesh(geo, mat);

                // Position below ground - all tops at same level
                const footingTopY = -footingDepth + adjustedThick;
                mesh.position.set(
                    col.x + offsetX,
                    footingTopY - adjustedThick / 2,
                    col.y + offsetZ
                );
                mesh.userData = {
                    type: 'footing',
                    id: `F-${col.id}`,
                    floorId: 'GND',
                    member: { columnId: col.id, size, thick: adjustedThick }
                };
                scene3D.add(mesh);
                meshes3D.push(mesh);

                // Footing pedestal (connecting column to footing) - v3.10: Use actual column size
                const pedColSize = get3DColumnSize(col);
                const pedColB = pedColSize.b;  // v3.10: Match column dimensions
                const pedColD = pedColSize.d;
                const pedestalGeo = new THREE.BoxGeometry(pedColB, footingDepth - adjustedThick, pedColD);
                const pedestalMat = new THREE.MeshStandardMaterial({ color: VIEW3D_COLORS.pedestal, roughness: 0.78 });
                const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
                pedestal.position.set(
                    col.x + offsetX,
                    -(footingDepth - adjustedThick) / 2,
                    col.y + offsetZ
                );
                scene3D.add(pedestal);
                meshes3D.push(pedestal);
            }

            // v2.8: TIE BEAMS - using calculated sizing from longest span
            const tieBeamH = (state.tieBeamDepth || Math.round((state.tieBeamH || 0.35) * 1000)) / 1000;
            const tieBeamW = (state.tieBeamWidth || Math.round((state.tieBeamW || 0.2) * 1000)) / 1000;
            const tieBeamTopY = -footingDepth + residentialFootingThick + tieBeamH / 2;  // On top of standard footings

            const tieBeamGeometry = floorGeometryById.get(currentViewFloor?.id) || { beams: state.beams || [] };
            for (let beam of tieBeamGeometry.beams) {
                // v3.0 FIX: Skip custom beams - they belong to specific floors only
                if (beam.isCustom) continue;
                // v3.0 FIX: Skip cantilever and edge beams - tie beams only connect main grid columns
                if (beam.isCantilever || beam.isEdgeBeam) continue;
                if (currentViewDeletedBeams.includes(beam.id)) continue;

                const startCol = state.columns.find(c => c.id === beam.startCol);
                const endCol = state.columns.find(c => c.id === beam.endCol);
                const renderedSegment = getRenderedBeamSegment(beam, startCol, endCol);
                const length = renderedSegment.length;

                const geo = beam.direction === 'X'
                    ? new THREE.BoxGeometry(length, tieBeamH, tieBeamW)
                    : new THREE.BoxGeometry(tieBeamW, tieBeamH, length);

                const mat = new THREE.MeshStandardMaterial({
                    color: VIEW3D_COLORS.tieBeam,
                    roughness: 0.75,
                    metalness: 0.02
                });
                const mesh = new THREE.Mesh(geo, mat);

                const mx = renderedSegment.midX + offsetX;
                const mz = renderedSegment.midY + offsetZ;
                mesh.position.set(mx, tieBeamTopY, mz);
                mesh.userData = { type: 'tieBeam', id: `TB-${beam.id}`, floorId: 'GND', member: { ...beam, length, webW: tieBeamW * 1000, webD: tieBeamH * 1000 } };

                scene3D.add(mesh);
                meshes3D.push(mesh);
            }
            } else {
                // SolverLink MVP: Draw simple base support markers (small inverted pyramids)
                for (let col of state.columns) {
                    if (col.active === false) continue;
                    if (currentViewDeletedColumns.includes(col.id)) continue;
                    if (col.startFloor || col.isPlanted) continue;

                    const supportSize = 0.25;
                    const supportH = 0.12;
                    const geo = new THREE.ConeGeometry(supportSize, supportH, 4);
                    const mat = new THREE.MeshStandardMaterial({
                        color: 0x10b981,  // Green for support markers
                        roughness: 0.6,
                        metalness: 0.1
                    });
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.rotation.x = Math.PI;  // Invert cone to point down
                    mesh.position.set(
                        col.x + offsetX,
                        -supportH / 2,
                        col.y + offsetZ
                    );
                    mesh.userData = { type: 'support', id: `S-${col.id}`, floorId: 'GND' };
                    scene3D.add(mesh);
                    meshes3D.push(mesh);
                }
            }

            // v3.10: 2D STRUCTURAL GRID AT GROUND LEVEL (Y=0)
            // Helper function to create text labels using Sprites (for grid bubbles)
            function createGridLabel(text, bgColor = 'rgba(51, 65, 85, 0.92)') {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 128;
                canvas.height = 128;

                // Draw circular bubble background
                ctx.beginPath();
                ctx.arc(64, 64, 56, 0, Math.PI * 2);
                ctx.fillStyle = bgColor;
                ctx.fill();
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 3;
                ctx.stroke();

                // Draw text
                ctx.font = 'bold 48px Inter, Arial, sans-serif';
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, 64, 64);

                const texture = new THREE.CanvasTexture(canvas);
                const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
                const sprite = new THREE.Sprite(material);
                sprite.scale.set(0.72, 0.72, 1);
                return sprite;
            }

            // v3.10: Helper function for member labels (columns, beams) - pill-shaped
            function createMemberLabel(text, color = 0xffffff) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 256;
                canvas.height = 64;

                // Draw pill-shaped background
                const radius = 28;
                ctx.beginPath();
                ctx.moveTo(radius, 4);
                ctx.lineTo(canvas.width - radius, 4);
                ctx.arcTo(canvas.width - 4, 4, canvas.width - 4, radius + 4, radius);
                ctx.lineTo(canvas.width - 4, canvas.height - radius - 4);
                ctx.arcTo(canvas.width - 4, canvas.height - 4, canvas.width - radius - 4, canvas.height - 4, radius);
                ctx.lineTo(radius, canvas.height - 4);
                ctx.arcTo(4, canvas.height - 4, 4, canvas.height - radius - 4, radius);
                ctx.lineTo(4, radius + 4);
                ctx.arcTo(4, 4, radius, 4, radius);
                ctx.closePath();

                // Fill with member color
                const hexColor = '#' + color.toString(16).padStart(6, '0');
                ctx.fillStyle = hexColor;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Draw text
                ctx.font = 'bold 28px Inter, Arial, sans-serif';
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, canvas.width / 2, canvas.height / 2);

                const texture = new THREE.CanvasTexture(canvas);
                const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
                const sprite = new THREE.Sprite(material);
                sprite.scale.set(1.2, 0.3, 1);
                return sprite;
            }

            // Grid line material
            const gridLineMaterial = new THREE.LineBasicMaterial({
                color: VIEW3D_COLORS.gridLine,
                transparent: true,
                opacity: 0.48
            });
            const gridY = 0.018;
            const groundPadding = Math.max(8, Math.max(totalX, totalY) * 0.75);

            // Draw X-direction grid lines (vertical lines in plan) and bubbles
            let currentGridX = 0;
            const xLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

            for (let i = 0; i <= state.xSpans.length; i++) {
                const x = currentGridX + offsetX;

                // Grid line from -1m to totalY+1m (extending beyond grid)
                const lineGeo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(x, gridY, offsetZ - groundPadding),
                    new THREE.Vector3(x, gridY, totalY + offsetZ + groundPadding)
                ]);
                const line = new THREE.Line(lineGeo, gridLineMaterial);
                scene3D.add(line);
                meshes3D.push(line);

                // Bubble label at bottom of grid line
                const label = createGridLabel(xLabels[i] || (i + 1).toString());
                label.position.set(x, 0.08, offsetZ - 1.5);
                scene3D.add(label);
                meshes3D.push(label);

                // Top bubble (mirrored)
                const topLabel = createGridLabel(xLabels[i] || (i + 1).toString());
                topLabel.position.set(x, 0.08, totalY + offsetZ + 1.5);
                scene3D.add(topLabel);
                meshes3D.push(topLabel);

                if (i < state.xSpans.length) {
                    currentGridX += state.xSpans[i];
                }
            }

            // Draw Y-direction grid lines (horizontal lines in plan) and bubbles
            let currentGridY = 0;

            for (let i = 0; i <= state.ySpans.length; i++) {
                const z = currentGridY + offsetZ;

                // Grid line from -1m to totalX+1m
                const lineGeo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(offsetX - groundPadding, gridY, z),
                    new THREE.Vector3(totalX + offsetX + groundPadding, gridY, z)
                ]);
                const line = new THREE.Line(lineGeo, gridLineMaterial);
                scene3D.add(line);
                meshes3D.push(line);

                // Bubble label at left of grid line
                const label = createGridLabel((i + 1).toString());
                label.position.set(offsetX - 1.5, 0.08, z);
                scene3D.add(label);
                meshes3D.push(label);

                // Right bubble (mirrored)
                const rightLabel = createGridLabel((i + 1).toString());
                rightLabel.position.set(totalX + offsetX + 1.5, 0.08, z);
                scene3D.add(rightLabel);
                meshes3D.push(rightLabel);

                if (i < state.ySpans.length) {
                    currentGridY += state.ySpans[i];
                }
            }

            // Wide matte ground plane, kept separate from the structural model geometry.
            const groundGeo = new THREE.PlaneGeometry(totalX + groundPadding * 2, totalY + groundPadding * 2);
            const theme = document.documentElement.getAttribute('data-theme') || 'dark';
            const groundMat = new THREE.MeshStandardMaterial({
                color: theme === 'dark' ? 0x0f172a : 0xf8fafc,
                transparent: true,
                opacity: theme === 'dark' ? 0.72 : 0.96,
                roughness: 0.88,
                metalness: 0,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const ground = new THREE.Mesh(groundGeo, groundMat);
            ground.rotation.x = -Math.PI / 2;
            ground.position.set(0, -0.025, 0);  // Slightly below Y=0 to avoid z-fighting
            ground.renderOrder = -1;
            scene3D.add(ground);
            meshes3D.push(ground);

            // Update camera target to center (including footings)
            const centerY = (state.floors.length * 3) / 2 - footingDepth / 2;
            controls3D.target.set(0, centerY, 0);
            camera3D.position.set(totalX * 1.5, centerY + 15, totalY * 1.5);
        }

        function setView(mode) {
            const canvas2D = document.getElementById('mainCanvas');
            const container3D = document.getElementById('container3D');
            const btn2D = document.getElementById('view2D');
            const btn3D = document.getElementById('view3D');

            if (mode === '2d') {
                canvas2D.style.display = 'block';
                container3D.classList.remove('active');
                btn2D?.classList.add('active');
                btn3D?.classList.remove('active');
            } else {
                canvas2D.style.display = 'none';
                // v3.9 FIX: Clear inline display style set by setPlanTab so class takes effect
                container3D.style.display = '';
                container3D.classList.add('active');
                btn2D?.classList.remove('active');
                btn3D?.classList.add('active');

                // v3.9 FIX: Use requestAnimationFrame to ensure container has dimensions before init
                // This fixes the lag/non-working 3D button on first click
                requestAnimationFrame(() => {
                    if (!view3DInitialized) {
                        init3D();
                    }
                    render3DFrame();

                    // Resize renderer after container is visible
                    const rect = container3D.getBoundingClientRect();
                    if (renderer3D && rect.width > 0 && rect.height > 0) {
                        renderer3D.setSize(rect.width, rect.height);
                        camera3D.aspect = rect.width / rect.height;
                        camera3D.updateProjectionMatrix();
                    }
                });
            }
        }
