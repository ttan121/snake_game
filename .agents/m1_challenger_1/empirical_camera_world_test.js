/**
 * Empirical Stress Test Harness for Camera and World Systems
 * Milestone 1 Challenger 1 (teamwork_preview_challenger)
 */

const { CONFIG, Camera, World } = require('../../script.js');

const NODE_PATH = process.execPath;
console.log(`[TEST HARNESS] Starting Empirical Stress Testing of Camera & World Systems`);
console.log(`[TEST HARNESS] Node runtime: ${NODE_PATH} (${process.version})`);

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function assert(condition, message, details = {}) {
    totalTests++;
    if (condition) {
        passedTests++;
    } else {
        failedTests++;
        const failureInfo = { message, details };
        failureDetails.push(failureInfo);
        console.error(`  ❌ FAIL: ${message}`, details);
    }
}

function runSection(title, fn) {
    console.log(`\n================================================================`);
    console.log(`▶ SECTION: ${title}`);
    console.log(`================================================================`);
    try {
        fn();
    } catch (err) {
        assert(false, `Unexpected exception in section "${title}": ${err.message}`, { stack: err.stack });
    }
}

// ============================================================================
// TEST SUITE 1: Coordinate Transformations & Numerical Drift (50,000+ trials)
// ============================================================================
runSection('1. Coordinate Transformations & Zero Drift Verification', () => {
    const camera = new Camera(1920, 1080);
    const NUM_TRIALS = 10000;
    let maxDriftX = 0;
    let maxDriftY = 0;
    let totalDriftX = 0;
    let totalDriftY = 0;

    // Test across various camera setups
    const cameraConfigs = [
        { name: 'Standard 1080p center', x: 1500, y: 1500, zoom: 1.0, w: 1920, h: 1080 },
        { name: 'Min zoom top-left', x: 0, y: 0, zoom: 0.35, w: 800, h: 600 },
        { name: 'Max zoom 1440p bottom-right', x: 3000, y: 3000, zoom: 1.05, w: 2560, h: 1440 },
        { name: 'Arbitrary float zoom & odd resolution', x: 742.123456, y: 2194.881234, zoom: 0.7182818, w: 1367, h: 769 },
        { name: '4K extreme out-of-world', x: -500, y: 4000, zoom: 0.5, w: 3840, h: 2160 }
    ];

    for (const cfg of cameraConfigs) {
        camera.x = cfg.x;
        camera.y = cfg.y;
        camera.zoom = cfg.zoom;
        camera.resize(cfg.w, cfg.h);

        let cfgMaxDrift = 0;
        for (let i = 0; i < NUM_TRIALS; i++) {
            // Random coordinates across and far beyond the arena [-50000 to +50000]
            const wx = (Math.random() - 0.5) * 100000;
            const wy = (Math.random() - 0.5) * 100000;

            const screen = camera.worldToScreen(wx, wy);
            const recovered = camera.screenToWorld(screen.x, screen.y);

            const driftX = Math.abs(recovered.x - wx);
            const driftY = Math.abs(recovered.y - wy);

            maxDriftX = Math.max(maxDriftX, driftX);
            maxDriftY = Math.max(maxDriftY, driftY);
            cfgMaxDrift = Math.max(cfgMaxDrift, driftX, driftY);
            totalDriftX += driftX;
            totalDriftY += driftY;

            // Zero floating-point drift: should be strictly within double precision machine epsilon (< 1e-9)
            if (driftX > 1e-9 || driftY > 1e-9) {
                assert(false, `Drift exceeded tolerance at trial ${i} for config ${cfg.name}`, { wx, wy, screen, recovered, driftX, driftY });
                break;
            }
        }
        assert(cfgMaxDrift < 1e-9, `Config "${cfg.name}" 10,000 trials max drift = ${cfgMaxDrift.toExponential(4)} (< 1e-9)`);
    }

    assert(maxDriftX < 1e-9, `Overall Max X coordinate drift is strictly zero-drift within double precision: max = ${maxDriftX.toExponential(4)}`);
    assert(maxDriftY < 1e-9, `Overall Max Y coordinate drift is strictly zero-drift within double precision: max = ${maxDriftY.toExponential(4)}`);
    console.log(`  ✔ 50,000 total transformation roundtrips verified: Max drift X = ${maxDriftX.toExponential(4)}, Y = ${maxDriftY.toExponential(4)}`);

    // Extreme coordinate tests
    const extremeCoords = [
        [0, 0],
        [CONFIG.WORLD_CENTER_X, CONFIG.WORLD_CENTER_Y],
        [CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT],
        [-1e7, -1e7],
        [1e7, 1e7],
        [Number.MAX_SAFE_INTEGER / 1e8, Number.MAX_SAFE_INTEGER / 1e8]
    ];

    for (const [exX, exY] of extremeCoords) {
        camera.x = 1500;
        camera.y = 1500;
        camera.zoom = 0.5;
        const s = camera.worldToScreen(exX, exY);
        const r = camera.screenToWorld(s.x, s.y);
        const drift = Math.hypot(r.x - exX, r.y - exY);
        assert(drift < 1e-7, `Extreme coordinate roundtrip for (${exX}, ${exY}) drift = ${drift.toExponential(4)}`);
    }

    // Screen center mapping test: World position at camera (x,y) must map exactly to screen center (W/2, H/2)
    for (const cfg of cameraConfigs) {
        camera.x = cfg.x;
        camera.y = cfg.y;
        camera.zoom = cfg.zoom;
        camera.resize(cfg.w, cfg.h);

        const centerScreen = camera.worldToScreen(camera.x, camera.y);
        assert(Math.abs(centerScreen.x - cfg.w / 2) < 1e-12, `Camera center X maps to viewport W/2 (${cfg.w / 2}) for ${cfg.name}`);
        assert(Math.abs(centerScreen.y - cfg.h / 2) < 1e-12, `Camera center Y maps to viewport H/2 (${cfg.h / 2}) for ${cfg.name}`);

        const centerWorld = camera.screenToWorld(cfg.w / 2, cfg.h / 2);
        assert(Math.abs(centerWorld.x - camera.x) < 1e-12, `Screen center (W/2) maps to Camera X (${camera.x}) for ${cfg.name}`);
        assert(Math.abs(centerWorld.y - camera.y) < 1e-12, `Screen center (H/2) maps to Camera Y (${camera.y}) for ${cfg.name}`);
    }
});

// ============================================================================
// TEST SUITE 2: Frustum Culling & Viewport Bounds Classification
// ============================================================================
runSection('2. Frustum Culling & Viewport Bounds Stress Test', () => {
    const resolutions = [
        { w: 800, h: 600 },
        { w: 1280, h: 720 },
        { w: 1920, h: 1080 },
        { w: 2560, h: 1440 },
        { w: 3840, h: 2160 },
        { w: 375, h: 667 },   // Mobile portrait
        { w: 667, h: 375 }    // Mobile landscape
    ];

    const zoomLevels = [0.35, 0.5, 0.75, 1.0, 1.05];

    for (const res of resolutions) {
        for (const z of zoomLevels) {
            const camera = new Camera(res.w, res.h);
            camera.x = 1500;
            camera.y = 1500;
            camera.zoom = z;
            camera.updateBounds(0); // Test with 0 padding for exact frustum match

            const bounds = camera.getVisibleBounds(0);
            const halfW = (res.w / 2) / z;
            const halfH = (res.h / 2) / z;

            // Check exact bounds math
            assert(Math.abs(bounds.minX - (1500 - halfW)) < 1e-10, `minX matches exact viewport left edge at zoom ${z}, res ${res.w}x${res.h}`);
            assert(Math.abs(bounds.maxX - (1500 + halfW)) < 1e-10, `maxX matches exact viewport right edge at zoom ${z}, res ${res.w}x${res.h}`);
            assert(Math.abs(bounds.minY - (1500 - halfH)) < 1e-10, `minY matches exact viewport top edge at zoom ${z}, res ${res.w}x${res.h}`);
            assert(Math.abs(bounds.maxY - (1500 + halfH)) < 1e-10, `maxY matches exact viewport bottom edge at zoom ${z}, res ${res.w}x${res.h}`);

            // Points inside
            assert(camera.isInViewport(1500, 1500, 0), `Center point is in viewport (zoom ${z})`);
            assert(camera.isInViewport(1500 - halfW + 1, 1500, 0), `Point just inside left edge is in viewport`);
            assert(camera.isInViewport(1500 + halfW - 1, 1500, 0), `Point just inside right edge is in viewport`);
            assert(camera.isInViewport(1500, 1500 - halfH + 1, 0), `Point just inside top edge is in viewport`);
            assert(camera.isInViewport(1500, 1500 + halfH - 1, 0), `Point just inside bottom edge is in viewport`);

            // Points on exact boundary
            assert(camera.isInViewport(1500 - halfW, 1500, 0), `Point exactly on left edge is in viewport`);
            assert(camera.isInViewport(1500 + halfW, 1500, 0), `Point exactly on right edge is in viewport`);
            assert(camera.isInViewport(1500, 1500 - halfH, 0), `Point exactly on top edge is in viewport`);
            assert(camera.isInViewport(1500, 1500 + halfH, 0), `Point exactly on bottom edge is in viewport`);

            // Points outside
            assert(!camera.isInViewport(1500 - halfW - 0.1, 1500, 0), `Point just outside left edge is culled`);
            assert(!camera.isInViewport(1500 + halfW + 0.1, 1500, 0), `Point just outside right edge is culled`);
            assert(!camera.isInViewport(1500, 1500 - halfH - 0.1, 0), `Point just outside top edge is culled`);
            assert(!camera.isInViewport(1500, 1500 + halfH + 0.1, 0), `Point just outside bottom edge is culled`);

            // Circle overlapping boundary from outside
            const radius = 50;
            assert(camera.isInViewport(1500 - halfW - 40, 1500, radius), `Circle overlapping left edge from outside is visible`);
            assert(!camera.isInViewport(1500 - halfW - 60, 1500, radius), `Circle entirely outside left edge is culled`);
            assert(camera.isInViewport(1500 + halfW + 40, 1500, radius), `Circle overlapping right edge from outside is visible`);
            assert(!camera.isInViewport(1500 + halfW + 60, 1500, radius), `Circle entirely outside right edge is culled`);

            // Corner overlapping tests
            assert(camera.isInViewport(1500 - halfW - 30, 1500 - halfH - 30, radius), `Circle overlapping top-left corner is visible`);
            assert(!camera.isInViewport(1500 - halfW - 60, 1500 - halfH - 60, radius), `Circle outside top-left corner is culled`);
        }
    }

    // Default padding behavior test (padding = 80)
    const camDefault = new Camera(1920, 1080);
    camDefault.x = 1500;
    camDefault.y = 1500;
    camDefault.zoom = 1.0;
    camDefault.updateBounds(80);

    const halfW = 1920 / 2;
    // With padding 80, bounds should be extended by 80px in world space
    assert(camDefault.bounds.minX === 1500 - halfW - 80, 'Default bounds.minX includes 80px margin');
    assert(camDefault.bounds.maxX === 1500 + halfW + 80, 'Default bounds.maxX includes 80px margin');
    assert(camDefault.isInViewport(1500 - halfW - 50, 1500, 0), 'Point in 80px margin is considered in viewport bounds');
    assert(!camDefault.isInViewport(1500 - halfW - 81, 1500, 0), 'Point beyond 80px margin is culled');
});

// ============================================================================
// TEST SUITE 3: Camera Lerp Convergence & Frame-Rate Independence
// ============================================================================
runSection('3. Camera Lerp Convergence & Variable dt Stability', () => {
    // 3.1: Convergence under varied constant delta times
    const testDeltaTimes = [0.001, 0.005, 0.016, 0.033, 0.05, 0.1];

    for (const dt of testDeltaTimes) {
        const cam = new Camera(1920, 1080);
        cam.x = 0;
        cam.y = 0;
        cam.setTarget(1000, 2000, 100);

        let elapsed = 0;
        let prevDist = Math.hypot(cam.targetX - cam.x, cam.targetY - cam.y);

        // Simulate 1.0 second of tracking
        while (elapsed < 1.0) {
            cam.update(1000, 2000, 100, dt);
            elapsed += dt;

            const currDist = Math.hypot(cam.targetX - cam.x, cam.targetY - cam.y);
            // Must be strictly decreasing (monotonic convergence, no overshoot)
            assert(currDist <= prevDist + 1e-12, `Strict monotonic convergence with dt=${dt}: prevDist=${prevDist}, currDist=${currDist}`);
            prevDist = currDist;
        }

        // After 1.0s with posLerpRate = 12.0:
        // Expected distance = initialDist * exp(-12.0 * 1.0) = 2236.06 * exp(-12) ≈ 2236.06 * 6.144e-6 ≈ 0.01374 px
        const finalDist = Math.hypot(cam.targetX - cam.x, cam.targetY - cam.y);
        const expectedDist = Math.hypot(1000, 2000) * Math.exp(-CONFIG.CAMERA_POS_LERP * elapsed);
        const diff = Math.abs(finalDist - expectedDist);
        assert(diff < 1e-4, `Convergence matches exact analytical exponential solution with dt=${dt} (diff=${diff.toExponential(4)})`);
        assert(finalDist < 0.05, `Camera has converged to within 0.05px after 1.0s (finalDist=${finalDist.toFixed(4)}px)`);
    }

    // 3.2: Fluctuating delta times (stochastic jitter dt in [0.001, 0.1])
    const camFluct = new Camera(1920, 1080);
    camFluct.x = 500;
    camFluct.y = 500;
    const targetX = 2500;
    const targetY = 1800;
    camFluct.setTarget(targetX, targetY, CONFIG.BASE_MASS);

    let totalSimTime = 0;
    let stepCount = 0;
    let prevDistance = Math.hypot(targetX - camFluct.x, targetY - camFluct.y);
    const initialDistance = prevDistance;

    // Run stochastic dt simulation for 2.0 seconds
    while (totalSimTime < 2.0) {
        // Random dt between 0.001s (1000fps) and 0.100s (10fps)
        const dt = 0.001 + Math.random() * 0.099;
        camFluct.update(targetX, targetY, CONFIG.BASE_MASS, dt);
        totalSimTime += dt;
        stepCount++;

        const dist = Math.hypot(targetX - camFluct.x, targetY - camFluct.y);
        assert(dist <= prevDistance + 1e-12, `Monotonic convergence under stochastic dt (step ${stepCount}, dt=${dt.toFixed(4)})`);
        prevDistance = dist;
    }

    const residualDist = Math.hypot(targetX - camFluct.x, targetY - camFluct.y);
    const analyticalResidual = initialDistance * Math.exp(-CONFIG.CAMERA_POS_LERP * totalSimTime);
    const drift = Math.abs(residualDist - analyticalResidual);
    assert(drift < 1e-6, `Camera matches exact analytical solution under fluctuating dt: residual=${residualDist.toExponential(4)}, drift=${drift.toExponential(4)}`);
    assert(residualDist < 1e-4, `Camera fully converged after 2.0s under fluctuating dt (residual=${residualDist.toExponential(4)}px across ${stepCount} steps)`);

    // 3.3: Moving Target Tracking & Steady-State Lag Stability
    const camMoving = new Camera(1920, 1080);
    // Initialize camera directly on the circle at t=0
    camMoving.x = 1500 + 400;
    camMoving.y = 1500;
    let movingTargetX = 1500 + 400;
    let movingTargetY = 1500;
    const speed = 285; // Boost speed px/s

    // Target moves in a circle of radius 400 at speed 285 px/s
    const omega = speed / 400; // angular velocity = 0.7125 rad/s
    for (let t = 0; t < 5.0; t += 0.016) {
        movingTargetX = 1500 + 400 * Math.cos(omega * t);
        movingTargetY = 1500 + 400 * Math.sin(omega * t);
        camMoving.update(movingTargetX, movingTargetY, CONFIG.BASE_MASS, 0.016);

        // Steady-state lag: |x_target - x_cam| = (v * dt_eff) ~ v / sqrt(k^2 + omega^2)
        // For k=12, omega=0.7125: lag ≈ 285 / sqrt(144 + 0.507) ≈ 285 / 12.02 ≈ 23.7 px
        const lag = Math.hypot(camMoving.x - movingTargetX, camMoving.y - movingTargetY);
        if (t > 0.5) { // Check steady state after initial transient
            assert(lag < 30 && lag > 15, `Camera steady-state tracking lag is tightly bounded: lag = ${lag.toFixed(2)}px (expected ~23.7px)`);
        }
    }

    // 3.4: Zoom Convergence under Dynamic Mass Changes
    const camZoom = new Camera(1920, 1080);
    camZoom.setTarget(1500, 1500, 20); // Base mass -> zoom = 1.0 (approx)
    assert(Math.abs(camZoom.zoom - 1.0) < 1e-5, `Initial zoom matches base zoom`);

    // Instantaneous mass jump to 5000
    const targetMass = 5000;
    const expectedRawZoom = CONFIG.CAMERA_BASE_ZOOM * Math.pow(CONFIG.CAMERA_REF_MASS / (targetMass + CONFIG.CAMERA_REF_MASS), CONFIG.CAMERA_KAPPA);
    const expectedClampedZoom = Math.max(CONFIG.CAMERA_MIN_ZOOM, Math.min(CONFIG.CAMERA_MAX_ZOOM, expectedRawZoom));

    camZoom.setTarget(1500, 1500, targetMass);
    assert(Math.abs(camZoom.targetZoom - expectedClampedZoom) < 1e-10, `targetZoom computed accurately for M=5000: targetZoom=${camZoom.targetZoom.toFixed(4)}`);

    // Converge over 2.0s with variable dt
    for (let t = 0; t < 2.0; t += 0.02) {
        camZoom.update(1500, 1500, targetMass, 0.02);
    }
    const zoomDiff = Math.abs(camZoom.zoom - expectedClampedZoom);
    assert(zoomDiff < 1e-3, `Zoom converged to target zoom within 2s (diff = ${zoomDiff.toExponential(4)})`);
});

// ============================================================================
// TEST SUITE 4: Mass-to-Zoom Mathematical Scaling & Bounds
// ============================================================================
runSection('4. Mass-to-Zoom Scaling & Min/Max Clamping', () => {
    const cam = new Camera(1920, 1080);

    // Test extreme masses
    const testMasses = [
        { mass: 0, expectedZoom: 1.0 }, // (150/150)^0.28 = 1.0
        { mass: 20, expectedZoom: 1.0 * Math.pow(150 / 170, 0.28) }, // ~0.965
        { mass: 150, expectedZoom: 1.0 * Math.pow(150 / 300, 0.28) }, // ~0.823
        { mass: 1000, expectedZoom: 1.0 * Math.pow(150 / 1150, 0.28) }, // ~0.565
        { mass: 10000, expectedZoom: CONFIG.CAMERA_MIN_ZOOM }, // Clamped to minZoom (0.35)
        { mass: 1e9, expectedZoom: CONFIG.CAMERA_MIN_ZOOM }    // Clamped to minZoom (0.35)
    ];

    for (const tm of testMasses) {
        cam.setTarget(1500, 1500, tm.mass);
        const expected = Math.max(CONFIG.CAMERA_MIN_ZOOM, Math.min(CONFIG.CAMERA_MAX_ZOOM, tm.expectedZoom));
        assert(Math.abs(cam.targetZoom - expected) < 1e-5, `Mass M=${tm.mass} gives targetZoom=${cam.targetZoom.toFixed(5)}, expected=${expected.toFixed(5)}`);
        assert(cam.targetZoom >= CONFIG.CAMERA_MIN_ZOOM && cam.targetZoom <= CONFIG.CAMERA_MAX_ZOOM, `targetZoom strictly in [${CONFIG.CAMERA_MIN_ZOOM}, ${CONFIG.CAMERA_MAX_ZOOM}]`);
    }

    // Monotonicity: Higher mass MUST result in equal or lower target zoom (zooming out)
    let lastZoom = Infinity;
    for (let m = 0; m <= 5000; m += 25) {
        cam.setTarget(1500, 1500, m);
        assert(cam.targetZoom <= lastZoom + 1e-12, `Target zoom decreases monotonically with mass at M=${m}: ${cam.targetZoom} <= ${lastZoom}`);
        lastZoom = cam.targetZoom;
    }
});

// ============================================================================
// TEST SUITE 5: Canvas Transform Matrix & 2D Pipeline Equivalence
// ============================================================================
runSection('5. Canvas 2D Transform Equivalence Test', () => {
    // Mock Canvas 2D Context Matrix Tracker
    class MockCanvasContext {
        constructor() {
            this.transforms = [];
            this.matrix = [1, 0, 0, 1, 0, 0]; // [a, b, c, d, e, f]
            this.savedMatrices = [];
        }

        save() {
            this.savedMatrices.push([...this.matrix]);
        }

        restore() {
            if (this.savedMatrices.length > 0) {
                this.matrix = this.savedMatrices.pop();
            }
        }

        translate(tx, ty) {
            const [a, b, c, d, e, f] = this.matrix;
            this.matrix[4] = a * tx + c * ty + e;
            this.matrix[5] = b * tx + d * ty + f;
        }

        scale(sx, sy) {
            this.matrix[0] *= sx;
            this.matrix[1] *= sx;
            this.matrix[2] *= sy;
            this.matrix[3] *= sy;
        }

        transformPoint(x, y) {
            const [a, b, c, d, e, f] = this.matrix;
            return {
                x: a * x + c * y + e,
                y: b * x + d * y + f
            };
        }
    }

    const testViewports = [
        { w: 800, h: 600, camX: 1200, camY: 1800, zoom: 0.8 },
        { w: 1920, h: 1080, camX: 1500, camY: 1500, zoom: 1.0 },
        { w: 2560, h: 1440, camX: 300, camY: 2700, zoom: 0.35 },
        { w: 1366, h: 768, camX: 2200, camY: 500, zoom: 1.05 }
    ];

    for (const tv of testViewports) {
        const cam = new Camera(tv.w, tv.h);
        cam.x = tv.camX;
        cam.y = tv.camY;
        cam.zoom = tv.zoom;

        const ctx = new MockCanvasContext();
        cam.applyTransform(ctx);

        // Test 100 random world points
        for (let i = 0; i < 100; i++) {
            const wx = Math.random() * 3000;
            const wy = Math.random() * 3000;

            const analyticalScreen = cam.worldToScreen(wx, wy);
            const matrixScreen = ctx.transformPoint(wx, wy);

            const errX = Math.abs(analyticalScreen.x - matrixScreen.x);
            const errY = Math.abs(analyticalScreen.y - matrixScreen.y);

            assert(errX < 1e-10, `Canvas matrix transform matches worldToScreen X (err=${errX.toExponential(4)})`);
            assert(errY < 1e-10, `Canvas matrix transform matches worldToScreen Y (err=${errY.toExponential(4)})`);
        }

        cam.restoreTransform(ctx);
        assert(ctx.savedMatrices.length === 0, `restoreTransform restored stack to base level`);
        assert(ctx.matrix[0] === 1 && ctx.matrix[3] === 1 && ctx.matrix[4] === 0 && ctx.matrix[5] === 0, `Context matrix restored to identity`);
    }
});

// ============================================================================
// TEST SUITE 6: World Arena Geometry, Grid Frustum Culling & Out-of-Bounds
// ============================================================================
runSection('6. World Arena Geometry & Out-of-Bounds Verification', () => {
    const world = new World(3000, 3000, 1450);

    assert(world.centerX === 1500, 'World center X is 1500');
    assert(world.centerY === 1500, 'World center Y is 1500');
    assert(world.radius === 1450, 'World radius is 1450');

    // Test center point
    assert(!world.isOutOfBounds(1500, 1500, 0), 'Center point (1500, 1500) is within bounds');
    assert(world.getDistanceToBorder(1500, 1500) === 1450, 'Distance to border at center is 1450');

    // Test points along 4 cardinal radii
    // Right
    assert(!world.isOutOfBounds(1500 + 1449, 1500, 0), 'Point at 1449px right is within bounds');
    assert(world.isOutOfBounds(1500 + 1450, 1500, 0), 'Point at exact 1450px right border triggers isOutOfBounds (>= R)');
    assert(world.isOutOfBounds(1500 + 1451, 1500, 0), 'Point at 1451px right is out of bounds');

    // Top
    assert(!world.isOutOfBounds(1500, 1500 - 1449, 0), 'Point at 1449px top is within bounds');
    assert(world.isOutOfBounds(1500, 1500 - 1450, 0), 'Point at exact 1450px top border is out of bounds');

    // Left
    assert(!world.isOutOfBounds(1500 - 1449, 1500, 0), 'Point at 1449px left is within bounds');
    assert(world.isOutOfBounds(1500 - 1450, 1500, 0), 'Point at exact 1450px left border is out of bounds');

    // Bottom
    assert(!world.isOutOfBounds(1500, 1500 + 1449, 0), 'Point at 1449px bottom is within bounds');
    assert(world.isOutOfBounds(1500, 1500 + 1450, 0), 'Point at exact 1450px bottom border is out of bounds');

    // Entity radius tests
    const snakeHeadRadius = 15;
    // Safe inside
    assert(!world.isOutOfBounds(1500 + 1434, 1500, snakeHeadRadius), 'Head with R=15 at 1434px from center is safe');
    // Touching border
    assert(world.isOutOfBounds(1500 + 1435, 1500, snakeHeadRadius), 'Head with R=15 at 1435px touches border and triggers out-of-bounds');
    // Crossing border
    assert(world.isOutOfBounds(1500 + 1440, 1500, snakeHeadRadius), 'Head with R=15 at 1440px crosses border');

    // Distance to border calculation
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const testDist = 1000;
        const x = 1500 + testDist * Math.cos(angle);
        const y = 1500 + testDist * Math.sin(angle);
        const borderDist = world.getDistanceToBorder(x, y);
        assert(Math.abs(borderDist - 450) < 1e-9, `Distance to border along angle ${angle.toFixed(2)} is 450px`);
    }

    // World pulse animation update
    world.update(0.016);
    assert(Math.abs(world.pulseTime - 0.016) < 1e-10, 'World pulseTime increments accurately');
    world.update(0.034);
    assert(Math.abs(world.pulseTime - 0.050) < 1e-10, 'World pulseTime accumulates correctly');

    // Test World.draw frustum culling with mock 2D context
    class MockDrawContext {
        constructor() {
            this.linesDrawn = 0;
            this.dotsDrawn = 0;
            this.arcsDrawn = 0;
            this.rectsDrawn = 0;
        }
        save() {}
        restore() {}
        beginPath() {}
        stroke() {}
        fill() {}
        moveTo(x, y) {}
        lineTo(x, y) { this.linesDrawn++; }
        arc(x, y, r, sa, ea) {
            if (r === 1.5) this.dotsDrawn++;
            else this.arcsDrawn++;
        }
        fillRect(x, y, w, h) { this.rectsDrawn++; }
    }

    const testCam = new Camera(800, 600);
    testCam.x = 1500;
    testCam.y = 1500;
    testCam.zoom = 1.0;
    testCam.updateBounds(0);

    const mockCtx = new MockDrawContext();
    world.draw(mockCtx, testCam);

    // With 800x600 viewport + 100px padding: visible bounds is ~1000x800 world area -> ~10x8 = ~18 grid lines
    assert(mockCtx.linesDrawn > 0 && mockCtx.linesDrawn <= 30, `Frustum culling restricts grid lines drawn: ${mockCtx.linesDrawn} lines`);
    assert(mockCtx.dotsDrawn > 0, `Grid dots inside circle are drawn: ${mockCtx.dotsDrawn} dots`);
    assert(mockCtx.arcsDrawn === 3, `3 Forcefield concentric circles drawn`);
});

// ============================================================================
// TEST SUITE 7: Boundary, Extreme & Adversarial Robustness
// ============================================================================
runSection('7. Adversarial Edge Cases & Numerical Robustness', () => {
    const cam = new Camera(800, 600);

    // Zero / sub-millisecond delta times
    cam.x = 1000;
    cam.y = 1000;
    cam.setTarget(2000, 2000, 50);
    cam.update(2000, 2000, 50, 0); // dt = 0
    assert(cam.x === 1000 && cam.y === 1000, 'dt = 0 does not move camera position or produce NaN');
    assert(!isNaN(cam.x) && !isNaN(cam.y) && !isNaN(cam.zoom), 'Camera state remains valid with dt = 0');

    // Enormous delta time (dt = 1000s) -> should snap directly to target without overshoot or NaN
    cam.update(2000, 2000, 50, 1000);
    assert(Math.abs(cam.x - 2000) < 1e-9, 'dt = 1000s snaps camera X directly to target without exploding');
    assert(Math.abs(cam.y - 2000) < 1e-9, 'dt = 1000s snaps camera Y directly to target without exploding');

    // Negative mass handling
    cam.setTarget(1500, 1500, -100);
    assert(cam.targetZoom <= CONFIG.CAMERA_MAX_ZOOM, 'Negative mass clamped to maxZoom (1.05)');

    // Extreme aspect ratio viewports
    const ultraWide = new Camera(5120, 1440); // 32:9 Super Ultrawide
    ultraWide.x = 1500;
    ultraWide.y = 1500;
    ultraWide.zoom = 1.0;
    ultraWide.updateBounds(0);
    const uwBounds = ultraWide.getVisibleBounds(0);
    assert(uwBounds.maxX - uwBounds.minX === 5120, 'Ultrawide visible width equals viewport width / zoom');
    assert(uwBounds.maxY - uwBounds.minY === 1440, 'Ultrawide visible height equals viewport height / zoom');

    // Extreme vertical viewport (mobile tall banner 200x2000)
    const tallBanner = new Camera(200, 2000);
    tallBanner.x = 1500;
    tallBanner.y = 1500;
    tallBanner.zoom = 0.5;
    tallBanner.updateBounds(0);
    const tbBounds = tallBanner.getVisibleBounds(0);
    assert(tbBounds.maxX - tbBounds.minX === 400, 'Tall banner visible width at Z=0.5 equals 400');
    assert(tbBounds.maxY - tbBounds.minY === 4000, 'Tall banner visible height at Z=0.5 equals 4000');

    // Zero-dimension viewport resilience
    const zeroCam = new Camera(0, 0);
    zeroCam.x = 1500;
    zeroCam.y = 1500;
    zeroCam.updateBounds(0);
    assert(zeroCam.isInViewport(1500, 1500, 0), 'Zero-size camera includes center point in bounds');
    const zeroScreen = zeroCam.worldToScreen(1500, 1500);
    assert(zeroScreen.x === 0 && zeroScreen.y === 0, 'Zero-size camera maps center to (0,0)');
});

// ============================================================================
// FINAL SUMMARY & VERDICT
// ============================================================================
console.log(`\n================================================================`);
console.log(`                   EMPIRICAL TEST SUMMARY                       `);
console.log(`================================================================`);
console.log(`Total Assertions Executed : ${totalTests}`);
console.log(`Assertions Passed         : ${passedTests}`);
console.log(`Assertions Failed         : ${failedTests}`);
console.log(`Success Rate              : ${((passedTests / totalTests) * 100).toFixed(2)}%`);
console.log(`================================================================\n`);

if (failedTests > 0) {
    console.error(`❌ EMPIRICAL SUITE FAILED with ${failedTests} failures.`);
    process.exit(1);
} else {
    console.log(`✅ EMPIRICAL SUITE PASSED ALL 100% OF TESTS.`);
    process.exit(0);
}
