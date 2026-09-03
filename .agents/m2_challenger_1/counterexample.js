const { SpatialHashGrid, FoodOrb } = require('../../script.js');

console.log('=== COUNTEREXAMPLE TEST FOR FOOD QUERY FALSE NEGATIVE ===');
const grid = new SpatialHashGrid(3000, 3000, 120);

// Create a food orb with radius 8 centered at x = 121, y = 100
const food = new FoodOrb('orb_bug_1', 121.0, 100.0, 8.0, 10, '#ff0000', 'corpse', true);
grid.insertFood(food);

// Query circle at x = 110, y = 100, radius = 5
const qx = 110.0, qy = 100.0, qr = 5.0;

// Brute-force check:
const dx = food.x - qx;
const dy = food.y - qy;
const dist = Math.hypot(dx, dy);
const maxDist = qr + food.radius;
const bruteForceMatch = dist <= maxDist;

// Spatial grid query:
const results = grid.queryNearbyFood(qx, qy, qr);
const gridFound = results.some(f => f.id === food.id);

console.log(`Food orb center: (${food.x}, ${food.y}), radius: ${food.radius}`);
console.log(`Query circle center: (${qx}, ${qy}), radius: ${qr}`);
console.log(`Distance: ${dist.toFixed(2)}, Max allowed distance (qr + orbR): ${maxDist.toFixed(2)}`);
console.log(`Brute-force overlap: ${bruteForceMatch}`);
console.log(`Spatial grid query results count: ${results.length}, Found: ${gridFound}`);

if (bruteForceMatch && !gridFound) {
    console.log('>>> CONFIRMED BUG: SpatialHashGrid.queryNearbyFood produces FALSE NEGATIVE (Missed overlapping food orb across cell boundary)!');
} else {
    console.log('>>> No false negative in this specific case.');
}
