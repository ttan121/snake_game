/**
 * ============================================================================
 * SLITHER.IO NEON ARENA - GAME ENGINE & CORE KINEMATICS
 * Milestone 1 & Milestone 2:
 * - Dynamic Fullscreen Tracking Camera & Affine Matrix Transform
 * - 3000x3000px World Arena & Forcefield Laser Perimeter
 * - 120px Uniform Spatial Hash Partitioning Grid (SpatialHashGrid)
 * - Multi-tier Food & Energy Orb Ecosystem (FoodOrb, FoodManager, GlowSpriteCache)
 * - Two-tier Magnetic Ingestion & Pull Dynamics
 * - 360° Snake Spine Kinematics & Morphological Scaling
 * - Boost Trail Pellet Shedding & Corpse Disintegration
 * - Multi-input Adapters (Mouse, Keyboard, Touch/Joystick)
 * - Vector Radar Minimap & Real-time Live HUD
 * ============================================================================
 */

// ============================================================================
// 1. GLOBAL CONFIGURATION & SKINS REPOSITORY
// ============================================================================

const CONFIG = {
    WORLD_WIDTH: 3000,
    WORLD_HEIGHT: 3000,
    WORLD_RADIUS: 1450,
    WORLD_CENTER_X: 1500,
    WORLD_CENTER_Y: 1500,
    GRID_SIZE: 100,

    BASE_SPEED: 150,           // Normal translational speed (px/s)
    BOOST_SPEED: 285,          // 1.9x boost speed (px/s)
    BOOST_DRAIN_RATE: 4.0,     // Mass drainage per second while boosting
    MIN_BOOST_MASS: 20.0,      // Boost cutoff mass threshold
    BASE_MASS: 20.0,           // Starting mass

    BASE_TURN_RATE: 4.8,       // Base angular velocity (rad/s)
    MIN_TURN_RATE: 1.2,        // Minimum angular velocity for behemoth snakes
    TURN_REF_MASS: 150.0,      // Characteristic reference mass for inertia
    TURN_DECAY_EXP: 0.35,      // Turn decay curvature exponent

    SEGMENT_BASE_COUNT: 10,
    SEGMENT_MASS_FACTOR: 0.35,
    BASE_BODY_RADIUS: 9.5,
    RADIUS_GROWTH_FACTOR: 0.18,
    HEAD_RADIUS_FACTOR: 1.20,
    JOINT_BASE_SPACING: 4.5,
    JOINT_SPACING_FACTOR: 0.45,

    CAMERA_BASE_ZOOM: 1.0,
    CAMERA_REF_MASS: 150.0,
    CAMERA_KAPPA: 0.28,
    CAMERA_MIN_ZOOM: 0.35,
    CAMERA_MAX_ZOOM: 1.05,
    CAMERA_POS_LERP: 12.0,
    CAMERA_ZOOM_LERP: 4.0,

    SPATIAL_CELL_SIZE: 120,
    TARGET_AMBIENT_FOOD: 1200,
    MAGNET_DISTANCE: 80,
    MAGNET_SPEED: 400,
    MAGNET_ACCEL: 380,
    INGEST_EXTRA_RADIUS: 2.0
};

const SKINS = [
    {
        id: 'cyan',
        name: 'CYAN PULSE',
        headColor: '#00f0ff',
        primaryColor: '#00f0ff',
        secondaryColor: '#0088cc',
        glowColor: '#00f0ff',
        eyeColor: '#ffffff',
        pupilColor: '#040714'
    },
    {
        id: 'magenta',
        name: 'NEON MAGENTA',
        headColor: '#ff007f',
        primaryColor: '#ff007f',
        secondaryColor: '#aa0055',
        glowColor: '#ff007f',
        eyeColor: '#ffffff',
        pupilColor: '#040714'
    },
    {
        id: 'green',
        name: 'MATRIX GREEN',
        headColor: '#00ff66',
        primaryColor: '#00ff66',
        secondaryColor: '#009933',
        glowColor: '#00ff66',
        eyeColor: '#ffffff',
        pupilColor: '#040714'
    },
    {
        id: 'solar',
        name: 'SOLAR FLARE',
        headColor: '#ffea00',
        primaryColor: '#ffea00',
        secondaryColor: '#ff6600',
        glowColor: '#ffea00',
        eyeColor: '#ffffff',
        pupilColor: '#040714'
    },
    {
        id: 'violet',
        name: 'ELECTRIC VIOLET',
        headColor: '#9d00ff',
        primaryColor: '#9d00ff',
        secondaryColor: '#5500aa',
        glowColor: '#9d00ff',
        eyeColor: '#ffffff',
        pupilColor: '#040714'
    },
    {
        id: 'plasma',
        name: 'CYBER PLASMA',
        headColor: '#00ffff',
        primaryColor: '#ff00a0',
        secondaryColor: '#00e5ff',
        glowColor: '#ff00a0',
        eyeColor: '#ffffff',
        pupilColor: '#040714'
    }
];

// ============================================================================
// 2. CAMERA SYSTEM
// ============================================================================

class Camera {
    constructor(viewportWidth = 800, viewportHeight = 600, worldWidth = CONFIG.WORLD_WIDTH, worldHeight = CONFIG.WORLD_HEIGHT) {
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.x = worldWidth / 2;
        this.y = worldHeight / 2;
        this.targetX = worldWidth / 2;
        this.targetY = worldHeight / 2;

        this.baseZoom = CONFIG.CAMERA_BASE_ZOOM;
        this.refMass = CONFIG.CAMERA_REF_MASS;
        this.kappa = CONFIG.CAMERA_KAPPA;
        this.minZoom = CONFIG.CAMERA_MIN_ZOOM;
        this.maxZoom = CONFIG.CAMERA_MAX_ZOOM;

        this.zoom = this.baseZoom;
        this.targetZoom = this.baseZoom;

        this.posLerpRate = CONFIG.CAMERA_POS_LERP;
        this.zoomLerpRate = CONFIG.CAMERA_ZOOM_LERP;

        this.bounds = { minX: 0, maxX: worldWidth, minY: 0, maxY: worldHeight };
        this.updateBounds();
    }

    resize(width, height) {
        this.viewportWidth = width;
        this.viewportHeight = height;
        this.updateBounds();
    }

    setTarget(x, y, mass = CONFIG.BASE_MASS) {
        this.targetX = x;
        this.targetY = y;
        const massVal = (mass !== undefined && mass !== null) ? mass : CONFIG.BASE_MASS;
        const massClamped = Math.max(0, massVal);
        const rawZoom = this.baseZoom * Math.pow(this.refMass / (massClamped + this.refMass), this.kappa);
        this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, rawZoom));
    }

    update(targetX, targetY, targetMass, dt) {
        if (targetX !== undefined && targetY !== undefined) {
            this.setTarget(targetX, targetY, targetMass || CONFIG.BASE_MASS);
        }

        // Frame-rate independent exponential decay smoothing
        const alphaPos = 1 - Math.exp(-this.posLerpRate * dt);
        const alphaZoom = 1 - Math.exp(-this.zoomLerpRate * dt);

        this.x += (this.targetX - this.x) * alphaPos;
        this.y += (this.targetY - this.y) * alphaPos;
        this.zoom += (this.targetZoom - this.zoom) * alphaZoom;

        this.updateBounds();
    }

    updateBounds(padding = 80) {
        const halfW = (this.viewportWidth / 2) / this.zoom;
        const halfH = (this.viewportHeight / 2) / this.zoom;
        this.bounds.minX = this.x - halfW - padding;
        this.bounds.maxX = this.x + halfW + padding;
        this.bounds.minY = this.y - halfH - padding;
        this.bounds.maxY = this.y + halfH + padding;
    }

    getVisibleBounds(padding = 0) {
        const halfW = (this.viewportWidth / 2) / this.zoom;
        const halfH = (this.viewportHeight / 2) / this.zoom;
        return {
            minX: this.x - halfW - padding,
            maxX: this.x + halfW + padding,
            minY: this.y - halfH - padding,
            maxY: this.y + halfH + padding
        };
    }

    isInViewport(worldX, worldY, radius = 0) {
        return (worldX + radius >= this.bounds.minX &&
                worldX - radius <= this.bounds.maxX &&
                worldY + radius >= this.bounds.minY &&
                worldY - radius <= this.bounds.maxY);
    }

    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.x) * this.zoom + this.viewportWidth / 2,
            y: (worldY - this.y) * this.zoom + this.viewportHeight / 2
        };
    }

    screenToWorld(screenX, screenY) {
        return {
            x: this.x + (screenX - this.viewportWidth / 2) / this.zoom,
            y: this.y + (screenY - this.viewportHeight / 2) / this.zoom
        };
    }

    applyTransform(ctx) {
        ctx.save();
        ctx.translate(this.viewportWidth / 2, this.viewportHeight / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.x, -this.y);
    }

    restoreTransform(ctx) {
        ctx.restore();
    }
}

// ============================================================================
// 3. WORLD ARENA & FORCEFIELD
// ============================================================================

class World {
    constructor(width = CONFIG.WORLD_WIDTH, height = CONFIG.WORLD_HEIGHT, radius = CONFIG.WORLD_RADIUS) {
        this.width = width;
        this.height = height;
        this.radius = radius;
        this.centerX = width / 2;
        this.centerY = height / 2;
        this.gridSize = CONFIG.GRID_SIZE;
        this.pulseTime = 0;
    }

    isOutOfBounds(x, y, radius = 0) {
        const dx = x - this.centerX;
        const dy = y - this.centerY;
        const distSq = dx * dx + dy * dy;
        const maxDist = this.radius - radius;
        return distSq >= maxDist * maxDist;
    }

    getDistanceToBorder(x, y) {
        const distToCenter = Math.hypot(x - this.centerX, y - this.centerY);
        return this.radius - distToCenter;
    }

    update(dt) {
        this.pulseTime += dt;
    }

    draw(ctx, camera) {
        const bounds = camera.getVisibleBounds(this.gridSize);

        // 1. Frustum-culled Background Fill
        ctx.fillStyle = '#060714';
        ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

        // 2. Frustum-culled Neon Grid Lines
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.045)';
        ctx.lineWidth = 1;
        ctx.beginPath();

        const startX = Math.floor(Math.max(0, bounds.minX) / this.gridSize) * this.gridSize;
        const endX = Math.min(this.width, bounds.maxX);
        for (let x = startX; x <= endX; x += this.gridSize) {
            ctx.moveTo(x, Math.max(0, bounds.minY));
            ctx.lineTo(x, Math.min(this.height, bounds.maxY));
        }

        const startY = Math.floor(Math.max(0, bounds.minY) / this.gridSize) * this.gridSize;
        const endY = Math.min(this.height, bounds.maxY);
        for (let y = startY; y <= endY; y += this.gridSize) {
            ctx.moveTo(Math.max(0, bounds.minX), y);
            ctx.lineTo(Math.min(this.width, bounds.maxX), y);
        }
        ctx.stroke();

        // 3. Neon Grid Intersections (Dotted nodes inside circular arena)
        ctx.fillStyle = 'rgba(0, 240, 255, 0.16)';
        for (let x = startX; x <= endX; x += this.gridSize) {
            for (let y = startY; y <= endY; y += this.gridSize) {
                const dx = x - this.centerX;
                const dy = y - this.centerY;
                if (dx * dx + dy * dy <= this.radius * this.radius) {
                    ctx.beginPath();
                    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.restore();

        // 4. Render Perimeter Laser Forcefield
        this.drawForcefield(ctx);
    }

    drawForcefield(ctx) {
        ctx.save();
        const pulse = Math.sin(this.pulseTime * 3.0) * 0.15 + 0.85;

        // Layer 1: Wide outer ambient glow
        ctx.strokeStyle = `rgba(255, 0, 127, ${0.12 * pulse})`;
        ctx.lineWidth = 44;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Layer 2: Medium laser beam
        ctx.strokeStyle = `rgba(255, 30, 150, ${0.55 * pulse})`;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Layer 3: Ultra-bright ion core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}

// ============================================================================
// 4. SPATIAL HASH PARTITIONING GRID (120px Uniform Grid)
// ============================================================================

class SpatialHashGrid {
    constructor(worldWidth = CONFIG.WORLD_WIDTH || 3000, worldHeight = CONFIG.WORLD_HEIGHT || 3000, cellSize = CONFIG.SPATIAL_CELL_SIZE || 120) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.cellSize = cellSize;
        this.cols = Math.ceil(worldWidth / cellSize);
        this.rows = Math.ceil(worldHeight / cellSize);
        const totalCells = this.cols * this.rows;

        this.segmentBuckets = new Array(totalCells);
        this.foodBuckets = new Array(totalCells);
        for (let i = 0; i < totalCells; i++) {
            this.segmentBuckets[i] = [];
            this.foodBuckets[i] = [];
        }
        this._queryStamp = 0;
    }

    _getKey(col, row) {
        return `${col},${row}`;
    }

    _getCell(x, y) {
        const col = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cellSize)));
        const row = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cellSize)));
        return { col, row };
    }

    _getCellIndex(x, y) {
        const col = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cellSize)));
        const row = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cellSize)));
        return row * this.cols + col;
    }

    clear() {
        for (let i = 0; i < this.segmentBuckets.length; i++) {
            this.segmentBuckets[i].length = 0;
        }
        for (let i = 0; i < this.foodBuckets.length; i++) {
            this.foodBuckets[i].length = 0;
        }
    }

    insertSegment(snakeId, segIndex, x, y, radius = 10) {
        const r = Math.max(0, radius || 0);
        const minCol = Math.min(this.cols - 1, Math.max(0, Math.floor((x - r) / this.cellSize)));
        const maxCol = Math.min(this.cols - 1, Math.max(0, Math.floor((x + r) / this.cellSize)));
        const minRow = Math.min(this.rows - 1, Math.max(0, Math.floor((y - r) / this.cellSize)));
        const maxRow = Math.min(this.rows - 1, Math.max(0, Math.floor((y + r) / this.cellSize)));

        const item = { snakeId, segIndex, x, y, radius: r };

        for (let c = minCol; c <= maxCol; c++) {
            for (let rIdx = minRow; rIdx <= maxRow; rIdx++) {
                const cellIndex = rIdx * this.cols + c;
                this.segmentBuckets[cellIndex].push(item);
            }
        }
    }

    insertFood(foodOrb) {
        if (!foodOrb) return;
        const col = Math.min(this.cols - 1, Math.max(0, Math.floor(foodOrb.x / this.cellSize)));
        const row = Math.min(this.rows - 1, Math.max(0, Math.floor(foodOrb.y / this.cellSize)));
        const cellIndex = row * this.cols + col;
        foodOrb._cellIndex = cellIndex;
        this.foodBuckets[cellIndex].push(foodOrb);
    }

    removeFood(foodOrb) {
        if (!foodOrb) return;
        let cellIndex = foodOrb._cellIndex;
        if (cellIndex === undefined || cellIndex < 0 || cellIndex >= this.foodBuckets.length) {
            const col = Math.min(this.cols - 1, Math.max(0, Math.floor(foodOrb.x / this.cellSize)));
            const row = Math.min(this.rows - 1, Math.max(0, Math.floor(foodOrb.y / this.cellSize)));
            cellIndex = row * this.cols + col;
        }
        const bucket = this.foodBuckets[cellIndex];
        if (bucket && bucket.length > 0) {
            const idx = bucket.indexOf(foodOrb);
            if (idx !== -1) {
                bucket[idx] = bucket[bucket.length - 1];
                bucket.pop();
            } else {
                const idIdx = bucket.findIndex(f => f.id === foodOrb.id);
                if (idIdx !== -1) {
                    bucket[idIdx] = bucket[bucket.length - 1];
                    bucket.pop();
                }
            }
        }
        foodOrb._cellIndex = undefined;
    }

    queryNearbySegments(x, y, radius) {
        const r = Math.max(0, radius || 0);
        const minCol = Math.min(this.cols - 1, Math.max(0, Math.floor((x - r) / this.cellSize)));
        const maxCol = Math.min(this.cols - 1, Math.max(0, Math.floor((x + r) / this.cellSize)));
        const minRow = Math.min(this.rows - 1, Math.max(0, Math.floor((y - r) / this.cellSize)));
        const maxRow = Math.min(this.rows - 1, Math.max(0, Math.floor((y + r) / this.cellSize)));

        const results = [];
        const seen = new Set();

        for (let c = minCol; c <= maxCol; c++) {
            for (let row = minRow; row <= maxRow; row++) {
                const cellIndex = row * this.cols + c;
                const bucket = this.segmentBuckets[cellIndex];
                if (!bucket || bucket.length === 0) continue;

                for (let i = 0; i < bucket.length; i++) {
                    const seg = bucket[i];
                    const uniqueId = `${seg.snakeId}_${seg.segIndex}`;
                    if (seen.has(uniqueId)) continue;
                    seen.add(uniqueId);

                    const dx = seg.x - x;
                    const dy = seg.y - y;
                    const maxDist = r + seg.radius;
                    if (dx * dx + dy * dy <= maxDist * maxDist) {
                        results.push(seg);
                    }
                }
            }
        }
        return results;
    }

    queryNearbyFood(x, y, radius) {
        const r = Math.max(0, radius || 0);
        const searchRadius = r + 16;
        const minCol = Math.min(this.cols - 1, Math.max(0, Math.floor((x - searchRadius) / this.cellSize)));
        const maxCol = Math.min(this.cols - 1, Math.max(0, Math.floor((x + searchRadius) / this.cellSize)));
        const minRow = Math.min(this.rows - 1, Math.max(0, Math.floor((y - searchRadius) / this.cellSize)));
        const maxRow = Math.min(this.rows - 1, Math.max(0, Math.floor((y + searchRadius) / this.cellSize)));

        const results = [];
        const stamp = ++this._queryStamp;

        for (let c = minCol; c <= maxCol; c++) {
            for (let row = minRow; row <= maxRow; row++) {
                const cellIndex = row * this.cols + c;
                const bucket = this.foodBuckets[cellIndex];
                if (!bucket || bucket.length === 0) continue;

                for (let i = 0; i < bucket.length; i++) {
                    const orb = bucket[i];
                    if (orb._queryStamp === stamp) continue;
                    orb._queryStamp = stamp;

                    const dx = orb.x - x;
                    const dy = orb.y - y;
                    const orbR = (orb.radius !== undefined) ? orb.radius : 4;
                    const maxDist = r + orbR;
                    if (dx * dx + dy * dy <= maxDist * maxDist) {
                        results.push(orb);
                    }
                }
            }
        }
        return results;
    }
}

// ============================================================================
// 5. FOOD ORB, GLOW SPRITE CACHE & FOOD MANAGER
// ============================================================================

class FoodOrb {
    constructor(id, x, y, radius = 4, value = 1, color = '#00f0ff', type = 'ambient', glow = false) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = radius;
        this.baseRadius = radius;
        this.value = value;
        this.color = color;
        this.glowColor = color;
        this.type = type; // 'ambient' | 'boost' | 'corpse'
        this.glow = glow;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.pulseSpeed = 2.4;
        this.pulseOffset = this.pulsePhase;
        this.isAttracted = false;
        this.targetSnake = null;
        this.spawnTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        this._cellIndex = undefined;
        this._queryStamp = 0;
    }

    update(dt) {
        if (dt <= 0) return;
        // Friction decay for moving orbs (boost trail impulse / drag)
        if (Math.abs(this.vx) > 0.01 || Math.abs(this.vy) > 0.01) {
            const friction = Math.exp(-4.5 * dt);
            this.vx *= friction;
            this.vy *= friction;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
        }

        // Ambient breathing pulse
        if (this.type === 'ambient') {
            this.pulsePhase += dt * this.pulseSpeed;
            this.radius = this.baseRadius * (1.0 + 0.08 * Math.sin(this.pulsePhase));
        }
    }
}

class GlowSpriteCache {
    constructor() {
        this.cache = new Map();
    }

    getGlowSprite(color, radius, blur = 15) {
        const rRounded = Math.max(0, Math.round(radius));
        const key = `${color}_${rRounded}_${blur}`;
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        const size = Math.max(8, Math.ceil((rRounded + blur) * 2));
        let canvas;
        if (typeof document !== 'undefined' && document.createElement) {
            canvas = document.createElement('canvas');
        } else if (typeof MockHTMLElement !== 'undefined') {
            canvas = new MockHTMLElement('canvas');
        } else {
            return null;
        }

        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas;

        const center = size / 2;
        ctx.clearRect(0, 0, size, size);

        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = blur;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(center, center, Math.max(1, rRounded), 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(center, center, Math.max(0.5, rRounded * 0.45), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        this.cache.set(key, canvas);
        return canvas;
    }

    clear() {
        this.cache.clear();
    }
}

class FoodManager {
    constructor(worldWidth = CONFIG.WORLD_WIDTH || 3000, worldHeight = CONFIG.WORLD_HEIGHT || 3000, targetAmbientCount = CONFIG.TARGET_AMBIENT_FOOD || 1200) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.worldCenterX = worldWidth / 2;
        this.worldCenterY = worldHeight / 2;
        this.worldRadius = Math.min(worldWidth, worldHeight) / 2 - 50; // 1450px
        this.targetAmbientCount = targetAmbientCount;
        this.foodList = [];
        this.foodMap = new Map();
        this._idCounter = 0;

        this.colors = [
            '#00f0ff', '#ff007f', '#00ff66', '#ffea00',
            '#9d00ff', '#ff00a0', '#33ccff', '#ff9900'
        ];

        // Magnetic Attraction & Ingestion parameters
        this.magnetDistance = CONFIG.MAGNET_DISTANCE || 80;
        this.magnetSpeed = CONFIG.MAGNET_SPEED || 400;
        this.magnetAccel = CONFIG.MAGNET_ACCEL || 380;
        this.ingestExtraRadius = CONFIG.INGEST_EXTRA_RADIUS || 2.0;

        // Ingestion Spark Particle FX
        this.particles = [];
    }

    spawnAmbientFood(count = 1) {
        if (count <= 0) return [];
        const spawned = [];
        const maxDist = this.worldRadius - 40;

        for (let i = 0; i < count; i++) {
            const id = `amb_${++this._idCounter}`;
            const theta = Math.random() * Math.PI * 2;
            const r = maxDist * Math.sqrt(Math.random());
            const x = Math.max(20, Math.min(this.worldWidth - 20, this.worldCenterX + Math.cos(theta) * r));
            const y = Math.max(20, Math.min(this.worldHeight - 20, this.worldCenterY + Math.sin(theta) * r));

            const value = 1 + Math.floor(Math.random() * 3); // 1, 2, or 3
            const radius = 3.0 + value * 0.8;
            const color = this.colors[Math.floor(Math.random() * this.colors.length)];

            const orb = new FoodOrb(id, x, y, radius, value, color, 'ambient', false);
            this.foodList.push(orb);
            this.foodMap.set(id, orb);
            spawned.push(orb);
        }
        return spawned;
    }

    spawnBoostOrb(x, y, color = '#00f0ff', headingAngle = null) {
        const id = `boost_${++this._idCounter}`;
        const clampedX = Math.max(20, Math.min(this.worldWidth - 20, x));
        const clampedY = Math.max(20, Math.min(this.worldHeight - 20, y));

        const orb = new FoodOrb(id, clampedX, clampedY, 3.5, 1.5, color || '#00f0ff', 'boost', true);

        if (headingAngle !== null && headingAngle !== undefined) {
            const impulse = 60.0 + Math.random() * 20.0;
            const jitterAngle = (Math.random() - 0.5) * 0.6;
            orb.vx = -Math.cos(headingAngle + jitterAngle) * impulse;
            orb.vy = -Math.sin(headingAngle + jitterAngle) * impulse;
        }

        this.foodList.push(orb);
        this.foodMap.set(id, orb);
        return orb;
    }

    spawnDeathOrbs(orbsOrSegments, totalMass = 0, color = '#ff007f') {
        if (Array.isArray(orbsOrSegments)) {
            if (orbsOrSegments.length === 0) return;
            const first = orbsOrSegments[0];

            if (first && (first.value !== undefined || first.type === 'corpse')) {
                // Array of pre-generated death orbs
                for (const orb of orbsOrSegments) {
                    if (!orb) continue;
                    orb.x = Math.max(20, Math.min(this.worldWidth - 20, orb.x));
                    orb.y = Math.max(20, Math.min(this.worldHeight - 20, orb.y));

                    const dx = orb.x - this.worldCenterX;
                    const dy = orb.y - this.worldCenterY;
                    const dist = Math.hypot(dx, dy);
                    if (dist > this.worldRadius - 20) {
                        const angle = Math.atan2(dy, dx);
                        orb.x = this.worldCenterX + Math.cos(angle) * (this.worldRadius - 25);
                        orb.y = this.worldCenterY + Math.sin(angle) * (this.worldRadius - 25);
                    }

                    if (!orb.id) orb.id = `death_${++this._idCounter}`;
                    if (orb.glow === undefined) orb.glow = true;

                    this.foodList.push(orb);
                    this.foodMap.set(orb.id, orb);
                }
                return;
            }

            // Otherwise array of segments passed
            const segments = orbsOrSegments;
            const dropMass = (totalMass || 100) * 0.70;
            const orbCount = Math.min(60, Math.max(8, Math.floor(segments.length * 0.8)));
            const massPerOrb = dropMass / orbCount;

            for (let i = 0; i < orbCount; i++) {
                const segIdx = Math.floor((i * segments.length) / orbCount);
                const seg = segments[segIdx] || { x: this.worldCenterX, y: this.worldCenterY };
                const jitterR = Math.random() * 15 + 5;
                const jitterAngle = Math.random() * Math.PI * 2;
                const ox = seg.x + Math.cos(jitterAngle) * jitterR;
                const oy = seg.y + Math.sin(jitterAngle) * jitterR;
                const clampedX = Math.max(20, Math.min(this.worldWidth - 20, ox));
                const clampedY = Math.max(20, Math.min(this.worldHeight - 20, oy));

                const orb = new FoodOrb(
                    `death_${++this._idCounter}`,
                    clampedX,
                    clampedY,
                    Math.min(12.0, 4.0 + Math.sqrt(massPerOrb)),
                    massPerOrb,
                    color,
                    'corpse',
                    true
                );
                this.foodList.push(orb);
                this.foodMap.set(orb.id, orb);
            }
        }
    }

    spawnIngestionSpark(x, y, color) {
        const count = 5;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 90;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: color || '#00f0ff',
                radius: 1.8 + Math.random() * 1.5,
                alpha: 1.0,
                life: 0,
                maxLife: 0.25 + Math.random() * 0.15
            });
        }
    }

    update(dt = 1 / 60, snakes = [], spatialGrid = null) {
        // 1. Throttled ambient food replenishment (capped at 30/tick)
        let ambientCount = 0;
        for (let i = 0; i < this.foodList.length; i++) {
            if (this.foodList[i].type === 'ambient') ambientCount++;
        }
        if (ambientCount < this.targetAmbientCount) {
            const needed = Math.min(30, this.targetAmbientCount - ambientCount);
            this.spawnAmbientFood(needed);
        }

        // 2. Physics update for moving orbs
        if (dt > 0) {
            for (let i = 0; i < this.foodList.length; i++) {
                const orb = this.foodList[i];
                if (typeof orb.update === 'function') orb.update(dt);
            }
        }

        // 3. Magnetic attraction and ingestion solver
        const consumedIds = new Set();

        for (const snake of snakes) {
            if (!snake || snake.isDead) continue;

            const head = typeof snake.getHead === 'function' ? snake.getHead() : snake;
            const headRadius = (typeof snake.getHeadRadius === 'function') ? snake.getHeadRadius() : (head.radius || 12);
            const attractRadius = headRadius + this.magnetDistance;
            const consumeRadius = headRadius + 6.0;

            const nearbyFood = spatialGrid && typeof spatialGrid.queryNearbyFood === 'function'
                ? spatialGrid.queryNearbyFood(head.x, head.y, attractRadius)
                : this.foodList;

            for (let i = 0; i < nearbyFood.length; i++) {
                const food = nearbyFood[i];
                if (consumedIds.has(food.id)) continue;

                const dx = head.x - food.x;
                const dy = head.y - food.y;
                const dist = Math.hypot(dx, dy);

                // Precise Ingestion Threshold
                const orbR = food.radius !== undefined ? food.radius : 3.5;
                const contactLimit = headRadius + orbR + this.ingestExtraRadius;

                if (dist <= Math.max(consumeRadius, contactLimit)) {
                    consumedIds.add(food.id);
                    if (typeof snake.addMass === 'function') {
                        snake.addMass(food.value);
                    } else if (snake.mass !== undefined) {
                        snake.mass += food.value;
                        if (typeof snake.recalculateDimensions === 'function') {
                            snake.recalculateDimensions();
                        }
                    }
                    this.spawnIngestionSpark(food.x, food.y, food.color);
                } else if (dist <= attractRadius && dt > 0) {
                    // Magnetic pull
                    const pullFactor = 1.0 - (dist / attractRadius);
                    const speed = this.magnetSpeed * (0.30 + pullFactor * 0.70);
                    const safeDist = dist > 1e-4 ? dist : 1e-4;
                    const ux = dx / safeDist;
                    const uy = dy / safeDist;

                    food.x += ux * speed * dt;
                    food.y += uy * speed * dt;
                }
            }
        }

        // 4. Batch purge consumed orbs
        if (consumedIds.size > 0) {
            this.foodList = this.foodList.filter(f => !consumedIds.has(f.id));
            for (const id of consumedIds) {
                const orb = this.foodMap.get(id);
                if (orb && spatialGrid && typeof spatialGrid.removeFood === 'function') {
                    spatialGrid.removeFood(orb);
                }
                this.foodMap.delete(id);
            }
        }

        // 5. Update Ingestion FX Particles
        if (dt > 0) {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.life += dt;
                if (p.life >= p.maxLife) {
                    this.particles.splice(i, 1);
                    continue;
                }
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vx *= 0.94;
                p.vy *= 0.94;
                p.alpha = Math.max(0, 1 - (p.life / p.maxLife));
            }
        }
    }

    draw(ctx, camera = null, glowCache = null) {
        if (!ctx) return;

        const visibleBounds = camera && typeof camera.getVisibleBounds === 'function'
            ? camera.getVisibleBounds(50)
            : null;

        const time = typeof performance !== 'undefined' && performance.now ? performance.now() * 0.003 : 0;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Draw Food Orbs with Frustum Culling
        for (let i = 0; i < this.foodList.length; i++) {
            const food = this.foodList[i];
            const r = food.radius || 4;

            if (visibleBounds) {
                if (food.x + r < visibleBounds.minX || food.x - r > visibleBounds.maxX ||
                    food.y + r < visibleBounds.minY || food.y - r > visibleBounds.maxY) {
                    continue;
                }
            } else if (camera && typeof camera.isInViewport === 'function') {
                if (!camera.isInViewport(food.x, food.y, r + 15)) continue;
            }

            // Cached glow sprite blit
            if (glowCache && (food.glow || food.type === 'corpse' || food.type === 'boost')) {
                const blur = food.type === 'corpse' ? 18 : 12;
                const sprite = glowCache.getGlowSprite(food.color, r, blur);
                if (sprite) {
                    ctx.drawImage(sprite, food.x - sprite.width / 2, food.y - sprite.height / 2);
                    continue;
                }
            }

            // Concentric circle / pulse fallback
            const pulse = food.glow ? Math.sin(time + (food.pulseOffset || 0)) * 0.25 + 0.75 : 1.0;
            const drawRadius = r * pulse;

            if (food.glow || food.type === 'corpse') {
                ctx.save();
                ctx.fillStyle = food.color;
                ctx.globalAlpha = 0.28 * pulse;
                ctx.beginPath();
                ctx.arc(food.x, food.y, drawRadius * 2.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            ctx.beginPath();
            ctx.fillStyle = food.color;
            ctx.arc(food.x, food.y, drawRadius, 0, Math.PI * 2);
            ctx.fill();

            // Ion core center
            ctx.beginPath();
            ctx.fillStyle = '#ffffff';
            ctx.arc(food.x, food.y, Math.max(1, drawRadius * 0.4), 0, Math.PI * 2);
            ctx.fill();
        }

        // 2. Draw Ingestion Spark Particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (camera && typeof camera.isInViewport === 'function' && !camera.isInViewport(p.x, p.y, p.radius + 4)) {
                continue;
            }

            ctx.save();
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * p.alpha, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    }

    clear() {
        this.foodList = [];
        this.foodMap.clear();
        this.particles = [];
        this._idCounter = 0;
    }
}

// ============================================================================
// 6. SNAKE ENTITY & 360° SPINE KINEMATICS
// ============================================================================

class Snake {
    constructor(id = 'player', name = 'Player', x = 1500, y = 1500, skin = 'cyan', isPlayer = false) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.angle = -Math.PI / 2;
        this.targetAngle = -Math.PI / 2;
        this.isPlayer = isPlayer;
        this.isDead = false;

        // Visual skin setup
        this.setSkin(skin);

        // Mass and Scores
        this.mass = CONFIG.BASE_MASS;
        this.score = Math.floor(this.mass * 10);
        this.kills = 0;

        // Kinematics and Speeds
        this.baseSpeed = CONFIG.BASE_SPEED;
        this.boostSpeed = CONFIG.BOOST_SPEED;
        this.currentSpeed = this.baseSpeed;
        this.isBoosting = false;
        this.boostDistAccumulator = 0;

        // Morphological Dimensions
        this.bodyRadius = CONFIG.BASE_BODY_RADIUS;
        this.headRadius = this.bodyRadius * CONFIG.HEAD_RADIUS_FACTOR;
        this.jointSpacing = CONFIG.JOINT_BASE_SPACING;

        // Path History (Dense continuous points with cumulative arc-length distances)
        this.pathHistory = [];
        this.segments = [];

        // Seed initial straight path history
        this.recalculateDimensions();
        const initialCount = this.calculateSegmentCount();
        const initialSpacing = this.jointSpacing;
        let cumulativeDist = initialCount * initialSpacing * 1.5;

        for (let s = cumulativeDist; s >= 0; s -= 2.0) {
            this.pathHistory.push({
                x: this.x - Math.cos(this.angle) * s,
                y: this.y - Math.sin(this.angle) * s,
                s: cumulativeDist - s
            });
        }
        this.currentPathDistance = cumulativeDist;
        this.updateSegments();
    }

    get speed() {
        return this.currentSpeed;
    }

    get minBoostMass() {
        return CONFIG.MIN_BOOST_MASS;
    }

    getBodyRadius() {
        this.bodyRadius = CONFIG.BASE_BODY_RADIUS + CONFIG.RADIUS_GROWTH_FACTOR * Math.sqrt(Math.max(0, this.mass));
        return this.bodyRadius;
    }

    getHeadRadius() {
        this.headRadius = this.getBodyRadius() * CONFIG.HEAD_RADIUS_FACTOR;
        return this.headRadius;
    }

    getTurnRate() {
        return Math.max(
            CONFIG.MIN_TURN_RATE,
            CONFIG.BASE_TURN_RATE * Math.pow(CONFIG.TURN_REF_MASS / (this.mass + CONFIG.TURN_REF_MASS), CONFIG.TURN_DECAY_EXP)
        );
    }

    getTargetSegmentCount() {
        return this.calculateSegmentCount();
    }

    updateSpine() {
        this.recalculateDimensions();
        this.updateSegments();
    }

    addMass(amount) {
        if (amount > 0) {
            this.mass += amount;
            this.recalculateDimensions();
        }
    }

    setSkin(skinInput) {
        if (typeof skinInput === 'object' && skinInput !== null) {
            this.skin = skinInput;
        } else {
            const found = SKINS.find(s => s.id === skinInput);
            this.skin = found || SKINS[0];
        }
    }

    setTargetAngle(angle) {
        if (typeof angle === 'number' && !isNaN(angle)) {
            this.targetAngle = angle;
        }
    }

    setBoosting(boost) {
        this.isBoosting = !!boost && this.mass > CONFIG.MIN_BOOST_MASS;
    }

    handleInput(inputState) {
        if (inputState && inputState.targetAngle !== null && inputState.targetAngle !== undefined) {
            this.setTargetAngle(inputState.targetAngle);
        }
        if (inputState) {
            this.setBoosting(!!inputState.isBoosting);
        }
    }

    recalculateDimensions() {
        this.bodyRadius = CONFIG.BASE_BODY_RADIUS + CONFIG.RADIUS_GROWTH_FACTOR * Math.sqrt(this.mass);
        this.headRadius = this.bodyRadius * CONFIG.HEAD_RADIUS_FACTOR;
        this.jointSpacing = CONFIG.JOINT_BASE_SPACING + CONFIG.JOINT_SPACING_FACTOR * this.bodyRadius;
        this.score = Math.floor(this.mass * 10);
    }

    calculateSegmentCount() {
        return Math.floor(CONFIG.SEGMENT_BASE_COUNT + CONFIG.SEGMENT_MASS_FACTOR * this.mass);
    }

    update(dt, param2, param3) {
        if (this.isDead) return;

        let onTrailPelletDrop = typeof param2 === 'function' ? param2 : (typeof param3 === 'function' ? param3 : null);
        let foodManager = (param2 && typeof param2.spawnBoostOrb === 'function') ? param2 : ((param3 && typeof param3.spawnBoostOrb === 'function') ? param3 : null);

        this.recalculateDimensions();

        // 1. 360° Steering with Shortest-Arc Normalization
        const angleDiff = Math.atan2(Math.sin(this.targetAngle - this.angle), Math.cos(this.targetAngle - this.angle));
        const turnRate = this.getTurnRate();
        const maxTurn = turnRate * dt;
        this.angle += Math.max(-maxTurn, Math.min(maxTurn, angleDiff));

        // 2. Speed transition & Mass Drainage
        if (this.isBoosting && this.mass > CONFIG.MIN_BOOST_MASS) {
            this.mass = Math.max(CONFIG.MIN_BOOST_MASS, this.mass - CONFIG.BOOST_DRAIN_RATE * dt);
            if (this.mass <= CONFIG.MIN_BOOST_MASS) {
                this.isBoosting = false;
            }
        } else if (this.mass <= CONFIG.MIN_BOOST_MASS) {
            this.isBoosting = false;
        }

        const targetSpeed = this.isBoosting ? this.boostSpeed : this.baseSpeed;
        const speedSmoothing = 1 - Math.exp(-12.0 * dt);
        this.currentSpeed += (targetSpeed - this.currentSpeed) * speedSmoothing;

        // 3. Advance Head Position
        const moveDist = this.currentSpeed * dt;
        this.x += Math.cos(this.angle) * moveDist;
        this.y += Math.sin(this.angle) * moveDist;
        this.currentPathDistance += moveDist;

        // 4. Boost Trail Pellet Shedding Event
        if (this.isBoosting) {
            this.boostDistAccumulator += moveDist;
            const shedInterval = 24.0;
            while (this.boostDistAccumulator >= shedInterval) {
                this.boostDistAccumulator -= shedInterval;
                if (this.segments.length > 0) {
                    const tail = this.segments[this.segments.length - 1];
                    const pelletData = {
                        x: tail.x,
                        y: tail.y,
                        value: 1.2,
                        color: this.skin.glowColor || this.skin.primaryColor || '#00f0ff',
                        type: 'boost',
                        glow: true
                    };
                    if (foodManager && typeof foodManager.spawnBoostOrb === 'function') {
                        foodManager.spawnBoostOrb(tail.x, tail.y, pelletData.color, this.angle);
                    }
                    if (typeof onTrailPelletDrop === 'function') {
                        onTrailPelletDrop(pelletData);
                    }
                    if (typeof this.onPelletDrop === 'function') {
                        this.onPelletDrop(pelletData);
                    }
                }
            }
        } else {
            this.boostDistAccumulator = 0;
        }

        // 5. Append new sample to path history
        this.pathHistory.unshift({
            x: this.x,
            y: this.y,
            s: this.currentPathDistance
        });

        // 6. Prune old history outside snake length
        const segCount = this.calculateSegmentCount();
        const maxRequiredDist = (segCount + 4) * this.jointSpacing;
        const minRetainedDist = this.currentPathDistance - maxRequiredDist;

        while (this.pathHistory.length > 20 && this.pathHistory[this.pathHistory.length - 1].s < minRetainedDist) {
            this.pathHistory.pop();
        }

        // 7. Update spine vertebrae positions via arc-length interpolation
        this.updateSegments();
    }

    updateSegments() {
        const segCount = this.calculateSegmentCount();
        this.segments = [{
            x: this.x,
            y: this.y,
            radius: this.headRadius,
            angle: this.angle
        }];

        const currentDist = this.currentPathDistance;
        let histIdx = 0;

        for (let i = 1; i < segCount; i++) {
            const targetDist = currentDist - i * this.jointSpacing;

            // Search backward in path history for the bracket [histIdx, histIdx + 1]
            while (histIdx < this.pathHistory.length - 1 && this.pathHistory[histIdx + 1].s >= targetDist) {
                histIdx++;
            }

            let segX = this.x;
            let segY = this.y;
            let segAngle = this.angle;

            if (histIdx < this.pathHistory.length - 1) {
                const pA = this.pathHistory[histIdx];
                const pB = this.pathHistory[histIdx + 1];
                const ds = pA.s - pB.s;
                const alpha = ds > 0.0001 ? (pA.s - targetDist) / ds : 0;
                const clampedAlpha = Math.max(0, Math.min(1, alpha));

                segX = pA.x + (pB.x - pA.x) * clampedAlpha;
                segY = pA.y + (pB.y - pA.y) * clampedAlpha;
                segAngle = Math.atan2(this.segments[i - 1].y - segY, this.segments[i - 1].x - segX);
            } else if (this.pathHistory.length > 0) {
                const last = this.pathHistory[this.pathHistory.length - 1];
                segX = last.x;
                segY = last.y;
                segAngle = this.segments[i - 1].angle;
            }

            // Morphological Vertebra Tapering Formula
            let segRadius = this.bodyRadius;
            const tailLength = Math.max(5, Math.min(20, Math.floor(segCount * 0.25)));

            if (i <= 2) {
                // Neck transition
                segRadius = this.headRadius - (this.headRadius - this.bodyRadius) * (i / 3);
            } else if (i >= segCount - tailLength) {
                // Tail tapering down to 45% radius
                const tailStep = (i - (segCount - tailLength) + 1) / tailLength;
                segRadius = this.bodyRadius * (1.0 - 0.55 * Math.pow(tailStep, 1.5));
            }

            this.segments.push({
                x: segX,
                y: segY,
                radius: Math.max(2.0, segRadius),
                angle: segAngle
            });
        }
    }

    die() {
        this.isDead = true;
        const dropMass = this.mass * 0.70;
        const orbs = [];
        const segCount = this.segments.length || 1;
        const orbCount = Math.min(60, Math.max(8, Math.floor(segCount * 0.8)));
        const massPerOrb = dropMass / orbCount;

        for (let i = 0; i < orbCount; i++) {
            const segIdx = Math.floor((i * segCount) / orbCount);
            const seg = this.segments[segIdx] || { x: this.x, y: this.y };
            const jitterRadius = Math.random() * 15 + 5;
            const jitterAngle = Math.random() * Math.PI * 2;
            const ox = seg.x + Math.cos(jitterAngle) * jitterRadius;
            const oy = seg.y + Math.sin(jitterAngle) * jitterRadius;
            const clampedX = Math.max(20, Math.min(CONFIG.WORLD_WIDTH - 20, ox));
            const clampedY = Math.max(20, Math.min(CONFIG.WORLD_HEIGHT - 20, oy));

            orbs.push({
                id: `death_${this.id}_${i}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                x: clampedX,
                y: clampedY,
                radius: Math.min(12.0, 4.0 + Math.sqrt(massPerOrb)),
                value: massPerOrb,
                color: this.skin.glowColor || this.skin.primaryColor || '#ff007f',
                type: 'corpse',
                glow: true
            });
        }
        return orbs;
    }

    getHead() {
        return {
            x: this.x,
            y: this.y,
            radius: this.headRadius,
            angle: this.angle
        };
    }

    getSegments() {
        return this.segments;
    }

    draw(ctx, camera) {
        if (this.isDead || this.segments.length === 0) return;

        // 1. Draw Body Segments from Tail to Neck (Back to Front)
        for (let i = this.segments.length - 1; i >= 1; i--) {
            const seg = this.segments[i];
            if (camera && !camera.isInViewport(seg.x, seg.y, seg.radius + 8)) continue;

            const isStripe = (Math.floor(i / 2) % 2 === 0);
            ctx.fillStyle = isStripe ? this.skin.primaryColor : this.skin.secondaryColor;

            ctx.beginPath();
            ctx.arc(seg.x, seg.y, seg.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 2. Draw Head & Eyes
        const head = this.segments[0];
        if (!camera || camera.isInViewport(head.x, head.y, head.radius + 12)) {
            // Head base
            ctx.fillStyle = this.skin.headColor;
            ctx.beginPath();
            ctx.arc(head.x, head.y, head.radius, 0, Math.PI * 2);
            ctx.fill();

            // Expressive Eyes
            this.drawEyes(ctx, head.x, head.y, this.angle, head.radius);
        }
    }

    drawEyes(ctx, hx, hy, angle, radius) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const perpX = -sin;
        const perpY = cos;

        const eyeOffset = radius * 0.45;
        const eyeForward = radius * 0.40;
        const eyeRadius = radius * 0.32;
        const pupilRadius = eyeRadius * 0.52;

        const leftEyeX = hx + perpX * eyeOffset + cos * eyeForward;
        const leftEyeY = hy + perpY * eyeOffset + sin * eyeForward;
        const rightEyeX = hx - perpX * eyeOffset + cos * eyeForward;
        const rightEyeY = hy - perpY * eyeOffset + sin * eyeForward;

        // Sclera
        ctx.fillStyle = this.skin.eyeColor || '#ffffff';
        ctx.beginPath();
        ctx.arc(leftEyeX, leftEyeY, eyeRadius, 0, Math.PI * 2);
        ctx.arc(rightEyeX, rightEyeY, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Pupils oriented toward travel heading
        ctx.fillStyle = this.skin.pupilColor || '#040714';
        const pupilShift = eyeRadius * 0.35;
        ctx.beginPath();
        ctx.arc(leftEyeX + cos * pupilShift, leftEyeY + sin * pupilShift, pupilRadius, 0, Math.PI * 2);
        ctx.arc(rightEyeX + cos * pupilShift, rightEyeY + sin * pupilShift, pupilRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ============================================================================
// 7. MULTI-INPUT MANAGERS & ADAPTERS
// ============================================================================

class MouseInputAdapter {
    constructor() {
        this.targetAngle = null;
        this.isBoosting = false;
        this.active = false;
    }

    init(windowObj = window) {
        if (!windowObj || !windowObj.addEventListener) return;

        windowObj.addEventListener('mousemove', (e) => {
            this.active = true;
            const centerX = windowObj.innerWidth / 2;
            const centerY = windowObj.innerHeight / 2;
            const dx = e.clientX - centerX;
            const dy = e.clientY - centerY;

            // Deadzone check (8px from screen center)
            if (dx * dx + dy * dy >= 64) {
                this.targetAngle = Math.atan2(dy, dx);
            }
        });

        windowObj.addEventListener('mousedown', (e) => {
            if (e.button === 0 || e.button === 2) {
                this.isBoosting = true;
            }
        });

        windowObj.addEventListener('mouseup', (e) => {
            if (e.button === 0 || e.button === 2) {
                this.isBoosting = false;
            }
        });

        windowObj.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
}

class KeyboardInputAdapter {
    constructor() {
        this.keys = {};
        this.targetAngle = null;
        this.isBoosting = false;
        this.active = false;
    }

    init(windowObj = window) {
        if (!windowObj || !windowObj.addEventListener) return;

        windowObj.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            this.keys[e.code] = true;

            if (e.code === 'Space' || e.key === 'Shift') {
                this.isBoosting = true;
                if (e.code === 'Space') e.preventDefault();
            }

            this.updateAngle();
        });

        windowObj.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            this.keys[e.code] = false;

            if (e.code === 'Space' || e.key === 'Shift') {
                this.isBoosting = false;
            }

            this.updateAngle();
        });
    }

    updateAngle() {
        let vx = 0;
        let vy = 0;

        if (this.keys['w'] || this.keys['arrowup']) vy -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) vy += 1;
        if (this.keys['a'] || this.keys['arrowleft']) vx -= 1;
        if (this.keys['d'] || this.keys['arrowright']) vx += 1;

        if (vx !== 0 || vy !== 0) {
            this.targetAngle = Math.atan2(vy, vx);
            this.active = true;
        } else {
            this.targetAngle = null;
            this.active = false;
        }
    }
}

class TouchInputAdapter {
    constructor(joystickBaseEl, joystickThumbEl, boostBtnEl) {
        this.joystickBase = joystickBaseEl;
        this.joystickThumb = joystickThumbEl;
        this.boostBtn = boostBtnEl;

        this.targetAngle = null;
        this.isBoosting = false;
        this.active = false;
        this.joystickTouchId = null;
        this.originX = 0;
        this.originY = 0;
        this.maxDeflection = 50.0; // max joystick radius
    }

    init(windowObj = window) {
        if (!windowObj || !windowObj.addEventListener) return;

        // Dedicated Mobile Boost Button Touch Handlers
        if (this.boostBtn) {
            this.boostBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.isBoosting = true;
                this.boostBtn.classList.add('active');
            }, { passive: false });

            const endBoost = (e) => {
                e.preventDefault();
                this.isBoosting = false;
                this.boostBtn.classList.remove('active');
            };

            this.boostBtn.addEventListener('touchend', endBoost, { passive: false });
            this.boostBtn.addEventListener('touchcancel', endBoost, { passive: false });
        }

        // Virtual Dynamic Joystick
        windowObj.addEventListener('touchstart', (e) => {
            if (this.joystickTouchId !== null) return;

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                // Ignore touches on boost button
                if (this.boostBtn && this.boostBtn.contains(touch.target)) continue;

                this.joystickTouchId = touch.identifier;
                this.originX = touch.clientX;
                this.originY = touch.clientY;
                this.active = true;

                if (this.joystickBase) {
                    this.joystickBase.style.left = `${this.originX}px`;
                    this.joystickBase.style.top = `${this.originY}px`;
                    this.joystickBase.classList.remove('hidden');
                }
                if (this.joystickThumb) {
                    this.joystickThumb.style.transform = 'translate(-50%, -50%)';
                }
                break;
            }
        }, { passive: true });

        windowObj.addEventListener('touchmove', (e) => {
            if (this.joystickTouchId === null) return;

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier !== this.joystickTouchId) continue;

                const dx = touch.clientX - this.originX;
                const dy = touch.clientY - this.originY;
                const dist = Math.hypot(dx, dy);

                if (dist > 5.0) {
                    this.targetAngle = Math.atan2(dy, dx);
                    const clampedDist = Math.min(dist, this.maxDeflection);
                    const thumbX = Math.cos(this.targetAngle) * clampedDist;
                    const thumbY = Math.sin(this.targetAngle) * clampedDist;

                    if (this.joystickThumb) {
                        this.joystickThumb.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`;
                    }
                }
                break;
            }
        }, { passive: true });

        const onTouchEnd = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.joystickTouchId) {
                    this.joystickTouchId = null;
                    this.active = false;
                    if (this.joystickBase) {
                        this.joystickBase.classList.add('hidden');
                    }
                    break;
                }
            }
        };

        windowObj.addEventListener('touchend', onTouchEnd, { passive: true });
        windowObj.addEventListener('touchcancel', onTouchEnd, { passive: true });
    }
}

class InputManager {
    constructor(elements = {}) {
        this.mouseAdapter = new MouseInputAdapter();
        this.keyboardAdapter = new KeyboardInputAdapter();
        this.touchAdapter = new TouchInputAdapter(
            elements.joystickBase,
            elements.joystickThumb,
            elements.boostBtn
        );
        this.lastAngle = -Math.PI / 2;
    }

    init(windowObj = window) {
        this.mouseAdapter.init(windowObj);
        this.keyboardAdapter.init(windowObj);
        this.touchAdapter.init(windowObj);
    }

    getState() {
        let targetAngle = null;
        let isBoosting = false;
        let activeDevice = 'none';

        if (this.touchAdapter.active && this.touchAdapter.targetAngle !== null) {
            targetAngle = this.touchAdapter.targetAngle;
            activeDevice = 'touch';
        } else if (this.keyboardAdapter.active && this.keyboardAdapter.targetAngle !== null) {
            targetAngle = this.keyboardAdapter.targetAngle;
            activeDevice = 'keyboard';
        } else if (this.mouseAdapter.targetAngle !== null) {
            targetAngle = this.mouseAdapter.targetAngle;
            activeDevice = 'mouse';
        }

        if (targetAngle !== null) {
            this.lastAngle = targetAngle;
        }

        isBoosting = this.touchAdapter.isBoosting ||
                     this.keyboardAdapter.isBoosting ||
                     this.mouseAdapter.isBoosting;

        return {
            targetAngle: targetAngle !== null ? targetAngle : this.lastAngle,
            isBoosting,
            activeDevice
        };
    }
}

// ============================================================================
// 8. UI CONTROLLER & RADAR MINIMAP
// ============================================================================

class UIController {
    constructor(elements = {}) {
        this.elements = elements;
        this.selectedSkinIndex = 0;
    }

    init(onPlayCallback, onRestartCallback) {
        if (this.elements.playBtn && onPlayCallback) {
            this.elements.playBtn.addEventListener('click', () => {
                const nickname = (this.elements.nicknameInput && this.elements.nicknameInput.value.trim()) || 'CyberViper';
                const skin = SKINS[this.selectedSkinIndex];
                onPlayCallback({ nickname, skin });
            });
        }

        if (this.elements.restartBtn && onRestartCallback) {
            this.elements.restartBtn.addEventListener('click', () => {
                const nickname = (this.elements.nicknameInput && this.elements.nicknameInput.value.trim()) || 'CyberViper';
                const skin = SKINS[this.selectedSkinIndex];
                onRestartCallback({ nickname, skin });
            });
        }

        // Skin Carousel Navigation
        if (this.elements.prevSkinBtn) {
            this.elements.prevSkinBtn.addEventListener('click', () => {
                this.selectedSkinIndex = (this.selectedSkinIndex - 1 + SKINS.length) % SKINS.length;
                this.updateSkinPreview();
            });
        }

        if (this.elements.nextSkinBtn) {
            this.elements.nextSkinBtn.addEventListener('click', () => {
                this.selectedSkinIndex = (this.selectedSkinIndex + 1) % SKINS.length;
                this.updateSkinPreview();
            });
        }

        this.updateSkinPreview();
    }

    updateSkinPreview() {
        const skin = SKINS[this.selectedSkinIndex];
        if (this.elements.skinName) {
            this.elements.skinName.innerText = skin.name;
            this.elements.skinName.style.color = skin.primaryColor;
        }

        if (this.elements.skinPreviewCanvas) {
            const canvas = this.elements.skinPreviewCanvas;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const centerY = canvas.height / 2;
            const segmentRadius = 10;
            const count = 5;

            // Draw miniature body segments
            for (let i = count - 1; i >= 1; i--) {
                const segX = 25 + i * 18;
                ctx.fillStyle = i % 2 === 0 ? skin.primaryColor : skin.secondaryColor;
                ctx.beginPath();
                ctx.arc(segX, centerY, segmentRadius * (1 - i * 0.08), 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw miniature head
            const headX = 25;
            ctx.fillStyle = skin.headColor;
            ctx.beginPath();
            ctx.arc(headX, centerY, segmentRadius * 1.2, 0, Math.PI * 2);
            ctx.fill();

            // Eyes
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(headX - 2, centerY - 4, 3, 0, Math.PI * 2);
            ctx.arc(headX - 2, centerY + 4, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(headX - 3, centerY - 4, 1.5, 0, Math.PI * 2);
            ctx.arc(headX - 3, centerY + 4, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    showStartMenu() {
        if (this.elements.hud) this.elements.hud.classList.add('hidden');
        if (this.elements.startScreen) this.elements.startScreen.classList.remove('hidden');
        if (this.elements.gameOverScreen) this.elements.gameOverScreen.classList.add('hidden');
    }

    showGameHUD() {
        if (this.elements.startScreen) this.elements.startScreen.classList.add('hidden');
        if (this.elements.gameOverScreen) this.elements.gameOverScreen.classList.add('hidden');
        if (this.elements.hud) this.elements.hud.classList.remove('hidden');
    }

    showGameOver(stats = {}) {
        if (this.elements.hud) this.elements.hud.classList.add('hidden');
        if (this.elements.gameOverScreen) this.elements.gameOverScreen.classList.remove('hidden');

        if (this.elements.summaryMass) this.elements.summaryMass.innerText = Math.floor(stats.mass || 0);
        if (this.elements.summaryScore) this.elements.summaryScore.innerText = Math.floor(stats.score || 0);
        if (this.elements.summaryRank) this.elements.summaryRank.innerText = `#${stats.rank || 1}`;
        if (this.elements.summaryTime) this.elements.summaryTime.innerText = stats.survivalTime || '00:00';
        if (this.elements.summaryKills) this.elements.summaryKills.innerText = stats.kills || 0;
    }

    updateHUD(stats = {}) {
        if (this.elements.hudMass) this.elements.hudMass.innerText = Math.floor(stats.mass || 20);
        if (this.elements.hudScore) this.elements.hudScore.innerText = Math.floor(stats.score || 200);
        if (this.elements.hudRank) this.elements.hudRank.innerText = `#${stats.rank || 1}`;
        if (this.elements.hudTotalBots) this.elements.hudTotalBots.innerText = stats.totalSnakes || 1;
        if (this.elements.hudFps) this.elements.hudFps.innerText = Math.round(stats.fps || 60);
    }

    updateLeaderboard(rankedList = [], playerId = 'player') {
        if (!this.elements.leaderboardList) return;

        let html = '';
        const topCount = Math.min(10, rankedList.length);

        for (let i = 0; i < topCount; i++) {
            const entry = rankedList[i];
            const isSelf = entry.id === playerId;
            html += `<li class="leaderboard-item ${isSelf ? 'self' : ''}">` +
                    `<span class="rank">${i + 1}.</span>` +
                    `<span class="name">${entry.name}</span>` +
                    `<span class="score">${entry.score}</span>` +
                    `</li>`;
        }

        this.elements.leaderboardList.innerHTML = html;
    }

    renderMinimap(player, allSnakes = [], world) {
        if (!this.elements.minimapCanvas || !world) return;
        const canvas = this.elements.minimapCanvas;
        const ctx = canvas.getContext('2d');
        const size = canvas.width;
        const center = size / 2;
        const scale = (size / 2) / (world.radius + 50);

        ctx.clearRect(0, 0, size, size);

        // 1. Radar Boundary
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(center, center, world.radius * scale, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Render Bot Snakes
        ctx.fillStyle = 'rgba(255, 0, 127, 0.7)';
        for (let s of allSnakes) {
            if (s.isDead || s.isPlayer) continue;
            const mx = center + (s.x - world.centerX) * scale;
            const my = center + (s.y - world.centerY) * scale;
            ctx.beginPath();
            ctx.arc(mx, my, 2.0, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3. Render Player Blip & Heading Cone
        if (player && !player.isDead) {
            const px = center + (player.x - world.centerX) * scale;
            const py = center + (player.y - world.centerY) * scale;

            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Heading ray
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(player.angle) * 7, py + Math.sin(player.angle) * 7);
            ctx.stroke();
        }
    }
}

// ============================================================================
// 9. MAIN GAME ENGINE & STATE MACHINE
// ============================================================================

class GameEngine {
    constructor(canvasElement, options = {}) {
        this.canvas = canvasElement;
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.options = options;

        // State Machine: 'MENU' | 'PLAYING' | 'GAMEOVER'
        this.state = 'MENU';
        this.isRunning = false;
        this.fixedDelta = 1 / 60; // 60Hz fixed simulation step
        this.accumulator = 0;
        this.lastTime = 0;

        // FPS Tracker
        this.frameCount = 0;
        this.fpsTimer = 0;
        this.currentFPS = 60;

        // Match Statistics
        this.matchStartTime = 0;
        this.survivalTime = '00:00';

        // Core Components
        this.world = new World();
        this.camera = new Camera(
            typeof window !== 'undefined' ? window.innerWidth : 800,
            typeof window !== 'undefined' ? window.innerHeight : 600
        );

        // Milestone 2 Subsystems
        this.spatialGrid = new SpatialHashGrid(CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT, CONFIG.SPATIAL_CELL_SIZE || 120);
        this.foodManager = new FoodManager(CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT, CONFIG.TARGET_AMBIENT_FOOD || 1200);
        this.glowCache = new GlowSpriteCache();

        this.player = null;
        this.snakes = [];

        // UI & Input Controllers
        this.inputManager = new InputManager(options.uiElements || {});
        this.uiController = new UIController(options.uiElements || {});

        this.init();
    }

    init() {
        if (typeof window !== 'undefined') {
            this.handleResize();
            window.addEventListener('resize', () => this.handleResize());
            this.inputManager.init(window);
        }

        this.uiController.init(
            (config) => this.startGame(config),
            (config) => this.startGame(config)
        );
    }

    handleResize() {
        if (typeof window === 'undefined' || !this.canvas) return;

        const width = window.innerWidth;
        const height = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.0);

        this.canvas.width = Math.floor(width * dpr);
        this.canvas.height = Math.floor(height * dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        if (this.ctx) {
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        this.camera.resize(width, height);
    }

    startGame(config = {}) {
        const nickname = config.nickname || 'CyberViper';
        const skin = config.skin || SKINS[0];

        this.player = new Snake('player', nickname, CONFIG.WORLD_CENTER_X, CONFIG.WORLD_CENTER_Y, skin, true);
        this.snakes = [this.player];

        // Milestone 2 Grid and Food Init
        this.spatialGrid.clear();
        this.foodManager.clear();
        this.foodManager.spawnAmbientFood(CONFIG.TARGET_AMBIENT_FOOD || 1200);

        this.state = 'PLAYING';
        this.matchStartTime = performance.now();
        this.uiController.showGameHUD();

        if (!this.isRunning) {
            this.isRunning = true;
            this.lastTime = performance.now();
            if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame((t) => this.mainLoop(t));
            }
        }
    }

    mainLoop(currentTime) {
        if (!this.isRunning) return;

        let frameTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        if (frameTime > 0.1) frameTime = 0.1; // Clamp against large lag spikes

        // FPS Calculation
        this.frameCount++;
        this.fpsTimer += frameTime;
        if (this.fpsTimer >= 0.5) {
            this.currentFPS = this.frameCount / this.fpsTimer;
            this.frameCount = 0;
            this.fpsTimer = 0;
        }

        // Fixed-Timestep Physics Accumulator
        this.accumulator += frameTime;
        while (this.accumulator >= this.fixedDelta) {
            this.physicsStep(this.fixedDelta);
            this.accumulator -= this.fixedDelta;
        }

        this.render();

        if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame((t) => this.mainLoop(t));
        }
    }

    physicsStep(dt) {
        if (this.state !== 'PLAYING') return;

        this.world.update(dt);

        // 1. Spatial Hash Grid Clear & Entity Registration
        this.spatialGrid.clear();
        for (const s of this.snakes) {
            if (s.isDead) continue;
            for (let i = 0; i < s.segments.length; i++) {
                const seg = s.segments[i];
                this.spatialGrid.insertSegment(s.id, i, seg.x, seg.y, seg.radius);
            }
        }
        for (const f of this.foodManager.foodList) {
            this.spatialGrid.insertFood(f);
        }

        // 2. Process Player Input
        const inputState = this.inputManager.getState();
        if (this.player && !this.player.isDead) {
            this.player.handleInput(inputState);
        }
// 2b. Simple AI for bot snakes
for (let bot of this.snakes) {
    if (bot.isPlayer || bot.isDead) continue;
    const head = bot.getHead();
    // Query nearby food within 200px radius
    const nearbyFood = this.spatialGrid.queryNearbyFood(head.x, head.y, 200);
    let targetAngle = bot.angle;
    if (nearbyFood.length > 0) {
        const food = nearbyFood[0];
        const dx = food.x - head.x;
        const dy = food.y - head.y;
        targetAngle = Math.atan2(dy, dx);
    } else {
        // Random wander when no food nearby
        targetAngle += (Math.random() - 0.5) * 0.1;
    }
    bot.handleInput({ targetAngle, isBoosting: false });
}
        // 3. Update Snake Entities & Boost Trail Shedding
        for (let snake of this.snakes) {
            if (snake.isDead) continue;
            snake.update(dt, this.spatialGrid, this.foodManager);

            // Boundary collision check
            if (this.world.isOutOfBounds(snake.x, snake.y, snake.headRadius)) {
                this.handleSnakeDeath(snake);
            }
        }

        // 4. Update Food Manager (Attraction, Ingestion, Replenishment)
        this.foodManager.update(dt, this.snakes, this.spatialGrid);

        // 5. Update Dynamic Tracking Camera
        if (this.player && !this.player.isDead) {
            this.camera.update(this.player.x, this.player.y, this.player.mass, dt);
        }

        // 6. Update Match Timer & HUD
        const elapsedSec = Math.floor((performance.now() - this.matchStartTime) / 1000);
        const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
        const secs = String(elapsedSec % 60).padStart(2, '0');
        this.survivalTime = `${mins}:${secs}`;

        this.uiController.updateHUD({
            mass: this.player ? this.player.mass : 20,
            score: this.player ? this.player.score : 200,
            rank: 1,
            totalSnakes: this.snakes.length,
            fps: this.currentFPS
        });

        this.uiController.updateLeaderboard(
            this.snakes.map(s => ({ id: s.id, name: s.name, score: s.score })),
            'player'
        );
    }

    handleSnakeDeath(snake) {
        const deathOrbs = snake.die();
        if (deathOrbs && deathOrbs.length > 0) {
            this.foodManager.spawnDeathOrbs(deathOrbs);
        }
        if (snake.isPlayer) {
            this.state = 'GAMEOVER';
            this.uiController.showGameOver({
                mass: snake.mass,
                score: snake.score,
                rank: 1,
                survivalTime: this.survivalTime,
                kills: snake.kills
            });
        }
    }

    render() {
        if (!this.ctx) return;

        // Clear Viewport Buffer
        this.ctx.clearRect(0, 0, this.camera.viewportWidth, this.camera.viewportHeight);

        // --- WORLD SPACE RENDERING ---
        this.camera.applyTransform(this.ctx);

        // 1. Frustum-culled World Grid & Forcefield
        this.world.draw(this.ctx, this.camera);

        // 2. Render Multi-tier Food Orbs & Ingestion Particles (before snakes)
        this.foodManager.draw(this.ctx, this.camera, this.glowCache);

        // 3. Render Snakes
        for (let snake of this.snakes) {
            snake.draw(this.ctx, this.camera);
        }

        this.camera.restoreTransform(this.ctx);

        // --- SCREEN SPACE HUD RENDERING ---
        if (this.state === 'PLAYING') {
            this.uiController.renderMinimap(this.player, this.snakes, this.world);
        }
    }
}

// ============================================================================
// 10. BROWSER DOM INITIALIZATION
// ============================================================================

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        const canvas = document.getElementById('gameCanvas');
        const uiElements = {
            hud: document.getElementById('hud'),
            statsPanel: document.getElementById('stats-panel'),
            hudMass: document.getElementById('hud-mass'),
            hudScore: document.getElementById('hud-score'),
            hudRank: document.getElementById('hud-rank'),
            hudTotalBots: document.getElementById('hud-total-bots'),
            hudFps: document.getElementById('hud-fps'),
            leaderboard: document.getElementById('leaderboard'),
            leaderboardList: document.getElementById('leaderboard-list'),
            minimapContainer: document.getElementById('minimap-container'),
            minimapCanvas: document.getElementById('minimapCanvas'),
            startScreen: document.getElementById('start-screen'),
            nicknameInput: document.getElementById('nickname-input'),
            prevSkinBtn: document.getElementById('prev-skin-btn'),
            nextSkinBtn: document.getElementById('next-skin-btn'),
            skinName: document.getElementById('skin-name'),
            skinPreviewCanvas: document.getElementById('skinPreviewCanvas'),
            playBtn: document.getElementById('play-btn'),
            gameOverScreen: document.getElementById('gameover-screen'),
            summaryMass: document.getElementById('summary-mass'),
            summaryScore: document.getElementById('summary-score'),
            summaryRank: document.getElementById('summary-rank'),
            summaryTime: document.getElementById('summary-time'),
            summaryKills: document.getElementById('summary-kills'),
            restartBtn: document.getElementById('restart-btn'),
            touchControls: document.getElementById('touch-controls'),
            joystickBase: document.getElementById('joystick-base'),
            joystickThumb: document.getElementById('joystick-thumb'),
            boostBtn: document.getElementById('mobile-boost-btn')
        };

        const engine = new GameEngine(canvas, { uiElements });
        window.__GAME_ENGINE__ = engine;
    });
}

// ============================================================================
// 11. NODE.JS MODULE EXPORTS (For Headless Automated Test Suites)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        SKINS,
        Camera,
        World,
        SpatialHashGrid,
        FoodOrb,
        GlowSpriteCache,
        FoodManager,
        Snake,
        MouseInputAdapter,
        KeyboardInputAdapter,
        TouchInputAdapter,
        InputManager,
        UIController,
        GameEngine
    };
}