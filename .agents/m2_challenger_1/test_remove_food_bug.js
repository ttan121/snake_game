const { SpatialHashGrid, FoodOrb } = require('../../script.js');

console.log('=== TEST: Moving Food Orb removeFood Bug ===');
const grid = new SpatialHashGrid(3000, 3000, 120);

const orb = new FoodOrb('boost_move_1', 119.0, 100.0, 4.0, 1, '#00f0ff', 'boost', true);
orb.vx = 50.0; // Moving right
grid.insertFood(orb);

console.log('Orb inserted at x=119.0 (Cell 0, 0)');
console.log('Cell 0,0 bucket size:', grid.foodBuckets.get('0,0')?.length);

// Orb moves across cell boundary to x=125.0
orb.x = 125.0;

// Try to remove orb using removeFood
grid.removeFood(orb);

console.log('Called removeFood(orb) when orb.x=125.0 (Cell 1, 0)');
console.log('Cell 0,0 bucket size after removeFood:', grid.foodBuckets.get('0,0')?.length);
console.log('Cell 1,0 bucket size after removeFood:', grid.foodBuckets.get('1,0')?.length);

const queryResults = grid.queryNearbyFood(119.0, 100.0, 10.0);
console.log('Query at old position (119, 100) returns orb?', queryResults.some(f => f.id === orb.id));

if (queryResults.some(f => f.id === orb.id)) {
    console.log('>>> CONFIRMED: Moving food orb was NOT removed from old cell bucket!');
}
