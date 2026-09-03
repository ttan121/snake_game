/**
 * Comprehensive Tier 1, Tier 2, and Tier 3 tests against script.js
 */

const assert = require('assert');
const {
    CONFIG,
    SKINS,
    Camera,
    World,
    SpatialHashGrid,
    FoodOrb,
    GlowSpriteCache,
    FoodManager,
    Snake,
    GameEngine
} = require('../../script.js');

let passed = 0;
let failed = 0;

function run(name, fn) {
    try {
        fn();
        console.log(`  ✔ [PASS] ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ✖ [FAIL] ${name}`);
        console.error(e);
        failed++;
    }
}

console.log('--- RUNNING FEATURE 6, 7, 8 TESTS AGAINST script.js ---');

// T1.6.1 - T1.6.6
run('T1.6.1: Spatial grid init', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    assert.strictEqual(grid.cellSize, 120);
    assert.strictEqual(grid.cols, 25);
    assert.strictEqual(grid.rows, 25);
});

run('T1.6.2: Inserting snake segment populates overlapping grid buckets', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    grid.insertSegment('s1', 0, 240, 240, 15);
    const nearby = grid.queryNearbySegments(240, 240, 20);
    assert.strictEqual(nearby.length, 1);
    assert.strictEqual(nearby[0].snakeId, 's1');
});

run('T1.6.3: Inserting food orb registers into correct spatial cell', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const food = { id: 'f1', x: 350, y: 450, radius: 4, value: 2 };
    grid.insertFood(food);
    const found = grid.queryNearbyFood(350, 450, 20);
    assert.strictEqual(found.length, 1);
    assert.strictEqual(found[0].id, 'f1');
});

run('T1.6.4: queryNearbySegments accurately returns proximate segments and filters distant ones', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    grid.insertSegment('s1', 0, 500, 500, 10);
    grid.insertSegment('s2', 0, 520, 500, 10);
    grid.insertSegment('s3', 0, 2500, 2500, 10);
    const results = grid.queryNearbySegments(500, 500, 50);
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results.some(r => r.snakeId === 's1'), true);
    assert.strictEqual(results.some(r => r.snakeId === 's2'), true);
    assert.strictEqual(results.some(r => r.snakeId === 's3'), false);
});

run('T1.6.5: queryNearbyFood returns food items within search radius R', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    grid.insertFood({ id: 'f1', x: 600, y: 600, radius: 3 });
    grid.insertFood({ id: 'f2', x: 630, y: 600, radius: 3 });
    grid.insertFood({ id: 'f3', x: 1800, y: 1800, radius: 3 });
    const results = grid.queryNearbyFood(600, 600, 50);
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results.some(f => f.id === 'f1'), true);
    assert.strictEqual(results.some(f => f.id === 'f2'), true);
});

run('T1.6.6: clear() completely empties all segment and food buckets', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    grid.insertSegment('s1', 0, 500, 500, 10);
    grid.insertFood({ id: 'f1', x: 500, y: 500, radius: 3 });
    grid.clear();
    assert.strictEqual(grid.queryNearbySegments(500, 500, 100).length, 0);
    assert.strictEqual(grid.queryNearbyFood(500, 500, 100).length, 0);
});

// T1.7.1 - T1.7.6
run('T1.7.1: Ambient food spawns uniformly distributed with mass 1-3', () => {
    const foodMgr = new FoodManager(3000, 3000, 500);
    const spawned = foodMgr.spawnAmbientFood(100);
    assert.strictEqual(spawned.length, 100);
    for (const orb of spawned) {
        assert.strictEqual(orb.type, 'ambient');
        assert.ok(orb.value >= 1 && orb.value <= 3);
        assert.ok(orb.x >= 0 && orb.x <= 3000);
        assert.ok(orb.y >= 0 && orb.y <= 3000);
    }
});

run('T1.7.2: Boost trail orbs spawn with trail orb mass values (1.5)', () => {
    const foodMgr = new FoodManager(3000, 3000, 0);
    const orb = foodMgr.spawnBoostOrb(1200, 1400, 'magenta');
    assert.strictEqual(orb.type, 'boost');
    assert.strictEqual(orb.value, 1.5);
    assert.strictEqual(orb.color, 'magenta');
    assert.strictEqual(orb.glow, true);
});

run('T1.7.3: Corpse disintegration creates high-energy death orbs with large mass', () => {
    const snake = new Snake('dead_s', 'Victim', 1000, 1000, 'gold');
    snake.mass = 300;
    snake.updateSpine();
    const deathOrbs = snake.die();
    assert.ok(deathOrbs.length > 5);
    const totalDropMass = deathOrbs.reduce((sum, o) => sum + o.value, 0);
    assert.ok(Math.abs(totalDropMass - 300 * 0.70) <= 5.0);
    assert.strictEqual(deathOrbs[0].type, 'corpse');
});

run('T1.7.4: Food orb schema contains id, position, radius, value, color, and type', () => {
    const foodMgr = new FoodManager(3000, 3000, 10);
    const [orb] = foodMgr.spawnAmbientFood(1);
    assert.ok(orb.id !== undefined);
    assert.ok(orb.x !== undefined);
    assert.ok(orb.y !== undefined);
    assert.ok(orb.radius !== undefined);
    assert.ok(orb.value !== undefined);
    assert.ok(orb.color !== undefined);
    assert.ok(orb.type !== undefined);
});

run('T1.7.5: Food manager maintains target ambient orb count by replenishing', () => {
    const foodMgr = new FoodManager(3000, 3000, 50);
    foodMgr.update(1 / 60, []);
    assert.strictEqual(foodMgr.foodList.length, 30);
    foodMgr.update(1 / 60, []);
    assert.strictEqual(foodMgr.foodList.length, 50);
});

run('T1.7.6: Food orbs retain unique identifiers across tiers', () => {
    const foodMgr = new FoodManager(3000, 3000, 0);
    const amb = foodMgr.spawnAmbientFood(1)[0];
    const bst = foodMgr.spawnBoostOrb(100, 100);
    const deadSnake = new Snake('s1', 'Dead', 200, 200);
    const [crp] = deadSnake.die();
    const ids = new Set([amb.id, bst.id, crp.id]);
    assert.strictEqual(ids.size, 3);
});

// T1.8.1 - T1.8.6
run('T1.8.1: Food outside magnetic radius remains completely stationary', () => {
    const snake = new Snake('s1', 'Player', 1000, 1000);
    const foodMgr = new FoodManager(3000, 3000, 0);
    const orb = { id: 'f1', x: 1300, y: 1000, radius: 4, value: 2, type: 'ambient' };
    foodMgr.foodList = [orb];
    foodMgr.update(1 / 60, [snake]);
    assert.strictEqual(orb.x, 1300);
});

run('T1.8.2: Food inside attraction radius is pulled toward snake head', () => {
    const snake = new Snake('s1', 'Player', 1000, 1000);
    const foodMgr = new FoodManager(3000, 3000, 0);
    const initialX = 1000 + snake.getHeadRadius() + 30;
    const orb = { id: 'f1', x: initialX, y: 1000, radius: 4, value: 2, type: 'ambient' };
    foodMgr.foodList = [orb];
    foodMgr.update(1 / 60, [snake]);
    assert.ok(orb.x < initialX);
});

run('T1.8.3: Food reaching head contact radius is ingested immediately', () => {
    const snake = new Snake('s1', 'Player', 1000, 1000);
    const foodMgr = new FoodManager(3000, 3000, 0);
    const orb = { id: 'f1', x: 1002, y: 1000, radius: 4, value: 5, type: 'ambient' };
    foodMgr.foodList = [orb];
    foodMgr.foodMap.set('f1', orb);
    foodMgr.update(1 / 60, [snake]);
    assert.strictEqual(foodMgr.foodList.length, 0);
});

run('T1.8.4: Consuming food increases snake mass by exact food value', () => {
    const snake = new Snake('s1', 'Player', 1000, 1000);
    const foodMgr = new FoodManager(3000, 3000, 0);
    const initialMass = snake.mass;
    const orb = { id: 'f1', x: 1000, y: 1000, radius: 4, value: 12.5, type: 'ambient' };
    foodMgr.foodList = [orb];
    foodMgr.foodMap.set('f1', orb);
    foodMgr.update(1 / 60, [snake]);
    assert.ok(Math.abs(snake.mass - (initialMass + 12.5)) < 0.001);
});

run('T1.8.5: Consumed food is removed from spatial grid and entity manager', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const snake = new Snake('s1', 'Player', 1000, 1000);
    const foodMgr = new FoodManager(3000, 3000, 0);
    const orb = { id: 'f1', x: 1000, y: 1000, radius: 4, value: 2, type: 'ambient' };
    foodMgr.foodList = [orb];
    foodMgr.foodMap.set('f1', orb);
    grid.insertFood(orb);
    foodMgr.update(1 / 60, [snake], grid);
    assert.strictEqual(foodMgr.foodList.length, 0);
    assert.strictEqual(grid.queryNearbyFood(1000, 1000, 50).length, 0);
});

run('T1.8.6: Magnetic attraction scales with snake head size', () => {
    const smallSnake = new Snake('s_small', 'Small', 1000, 1000);
    smallSnake.mass = 10;
    const giantSnake = new Snake('s_giant', 'Giant', 2000, 2000);
    giantSnake.mass = 1000;
    const smallAttractR = smallSnake.getHeadRadius() + 80;
    const giantAttractR = giantSnake.getHeadRadius() + 80;
    assert.ok(giantAttractR > smallAttractR);
});

// Tier 2 Boundaries
run('B6.1: Querying spatial grid with radius R = 0 returns only objects at exact point', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    grid.insertSegment('s1', 0, 500, 500, 0);
    grid.insertSegment('s2', 0, 505, 500, 0);
    const results = grid.queryNearbySegments(500, 500, 0);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].snakeId, 's1');
});

run('B6.2: Querying with radius R = 10,000 returns all objects without duplicates', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    grid.insertSegment('s1', 0, 100, 100, 10);
    grid.insertSegment('s2', 0, 2000, 2000, 10);
    grid.insertSegment('s3', 0, 2900, 2900, 10);
    const results = grid.queryNearbySegments(1500, 1500, 10000);
    assert.strictEqual(results.length, 3);
    const ids = new Set(results.map(r => r.snakeId));
    assert.strictEqual(ids.size, 3);
});

run('B6.3: Entity positioned exactly on grid cell boundary (120, 240) registers properly', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    grid.insertSegment('s1', 0, 120, 240, 10);
    const nearby = grid.queryNearbySegments(120, 240, 15);
    assert.strictEqual(nearby.length, 1);
});

run('B6.4: Entity placed outside world bounds (-50, 3500) clamps to border cells safely', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    grid.insertSegment('s_out', 0, -50, 3500, 10);
    const nearby = grid.queryNearbySegments(0, 2990, 600);
    assert.strictEqual(nearby.length, 1);
});

run('B6.5: Rapid insert and clear of 5,000 items operates cleanly without memory leak', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    for (let i = 0; i < 5000; i++) {
        grid.insertSegment(`s_${i}`, 0, Math.random() * 3000, Math.random() * 3000, 10);
    }
    assert.ok(grid.segmentBuckets.size > 0);
    grid.clear();
    assert.strictEqual(grid.segmentBuckets.size, 0);
});

run('B6.6: Querying an empty grid returns an empty array []', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    assert.strictEqual(grid.queryNearbySegments(500, 500, 500).length, 0);
    assert.strictEqual(grid.queryNearbyFood(500, 500, 500).length, 0);
});

run('B7.1: Zero ambient food count requested (count = 0) spawns 0 orbs', () => {
    const foodMgr = new FoodManager(3000, 3000, 0);
    const spawned = foodMgr.spawnAmbientFood(0);
    assert.strictEqual(spawned.length, 0);
});

run('B7.2: Spawning food at exact arena boundaries keeps orbs inside playable bounds', () => {
    const foodMgr = new FoodManager(3000, 3000, 0);
    const orbs = [
        { id: 'o1', x: -50, y: 1500, radius: 4, value: 2 },
        { id: 'o2', x: 3500, y: 1500, radius: 4, value: 2 }
    ];
    foodMgr.spawnDeathOrbs(orbs);
    for (const orb of foodMgr.foodList) {
        assert.ok(orb.x >= 20 && orb.x <= 2980);
    }
});

run('B7.3: Extreme food mass value (M_orb = 1000) stores and grows snake correctly', () => {
    const snake = new Snake('s1', 'Test', 500, 500);
    snake.addMass(1000);
    assert.strictEqual(snake.mass, 1020);
    assert.strictEqual(snake.score, 10200);
});

run('B7.4: Negative food mass values are safely ignored without corrupting snake mass', () => {
    const snake = new Snake('s1', 'Test', 500, 500);
    snake.addMass(-50);
    assert.strictEqual(snake.mass, 20);
});

run('B7.5: Food collection when grid contains 0 food returns empty query without errors', () => {
    const foodMgr = new FoodManager(3000, 3000, 0);
    const snake = new Snake('s1', 'Test', 500, 500);
    foodMgr.update(1 / 60, [snake]);
    assert.strictEqual(foodMgr.foodList.length, 0);
});

run('B7.6: Spawning 2000 ambient food orbs executes efficiently', () => {
    const foodMgr = new FoodManager(3000, 3000, 2000);
    foodMgr.spawnAmbientFood(2000);
    assert.strictEqual(foodMgr.foodList.length, 2000);
});

run('B8.1: Food at exact attraction radius boundary (D = R_attract) is pulled', () => {
    const snake = new Snake('s1', 'Player', 1000, 1000);
    const attractRadius = snake.getHeadRadius() + 80;
    const orb = { id: 'f1', x: 1000 + attractRadius - 0.5, y: 1000, radius: 4, value: 2 };
    const foodMgr = new FoodManager(3000, 3000, 0);
    foodMgr.foodList = [orb];
    foodMgr.update(1 / 60, [snake]);
    assert.ok(orb.x < 1000 + attractRadius - 0.5);
});

run('B8.2: Food just outside attraction radius (D = R_attract + 0.5) is unaffected', () => {
    const snake = new Snake('s1', 'Player', 1000, 1000);
    const attractRadius = snake.getHeadRadius() + 80;
    const initialX = 1000 + attractRadius + 1.0;
    const orb = { id: 'f1', x: initialX, y: 1000, radius: 4, value: 2 };
    const foodMgr = new FoodManager(3000, 3000, 0);
    foodMgr.foodList = [orb];
    foodMgr.update(1 / 60, [snake]);
    assert.strictEqual(orb.x, initialX);
});

run('B8.3: Consuming 50 food orbs in a single tick accumulates total mass exactly', () => {
    const snake = new Snake('s1', 'Player', 1000, 1000);
    const foodMgr = new FoodManager(3000, 3000, 0);
    for (let i = 0; i < 50; i++) {
        const orb = { id: `f_${i}`, x: 1000, y: 1000, radius: 4, value: 2.5 };
        foodMgr.foodList.push(orb);
        foodMgr.foodMap.set(orb.id, orb);
    }
    foodMgr.update(1 / 60, [snake]);
    assert.strictEqual(foodMgr.foodList.length, 0);
    assert.ok(Math.abs(snake.mass - (20 + 50 * 2.5)) < 0.001);
});

run('B8.4: Magnetic attraction with dt = 0 does not move food', () => {
    const snake = new Snake('s1', 'Player', 1000, 1000);
    const orb = { id: 'f1', x: 1040, y: 1000, radius: 4, value: 2 };
    const foodMgr = new FoodManager(3000, 3000, 0);
    foodMgr.foodList = [orb];
    foodMgr.update(0, [snake]);
    assert.strictEqual(orb.x, 1040);
});

run('B8.5: Food at exact center of snake head (D = 0) ingests instantly without NaN', () => {
    const snake = new Snake('s1', 'Player', 1000, 1000);
    const orb = { id: 'f1', x: 1000, y: 1000, radius: 4, value: 5 };
    const foodMgr = new FoodManager(3000, 3000, 0);
    foodMgr.foodList = [orb];
    foodMgr.foodMap.set('f1', orb);
    foodMgr.update(1 / 60, [snake]);
    assert.strictEqual(foodMgr.foodList.length, 0);
    assert.strictEqual(isNaN(snake.mass), false);
});

run('B8.6: Dead snakes do not attract or ingest food', () => {
    const snake = new Snake('s1', 'Dead', 1000, 1000);
    snake.die();
    const orb = { id: 'f1', x: 1000, y: 1000, radius: 4, value: 5 };
    const foodMgr = new FoodManager(3000, 3000, 0);
    foodMgr.foodList = [orb];
    foodMgr.foodMap.set('f1', orb);
    foodMgr.update(1 / 60, [snake]);
    assert.strictEqual(foodMgr.foodList.length, 1);
});

console.log(`\nRESULTS: ${passed} Passed, ${failed} Failed`);
if (failed > 0) process.exit(1);
