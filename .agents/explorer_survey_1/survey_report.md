# Comprehensive Survey & Architecture Report: Slither.io Rebuild

**Agent**: Survey Explorer 1 (`explorer_survey_1`)  
**Date**: 2026-08-29  
**Target Repository**: `D:\snake_game`  
**Reference Document**: `ORIGINAL_REQUEST.md`

---

## 1. Executive Summary

This report delivers a thorough architectural survey and engineering blueprint for transforming the existing single-player grid/arena "Neon Snake" game into a high-polish, feature-complete **Slither.io-style multiplayer-simulation web game**.

The rebuild requires transitioning from a fixed 800x800 single-snake canvas into an open-world arena (e.g. 3000x3000px circular map) featuring:
1. **Dynamic Camera & World Transform**: Centered on the player's snake head with smooth panning and dynamic zoom.
2. **Multi-Snake Architecture**: Scalable class-based entity system supporting 15–30 concurrent AI bots alongside the player snake.
3. **Continuous Kinematics & Boost Mechanics**: 360-degree continuous turning, mass/length progression, and speed boosting with mass shedding.
4. **Food & Orb Ecosystem**: Ambient orbs, high-value death orbs, boost trails, and chasing prey orbs with magnetic attraction.
5. **Spatial Hashing & Collision Pipeline**: Sub-millisecond $O(1)$ collision detection for snake heads vs bodies, food, and map borders.
6. **High-Performance 60 FPS Glowing Visuals**: Offscreen sprite pre-rendering and additive blending to replace unoptimized `ctx.shadowBlur` rasterization bottlenecks.
7. **Complete UI/UX Suite**: Sleek cyberpunk start screen, skin/color customizer, live dynamic leaderboard, radar minimap, kill feed, and game-over summary.

---

## 2. Codebase Audit & Current Limitations

### 2.1 File Structure & Line Count
- `index.html` (46 lines): Fixed layout with static header, score board, centered 800x800 canvas container, overlay modal, and virtual joystick markup.
- `script.js` (384 lines): Monolithic procedural script with global variables handling state, movement, and drawing.
- `style.css` (154 lines): Dark neon cyberpunk theme with Orbitron font, responsive query hiding PC guide on mobile, virtual joystick styling.

### 2.2 In-Depth Analysis of Existing Mechanics & Data Structures

| Subsystem | Current Implementation (`script.js`) | Limitations / Conflicts with Slither.io |
|---|---|---|
| **World & Coordinates** | Fixed `logicalSize = 800` (lines 16-18). No coordinate transformation; screen $(x, y) \equiv$ world $(x, y)$. | Needs a massive 3000x3000px+ circular arena with a camera transformation pipeline (`screenToWorld`, `worldToScreen`, `ctx.translate`). |
| **Canvas Viewport** | Fixed 800x800 CSS container (`style.css` lines 43-53) scaled by HiDPI DPR (lines 27-33). | Slither.io requires fullscreen `window.innerWidth` $\times$ `window.innerHeight` canvas with dynamic resize handlers. |
| **Snake Data Model** | Single global `snake = []` array (line 36) and `pathHistory = []` (line 37). Supports only 1 snake. | Must be refactored into a scalable `Snake` class instantiated for the player and 15–30 bot instances. |
| **Movement Physics** | Dual mode: 'classic' (grid-based) vs 'free' (360° turn by delta angle, lines 150-174). No boost, no turning radius scaling, no continuous body spline. | 'Classic' grid mode must be removed. 360° continuous physics with acceleration, angular velocity, and boosting must be standardized. |
| **Food / Orb System** | Single global object `apple = {x, y}` (line 50). Only 1 food item on screen at a time. | Needs a `FoodManager` supporting 1000+ simultaneous orbs, multiple orb types (ambient, boost shed, death orbs), magnetic pull, and spatial clustering. |
| **Collision System** | $O(N)$ brute-force distance check on own snake body (lines 188-192) and wall bounds $[10, 790]$ (line 179). | Inadequate for multiple snakes. Requires a 2D Spatial Hash Grid to handle head-to-body, head-to-head, and head-to-orb queries at 60 FPS. |
| **AI Bot System** | None exists. | Autonomous AI bots with steering behaviors (wander, forage, avoid body, hunt/intercept, boost attack) are required. |
| **Rendering Pipeline** | Direct canvas 2D draws with `ctx.shadowBlur = 20` invoked per segment and per apple each frame (lines 214, 229-230). | Invoking `shadowBlur` across 30 snakes $\times$ 100 segments + 1000 orbs causes catastrophic GPU/CPU rasterization drops (<10 FPS). Must use pre-rendered offscreen glow caches. |
| **UI & HUD** | Fixed static DOM elements (title, score, high score). Simple overlay toggle on game over (lines 266-271). | Requires a full game UI: Live top 10 leaderboard, in-game minimap radar, kill feed notifications, skin selector, and responsive HUD overlay. |

---

## 3. Architecture Blueprint for Slither.io Rebuild

To ensure maintainability, testability, and 60 FPS performance, the architecture is structured into modular subsystems using pure ES6 / Vanilla JavaScript:

```
                      +-----------------------------------+
                      |          Game Engine              |
                      | (GameLoop, StateMachine, Resizer) |
                      +-----------------+-----------------+
                                        |
      +------------------+--------------+---------------+------------------+
      |                  |                              |                  |
+-----v-----+      +-----v-----+                  +-----v-----+      +-----v-----+
|  Camera   |      |   World   |                  |  Spatial  |      | Offscreen |
|  System   |      | Arena/Grid|                  | Hash Grid |      | GlowCache |
+-----+-----+      +-----------+                  +-----+-----+      +-----+-----+
      |                                                 |                  |
      +------------------+------------------------------+                  |
                         |                                                 |
                   +-----v-----+                                           |
                   |   Entity  |                                           |
                   |  Manager  |                                           |
                   +-----+-----+                                           |
                         |                                                 |
             +-----------+-----------+                                     |
             |                       |                                     |
       +-----v-----+           +-----v-----+                               |
       |   Snake   |           |   Food    |                               |
       |  System   |           |  Manager  |                               |
       | (Player & |           | (Ambient, |                               |
       |   Bots)   |           |  Death)   |                               |
       +-----+-----+           +-----+-----+                               |
             |                       |                                     |
             +-----------+-----------+                                     |
                         |                                                 |
                   +-----v-----+                                     +-----v-----+
                   | Collision |                                     | Glowing   |
                   |  Solver   |                                     | Renderer  |
                   +-----------+                                     +-----------+
```

### 3.1 Module Breakdown & Responsibilities

#### 1. `Engine.js` (Game Loop & State Controller)
- **Responsibilities**:
  - Manages game states: `MENU`, `PLAYING`, `GAME_OVER`.
  - Delta-time calculation (`dt`) with max clamp (0.1s) and fixed-timestep accumulator for deterministic physics (60Hz).
  - Handles window resize events and propagates dimensions to the canvas and camera.
  - Central dispatcher for `update(dt)` and `render()`.

#### 2. `Camera.js` (Viewport & Transform System)
- **Responsibilities**:
  - Tracks player head position `(player.x, player.y)` with smooth exponential lerp damping (`factor = 0.08`).
  - Implements dynamic zoom scaling: `zoom = baseZoom / (1 + length * zoomFactor)` ensuring larger snakes get a wider field of view.
  - Calculates visible world bounding box (`viewportBounds`) for aggressive frustum culling.
  - Provides bi-directional coordinate mapping:
    - `screenToWorld(screenX, screenY) -> {x, y}`
    - `worldToScreen(worldX, worldY) -> {x, y}`
  - Applies 2D canvas context transformations (`translate`, `scale`).

#### 3. `World.js` (Map Arena & Environment)
- **Responsibilities**:
  - Defines circular world boundaries: `radius = 2000px` (diameter 4000px, area $\approx 12.56 \text{M px}^2$).
  - Generates immersive background visuals:
    - Glowing neon hexagonal / coordinate grid lines.
    - Multi-layered parallax starfield / floating cosmic dust particles.
    - Pulsing neon boundary forcefield with danger color gradation.
  - Supplies boundary clamping and distance calculations for collision.

#### 4. `SpatialHash.js` (Broadphase Spatial Partitioning)
- **Responsibilities**:
  - Partitions world into a 2D uniform grid (e.g. `cellSize = 120px`).
  - Provides instant $O(1)$ spatial registration and bucket querying.
  - Methods:
    - `insert(entity, type)`: Registers food or snake body segment.
    - `queryCircle(x, y, radius, filterType)`: Returns all entities within radius.
    - `clear()`: Re-initializes buckets each physics frame.

#### 5. `Snake.js` (Base Snake Entity) & `BotSnake.js` / `PlayerSnake.js`
- **Responsibilities**:
  - **Properties**: `id`, `name`, `isPlayer`, `colorTheme`, `score`, `length`, `radius`, `x`, `y`, `angle`, `targetAngle`, `turnSpeed`, `baseSpeed`, `boostSpeed`, `isBoosting`, `isAlive`.
  - **Body Kinematics**: Maintains dense position history (`pathHistory`). Segments are sampled along history at uniform arc-length intervals (`segmentSpacing = 8px`).
  - **Boost Logic**: Doubles movement speed when active. When boosting, periodically ejects mass (spawning boost orbs behind tail) and decrements length/score.
  - **Visuals**: Smooth segment sizing (slight taper towards tail), head rendering with reactive eyes that track movement direction and squint during boost, glowing outer stroke.
  - **Death Handling**: When destroyed, decomposes body segments into high-value glowing death orbs with dispersion velocity.

#### 6. `FoodManager.js` (Orb & Energy Ecosystem)
- **Responsibilities**:
  - Manages collection of active orbs (pools up to 2000 active orbs).
  - Orb Categories:
    - **Ambient Orbs**: Spawned evenly across the arena with subtle drift and color oscillation (value: 1).
    - **Boost Orbs**: Dropped by boosting snakes (value: 2).
    - **Death Orbs**: Dropped along the full spine of killed snakes (value: 15–40 each, large glowing radius).
    - **Chasing Firefly Orbs**: High-speed prey orbs that flee nearby snakes, rewarding massive points (value: 100).
  - Implements **magnetic pull**: When an orb enters a snake's head attraction radius (`radius * 2.5`), it accelerates smoothly towards the snake's mouth.

#### 7. `BotController.js` (AI Autonomous Agents)
- **Responsibilities**:
  - Spawns and manages 15–25 concurrent bot snakes with unique cyberpunk names and skin variations.
  - Implements steering behaviors:
    - **Wander & Forage**: Scans nearby spatial cells for dense food clusters.
    - **Collision Avoidance**: Raycasts/probes forward trajectory; sharply steers away if an enemy body segment is detected.
    - **Border Avoidance**: Steers towards world center when approaching boundary ($d > R - 200$).
    - **Hunting & Interception**: Aggressive bots detect nearby smaller snakes and boost to cut across their path (coiling / cutoff tactic).
  - Autonomous respawn scheduler: Automatically replenishes bot population when a bot dies.

#### 8. `GlowRenderer.js` & `GlowCache.js` (High-Performance Canvas Renderer)
- **Responsibilities**:
  - Pre-generates offscreen canvas sprites for all neon color themes (Cyan, Magenta, Lime, Orange, Yellow, Purple, Electric Blue, White):
    - Glow Orb Sprites (Radial gradient with luminous core and soft outer halo).
    - Snake Segment Sprites (Multi-layered neon disc with inner highlight).
    - Particle Glow Sparks.
  - Main render pass:
    1. Background grid & stars (clipped to viewport).
    2. Boundary forcefield ring.
    3. Food orbs (rendered via fast `drawImage` blitting with viewport culling).
    4. Snake bodies and heads (drawn back-to-front, glowing eyes, custom skins).
    5. Boost and death particle explosions.
  - Uses `ctx.globalCompositeOperation = 'lighter'` for intense additive neon glow without CPU blur overhead.

#### 9. `UI.js` (HUD, Start Menu, Leaderboard & Radar)
- **Responsibilities**:
  - **Start Screen Overlay**: Neon title, player nickname input, skin selector carousel, high score badge, "PLAY" button.
  - **Live Leaderboard**: Real-time Top 10 rankings showing bot names, player name (highlighted with distinct color), and scores.
  - **In-Game HUD**: Current score, length rank, boost gauge, FPS counter.
  - **Minimap Radar**: Circular canvas in bottom right showing world boundary, player position (pulsing cyan blip), and top leaderboard snakes.
  - **Kill Feed**: Animated toast notifications ("You eliminated CyberViper!", "NeonByte was slain!").
  - **Game Over Screen**: Final score, rank, enemies killed, time survived, and one-click restart.
  - **Input Adapters**: Seamless support for Mouse movement (PC), Keyboard steering (WASD/Arrows), Touch Virtual Joystick (Mobile), and Spacebar/Left-Click/Touch Button for boosting.

---

## 4. Technical Specifications & Mathematical Formulations

### 4.1 Coordinate Space & Camera Transformations

```
  Screen Space: [0, canvas.width] x [0, canvas.height]
  Center of Viewport: (canvas.width / 2, canvas.height / 2)
  
  World Space: Circular Disk centered at (0, 0) with Radius R = 2000px
  
  Camera State:
    x: CamX (lerped to player.x)
    y: CamY (lerped to player.y)
    zoom: dynamic zoom scale
```

**Forward Transform (World -> Screen)**:
$$X_{\text{screen}} = (X_{\text{world}} - \text{Cam}_x) \cdot \text{zoom} + \frac{\text{canvas.width}}{2}$$
$$Y_{\text{screen}} = (Y_{\text{world}} - \text{Cam}_y) \cdot \text{zoom} + \frac{\text{canvas.height}}{2}$$

**Inverse Transform (Screen -> World)**:
$$X_{\text{world}} = \frac{X_{\text{screen}} - \frac{\text{canvas.width}}{2}}{\text{zoom}} + \text{Cam}_x$$
$$Y_{\text{world}} = \frac{Y_{\text{screen}} - \frac{\text{canvas.height}}{2}}{\text{zoom}} + \text{Cam}_y$$

**Canvas Matrix Context Setup**:
```js
ctx.save();
ctx.translate(canvas.width / 2, canvas.height / 2);
ctx.scale(camera.zoom, camera.zoom);
ctx.translate(-camera.x, -camera.y);
// All world rendering executed in native World Coordinates
ctx.restore();
```

---

### 4.2 Snake Kinematics & Body Spline

#### Movement & Turning
Given snake speed $v$, delta time $\Delta t$, current angle $\theta$, and target angle $\theta_t$:
$$\Delta\theta = \text{normalizeAngle}(\theta_t - \theta)$$
$$\theta \leftarrow \theta + \text{clamp}(\Delta\theta, -\omega_{\max} \Delta t, \omega_{\max} \Delta t)$$
$$x \leftarrow x + v \cdot \cos(\theta) \Delta t$$
$$y \leftarrow y + v \cdot \sin(\theta) \Delta t$$
Where turning rate $\omega_{\max}$ decreases smoothly as snake length increases:
$$\omega_{\max} = \omega_{\text{base}} \cdot \max\left(0.5, \frac{1}{\sqrt{1 + \text{length} \times 0.01}}\right)$$

#### Continuous Path History & Segment Spacing
To ensure smooth body curves without rubber-banding or telescoping segments:
1. Every frame, the head position $(x, y)$ is recorded into `pathHistory`.
2. Accumulated path distance between points is tracked.
3. The $k$-th body segment is placed at distance $D_k = k \times \text{segmentSpacing}$ along the accumulated path history via linear interpolation between recorded points.
4. Total segments count: $N = \lfloor 5 + \text{score} / 10 \rfloor$.

---

### 4.3 Spatial Hashing & Collision Optimization

To maintain 60 FPS with 25 snakes ($\sim 2500$ segments) and 1000 orbs:
- Arena partitioned into cells of width $W_c = 120\text{px}$.
- Cell key hash:
  $$\text{key}(x, y) = \lfloor x / W_c \rfloor + \text{"_"} + \lfloor y / W_c \rfloor$$
- Insertion complexity: $O(1)$ per entity.
- Query complexity: Querying a head circle $(x, y, r)$ checks only the $3 \times 3$ neighboring cells ($< 15$ checks vs $3500$ checks).

#### Collision Rules:
1. **Head vs World Border**: $\sqrt{x_{\text{head}}^2 + y_{\text{head}}^2} \ge R - r_{\text{head}} \implies \text{Death}$.
2. **Head vs Other Snake Body**: If distance to any segment $S_{j}$ of snake $B$ is $< r_{\text{head}} + r_{\text{segment}} \implies \text{Head Snake dies}$.
3. **Head vs Own Body**: Segment index $j > 4$ and distance $< r_{\text{head}} + r_{\text{segment}} \implies \text{Self-collision Death}$ (optional or disabled for Slither.io classic rules where self-overlap is permitted).
4. **Head vs Food**: Distance $< r_{\text{head}} + r_{\text{orb}} \implies \text{Consume food, increment mass}$.

---

### 4.4 60 FPS Canvas Glow Optimization (Offscreen Pre-rendering)

#### The Problem with Native `ctx.shadowBlur`
In Canvas 2D, setting `ctx.shadowBlur = 20` forces the browser to apply a Gaussian blur kernel across the bounding box of each draw call on the CPU or un-cached GPU pipeline. 3000 blurred draw calls per frame will overwhelm any GPU/CPU, dropping framerates below 10 FPS.

#### The Solution: Offscreen Sprite Cache
During engine initialization, `GlowCache` pre-renders a suite of small offscreen canvases:
1. **Orb Sprites**: Sizes 16px, 24px, 32px, 48px across 8 neon palettes. Rendered once with multi-stop radial gradients:
   - `0.0`: Core bright white `#ffffff`
   - `0.3`: Vivid neon color `#00ffff`
   - `0.7`: Translucent halo `rgba(0, 255, 255, 0.3)`
   - `1.0`: Transparent `rgba(0, 255, 255, 0.0)`
2. **Segment Sprites**: Rendered with glowing outer borders and metallic/glossy neon center.
3. **Drawing in Loop**: Drawing an orb becomes a single hardware-accelerated `ctx.drawImage(cachedCanvas, x - r, y - r, 2*r, 2*r)` call, executing at >100,000 sprites/sec on modern browsers.

---

### 4.5 Bot AI State Machine & Steering Behaviors

Each bot evaluates a weighted steering vector $\mathbf{F} = \sum w_i \mathbf{f}_i$:

```
                             +--------------------+
                             |   Bot Update (dt)  |
                             +---------+----------+
                                       |
                   +-------------------+-------------------+
                   |                   |                   |
          +--------v--------+ +--------v--------+ +--------v--------+
          | Avoid Boundaries| | Avoid Obstacles | |   Target Food   |
          |  (Weight: 10.0) | |  (Weight: 8.0)  | |  (Weight: 2.0)  |
          +--------+--------+ +--------+--------+ +--------+--------+
                   |                   |                   |
                   +-------------------+-------------------+
                                       |
                            +----------v----------+
                            | Compute TargetAngle |
                            | & Decide Boost Mode |
                            +---------------------+
```

1. **Boundary Avoidance**: When distance from center $> R - 300$, apply strong force towards $(0, 0)$.
2. **Obstacle / Snake Body Avoidance**: Cast 3 forward probe whiskers at $[-\pi/6, 0, \pi/6]$ over distance $d_{\text{look}} = 150\text{px}$. If any whisker intersects an enemy body segment, calculate a perpendicular evasion force.
3. **Food Seeking**: Find nearest food cluster or high-value death orb within sensory radius (400px).
4. **Boost Heuristic**: If in hunting mode and adjacent to an enemy head, or if fleeing a close trap, activate boost. Conserve boost if score $< 30$.

---

## 5. UI/UX & HUD Redesign

### 5.1 Screen Layout & Component Structure

```
+-------------------------------------------------------------------------+
| [Top Left]                [Top Center]                      [Top Right] |
| Score: 1,450              CYBER SLITHER                +--------------+ |
| Rank: #3 / 25                                          | LEADERBOARD  | |
| Length: 145m                                           | 1. NeonKing  | |
|                                                        | 2. GigaWorm  | |
|                                                        | 3. YOU       | |
|                                                        | 4. Viper99   | |
|                                                        | ...          | |
|                                                        +--------------+ |
|                                                                         |
|                                                                         |
|                                                                         |
|                                                                         |
|                                                                         |
|                                                            [Bottom Right]|
|                                                            +----------+ |
| [Bottom Left]                                              |  MINIMAP | |
| [ Boost Button ] (Mobile)                                  |  (Radar) | |
| [ Virtual Joystick ] (Mobile)                              |   ( O )  | |
|                                                            +----------+ |
+-------------------------------------------------------------------------+
```

### 5.2 Theme & Styling
- **Palette**: Dark cyber aesthetic (`#050510` background, `#00ffff` cyan, `#ff007f` neon magenta, `#00ff66` neon lime, `#ffaa00` electric orange, `#9933ff` deep violet).
- **Typography**: `Orbitron` Google Font with glowing neon CSS text shadows.
- **Glassmorphism HUD**: Translucent dark backgrounds (`rgba(10, 10, 30, 0.75)`) with backdrop blur and cyan border highlights.

---

## 6. Refactoring & Tear-Down Plan

### What to Remove
- Remove the fixed 800x800 canvas limitation and container wrappers.
- Remove classic 4-direction grid mode and grid apple spawning.
- Remove single-snake global variables and procedural logic in `script.js`.
- Remove unoptimized direct `ctx.shadowBlur` loops.

### What to Retain & Enhance
- Retain the Cyberpunk Neon aesthetic and Orbitron font.
- Retain the virtual joystick and touch input handling, scaling them for fullscreen responsive gameplay.
- Retain local storage high-score persistence and sound hooks.

### New Module Structure (Clean Vanilla JS)
To keep the game easily loadable without complex bundlers or build steps, all modules can be cleanly structured either as ES6 classes loaded via standard script/module tags or unified into well-separated architectural namespaces:
1. `index.html` — Fullscreen layout, glassmorphic HUD overlays, start modal, leaderboard, minimap.
2. `style.css` — Modern responsive styling, cyberpunk animations, HUD layout, mobile controls.
3. `src/` (or structured sections in `script.js`):
   - `Config.js` — World dimensions, speeds, colors, balance constants.
   - `GlowCache.js` — Offscreen sprite generator for 60fps glow.
   - `SpatialHash.js` — Fast spatial partitioning grid.
   - `Camera.js` — Viewport & coordinate transforms.
   - `World.js` — Arena background, grid, stars, boundary forcefield.
   - `FoodManager.js` — Ambient, boost, death, and prey orbs.
   - `Snake.js` — Snake base entity, kinematics, eyes, boost, rendering.
   - `BotController.js` — Multi-bot AI, behaviors, spawn cycles.
   - `UI.js` — HUD, Leaderboard, Minimap, Menus, Input adapters.
   - `Game.js` — Main loop, state machine, collision coordinator.

---

## 7. Dependency Graph & Milestone Breakdown

### Dependency Graph

```
[Milestone 1: Framework & Engine Core]
   |--> Canvas Fullscreen Resizer & HiDPI
   |--> World Arena (3000x3000px) & Background Grid
   |--> Camera Viewport & Coordinate Matrix
   |--> GlowCache Offscreen Sprite System
        |
        v
[Milestone 2: Snake Kinematics & Player Controls]
   |--> Snake Entity Class & Path History Spline
   |--> 360° Movement & Angular Interpolation
   |--> Boost Mechanic & Mass Shedding
   |--> Player Controls (Mouse, Keyboard, Mobile Joystick + Boost)
        |
        v
[Milestone 3: Food Ecosystem & Spatial Partitioning]
   |--> Spatial Hash Grid System (O(1) lookups)
   |--> Ambient Orbs & Pulsing Animations
   |--> Magnetic Food Attraction
   |--> Mass Consumption & Length Growth
        |
        v
[Milestone 4: AI Bot System & Concurrency]
   |--> Bot Controller & 15-25 Bot Instances
   |--> Steering Behaviors (Wander, Forage, Avoid, Hunt)
   |--> Autonomous Bot Respawn Lifecycle
        |
        v
[Milestone 5: Collision Resolution & Death Mechanics]
   |--> Head vs Body / Border Collision System
   |--> Death Explosion Particles & Disintegration
   |--> High-Value Death Orb Dropping
        |
        v
[Milestone 6: UI/UX Suite, Leaderboard & Final Polish]
   |--> Modern Start Screen & Skin Customizer
   |--> Dynamic Real-time Top 10 Leaderboard
   |--> Radar Minimap System
   |--> Kill Feed Notifications & Game Over Summary
   |--> Performance Tuning & 60 FPS Stress Testing
```

---

## 8. Summary & Recommendation

The proposed architecture comprehensively addresses every acceptance criterion specified in `ORIGINAL_REQUEST.md`. It elevates the project from a basic retro game to an arcade-quality, high-performance IO web game capable of smoothly rendering dozens of bots, thousands of orbs, and rich neon visual effects at a solid 60 FPS in pure Vanilla JS and HTML5 Canvas.
