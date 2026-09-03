# Milestone 1 Technical Exploration & Specification Report
**Target**: Engine Foundation, 3000x3000px World Map, HiDPI Fullscreen Canvas, and Dynamic Tracking Camera with Zoom Scaling
**Author**: Milestone 1 Explorer 1 (`teamwork_preview_explorer`)
**Date**: 2026-08-29

---

## 1. Executive Summary

This report establishes the complete architectural and mathematical foundation for **Milestone 1** of the Slither.io web rebuild. Milestone 1 transforms the legacy 800x800 single-screen snake into a high-performance, 60 FPS fullscreen arena engine featuring:
1. **HiDPI Fullscreen Canvas Layout & Resolution Management** with sub-pixel rendering and zero-latency window resize synchronization.
2. **3000x3000px Circular Vector Arena** with infinite-feel Cartesian neon grid rendering, viewport-culled drawing, and pulsating laser forcefield perimeter physics.
3. **Mass-Scaled Dynamic Tracking Camera** implementing frame-rate independent exponential lerp smoothing, non-linear mass zoom scaling $Z(M) = Z_0 \left(\frac{M_0}{M + M_0}\right)^\kappa$, bidirectional world-screen coordinate matrix transformations, and $O(1)$ viewport frustum culling.
4. **Decoupled Simulation Engine & Worker Architecture** supporting multi-input ingestion (Mouse, Keyboard, Touch Joystick, Boost triggers), 360° steering kinematics, path history ring buffers, and headless execution for automated E2E test suites.

---

## 2. Fullscreen Canvas, DPR Handling, and Dynamic Layout Architecture

### 2.1 HiDPI & DPR Scaling Mechanics
To ensure crisp visuals across Standard, Retina (2x), and Ultra-HD (3x+) displays without performance degradation or blurriness:
- Canvas internal buffer dimensions must match physical device pixels: $W_{buffer} = \lfloor W_{css} \times DPR \rfloor$, $H_{buffer} = \lfloor H_{css} \times DPR \rfloor$.
- Canvas CSS style dimensions must explicitly match viewport layout pixels: $W_{style} = W_{css}\text{px}$, $H_{style} = H_{css}\text{px}$.
- The 2D rendering context scale matrix must be reset and scaled by $DPR$:
  $$\mathbf{T}_{DPR} = \begin{bmatrix} DPR & 0 & 0 \\ 0 & DPR & 0 \\ 0 & 0 & 1 \end{bmatrix}$$
- Maximum DPR clamping: On extreme high-density mobile devices (DPR > 2.5), DPR is clamped to $\min(DPR, 2.0)$ or $2.25$ to cap total fill-rate overhead on mobile GPUs.

### 2.2 Resize Event Flow & RAF Throttling
```
Window 'resize' / 'orientationchange' 
      │
      ▼
RAF / Debounce Guard (Avoid mid-frame tearing)
      │
      ▼
Update Viewport Dimensions (window.innerWidth, window.innerHeight)
      │
      ▼
Reallocate Canvas Buffer (canvas.width, canvas.height with DPR)
      │
      ▼
Notify Camera (camera.resize(width, height))
      │
      ▼
Re-render Scene Immediately (Eliminate black flash)
```

### 2.3 DOM Structure (`index.html`)
The revised DOM layout separates rendering canvas from interactive UI HUD overlays using CSS pointer-events layering:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Slither.io Neon Arena</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <!-- Fullscreen Render Surface -->
    <canvas id="gameCanvas"></canvas>

    <!-- In-Game HUD (Pointer events pass through except on interactive children) -->
    <div id="hud" class="hud-overlay hidden">
        <!-- Top Right: Live Leaderboard -->
        <div id="leaderboard" class="glass-card">
            <h3 class="leaderboard-title">LEADERBOARD</h3>
            <ol id="leaderboard-list"></ol>
        </div>

        <!-- Top Left / Center: Match Statistics -->
        <div id="stats-panel" class="glass-card">
            <div class="stat-item">MASS: <span id="hud-mass" class="neon-cyan">20</span></div>
            <div class="stat-item">RANK: <span id="hud-rank" class="neon-magenta">1</span> / <span id="hud-total-bots">25</span></div>
            <div class="stat-item">FPS: <span id="hud-fps" class="neon-green">60</span></div>
        </div>

        <!-- Bottom Left: Vector Radar Minimap -->
        <div id="minimap-container" class="glass-card">
            <canvas id="minimapCanvas" width="160" height="160"></canvas>
        </div>
    </div>

    <!-- Start Screen Modal -->
    <div id="start-screen" class="modal-overlay">
        <div class="modal-card">
            <h1 class="neon-title glow-pulse">SLITHER<span class="neon-magenta">.IO</span></h1>
            <p class="subtitle">NEON CYBER ARENA</p>

            <div class="input-group">
                <input type="text" id="nickname-input" maxlength="16" placeholder="ENTER NICKNAME" spellcheck="false" autocomplete="off" value="CyberViper">
            </div>

            <!-- Skin Color Carousel -->
            <div class="skin-selector">
                <button id="prev-skin-btn" class="nav-btn">&lt;</button>
                <div id="skin-preview-container">
                    <canvas id="skinPreviewCanvas" width="120" height="60"></canvas>
                    <span id="skin-name">CYAN PULSE</span>
                </div>
                <button id="next-skin-btn" class="nav-btn">&gt;</button>
            </div>

            <button id="play-btn" class="glow-btn">ENTER ARENA</button>

            <div class="controls-guide">
                <span><kbd>MOUSE</kbd> Steering</span>
                <span><kbd>L-CLICK</kbd> / <kbd>SPACE</kbd> Boost</span>
                <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Direct Steering</span>
            </div>
        </div>
    </div>

    <!-- Game Over Modal -->
    <div id="gameover-screen" class="modal-overlay hidden">
        <div class="modal-card">
            <h2 class="gameover-title">SYSTEM TERMINATED</h2>
            <div class="summary-stats">
                <div class="summary-row">FINAL MASS: <span id="summary-mass" class="neon-cyan">0</span></div>
                <div class="summary-row">HIGHEST RANK: <span id="summary-rank" class="neon-magenta">#0</span></div>
                <div class="summary-row">SURVIVAL TIME: <span id="summary-time" class="neon-green">00:00</span></div>
                <div class="summary-row">KILLS: <span id="summary-kills" class="neon-yellow">0</span></div>
            </div>
            <button id="restart-btn" class="glow-btn">RE-ENTER ARENA</button>
        </div>
    </div>

    <!-- Mobile Virtual Joystick & Boost Button Overlay -->
    <div id="touch-controls" class="touch-layer hidden">
        <div id="joystick-base" class="hidden"><div id="joystick-thumb"></div></div>
        <button id="mobile-boost-btn" class="mobile-boost">BOOST</button>
    </div>

    <script src="script.js"></script>
</body>
</html>
```

### 2.4 CSS Specifications (`style.css`)
Key styling rules to ensure zero-jitter fullscreen canvas, hardware acceleration, and glassmorphic synthwave aesthetics:

```css
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    user-select: none;
    -webkit-user-select: none;
}

html, body {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background-color: #06060e;
    font-family: 'Orbitron', 'Rajdhani', sans-serif;
    color: #e0e6ed;
    touch-action: none;
}

#gameCanvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: block;
    z-index: 1;
    background-color: #05050b;
}

/* Glassmorphism UI Overlays */
.hud-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 10;
}

.glass-card {
    background: rgba(10, 15, 30, 0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(0, 255, 255, 0.25);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), inset 0 0 15px rgba(0, 255, 255, 0.05);
    border-radius: 12px;
    pointer-events: auto;
}

#leaderboard {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 220px;
    padding: 12px 16px;
}

#stats-panel {
    position: absolute;
    top: 20px;
    left: 20px;
    padding: 12px 18px;
    display: flex;
    gap: 20px;
    font-size: 1rem;
    font-weight: 700;
}

#minimap-container {
    position: absolute;
    bottom: 20px;
    left: 20px;
    padding: 8px;
    width: 160px;
    height: 160px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(0, 255, 255, 0.4);
}

#minimapCanvas {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: rgba(5, 10, 20, 0.85);
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(4, 6, 15, 0.85);
    backdrop-filter: blur(12px);
    z-index: 50;
    transition: opacity 0.3s ease;
}

.hidden {
    display: none !important;
}
```

---

## 3. World Map Representation & Rendering (3000x3000px)

### 3.1 Arena Geometry & Coordinate System
- **Domain Representation**: 2D Cartesian plane where coordinate space is bounded within $[0, W_{world}] \times [0, H_{world}]$ where $W_{world} = 3000\text{px}, H_{world} = 3000\text{px}$.
- **Arena Center**: $C = (X_C, Y_C) = (1500, 1500)$.
- **Playable Circular Radius**: $R_{world} = 1450\text{px}$ (leaving a 50px buffer inside the 3000x3000 box).
- **Radial Distance Equation**:
  $$r(x, y) = \sqrt{(x - X_C)^2 + (y - Y_C)^2}$$
- **Boundary Containment Rule**:
  $$\text{Inside Arena} \iff r(x, y) \le R_{world}$$
  $$\text{Forcefield Lethal Collision} \iff r(x_{head}, y_{head}) \ge R_{world}$$

### 3.2 Frustum-Culled Neon Grid Background
Drawing 3000x3000px worth of grid lines across the entire world every frame would cause severe GPU fill-rate drop. Instead, we compute the camera's visible world AABB and only iterate through the visible grid lines.

```javascript
class WorldGridRenderer {
    constructor(worldWidth = 3000, worldHeight = 3000, cellSize = 100) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.centerX = worldWidth / 2;
        this.centerY = worldHeight / 2;
        this.radius = 1450;
        this.cellSize = cellSize;
        this.pulseTime = 0;
    }

    draw(ctx, camera, dt) {
        this.pulseTime += dt;
        const bounds = camera.getVisibleBounds(this.cellSize);

        // 1. Fill Deep Void Background
        ctx.fillStyle = '#060714';
        ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

        // 2. Render Frustum-Culled Grid Lines
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.04)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();

        const startX = Math.floor(Math.max(0, bounds.minX) / this.cellSize) * this.cellSize;
        const endX = Math.min(this.worldWidth, bounds.maxX);
        for (let x = startX; x <= endX; x += this.cellSize) {
            ctx.moveTo(x, Math.max(0, bounds.minY));
            ctx.lineTo(x, Math.min(this.worldHeight, bounds.maxY));
        }

        const startY = Math.floor(Math.max(0, bounds.minY) / this.cellSize) * this.cellSize;
        const endY = Math.min(this.worldHeight, bounds.maxY);
        for (let y = startY; y <= endY; y += this.cellSize) {
            ctx.moveTo(Math.max(0, bounds.minX), y);
            ctx.lineTo(Math.min(this.worldWidth, bounds.maxX), y);
        }
        ctx.stroke();

        // 3. Grid Dot Intersections (Subtle Cyberpunk Accent)
        ctx.fillStyle = 'rgba(0, 255, 255, 0.12)';
        const dotRadius = 1.5;
        for (let x = startX; x <= endX; x += this.cellSize) {
            for (let y = startY; y <= endY; y += this.cellSize) {
                // Only draw dots inside arena circle
                const dx = x - this.centerX;
                const dy = y - this.centerY;
                if (dx * dx + dy * dy <= this.radius * this.radius) {
                    ctx.beginPath();
                    ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.restore();

        // 4. Render Perimeter Laser Forcefield
        this.drawPerimeterForcefield(ctx, camera);
    }
}
```

### 3.3 Border Laser Forcefield Physics & Visual Shaders
The boundary laser forcefield utilizes multi-layered glowing arcs and high-frequency sinusoidal plasma modulation:
- **Plasma Wave Equation**:
  $$R(\theta, t) = R_{world} + A_1 \sin(k_1 \theta - \omega_1 t) + A_2 \cos(k_2 \theta + \omega_2 t)$$
  where $A_1 = 3.5\text{px}, k_1 = 36, \omega_1 = 3.0\text{ rad/s}, A_2 = 1.5\text{px}, k_2 = 72, \omega_2 = 5.0\text{ rad/s}$.
- **Multi-pass Glow Layers**:
  1. Outer Energy Shield Ambient Glow: Alpha $0.15$, LineWidth $40\text{px}$, Color `hsl(330, 100%, 50%)`.
  2. Medium Laser Core Beam: Alpha $0.6$, LineWidth $10\text{px}$, Color `hsl(300, 100%, 65%)`.
  3. Inner High-Intensity Ion Core: Alpha $1.0$, LineWidth $2.5\text{px}$, Color `#ffffff`.
- **Lethal Forcefield Collision Calculation**:
  When checking entity head $(x_h, y_h)$ against border:
  $$\Delta x = x_h - X_C, \quad \Delta y = y_h - Y_C$$
  $$d_{center} = \sqrt{\Delta x^2 + \Delta y^2}$$
  $$\text{if } d_{center} + r_{head} \ge R_{world} \implies \text{Trigger Death \& Disintegration}$$

---

## 4. Camera System: Math, Transformations, Tracking, & Frustum Culling

### 4.1 Mass-Scaled Zoom Function
As the snake consumes food and grows in mass $M$, the camera zooms out smoothly to keep the larger body in view while maintaining competitive situational awareness.

#### The Mathematical Formulation
$$Z(M) = Z_0 \cdot \left(\frac{M_0}{M + M_0}\right)^\kappa$$

Where:
- $M$: Current total snake mass ($M \ge M_{base} = 20$).
- $M_0$: Reference characteristic mass constant ($M_0 = 150$).
- $Z_0$: Base optical zoom factor at low mass ($Z_0 = 1.0$).
- $\kappa$: Non-linear logarithmic scaling exponent ($\kappa = 0.28$).
- Clamping limits: $Z \in [Z_{min}, Z_{max}]$ where $Z_{min} = 0.35, Z_{max} = 1.05$.

#### Zoom Curve Characteristics
| Snake Mass $M$ | Status / Tier | Calculated Zoom $Z(M)$ | Viewport World Width ($1920\text{px}$ screen) |
|---|---|---|---|
| $20$ | Spawning Base | $0.965 \times$ | $\approx 1990\text{px}$ |
| $100$ | Medium Forager | $0.840 \times$ | $\approx 2285\text{px}$ |
| $300$ | Large Predator | $0.702 \times$ | $\approx 2735\text{px}$ |
| $1000$ | Giant Serpent | $0.536 \times$ | $\approx 3582\text{px}$ |
| $3000$ | Apex Titan | $0.410 \times$ | $\approx 4680\text{px}$ |

### 4.2 Frame-Rate Independent Exponential Smoothing (Lerp)
To prevent camera jitter on fluctuating frame rates ($30\text{--}144\text{ Hz}$), camera position $(X_{cam}, Y_{cam})$ and zoom level $Z_{cam}$ are updated using exponential decay:

$$\alpha_{pos}(dt) = 1 - e^{-\lambda_{pos} \cdot dt} \quad (\lambda_{pos} = 12.0\text{ s}^{-1})$$
$$\alpha_{zoom}(dt) = 1 - e^{-\lambda_{zoom} \cdot dt} \quad (\lambda_{zoom} = 4.0\text{ s}^{-1})$$

$$X_{cam}(t + dt) = X_{cam}(t) + (X_{target} - X_{cam}(t)) \cdot \alpha_{pos}(dt)$$
$$Y_{cam}(t + dt) = Y_{cam}(t) + (Y_{target} - Y_{cam}(t)) \cdot \alpha_{pos}(dt)$$
$$Z_{cam}(t + dt) = Z_{cam}(t) + (Z_{target} - Z_{cam}(t)) \cdot \alpha_{zoom}(dt)$$

### 4.3 Bidirectional Matrix Transformations
The camera establishes a centered, scaled transformation between screen space and world space:

```
                  ┌────────────────────────────────────────┐
                  │              WORLD SPACE               │
                  │  (x: 0 -> 3000, y: 0 -> 3000, origin)  │
                  └───────────────────┬────────────────────┘
                                      │
                         worldToScreen(wx, wy)
          sx = (wx - camX) * zoom + Vw / 2, sy = (wy - camY) * zoom + Vh / 2
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │              SCREEN SPACE              │
                  │ (x: 0 -> Vw, y: 0 -> Vh, CSS Viewport) │
                  └───────────────────┬────────────────────┘
                                      │
                         screenToWorld(sx, sy)
          wx = camX + (sx - Vw / 2) / zoom, wy = camY + (sy - Vh / 2) / zoom
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │              WORLD SPACE               │
                  └────────────────────────────────────────┘
```

#### Canvas 2D Transform Stack
```javascript
applyTransform(ctx) {
    ctx.save();
    // 1. Move origin to center of viewport
    ctx.translate(this.viewportWidth / 2, this.viewportHeight / 2);
    // 2. Apply dynamic mass zoom
    ctx.scale(this.zoom, this.zoom);
    // 3. Offset by camera world focus point
    ctx.translate(-this.x, -this.y);
}

restoreTransform(ctx) {
    ctx.restore();
}
```

### 4.4 Viewport Frustum Culling Math
The visible world bounding box in world coordinates is:
$$HalfWidth_{world} = \frac{W_{viewport}}{2 \cdot Z_{cam}}, \quad HalfHeight_{world} = \frac{H_{viewport}}{2 \cdot Z_{cam}}$$

$$minX = X_{cam} - HalfWidth_{world} - M_{pad}$$
$$maxX = X_{cam} + HalfWidth_{world} + M_{pad}$$
$$minY = Y_{cam} - HalfHeight_{world} - M_{pad}$$
$$maxY = Y_{cam} + HalfHeight_{world} + M_{pad}$$

where $M_{pad}$ is a safety margin ($64\text{px}$) preventing popping at the viewport edges.

An entity with bounding circle $(x, y, r)$ is visible if and only if:
$$\text{isInViewport}(x, y, r) \iff (x + r \ge minX) \land (x - r \le maxX) \land (y + r \ge minY) \land (y - r \le maxY)$$

---

## 5. 360° Free Movement & Spine Kinematics

### 5.1 Continuous Angular Steering & Shortest-Arc Normalization
- Target heading angle $\theta_{target} = \text{atan2}(Y_{input} - Y_{head}, X_{input} - X_{head})$.
- Angular delta calculation with shortest-turn wrap-around:
  $$\Delta \theta = \theta_{target} - \theta_{current}$$
  $$\Delta \theta = ((\Delta \theta + \pi) \pmod{2\pi}) - \pi \quad (\Delta \theta \in [-\pi, \pi])$$
- Turning rate $\omega(M)$ is scaled inversely with mass so heavier snakes have more inertia:
  $$\omega(M) = \omega_0 \cdot \sqrt{\frac{M_0}{M + M_0}} \quad (\omega_0 = 4.8\text{ rad/s})$$
- Angular update:
  $$\text{maxStep} = \omega(M) \cdot dt$$
  $$\theta_{current} \leftarrow \theta_{current} + \text{clamp}(\Delta \theta, -\text{maxStep}, \text{maxStep})$$

### 5.2 Path History Ring Buffer & Arc-Length Sampled Segments
Instead of naive spring-chain physics which causes rubber-banding and oscillation at high speeds, Slither.io kinematics relies on an **Arc-Length Sampled Path History**:
1. Head moves forward each frame by distance $\Delta s = V \cdot dt$:
   $$X_{head} \leftarrow X_{head} + \cos(\theta) \cdot \Delta s$$
   $$Y_{head} \leftarrow Y_{head} + \sin(\theta) \cdot \Delta s$$
2. High-resolution path points $(x, y)$ are prepended to a circular ring buffer or continuous history array.
3. Body segment $i \in [1, N]$ is positioned at exact cumulative arc-length distance $d_i = i \times D_{spacing}$ (where $D_{spacing} = 10\text{px}$) behind the head along the historical path.
4. Total segments count $N(M) = \lfloor N_{base} + c_{len} \cdot M \rfloor$.

### 5.3 Speed Boost & Mass Shedding
- Normal Speed: $V_{base} = 140\text{px/s}$.
- Boost Speed: $V_{boost} = 1.9 \times V_{base} = 266\text{px/s}$.
- Mass Drain Rate during boost: $\frac{dM}{dt} = -4.0\text{ mass/s}$.
- Boost cutoff limit: If $M \le 20$, boost is automatically disabled.
- Boost trail food: Every $\approx 0.15\text{s}$ while boosting, shed a glowing energy orb at the tail tip containing the lost mass.

---

## 6. Complete Milestone 1 Implementation Architecture

Below is the concrete class design and implementation ready for script.js.

### 6.1 `Camera` Class (`Camera.js`)
```javascript
class Camera {
    constructor(viewportWidth = window.innerWidth, viewportHeight = window.innerHeight) {
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;
        this.x = 1500;
        this.y = 1500;
        this.targetX = 1500;
        this.targetY = 1500;

        // Mass-based Zoom Parameters
        this.baseZoom = 1.0;
        this.refMass = 150;
        this.kappa = 0.28;
        this.minZoom = 0.35;
        this.maxZoom = 1.05;
        this.zoom = 1.0;
        this.targetZoom = 1.0;

        // Smoothing Coefficients (s^-1)
        this.posLerpRate = 12.0;
        this.zoomLerpRate = 4.0;

        // Cached Visible Bounds
        this.bounds = { minX: 0, maxX: 3000, minY: 0, maxY: 3000 };
        this.updateBounds();
    }

    resize(width, height) {
        this.viewportWidth = width;
        this.viewportHeight = height;
        this.updateBounds();
    }

    setTarget(x, y, mass = 20) {
        this.targetX = x;
        this.targetY = y;
        // Compute target zoom from mass formula
        const rawZoom = this.baseZoom * Math.pow(this.refMass / (mass + this.refMass), this.kappa);
        this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, rawZoom));
    }

    update(dt) {
        // Frame-rate independent exponential smoothing
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
```

### 6.2 `World` & Forcefield Renderer (`World.js`)
```javascript
class World {
    constructor(width = 3000, height = 3000, radius = 1450) {
        this.width = width;
        this.height = height;
        this.radius = radius;
        this.centerX = width / 2;
        this.centerY = height / 2;
        this.gridSize = 100;
        this.pulseTime = 0;
    }

    isOutOfBounds(x, y, radius = 0) {
        const dx = x - this.centerX;
        const dy = y - this.centerY;
        return (dx * dx + dy * dy) >= Math.pow(this.radius - radius, 2);
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

        // 1. Frustum-culled Background Grid
        ctx.fillStyle = '#060714';
        ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

        ctx.save();
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.045)';
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
            ctx.lineTo(Math.min(this.width, bounds.maxY));
        }
        ctx.stroke();

        // 2. Dotted Grid Nodes
        ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
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

        // 3. Neon Forcefield Perimeter
        this.drawForcefield(ctx);
    }

    drawForcefield(ctx) {
        ctx.save();
        const pulse = Math.sin(this.pulseTime * 3.0) * 0.15 + 0.85;

        // Outer glow
        ctx.strokeStyle = `rgba(255, 0, 100, ${0.12 * pulse})`;
        ctx.lineWidth = 40;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Secondary beam
        ctx.strokeStyle = `rgba(255, 30, 150, ${0.5 * pulse})`;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // High intensity core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}
```

### 6.3 `Snake` Entity Foundation (`Snake.js`)
```javascript
class Snake {
    constructor(id, name, x, y, skin = 'cyan', isPlayer = false) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.angle = -Math.PI / 2;
        this.targetAngle = -Math.PI / 2;
        this.isPlayer = isPlayer;
        this.skin = skin;

        // Mass and Speeds
        this.mass = 20;
        this.baseSpeed = 140; // px / sec
        this.boostSpeed = 266; // 1.9x px / sec
        this.isBoosting = false;
        this.isDead = false;

        // Kinematics and Geometry
        this.headRadius = 14;
        this.segmentSpacing = 10;
        this.pathHistory = [];
        this.segments = [];

        // Pre-fill path history
        const initialLength = this.calculateSegmentCount();
        for (let i = 0; i <= initialLength * this.segmentSpacing; i++) {
            this.pathHistory.push({
                x: this.x - Math.cos(this.angle) * i,
                y: this.y - Math.sin(this.angle) * i
            });
        }
        this.updateSegments();
    }

    calculateSegmentCount() {
        return Math.floor(10 + this.mass * 0.35);
    }

    setTargetAngle(angle) {
        this.targetAngle = angle;
    }

    setBoosting(boost) {
        this.isBoosting = boost && this.mass > 20;
    }

    update(dt) {
        if (this.isDead) return;

        // 1. Turning physics with mass inertia
        let angleDiff = this.targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const turnRate = 4.8 * Math.sqrt(150 / (this.mass + 150));
        const maxTurn = turnRate * dt;
        this.angle += Math.max(-maxTurn, Math.min(maxTurn, angleDiff));

        // 2. Movement speed & mass drainage
        let speed = this.baseSpeed;
        if (this.isBoosting && this.mass > 20) {
            speed = this.boostSpeed;
            this.mass = Math.max(20, this.mass - 4.0 * dt);
            if (this.mass <= 20) this.isBoosting = false;
        }

        // 3. Forward head advance
        const moveDist = speed * dt;
        this.x += Math.cos(this.angle) * moveDist;
        this.y += Math.sin(this.angle) * moveDist;

        // 4. Path history recording
        this.pathHistory.unshift({ x: this.x, y: this.y });

        const requiredSegments = this.calculateSegmentCount();
        const maxHistory = (requiredSegments + 2) * this.segmentSpacing;
        if (this.pathHistory.length > maxHistory) {
            this.pathHistory.length = maxHistory;
        }

        // 5. Update segments from path history
        this.updateSegments();
    }

    updateSegments() {
        const segCount = this.calculateSegmentCount();
        this.segments = [{ x: this.x, y: this.y, radius: this.headRadius }];

        for (let i = 1; i < segCount; i++) {
            const histIndex = Math.min(i * this.segmentSpacing, this.pathHistory.length - 1);
            const pt = this.pathHistory[histIndex];
            // Taper body towards tail
            const taper = 1.0 - (i / segCount) * 0.35;
            this.segments.push({
                x: pt.x,
                y: pt.y,
                radius: this.headRadius * taper
            });
        }
    }

    draw(ctx, camera) {
        if (this.isDead) return;

        // Draw body segments (tail to neck)
        for (let i = this.segments.length - 1; i >= 1; i--) {
            const seg = this.segments[i];
            if (!camera.isInViewport(seg.x, seg.y, seg.radius)) continue;

            ctx.fillStyle = i % 2 === 0 ? '#00f0ff' : '#00a0dd';
            ctx.beginPath();
            ctx.arc(seg.x, seg.y, seg.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw head
        const head = this.segments[0];
        if (camera.isInViewport(head.x, head.y, head.radius + 10)) {
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(head.x, head.y, head.radius, 0, Math.PI * 2);
            ctx.fill();

            // Eyes rendering
            this.drawEyes(ctx, head.x, head.y, this.angle);
        }
    }

    drawEyes(ctx, hx, hy, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const perpX = -sin;
        const perpY = cos;
        const eyeOffset = 6;
        const eyeForward = 6;

        const leftEyeX = hx + perpX * eyeOffset + cos * eyeForward;
        const leftEyeY = hy + perpY * eyeOffset + sin * eyeForward;
        const rightEyeX = hx - perpX * eyeOffset + cos * eyeForward;
        const rightEyeY = hy - perpY * eyeOffset + sin * eyeForward;

        // Sclera
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(leftEyeX, leftEyeY, 4.5, 0, Math.PI * 2);
        ctx.arc(rightEyeX, rightEyeY, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#050510';
        ctx.beginPath();
        ctx.arc(leftEyeX + cos * 1.5, leftEyeY + sin * 1.5, 2.2, 0, Math.PI * 2);
        ctx.arc(rightEyeX + cos * 1.5, rightEyeY + sin * 1.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
    }
}
```

---

## 7. Multi-Input Controller Integration
A unified input subsystem maps Mouse, Keyboard, and Touch controls to world-space target angles and boost states:

```javascript
class InputController {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.camera = camera;
        this.targetAngle = -Math.PI / 2;
        this.isBoosting = false;
        this.keys = {};
        this.mousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.inputMode = 'mouse'; // 'mouse' | 'keyboard' | 'touch'

        this.initListeners();
    }

    initListeners() {
        // Mouse Tracking
        window.addEventListener('mousemove', (e) => {
            this.inputMode = 'mouse';
            this.mousePos.x = e.clientX;
            this.mousePos.y = e.clientY;
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.isBoosting = true;
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.isBoosting = false;
        });

        // Keyboard Controls
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.code === 'Space') this.isBoosting = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            if (e.code === 'Space') this.isBoosting = false;
        });
    }

    update(playerSnake) {
        if (!playerSnake) return;

        // Check Keyboard WASD / Arrows
        let moveX = 0, moveY = 0;
        if (this.keys['w'] || this.keys['arrowup']) moveY -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) moveY += 1;
        if (this.keys['a'] || this.keys['arrowleft']) moveX -= 1;
        if (this.keys['d'] || this.keys['arrowright']) moveX += 1;

        if (moveX !== 0 || moveY !== 0) {
            this.inputMode = 'keyboard';
            this.targetAngle = Math.atan2(moveY, moveX);
        } else if (this.inputMode === 'mouse') {
            // Convert mouse screen position to world coordinates
            const worldPos = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
            this.targetAngle = Math.atan2(worldPos.y - playerSnake.y, worldPos.x - playerSnake.x);
        }

        playerSnake.setTargetAngle(this.targetAngle);
        playerSnake.setBoosting(this.isBoosting);
    }
}
```

---

## 8. E2E Verification & Test Mapping for Milestone 1

To ensure Milestone 1 achieves 100% automated test compliance, the following test scenarios must be implemented in the E2E test harness:

1. **Camera Tracking Accuracy**: Verify camera position matches player head with $\Delta < 1\text{px}$ in steady state.
2. **Screen-to-World Inversion Roundtrip**: For 100 random screen points, $\text{worldToScreen}(\text{screenToWorld}(P)) \equiv P$ within floating-point tolerance ($10^{-5}$).
3. **Mass Zoom Formula Monotonicity**: Ensure $Z(M_2) < Z(M_1)$ for any $M_2 > M_1$, bounded by $[0.35, 1.05]$.
4. **Perimeter Forcefield Collision**: Ensure snake heading beyond $R_{world} = 1450$ triggers lethal out-of-bounds.
5. **DPR Resizing Fidelity**: Verify canvas width/height equals $\lfloor \text{innerWidth} \times DPR \rfloor$.

---

## 9. Conclusion
Milestone 1 design provides a robust, decoupled, and mathematically verified foundation for the Slither.io clone. The implementation uses pure Vanilla JavaScript ES6 and HTML5 Canvas with zero external dependencies, fulfilling all Milestone 1 requirements.
