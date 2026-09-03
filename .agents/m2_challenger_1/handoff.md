# Milestone 2 Empirical Review: SpatialHashGrid Stress Test & Hardening

**Agent:** Challenger 1 (`teamwork_preview_challenger`)  
**Target:** `D:\snake_game\script.js` (`SpatialHashGrid` class, lines 354–496)  
**Verdict:** **REQUEST_CHANGES** ⚠️  

---

## 1. Observation

### 1.1 Implementation Analysis (`script.js`)

In `D:\snake_game\script.js`:
- Lines 381–401: `insertSegment(snakeId, segIndex, x, y, radius = 10)` expands the insertion bounds by segment radius:
  ```javascript
  const minCol = Math.min(this.cols - 1, Math.max(0, Math.floor((x - r) / this.cellSize)));
  const maxCol = Math.min(this.cols - 1, Math.max(0, Math.floor((x + r) / this.cellSize)));
  const minRow = Math.min(this.rows - 1, Math.max(0, Math.floor((y - r) / this.cellSize)));
  const maxRow = Math.min(this.rows - 1, Math.max(0, Math.floor((y + r) / this.cellSize)));
  ```
- Lines 403–413: `insertFood(foodOrb)` places each orb only into a single cell based on its center:
  ```javascript
  const cell = this._getCell(foodOrb.x, foodOrb.y);
  const key = this._getKey(cell.col, cell.row);
  let bucket = this.foodBuckets.get(key);
  if (!bucket) {
      bucket = [];
      this.foodBuckets.set(key, bucket);
  }
  bucket.push(foodOrb);
  ```
- Lines 463–470: `queryNearbyFood(x, y, radius)` queries only the bounding box `[x - radius, x + radius]` without expanding for the food orb's radius (`orb.radius`):
  ```javascript
  const r = Math.max(0, radius || 0);
  const minCol = Math.min(this.cols - 1, Math.max(0, Math.floor((x - r) / this.cellSize)));
  const maxCol = Math.min(this.cols - 1, Math.max(0, Math.floor((x + r) / this.cellSize)));
  const minRow = Math.min(this.rows - 1, Math.max(0, Math.floor((y - r) / this.cellSize)));
  const maxRow = Math.min(this.rows - 1, Math.max(0, Math.floor((y + r) / this.cellSize)));
  ```
- Lines 415–427: `removeFood(foodOrb)` calculates the cell from `foodOrb.x, foodOrb.y`. If the orb has moved since insertion (e.g. boost trail orbs with velocity), `_getCell` points to the new cell, leaving the orb permanently stranded in the old cell's bucket.
- Lines 366–379, 393–398, 437–450, 471–483: Memory allocations occur on every insertion and query:
  - String keys generated via template literals: `${col},${row}` and `${seg.snakeId}_${seg.segIndex}`
  - Bucket arrays reallocated dynamically (`bucket = []`) on each frame after `clear()`
  - Result arrays (`results = []`) and Sets (`seen = new Set()`) instantiated on every query call.

### 1.2 Empirical Test Execution Output

Executing `stress_test_spatial_grid.js` with 3,000 segments, 2,000 food orbs, and 10,000 randomized circle queries across the 3000x3000px arena yielded:

```
================================================================
       SPATIAL HASH GRID EMPIRICAL STRESS TEST HARNESS          
================================================================

--- SEGMENT QUERY RESULTS (10,000 Queries) ---
True Positives      : 101976
False Negatives     : 0
False Positives     : 0
Queries with Misses : 0 / 10000 (0.00%)
Recall Rate         : 100.0000%
Grid Query Time     : 35.10 ms (avg 3.51 µs/query)
Brute Force Time    : 42.24 ms (avg 4.22 µs/query)
Speedup Factor      : 1.20x

--- FOOD QUERY RESULTS (10,000 Queries) ---
True Positives      : 62072
False Negatives     : 71
False Positives     : 0
Queries with Misses : 68 / 10000 (0.68%)
Recall Rate         : 99.8857%
Grid Query Time     : 19.80 ms (avg 1.98 µs/query)
Brute Force Time    : 42.40 ms (avg 4.24 µs/query)
Speedup Factor      : 2.14x

Sample Food False Negatives Details:
  [Miss #1] Orb food_470 at (1439.2, 1886.8 r=8.2) in cell (11, 15)
      Query at (1558.3, 1921.7 r=117.3) -> searches cols [12..13], rows [15..16]
      Distance = 124.12 <= Max Allowed 125.51 (OVERLAP = TRUE, BUT NOT IN SEARCHED CELLS!)

--- BOUNDARY TESTS (11 Matrix Conditions) ---
- Points exactly on cell boundaries (x=120.0, 240.0): PASS
- Coordinates at world limits (0, 3000): PASS
- Negative coordinates (-0.01, -500): PASS (Clamped safely)
- Coordinates > 3000 (3050, 100000): PASS (Clamped safely)
- Degenerate radii (r=0, r=-5, r=2000): PASS

--- 1,000 FRAME CLEARING CYCLES & MEMORY ALLOCATION ANALYSIS ---
1,000 Simulation Cycles Completed in 626.48 ms (0.626 ms/frame)
Heap Difference: +7.22 MB
Estimated Heap Allocations Per Frame  : ~13,625 objects/strings
Estimated Heap Allocations Per Second : ~817,500 objects/strings at 60 FPS
Zero-GC Memory Reuse Compliance       : FAIL
```

---

## 2. Logic Chain

1. **Food Query Recall Deficiency**:
   - `insertFood` records the orb only at `floor(x / cellSize), floor(y / cellSize)`.
   - `queryNearbyFood` calculates Euclidean overlap condition `dx*dx + dy*dy <= (r + orb.radius)^2`.
   - However, `queryNearbyFood` bounds its search to `floor((x - r)/cellSize) .. floor((x + r)/cellSize)`.
   - When a food orb is positioned near a cell boundary (e.g. center in cell $C_1$, with boundary extending into cell $C_0$), a query circle residing in $C_0$ that overlaps the orb's boundary will only search cell $C_0$.
   - Because $C_0$ does not contain the orb's center, the orb is missed, directly causing false negatives (71 missed orbs in 10,000 queries, 99.88% recall instead of 100%).

2. **Moving Food Invalidation in `removeFood`**:
   - `FoodOrb` instances with non-zero velocities (e.g. boost trail pellets with impulse `vx, vy`) change coordinates over time.
   - When `removeFood(foodOrb)` is invoked after the orb has moved across a cell boundary, `removeFood` evaluates `_getCell` using current `(x, y)`.
   - Because the orb was inserted under its old cell coordinates, it is not found in the new cell's bucket, leaving a zombie orb in the old cell bucket.

3. **High GC Allocation Churn**:
   - `SpatialHashGrid` performs fresh string formatting (`${c},${rIdx}`, `${snakeId}_${segIndex}`), creates dynamic bucket arrays `[]`, creates segment items `{ snakeId, segIndex, x, y, radius }`, and allocates new `Set()` / `[]` instances per query.
   - Across 3,000 segments and 2,000 food orbs at 60 FPS, this produces ~13,600 heap allocations per frame (~817,500 allocations/second).
   - While execution time is fast (0.626 ms/frame), this high allocation rate violates the "zero-GC memory reuse" objective and will cause periodic garbage collection micro-stutters during extended gameplay.

4. **Boundary Robustness**:
   - Out-of-bounds entity coordinates ($<0$ or $>3000$) are safely clamped to `[0, cols-1]` and `[0, rows-1]` via `Math.min(..., Math.max(0, ...))`.
   - False positive overlap from clamped border buckets is effectively prevented by the Euclidean distance check `dx*dx + dy*dy <= limit*limit`.

---

## 3. Caveats

- In the current `GameEngine.physicsStep()`, `spatialGrid.clear()` is called every tick and all active entities are re-inserted. As a result, `removeFood` is not actively called during normal frame execution, which masks the `removeFood` stale coordinate bug. However, `removeFood` remains defective as an exported public API.
- The 99.88% recall rate for food queries misses edge-case food ingestion when a snake head is grazing food across cell boundaries, which can cause subtle ingestion latency or missed pickups during high-speed boost maneuvers.

---

## 4. Conclusion & Required Actions

**Verdict:** **REQUEST_CHANGES** ⚠️

### Required Fixes for Worker:
1. **Fix Food Query Boundary Recall (Zero False Negatives)**:
   - In `SpatialHashGrid.queryNearbyFood(x, y, radius, maxFoodRadius = 12)` (or during `insertFood`), expand the query bounding box to include maximum food radius:
     ```javascript
     const maxR = (radius || 0) + 12; // 12px is max food radius
     const minCol = Math.min(this.cols - 1, Math.max(0, Math.floor((x - maxR) / this.cellSize)));
     const maxCol = Math.min(this.cols - 1, Math.max(0, Math.floor((x + maxR) / this.cellSize)));
     const minRow = Math.min(this.rows - 1, Math.max(0, Math.floor((y - maxR) / this.cellSize)));
     const maxRow = Math.min(this.rows - 1, Math.max(0, Math.floor((y + maxR) / this.cellSize)));
     ```
     *Alternatively*, modify `insertFood` to insert into all overlapping cells (identical to `insertSegment`).
2. **Fix `removeFood` Stale Coordinate Tracking**:
   - Store `_lastCellKey` or `_cellCol, _cellRow` on the `FoodOrb` upon insertion so `removeFood` removes it from its actual registered bucket.
3. **Zero-GC Allocation Optimization**:
   - Replace string-keyed `Map` with flat 1D array of static bucket arrays (e.g. `this.segmentBuckets = new Array(cols * rows)` pre-initialized with reusable array pools, indexable via `row * cols + col`).
   - Clear buckets by setting `bucket.length = 0` rather than instantiating new arrays or dropping Maps.
   - Replace `new Set()` in queries with a global query counter tag / dirty integer array or reuse a scratch `Set` (`scratchSet.clear()`).

---

## 5. Verification Method

To independently verify all observations and reproduce the findings:

1. **Run the Empirical Stress Test Suite**:
   ```powershell
   & "C:\Users\ADmin\scoop\apps\nodejs-lts\24.20.0\node.exe" D:\snake_game\.agents\m2_challenger_1\stress_test_spatial_grid.js
   ```
   *Expected Result:* 71 false negatives in food queries (99.88% recall), ~13,600 allocs/frame.

2. **Run the Minimal False Negative Counterexample**:
   ```powershell
   & "C:\Users\ADmin\scoop\apps\nodejs-lts\24.20.0\node.exe" D:\snake_game\.agents\m2_challenger_1\counterexample.js
   ```
   *Expected Result:* Proves false negative on cross-cell boundary food orb ($x=121, r=8$ vs query at $x=110, r=5$).

3. **Run the `removeFood` Stale Coordinate Test**:
   ```powershell
   & "C:\Users\ADmin\scoop\apps\nodejs-lts\24.20.0\node.exe" D:\snake_game\.agents\m2_challenger_1\test_remove_food_bug.js
   ```
   *Expected Result:* Proves moving food orb is not removed from its original bucket.

4. **Run Existing E2E Test Suite**:
   ```powershell
   & "C:\Users\ADmin\scoop\apps\nodejs-lts\24.20.0\node.exe" tests/e2e_harness.js
   ```
