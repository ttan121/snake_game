/**
 * Detailed Diagnostic Runner for script.js
 */
const path = require('path');
const scriptPath = path.resolve(__dirname, '../../script.js');
const { CONFIG, SKINS, Snake, Camera, World, GameEngine } = require(scriptPath);

console.log('--- 1. DIAGNOSTIC: 360° STEERING & WRAPPING ---');
{
    const snake = new Snake('s1', 'Player', 1500, 1500);
    const start = -Math.PI + 0.1;
    const target = Math.PI - 0.1;
    snake.angle = start;
    snake.setTargetAngle(target);

    console.log(`Start Angle: ${start} (${(start * 180 / Math.PI).toFixed(2)} deg)`);
    console.log(`Target Angle: ${target} (${(target * 180 / Math.PI).toFixed(2)} deg)`);

    const turnRate = CONFIG.BASE_TURN_RATE * Math.pow(CONFIG.TURN_REF_MASS / (snake.mass + CONFIG.TURN_REF_MASS), CONFIG.TURN_DECAY_EXP);
    console.log(`Turn Rate at mass ${snake.mass}: ${turnRate.toFixed(4)} rad/s (${(turnRate * 180 / Math.PI).toFixed(2)} deg/s)`);

    let history = [];
    for (let i = 0; i < 5; i++) {
        const before = snake.angle;
        snake.update(1 / 60);
        const delta = snake.angle - before;
        history.push({ step: i + 1, angle: snake.angle, delta });
        console.log(`Step ${i + 1}: angle = ${snake.angle.toFixed(5)}, delta = ${delta.toFixed(5)}`);
    }
}

console.log('\n--- 2. DIAGNOSTIC: VERTEBRAL SPINE STABILITY (1000 STEPS) ---');
{
    // Test normal snake spawning at default mass (20.0)
    const snake = new Snake('s_normal', 'Player', 1500, 1500);
    console.log(`Initial mass: ${snake.mass}, Segments: ${snake.segments.length}, JointSpacing: ${snake.jointSpacing}`);
    
    // Warm up initial 10 steps
    for (let i = 0; i < 10; i++) snake.update(1 / 60);

    let minBaseDist = Infinity, maxBaseDist = -Infinity, maxBaseErr = 0;
    for (let step = 0; step < 1000; step++) {
        snake.update(1 / 60);
        const segs = snake.getSegments();
        for (let i = 1; i < segs.length; i++) {
            const d = Math.hypot(segs[i].x - segs[i - 1].x, segs[i].y - segs[i - 1].y);
            const err = Math.abs(d - snake.jointSpacing);
            if (err > maxBaseErr) maxBaseErr = err;
            if (d < minBaseDist) minBaseDist = d;
            if (d > maxBaseDist) maxBaseDist = d;
        }
    }
    console.log(`Normal Speed (150px/s) over 1000 steps:`);
    console.log(`  Expected Spacing: ${snake.jointSpacing.toFixed(4)}px`);
    console.log(`  Min Dist: ${minBaseDist.toFixed(4)}px, Max Dist: ${maxBaseDist.toFixed(4)}px, Max Spacing Error: ${maxBaseErr.toFixed(6)}px`);

    // Now test Boost Speed (285px/s)
    const boostSnake = new Snake('s_boost', 'BoostPlayer', 1500, 1500);
    // Lock mass by resetting each frame or starting high
    boostSnake.mass = 500;
    // Re-seed history for mass 500
    boostSnake.recalculateDimensions();
    const count500 = boostSnake.calculateSegmentCount();
    const spacing500 = boostSnake.jointSpacing;
    boostSnake.pathHistory = [];
    const cumDist = count500 * spacing500 * 2.0;
    for (let s = cumDist; s >= 0; s -= 2.0) {
        boostSnake.pathHistory.push({
            x: boostSnake.x - Math.cos(boostSnake.angle) * s,
            y: boostSnake.y - Math.sin(boostSnake.angle) * s,
            s: cumDist - s
        });
    }
    boostSnake.currentPathDistance = cumDist;
    boostSnake.updateSegments();

    boostSnake.setBoosting(true);
    for (let i = 0; i < 30; i++) {
        boostSnake.update(1 / 60);
        boostSnake.mass = 500;
    }

    let minBoostDist = Infinity, maxBoostDist = -Infinity, maxBoostErr = 0;
    for (let step = 0; step < 1000; step++) {
        boostSnake.update(1 / 60);
        boostSnake.mass = 500;
        const segs = boostSnake.getSegments();
        for (let i = 1; i < segs.length; i++) {
            const d = Math.hypot(segs[i].x - segs[i - 1].x, segs[i].y - segs[i - 1].y);
            const err = Math.abs(d - spacing500);
            if (err > maxBoostErr) maxBoostErr = err;
            if (d < minBoostDist) minBoostDist = d;
            if (d > maxBoostDist) maxBoostDist = d;
        }
    }
    console.log(`Boost Speed (285px/s) over 1000 steps:`);
    console.log(`  Expected Spacing: ${spacing500.toFixed(4)}px`);
    console.log(`  Min Dist: ${minBoostDist.toFixed(4)}px, Max Dist: ${maxBoostDist.toFixed(4)}px, Max Spacing Error: ${maxBoostErr.toFixed(6)}px`);
}

console.log('\n--- 3. DIAGNOSTIC: BOOST MASS DEPLETION & CUTOFF ---');
{
    const snake = new Snake('s_drain', 'DrainPlayer', 1500, 1500);
    snake.mass = 22.0;
    snake.setBoosting(true);
    console.log(`Initial mass: ${snake.mass}, isBoosting: ${snake.isBoosting}`);

    let step = 0;
    while (snake.isBoosting && step < 100) {
        step++;
        snake.update(1 / 60);
        console.log(`Step ${step}: mass = ${snake.mass.toFixed(6)}, isBoosting = ${snake.isBoosting}`);
    }

    console.log(`After cutoff reached (step ${step}): mass = ${snake.mass.toFixed(6)}, isBoosting = ${snake.isBoosting}`);

    // Try boosting again
    snake.setBoosting(true);
    console.log(`After setBoosting(true): isBoosting = ${snake.isBoosting}`);
}
