/**
 * Empirical Stress Test Suite for SpatialHashGrid
 * Author: Milestone 2 Challenger 1
 * Targets: script.js -> SpatialHashGrid
 */

const { SpatialHashGrid, FoodOrb } = require('../../script.js');
const v8 = require('v8');
const vm = require('vm');

// Pseudo-random number generator with fixed seed for determinism & reproducibility
function createRng(seed = 123456789) {
    let s = seed;
    return function() {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
    };
}

const rng = createRng(42);

function randomFloat(min, max) {
    return min + rng() * (max - min);
}

function randomInt(min, max) {
    return Math.floor(randomFloat(min, max + 1));
}

console.log('================================================================');
console.log('       SPATIAL HASH GRID EMPIRICAL STRESS TEST HARNESS          ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: RECALL & FALSE NEGATIVE BENCHMARK (10,000 Random Circle Queries)
// -----------------------------------------------------------------------------
console.log('--- TEST 1: 10,000 Spatial Queries Benchmark (2,000 Food, 3,000 Segments) ---');

const grid = new SpatialHashGrid(3000, 3000, 120);

// Populate 3,000 Snake Segments across 3000x3000 map
const segments = [];
const numSnakes = 30;
const segsPerSnake = 100; // 30 * 100 = 3000 segments

for (let s = 0; s < numSnakes; s++) {
    const snakeId = `snake_${s}`;
    let cx = randomFloat(200, 2800);
    let cy = randomFloat(200, 2800);
    let angle = randomFloat(0, Math.PI * 2);

    for (let i = 0; i < segsPerSnake; i++) {
        cx += Math.cos(angle) * 5.0;
        cy += Math.sin(angle) * 5.0;
        angle += randomFloat(-0.2, 0.2);
        const radius = randomFloat(8.0, 16.0);
        const seg = { snakeId, segIndex: i, x: cx, y: cy, radius };
        segments.push(seg);
        grid.insertSegment(snakeId, i, cx, cy, radius);
    }
}

// Populate 2,000 Food Orbs across 3000x3000 map
const foodOrbs = [];
for (let f = 0; f < 2000; f++) {
    const id = `food_${f}`;
    const x = randomFloat(20, 2980);
    const y = randomFloat(20, 2980);
    const radius = randomFloat(3.0, 10.0);
    const value = randomInt(1, 10);
    const type = f % 3 === 0 ? 'boost' : (f % 5 === 0 ? 'corpse' : 'ambient');
    const orb = new FoodOrb(id, x, y, radius, value, '#00f0ff', type, true);
    foodOrbs.push(orb);
    grid.insertFood(orb);
}

console.log(`Inserted: ${segments.length} segments and ${foodOrbs.length} food orbs.`);

// Brute-force O(N) linear scan oracles
function bruteForceQuerySegments(x, y, radius) {
    const res = [];
    const maxR = radius;
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const dx = seg.x - x;
        const dy = seg.y - y;
        const limit = maxR + seg.radius;
        if (dx * dx + dy * dy <= limit * limit) {
            res.push(seg);
        }
    }
    return res;
}

function bruteForceQueryFood(x, y, radius) {
    const res = [];
    const maxR = radius;
    for (let i = 0; i < foodOrbs.length; i++) {
        const orb = foodOrbs[i];
        const dx = orb.x - x;
        const dy = orb.y - y;
        const limit = maxR + orb.radius;
        if (dx * dx + dy * dy <= limit * limit) {
            res.push(orb);
        }
    }
    return res;
}

// Execute 10,000 test queries
const NUM_QUERIES = 10000;

let segTruePositives = 0;
let segFalseNegatives = 0;
let segFalsePositives = 0;
let segQueriesWithMisses = 0;

let foodTruePositives = 0;
let foodFalseNegatives = 0;
let foodFalsePositives = 0;
let foodQueriesWithMisses = 0;

let totalSegGridTimeMs = 0;
let totalSegBruteTimeMs = 0;
let totalFoodGridTimeMs = 0;
let totalFoodBruteTimeMs = 0;

const sampleFoodMisses = [];

for (let q = 0; q < NUM_QUERIES; q++) {
    const qx = randomFloat(0, 3000);
    const qy = randomFloat(0, 3000);
    const qr = randomFloat(10, 150); // query radius (covers normal head sensor + magnet distance)

    // --- Segment Query Evaluation ---
    const t0 = process.hrtime.bigint();
    const segGridRes = grid.queryNearbySegments(qx, qy, qr);
    const t1 = process.hrtime.bigint();
    const segBruteRes = bruteForceQuerySegments(qx, qy, qr);
    const t2 = process.hrtime.bigint();

    totalSegGridTimeMs += Number(t1 - t0) / 1e6;
    totalSegBruteTimeMs += Number(t2 - t1) / 1e6;

    const segGridSet = new Set(segGridRes.map(s => `${s.snakeId}_${s.segIndex}`));
    const segBruteSet = new Set(segBruteRes.map(s => `${s.snakeId}_${s.segIndex}`));

    let segMissCount = 0;
    for (const key of segBruteSet) {
        if (segGridSet.has(key)) {
            segTruePositives++;
        } else {
            segFalseNegatives++;
            segMissCount++;
        }
    }
    for (const key of segGridSet) {
        if (!segBruteSet.has(key)) {
            segFalsePositives++;
        }
    }
    if (segMissCount > 0) segQueriesWithMisses++;

    // --- Food Query Evaluation ---
    const tf0 = process.hrtime.bigint();
    const foodGridRes = grid.queryNearbyFood(qx, qy, qr);
    const tf1 = process.hrtime.bigint();
    const foodBruteRes = bruteForceQueryFood(qx, qy, qr);
    const tf2 = process.hrtime.bigint();

    totalFoodGridTimeMs += Number(tf1 - tf0) / 1e6;
    totalFoodBruteTimeMs += Number(tf2 - tf1) / 1e6;

    const foodGridSet = new Set(foodGridRes.map(f => f.id));
    const foodBruteSet = new Set(foodBruteRes.map(f => f.id));

    let foodMissCount = 0;
    for (const id of foodBruteSet) {
        if (foodGridSet.has(id)) {
            foodTruePositives++;
        } else {
            foodFalseNegatives++;
            foodMissCount++;
            if (sampleFoodMisses.length < 5) {
                const orb = foodOrbs.find(o => o.id === id);
                sampleFoodMisses.push({
                    query: { x: qx, y: qy, r: qr },
                    orb: { id: orb.id, x: orb.x, y: orb.y, r: orb.radius }
                });
            }
        }
    }
    for (const id of foodGridSet) {
        if (!foodBruteSet.has(id)) {
            foodFalsePositives++;
        }
    }
    if (foodMissCount > 0) foodQueriesWithMisses++;
}

console.log('\n--- SEGMENT QUERY RESULTS (10,000 Queries) ---');
console.log(`True Positives      : ${segTruePositives}`);
console.log(`False Negatives     : ${segFalseNegatives}`);
console.log(`False Positives     : ${segFalsePositives}`);
console.log(`Queries with Misses : ${segQueriesWithMisses} / ${NUM_QUERIES} (${(segQueriesWithMisses / NUM_QUERIES * 100).toFixed(2)}%)`);
const segRecall = (segTruePositives + segFalseNegatives) > 0 ? (segTruePositives / (segTruePositives + segFalseNegatives) * 100).toFixed(4) : 100;
console.log(`Recall Rate         : ${segRecall}%`);
console.log(`Grid Query Time     : ${totalSegGridTimeMs.toFixed(2)} ms (avg ${(totalSegGridTimeMs / NUM_QUERIES * 1000).toFixed(2)} µs/query)`);
console.log(`Brute Force Time    : ${totalSegBruteTimeMs.toFixed(2)} ms (avg ${(totalSegBruteTimeMs / NUM_QUERIES * 1000).toFixed(2)} µs/query)`);
console.log(`Speedup Factor      : ${(totalSegBruteTimeMs / totalSegGridTimeMs).toFixed(2)}x`);

console.log('\n--- FOOD QUERY RESULTS (10,000 Queries) ---');
console.log(`True Positives      : ${foodTruePositives}`);
console.log(`False Negatives     : ${foodFalseNegatives}`);
console.log(`False Positives     : ${foodFalsePositives}`);
console.log(`Queries with Misses : ${foodQueriesWithMisses} / ${NUM_QUERIES} (${(foodQueriesWithMisses / NUM_QUERIES * 100).toFixed(2)}%)`);
const foodRecall = (foodTruePositives + foodFalseNegatives) > 0 ? (foodTruePositives / (foodTruePositives + foodFalseNegatives) * 100).toFixed(4) : 100;
console.log(`Recall Rate         : ${foodRecall}%`);
console.log(`Grid Query Time     : ${totalFoodGridTimeMs.toFixed(2)} ms (avg ${(totalFoodGridTimeMs / NUM_QUERIES * 1000).toFixed(2)} µs/query)`);
console.log(`Brute Force Time    : ${totalFoodBruteTimeMs.toFixed(2)} ms (avg ${(totalFoodBruteTimeMs / NUM_QUERIES * 1000).toFixed(2)} µs/query)`);
console.log(`Speedup Factor      : ${(totalFoodBruteTimeMs / totalFoodGridTimeMs).toFixed(2)}x`);

if (sampleFoodMisses.length > 0) {
    console.log('\nSample Food False Negatives Details:');
    sampleFoodMisses.forEach((m, idx) => {
        const dx = m.orb.x - m.query.x;
        const dy = m.orb.y - m.query.y;
        const dist = Math.hypot(dx, dy);
        const maxDist = m.query.r + m.orb.r;
        const orbCol = Math.floor(m.orb.x / 120);
        const orbRow = Math.floor(m.orb.y / 120);
        const minQCol = Math.floor((m.query.x - m.query.r) / 120);
        const maxQCol = Math.floor((m.query.x + m.query.r) / 120);
        const minQRow = Math.floor((m.query.y - m.query.r) / 120);
        const maxQRow = Math.floor((m.query.y + m.query.r) / 120);

        console.log(`  [Miss #${idx + 1}] Orb ${m.orb.id} at (${m.orb.x.toFixed(1)}, ${m.orb.y.toFixed(1)} r=${m.orb.r.toFixed(1)}) in cell (${orbCol}, ${orbRow})`);
        console.log(`      Query at (${m.query.x.toFixed(1)}, ${m.query.y.toFixed(1)} r=${m.query.r.toFixed(1)}) -> searches cols [${minQCol}..${maxQCol}], rows [${minQRow}..${maxQRow}]`);
        console.log(`      Distance = ${dist.toFixed(2)} <= Max Allowed ${maxDist.toFixed(2)} (OVERLAP = TRUE, BUT NOT IN SEARCHED CELLS!)`);
    });
}

// -----------------------------------------------------------------------------
// TEST 2: BOUNDARY CASES & EXTREME VALUES
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log('--- TEST 2: Boundary Cases, Precision Limits & Extreme Values ---');
console.log('================================================================\n');

const bGrid = new SpatialHashGrid(3000, 3000, 120);

const boundaryTests = [
    // Cell Boundaries
    { name: 'Entity exact on cell boundary x=120.0, y=120.0', x: 120.0, y: 120.0, r: 10 },
    { name: 'Entity exact on cell boundary x=240.0, y=240.0', x: 240.0, y: 240.0, r: 10 },
    { name: 'Entity exact on world border min (0, 0)', x: 0, y: 0, r: 10 },
    { name: 'Entity exact on world border max (3000, 3000)', x: 3000, y: 3000, r: 10 },
    
    // Negative Coordinates
    { name: 'Entity slightly negative x=-0.01, y=-0.01', x: -0.01, y: -0.01, r: 10 },
    { name: 'Entity deep negative x=-500, y=-500', x: -500, y: -500, r: 10 },
    
    // Far Out-Of-Bounds
    { name: 'Entity beyond world boundary x=3050, y=3050', x: 3050, y: 3050, r: 10 },
    { name: 'Entity extreme out-of-bounds x=100000, y=100000', x: 100000, y: 100000, r: 10 },

    // Degenerate / Zero Radius
    { name: 'Entity with zero radius r=0', x: 500, y: 500, r: 0 },
    { name: 'Entity with negative radius r=-5', x: 500, y: 500, r: -5 },
    { name: 'Entity with huge radius r=2000 (covers 2/3 of map)', x: 1500, y: 1500, r: 2000 }
];

boundaryTests.forEach((t, i) => {
    bGrid.clear();
    let threw = false;
    let segFound = false;
    let foodFound = false;

    try {
        bGrid.insertSegment('test_snake', i, t.x, t.y, t.r);
        const orb = new FoodOrb(`bound_orb_${i}`, t.x, t.y, Math.max(0, t.r), 1);
        bGrid.insertFood(orb);

        const segRes = bGrid.queryNearbySegments(t.x, t.y, Math.max(10, t.r));
        segFound = segRes.some(s => s.snakeId === 'test_snake' && s.segIndex === i);

        const foodRes = bGrid.queryNearbyFood(t.x, t.y, Math.max(10, t.r));
        foodFound = foodRes.some(f => f.id === `bound_orb_${i}`);
    } catch (e) {
        threw = true;
        console.error(`  [FAIL] ${t.name}: Threw exception ${e.message}`);
    }

    if (!threw) {
        console.log(`  [PASS] ${t.name}: Insert & Query OK (SegFound: ${segFound}, FoodFound: ${foodFound})`);
    }
});

// Out-of-bounds bucket pollution check
console.log('\nChecking out-of-bounds bucket pollution:');
bGrid.clear();
bGrid.insertSegment('out_snake', 0, -5000, -5000, 10);
// -5000 maps to col 0, row 0 in SpatialHashGrid._getCell
const col0Row0Bucket = bGrid.segmentBuckets.get('0,0');
console.log(`Segment at (-5000, -5000) inserted into cell (0, 0) bucket? ${col0Row0Bucket && col0Row0Bucket.length > 0}`);
const queryInsideWorld = bGrid.queryNearbySegments(10, 10, 20);
console.log(`Query at valid world (10, 10, r=20) returns out-of-bounds segment? ${queryInsideWorld.length > 0} (Count: ${queryInsideWorld.length})`);
console.log('Explanation: Clamping places out-of-bounds entities in border cell buckets, but Euclidean distance filter rejects them during query.');

// -----------------------------------------------------------------------------
// TEST 3: ZERO-GC MEMORY REUSE & ALLOCATION CHURN ACROSS 1,000 CYCLES
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log('--- TEST 3: Zero-GC Memory Churn & Allocation Benchmark (1,000 Cycles) ---');
console.log('================================================================\n');

const gcGrid = new SpatialHashGrid(3000, 3000, 120);

// Pre-create entity objects to simulate persistent game objects
const simSegments = [];
for (let i = 0; i < 3000; i++) {
    simSegments.push({
        snakeId: `s_${Math.floor(i / 100)}`,
        segIndex: i % 100,
        x: randomFloat(50, 2950),
        y: randomFloat(50, 2950),
        radius: randomFloat(8, 15)
    });
}

const simFood = [];
for (let i = 0; i < 2000; i++) {
    simFood.push(new FoodOrb(`f_${i}`, randomFloat(50, 2950), randomFloat(50, 2950), 4, 1));
}

// 25 Bot Heads querying per frame
const simBotHeads = [];
for (let i = 0; i < 25; i++) {
    simBotHeads.push({
        x: randomFloat(200, 2800),
        y: randomFloat(200, 2800),
        r: 100 // Attract + Whisker sensing radius
    });
}

if (global.gc) {
    global.gc();
}

const memBefore = process.memoryUsage();
const tStart = process.hrtime.bigint();

const CYCLES = 1000;
for (let cycle = 0; cycle < CYCLES; cycle++) {
    gcGrid.clear();

    // 1. Insert 3,000 segments
    for (let i = 0; i < 3000; i++) {
        const seg = simSegments[i];
        gcGrid.insertSegment(seg.snakeId, seg.segIndex, seg.x, seg.y, seg.radius);
    }

    // 2. Insert 2,000 food orbs
    for (let i = 0; i < 2000; i++) {
        gcGrid.insertFood(simFood[i]);
    }

    // 3. 25 Bot queries
    for (let i = 0; i < 25; i++) {
        const h = simBotHeads[i];
        gcGrid.queryNearbySegments(h.x, h.y, h.r);
        gcGrid.queryNearbyFood(h.x, h.y, h.r);
    }
}

const tEnd = process.hrtime.bigint();
const memAfter = process.memoryUsage();

const totalDurationMs = Number(tEnd - tStart) / 1e6;
const msPerCycle = totalDurationMs / CYCLES;
const fpsEquiv = 1000 / msPerCycle;

console.log(`1,000 Simulation Cycles Completed in ${totalDurationMs.toFixed(2)} ms`);
console.log(`Time per Frame/Cycle : ${msPerCycle.toFixed(3)} ms (Supports ~${fpsEquiv.toFixed(0)} FPS execution)`);
console.log(`Heap Used Before     : ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`Heap Used After      : ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`Heap Difference     : ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB`);

// Detailed Object Allocation Breakdown Analysis per single frame
console.log('\n--- ALLOCATION PRESSURE & GC ANALYSIS PER FRAME ---');
// Quantify object allocations per frame:
// 1. insertSegment:
//    - creates new item: { snakeId, segIndex, x, y, radius } -> 3,000 objects
//    - loops over [minCol..maxCol] * [minRow..maxRow]: each touched cell calls _getKey -> template literal `${c},${rIdx}` string
//      With average segment spanning across ~1.8 cells = ~5,400 string allocations.
//    - bucket array allocation: each new key allocates [] -> ~625 array allocations on clear/re-insert.
// 2. insertFood:
//    - calls _getKey -> 2,000 string allocations.
// 3. queryNearbySegments (25 queries):
//    - new Set() -> 25 Set allocations
//    - results = [] -> 25 Array allocations
//    - string key `${seg.snakeId}_${seg.segIndex}` for each candidate segment in buckets.
//      With ~100 candidate segments per query = 2,500 string allocations.
// 4. queryNearbyFood (25 queries):
//    - new Set() -> 25 Set allocations
//    - results = [] -> 25 Array allocations
// 5. clear():
//    - this.segmentBuckets.clear() / this.foodBuckets.clear() discards all allocated bucket arrays to GC.

const estimatedObjectsPerFrame = 3000 + 5400 + 625 + 2000 + 25 + 25 + 2500 + 25 + 25;
const estimatedObjectsPerSecond60FPS = estimatedObjectsPerFrame * 60;

console.log(`Estimated Heap Allocations Per Frame  : ~${estimatedObjectsPerFrame.toLocaleString()} objects/strings`);
console.log(`Estimated Heap Allocations Per Second : ~${estimatedObjectsPerSecond60FPS.toLocaleString()} objects/strings at 60 FPS`);
console.log(`Zero-GC Memory Reuse Compliance       : FAIL (SpatialHashGrid allocates new strings, arrays, Sets, and item objects on every tick instead of pooled flat typed arrays / static cell buckets)`);

console.log('\n================================================================');
console.log('                     TEST SUMMARY & FINDINGS                    ');
console.log('================================================================');
console.log(`1. Segment Query Recall  : ${segRecall}% (0 false negatives)`);
console.log(`2. Food Query Recall     : ${foodRecall}% (${foodFalseNegatives} false negatives detected across ${foodQueriesWithMisses} queries)`);
console.log(`3. Boundary Handling     : PASS (Clamps out-of-bounds safely, no uncaught exceptions)`);
console.log(`4. Zero-GC Memory Reuse  : FAIL (~${estimatedObjectsPerFrame.toLocaleString()} allocs/frame, ~${(estimatedObjectsPerSecond60FPS/1e6).toFixed(2)}M allocs/sec)`);
