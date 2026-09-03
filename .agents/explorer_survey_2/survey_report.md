# Comprehensive Specification Report: Slither.io Mechanics, Mathematics & Entity Models

**Author:** Survey Spec Miner 2 (`teamwork_preview_spec_miner`)  
**Target:** Slither.io Clone Architecture & Simulation Engine  
**Workspace:** `D:\snake_game`  
**Date:** 2026-08-29  

---

## 1. Executive Summary & Mathematical Architecture

This specification formalizes the physical equations, mathematical transformations, data schemas, and collision kinematics required to construct a production-grade, 60 FPS Slither.io web game using vanilla JavaScript and HTML5 Canvas.

### Key Architectural Pillars
1. **Kinematics & Steering Engine:** Continuous 360-degree heading vector $\vec{u}(\theta) = (\cos\theta, \sin\theta)$, angle normalization, dynamic turning radius scaled inversely with snake mass, and arc-length sampled body spine history.
2. **Dynamic Camera & Projection Matrix:** Centered player head tracking with exponential damping, scale/zoom factor $Z(M) = Z_0 \cdot (M_0 / M)^\kappa$, and bidirectional coordinate transformations (World $\leftrightarrow$ Screen).
3. **Speed & Mass Thermodynamics:** Dual-speed state machine ($v_{\text{base}} \to v_{\text{boost}}$) with continuous mass expenditure $\dot{M}_{\text{boost}}$, trail particle ejection, and momentum decay.
4. **Entity Schemas & Disintegration:** High-fidelity JSON/JS data representations for Snakes, Food Orbs, Particles, and Spatial Grid, plus a radial jitter dead-snake disintegration algorithm.
5. **Collision & Arena Physics:** Spatial Hash partitioning ($O(1)$ cell lookups), circle-circle head-to-body penetration detection, boundary warnings, and lethal arena edge triggers.

---

## 2. Slither.io Mechanics Math & Physics Specification

```
                          WORLD COORDINATE SYSTEM
   (0,0) +-------------------------------------------------------+
         |                                                       |
         |         θ = atan2(dy, dx)                             |
         |            \                                          |
         |             \   v_head = (v*cos θ, v*sin θ)           |
         |              ●──────► Head (p0)                       |
         |             / \                                       |
         |            /   \                                      |
         |           ○     ○ Body Segments (p1..pn)              |
         |            \   /                                      |
         |             \ /                                       |
         |              ○ Tail                                   |
         |                                                       |
         |              World Dimensions: W_world x H_world      |
         +-------------------------------------------------------+ (W, H)
```

### 2.1 360-Degree Continuous Angular Steering Physics

#### 2.1.1 Heading Vector & Angle Representation
The snake's head position in world space is $\vec{p}_0(t) = \begin{pmatrix} x_0(t) \\ y_0(t) \end{pmatrix} \in \mathbb{R}^2$.  
The current heading angle is $\theta(t) \in [-\pi, \pi)$.

Given a target direction (from mouse cursor position $\vec{P}_{\text{mouse}}^{\text{world}}$, virtual joystick vector, or AI waypoint $\vec{P}_{\text{target}}$):
$$\theta_{\text{target}} = \text{atan2}\left(y_{\text{target}} - y_0, x_{\text{target}} - x_0\right)$$

#### 2.1.2 Shortest Angular Difference Calculation
To prevent erratic $360^\circ$ wrap-around spinning, the angular error $\Delta\theta$ must be mapped to the principal branch $[-\pi, \pi]$:
$$\Delta\theta = \text{atan2}\left(\sin(\theta_{\text{target}} - \theta), \cos(\theta_{\text{target}} - \theta)\right)$$

#### 2.1.3 Mass-Dependent Turning Rate $\omega(M)$
In Slither.io, larger snakes possess greater rotational inertia and turn with a wider turning radius, allowing smaller, agile snakes to cut in front of them:
$$\omega(M) = \omega_{\text{base}} \cdot \left( \frac{M_{\text{ref}}}{M + M_{\text{ref}}} \right)^{\gamma_\omega}$$

| Parameter | Symbol | Nominal Value | Unit | Description |
|---|---|---|---|---|
| Base Angular Velocity | $\omega_{\text{base}}$ | $4.2$ | $\text{rad/s}$ ($\approx 0.07\text{ rad/frame}$) | Turn speed of starter snake ($M=10$) |
| Reference Mass | $M_{\text{ref}}$ | $120.0$ | mass units | Mass threshold where turn rate softens |
| Turn Decay Exponent | $\gamma_\omega$ | $0.35$ | dimensionless | Curvature scaling exponent |
| Minimum Angular Velocity | $\omega_{\text{min}}$ | $1.2$ | $\text{rad/s}$ | Clamped floor for giant snakes |

**Step Integration:**
$$\theta(t + \Delta t) = \theta(t) + \text{clamp}\left(\Delta\theta, -\omega(M) \cdot \Delta t, +\omega(M) \cdot \Delta t\right)$$
$$\vec{p}_0(t + \Delta t) = \vec{p}_0(t) + \begin{pmatrix} v(t) \cos \theta(t + \Delta t) \\ v(t) \sin \theta(t + \Delta t) \end{pmatrix} \Delta t$$

---

### 2.2 Snake Body Spine Kinematics & Segment Spacing

Slither.io snakes maintain a continuous organic curve without collapsing, stretching, or segment jitter. Two complementary methods are specified:

#### Method A: Arc-Length Sampled Path History (Authoritative Slither.io Model)
The snake maintains a circular ring buffer of historical head positions $\mathcal{H} = \{\vec{h}_0, \vec{h}_1, \dots, \vec{h}_{K-1}\}$ recorded at every physical sub-step.

1. At each frame, push new head position $\vec{p}_0(t)$ to the front of $\mathcal{H}$.
2. Accumulated distance along the path between sample $k$ and $k+1$ is $\delta s_k = \|\vec{h}_k - \vec{h}_{k+1}\|$.
3. Segment $i \in \{1, 2, \dots, N-1\}$ is placed at target arc-length distance:
   $$S_i = i \cdot L_{\text{joint}}(M)$$
   where $L_{\text{joint}}(M) = L_0 + c_L \cdot R_{\text{body}}(M)$ (nominal $L_{\text{joint}} \approx 8 - 14\text{px}$).
4. Interpolate between discrete history samples $\vec{h}_a$ and $\vec{h}_{a+1}$ where cumulative distance spans $S_i$:
   $$\vec{p}_i = \vec{h}_a + \left(\frac{S_i - \text{cumDist}(a)}{\text{cumDist}(a+1) - \text{cumDist}(a)}\right) (\vec{h}_{a+1} - \vec{h}_a)$$

#### Method B: Inverse Kinematic Distance Constraints (Fast Verlet Relaxation)
For low-overhead simulation (e.g. 50+ AI bot snakes concurrently):
For each segment $i$ from $1$ to $N-1$:
$$\vec{d}_i = \vec{p}_i(t) - \vec{p}_{i-1}(t+\Delta t)$$
$$\|\vec{d}_i\| = \sqrt{d_{i,x}^2 + d_{i,y}^2}$$
$$\vec{p}_i(t+\Delta t) = \vec{p}_{i-1}(t+\Delta t) + \frac{\vec{d}_i}{\|\vec{d}_i\|} \cdot L_{\text{joint}}$$

#### 2.2.1 Body Segment Sizing & Tapering Formula
- **Body Radius:** $R_{\text{body}}(M) = R_0 + c_r \cdot \sqrt{M}$  
  ($R_0 = 9.0\text{px}$, $c_r = 0.18\text{px}/\sqrt{\text{mass}}$, clamped to $R_{\text{max}} = 38\text{px}$)
- **Head Radius:** $R_{\text{head}}(M) = 1.20 \cdot R_{\text{body}}(M)$
- **Tail Tapering:** For the last $k = \min(8, \lfloor 0.2 N \rfloor)$ segments:
  $$R_i(M) = R_{\text{body}}(M) \cdot \left(1.0 - 0.45 \cdot \left(\frac{i - (N - k)}{k}\right)^2\right), \quad \forall i \ge N-k$$
- **Segment Count:** $N(M) = \left\lfloor N_{\text{base}} + c_n \cdot M^{0.65} \right\rfloor$  
  ($N_{\text{base}} = 10$, $c_n = 1.2$)

---

### 2.3 Speed Boost & Mass Dissipation Mechanics

```
                       SPEED BOOST STATE MACHINE
        [Normal State] ──(Mouse Down & M > M_min)──► [Boost State]
           v = v_base                                  v = v_boost
           dM/dt = 0                                   dM/dt = -drain_rate
                ▲                                          │
                │                                          ▼
                └────(Mouse Up OR M <= M_min)──────────────┘
```

#### 2.3.1 Speed Parameters
- **Normal Speed:** $v_{\text{base}} = 160.0\text{ px/s}$ ($\approx 2.67\text{ px/frame}$ at 60 FPS)
- **Boost Speed:** $v_{\text{boost}} = v_{\text{base}} \times 1.90 = 304.0\text{ px/s}$ ($\approx 5.07\text{ px/frame}$)
- **Speed Transition Smoothing:** $v(t + \Delta t) = v(t) + (v_{\text{target}} - v(t)) \cdot (1 - e^{-12 \Delta t})$

#### 2.3.2 Mass Expenditure & Ejection Rates
Boosting consumes snake mass and deposits glowing food pellets along the tail path:
- **Mass Consumption Rate:** $\dot{M}_{\text{boost}} = 4.5\text{ mass units/sec}$
- **Minimum Boost Threshold:** $M_{\text{min\_boost}} = 20.0$ units. If $M \le M_{\text{min\_boost}}$, boost automatically deactivates.
- **Trail Pellet Spawn Frequency:** Every $\Delta d_{\text{eject}} = 24.0\text{px}$ travelled while boosting (or every $\Delta t_{\text{eject}} \approx 0.08\text{s}$):
  - Mass per pellet: $V_{\text{pellet}} = 1.2$ mass units.
  - Spawn position: Tail segment position $\vec{p}_{N-1}$ with a small backward ejection impulse:
    $$\vec{v}_{\text{pellet}} = -\begin{pmatrix} \cos\theta_{\text{tail}} \\ \sin\theta_{\text{tail}} \end{pmatrix} \cdot (40 + \mathcal{U}(-10, 10)) + \vec{\epsilon}_{\text{radial}}$$
  - Pellet friction decay: $\vec{v}_{\text{pellet}}(t + \Delta t) = \vec{v}_{\text{pellet}}(t) \cdot (0.90)^{\Delta t \cdot 60}$ (comes to a rest within $\sim 0.3$s).

---

### 2.4 Dynamic Camera Tracking & Coordinate Transformations

```
             WORLD SPACE                          SCREEN CANVAS (Viewport)
   (0,0) +-----------------------+               +-----------------------+
         |                       |               |         (Ws/2, Hs/2)  |
         |      (Cx, Cy)         |               |              ●        |
         |         ● Head        |  ──────────►  |          Player Head  |
         |                       |   Transform   |                       |
         |                       |               |  Resolution: Ws x Hs  |
         +-----------------------+               +-----------------------+
```

#### 2.4.1 Camera Position Smoothing (Exponential Damping)
Target camera position is player head position $\vec{p}_{0,\text{player}}$:
$$\vec{C}(t + \Delta t) = \vec{C}(t) + (\vec{p}_{0,\text{player}} - \vec{C}(t)) \cdot \left(1 - e^{-\lambda_{\text{cam}} \Delta t}\right)$$
where $\lambda_{\text{cam}} = 14.0\text{ s}^{-1}$ provides instant responsive tracking without high-frequency micro-jitter.

#### 2.4.2 Dynamic Zoom / Scale Function $Z(M)$
As the snake accumulates mass, the field of view expands (camera zooms out) to keep gameplay fair and prevent the head from occupying the entire screen:
$$Z(M) = Z_{\text{base}} \cdot \left(\frac{M_{\text{zoom\_ref}}}{M + M_{\text{zoom\_ref}}}\right)^{\kappa_z}$$

| Parameter | Symbol | Nominal Value | Description |
|---|---|---|---|
| Base Scale | $Z_{\text{base}}$ | $1.00$ | Zoom at $M=0$ |
| Zoom Reference Mass | $M_{\text{zoom\_ref}}$ | $350.0$ | Characteristic scaling mass |
| Zoom Exponent | $\kappa_z$ | $0.28$ | Non-linear FOV compression exponent |
| Minimum Clamped Zoom | $Z_{\text{min}}$ | $0.42$ | Furthest zoom-out (for massive top-1 snakes) |
| Maximum Clamped Zoom | $Z_{\text{max}}$ | $1.10$ | Closest zoom-in (for newly spawned snakes) |

Zoom is smoothed using: $Z_{\text{current}} \leftarrow Z_{\text{current}} + (Z(M) - Z_{\text{current}}) \cdot (1 - e^{-4.0 \Delta t})$.

#### 2.4.3 World-to-Screen Forward Transformation
For any entity at world coordinate $(X_w, Y_w)$:
$$\begin{pmatrix} X_s \\ Y_s \end{pmatrix} = \begin{pmatrix} \frac{W_s}{2} \\ \frac{H_s}{2} \end{pmatrix} + Z \cdot \begin{pmatrix} X_w - C_x \\ Y_w - C_y \end{pmatrix}$$

#### 2.4.4 Screen-to-World Inverse Transformation
For pointer events (mouse movement $(X_s^{\text{mouse}}, Y_s^{\text{mouse}})$ on screen):
$$\begin{pmatrix} X_w^{\text{mouse}} \\ Y_w^{\text{mouse}} \end{pmatrix} = \begin{pmatrix} C_x \\ C_y \end{pmatrix} + \frac{1}{Z} \cdot \begin{pmatrix} X_s^{\text{mouse}} - \frac{W_s}{2} \\ Y_s^{\text{mouse}} - \frac{H_s}{2} \end{pmatrix}$$

**Direct Pointer Heading Lemma:**  
Because the player's head is centered at $\begin{pmatrix} C_x \\ C_y \end{pmatrix}$, the vector from head to mouse cursor in world space is:
$$\vec{P}_w^{\text{mouse}} - \vec{p}_0 = \frac{1}{Z} \begin{pmatrix} X_s^{\text{mouse}} - W_s/2 \\ Y_s^{\text{mouse}} - H_s/2 \end{pmatrix}$$
Therefore:
$$\theta_{\text{target}} = \text{atan2}\left(Y_s^{\text{mouse}} - \frac{H_s}{2}, X_s^{\text{mouse}} - \frac{W_s}{2}\right)$$
The target angle can be calculated directly from screen mouse coordinates relative to viewport center, completely invariant to camera zoom $Z$ and camera position $(C_x, C_y)$.

#### 2.4.5 Viewport Frustum Culling Condition
An entity with bounding circle center $\vec{p}$ and radius $r$ is visible if and only if:
$$|X_w - C_x| \le \frac{W_s}{2 Z} + r \quad \land \quad |Y_w - C_y| \le \frac{H_s}{2 Z} + r$$
Entities outside this bounding box are skipped during Canvas drawing calls to conserve GPU/CPU fill-rate.

---

### 2.5 World Boundaries & Geometry

The world can be configured as a large Circular Arena (authentic Slither.io) or Rectangular Arena:

#### Circular Arena Geometry (Recommended)
- **Map Radius:** $R_{\text{world}} = 2500.0\text{ px}$ (Diameter $= 5000\text{px}$, Area $\approx 19.63 \times 10^6\text{ px}^2$).
- **Map Center:** $\vec{O}_{\text{world}} = (0, 0)$ or $(2500, 2500)$.
- **Distance from Origin:** $d(\vec{p}) = \sqrt{p_x^2 + p_y^2}$.
- **Warning Zone (Neon Perimeter Ring):** When $d(\vec{p}_0) > 0.88 \cdot R_{\text{world}}$, render pulsing red hazard warning lines.
- **Lethal Border Condition:**
  $$d(\vec{p}_0) + R_{\text{head}} \ge R_{\text{world}} \implies \text{Instant Death (Disintegration)}$$

---

## 3. Entity Specifications & Data Schemas

```
                             ENTITY RELATIONSHIP DIAGRAM
  +--------------------+             +--------------------+
  |      SpatialGrid   | 1         * |     FoodOrbEntity  |
  |  - cellSize = 120  |◄────────────|  - value (1..30)   |
  |  - buckets: Map    |             |  - glow & pulse    |
  +--------------------+             +--------------------+
            ▲
            │ 1
            │
            │ *
  +--------------------+ 1         * +--------------------+
  |     SnakeEntity    |────────────►|   BodySegmentNode  |
  |  - isPlayer: bool  |             |  - x, y, radius    |
  |  - mass, score     |             +--------------------+
  |  - skin & palette  |
  +--------------------+
```

### 3.1 Snake Data Model (`SnakeEntity`)

```javascript
/**
 * @typedef {Object} BodySegmentNode
 * @property {number} x - World coordinate X
 * @property {number} y - World coordinate Y
 * @property {number} radius - Segment visual & collision radius
 * @property {number} angle - Angle orientation of this segment
 */

/**
 * @typedef {Object} SnakeSkinConfig
 * @property {string} id - Skin identifier (e.g. 'neon-cyan', 'cyber-plasma', 'viper-green')
 * @property {string} headColor - Primary color for head & face (#00ffff)
 * @property {string} bodyPrimary - Main body segment color
 * @property {string} bodySecondary - Alternating stripe color
 * @property {string} glowColor - Canvas shadowColor (#00ffff, rgba(...))
 * @property {number} glowBlur - Canvas shadowBlur base intensity (15-25)
 * @property {string} eyeColor - Sclera color (#ffffff)
 * @property {string} pupilColor - Pupil color (#000000)
 * @property {string} patternType - 'solid' | 'stripes' | 'gradient' | 'segmented'
 */

/**
 * Complete Snake Entity Schema
 */
const SnakeEntitySchema = {
    id: "snake_player_1",         // Unique UUID / string identifier
    name: "NeonViper",             // Display name shown in leaderboard & above head
    isPlayer: true,                // True for human player, false for AI bot
    isDead: false,                 // Lifecycle flag
    disintegrated: false,          // Whether death orbs have already been spawned
    
    // Position & Kinematics
    head: { x: 1500.0, y: 1500.0 }, // Exact current head coordinates in world
    angle: -1.57079,               // Current movement heading in radians (-PI to PI)
    targetAngle: -1.57079,         // Desired heading (from mouse/AI)
    currentSpeed: 160.0,           // Pixels per second
    isBoosting: false,             // Active boost state
    
    // Mass, Score & Sizing
    mass: 10.0,                    // Current mass (determines radius, length, turn rate)
    score: 0,                      // Accumulated score (mass - startingMass + killBonuses)
    kills: 0,                      // Number of opponent snakes killed
    radius: 9.0,                   // Calculated body radius
    headRadius: 10.8,              // Calculated head radius
    
    // Body Chain & Trajectory History
    /** @type {BodySegmentNode[]} */
    segments: [],                  // Array of segment objects [head, ...body, tail]
    /** @type {Array<{x: number, y: number, time: number}>} */
    pathHistory: [],               // High-resolution position ring buffer
    
    // Appearance & Customization
    /** @type {SnakeSkinConfig} */
    skin: {
        id: "neon-cyan",
        headColor: "#00f0ff",
        bodyPrimary: "#00b4d8",
        bodySecondary: "#0077b6",
        glowColor: "#00f0ff",
        glowBlur: 18,
        eyeColor: "#ffffff",
        pupilColor: "#020210",
        patternType: "stripes"
    },
    
    // AI Specific State (null if isPlayer == true)
    ai: {
        state: "WANDER",           // 'WANDER' | 'FEED' | 'CHASE' | 'FLEE' | 'ENVOIL'
        targetFoodId: null,        // Targeted food orb ID
        targetSnakeId: null,       // Targeted prey/threat snake ID
        nextDecisionTime: 0,       // Timestamp for next AI evaluation
        wanderAngle: 0,            // Perlin/random wander trajectory
        dangerVector: { x: 0, y: 0 } // Computed repulsive avoidance vector
    }
};
```

---

### 3.2 Food & Energy Orb Data Model (`FoodOrbEntity`)

Food in Slither.io is divided into three distinct functional tiers:
1. **Natural Ambient Food (`NATURAL`):** Constant map replenishment, small, slow drifting or static, low mass ($1 - 3$).
2. **Boost Trail Pellets (`BOOST_TRAIL`):** Dropped by boosting snakes, medium mass ($1 - 2$), bright glow, short friction slide.
3. **Dead Snake Energy Orbs (`DEATH_ENERGY`):** Dropped upon snake destruction, large mass ($5 - 25$), vibrant pulsing glow, hue matched to dead snake's skin.

```javascript
/**
 * Complete Food Orb Entity Schema
 */
const FoodOrbEntitySchema = {
    id: 10482,                     // Unique integer / string ID
    type: "DEATH_ENERGY",          // 'NATURAL' | 'BOOST_TRAIL' | 'DEATH_ENERGY'
    x: 1420.5,                     // World position X
    y: 1580.2,                     // World position Y
    vx: 1.2,                       // Drift / scatter velocity X
    vy: -0.8,                      // Drift / scatter velocity Y
    
    // Value & Size
    value: 8.0,                    // Mass awarded to snake upon ingestion
    baseRadius: 6.5,               // Base radius in pixels (formula: 3.0 + sqrt(value) * 1.2)
    radius: 6.5,                   // Current animated radius
    
    // Visuals & Animations
    color: "#ff007f",              // Core fill color (hex/rgb/hsl)
    glowColor: "#ff007f",          // Shadow glow color
    glowBlur: 12,                  // Shadow blur magnitude
    pulsePhase: 1.45,              // Current phase angle in radians for pulsing sinewave
    pulseSpeed: 3.5,               // Pulse frequency (radians per second)
    
    // Attraction Magnetism
    attractedToSnakeId: null,      // Locked snake ID when within ingestion magnetic radius
    attractionSpeed: 0.0           // Acceleration towards snake mouth
};
```

---

### 3.3 Dead Snake Body Disintegration Algorithm

When any snake dies (due to head-to-body collision or border impact):

```
       DEAD SNAKE DISINTEGRATION EXPLOSION
     p0 (Head)        p1           p2          p_tail
     (💥)             (💥)         (💥)         (💥)
      │ ╲            ╱ │ ╲        ╱ │ ╲        ╱ │
      ▼  ▼          ▼  ▼  ▼      ▼  ▼  ▼      ▼  ▼
     [High-Value Energy Orbs scattered radially along spine]
```

#### Step-by-Step Mathematical Recipe:
1. **Total Recoverable Mass:**  
   $$\mathcal{M}_{\text{dropped}} = \max\left(10, \lfloor \eta_{\text{drop}} \cdot M_{\text{victim}} \rfloor\right), \quad \text{where } \eta_{\text{drop}} = 0.80$$
2. **Orb Count Allocation:**  
   Let number of orbs $K = \min\left(120, \max(12, \lfloor N_{\text{segments}} \times 1.2 \rfloor)\right)$.  
   Average mass per orb $\bar{V} = \frac{\mathcal{M}_{\text{dropped}}}{K}$.
3. **Spatial Distribution Along Body Spine:**  
   For each orb index $k \in \{0, 1, \dots, K-1\}$:
   - Corresponding segment index $j = \lfloor \frac{k}{K} \cdot N_{\text{segments}} \rfloor$.
   - Base center position $\vec{p}_j = (x_j, y_j)$.
   - Perpendicular angle to spine $\theta_j^\perp = \theta_j \pm \frac{\pi}{2}$.
   - Radial scatter distance: $\rho_k = \mathcal{U}(-1.2, 1.2) \cdot R_{\text{body}}$.
   - Initial explosion impulse velocity:
     $$\vec{v}_{\text{scatter}} = \begin{pmatrix} \cos(\theta_j^\perp + \mathcal{U}(-0.5, 0.5)) \\ \sin(\theta_j^\perp + \mathcal{U}(-0.5, 0.5)) \end{pmatrix} \cdot \mathcal{U}(30, 120)\text{ px/s}$$
   - Orb parameters:
     $$x_{\text{orb}} = x_j + \rho_k \cos \theta_j^\perp, \quad y_{\text{orb}} = y_j + \rho_k \sin \theta_j^\perp$$
     $$V_{\text{orb}} = \bar{V} \cdot \mathcal{U}(0.7, 1.4), \quad R_{\text{orb}} = 3.5 + 1.2 \cdot \sqrt{V_{\text{orb}}}$$
     $$\text{color} = \text{victim.skin.headColor}$$

---

## 4. Collision Detection & Spatial Partitioning Math

```
                 SPATIAL HASH GRID PARTITIONING
   +──────────────┬──────────────┬──────────────+
   | Cell (i-1,j-1)| Cell (i, j-1)| Cell (i+1,j-1)|
   |              |              |              |
   +──────────────┼──────────────┼──────────────+
   | Cell (i-1, j)| Cell (i, j)  | Cell (i+1, j)|
   |              |   ● Head     |              |
   +──────────────┼──────────────┼──────────────+
   | Cell (i-1,j+1)| Cell (i, j+1)| Cell (i+1,j+1)|
   |              |  ● Segment   |              |
   +──────────────┴──────────────┴──────────────+
```

### 4.1 Spatial Hash Grid (Bucket Hashing)
To support 15 snakes (up to 3,000 total segments) and 1,500 food orbs at 60 FPS:
- **Grid Cell Size:** $S_{\text{cell}} = 120\text{px}$.
- **Hash Function:** $\text{key}(x, y) = \lfloor x / S_{\text{cell}} \rfloor + \text{"\_"} + \lfloor y / S_{\text{cell}} \rfloor$.
- **Query Range:** For an entity at $(x, y)$ with radius $R$, query the $3 \times 3$ neighboring cells:
  $$\left[\lfloor (x - R)/S_{\text{cell}} \rfloor \dots \lfloor (x + R)/S_{\text{cell}} \rfloor\right] \times \left[\lfloor (y - R)/S_{\text{cell}} \rfloor \dots \lfloor (y + R)/S_{\text{cell}} \rfloor\right]$$

### 4.2 Head-to-Body Lethal Collision Physics
For snake $A$ (with head $\vec{p}_{A,0}$ and head radius $R_{A,\text{head}}$) against snake $B$'s body segment $j$ ($\vec{p}_{B,j}$ and radius $R_{B,j}$):

1. **Self-Collision Immunity:** If $A = B$ and $j < 8$, skip collision (a snake cannot eat its own neck). Moreover, in Slither.io, snakes are fully immune to colliding with their own body ($A = B$ always ignored), enabling circling/coiling tactics.
2. **Circle Penetration Test:**
   $$\Delta x = p_{A,0,x} - p_{B,j,x}, \quad \Delta y = p_{A,0,y} - p_{B,j,y}$$
   $$\text{dist}^2 = \Delta x^2 + \Delta y^2$$
   $$\text{collisionRadius} = R_{A,\text{head}} + R_{B,j} - \delta_{\text{grace}}$$
   where $\delta_{\text{grace}} = 3.0\text{px}$ is a generous hitbox forgiveness threshold to prevent frustrating micro-glancing deaths.
3. **Collision Condition:**
   $$\text{dist}^2 \le (\text{collisionRadius})^2 \implies \text{Snake } A \text{ Dies Instantly}$$

### 4.3 Food Ingestion & Magnetic Pull Physics
For snake head $\vec{p}_{0}$ and food orb $\vec{P}_{\text{orb}}$:
- **Magnetic Attraction Radius:** $R_{\text{magnet}} = R_{\text{head}} + 28.0\text{px}$.
- If $\|\vec{p}_0 - \vec{P}_{\text{orb}}\| \le R_{\text{magnet}}$, apply magnetic pull vector:
  $$\vec{a}_{\text{magnet}} = \frac{\vec{p}_0 - \vec{P}_{\text{orb}}}{\|\vec{p}_0 - \vec{P}_{\text{orb}}\|} \cdot 380\text{ px/s}^2$$
- **Instant Ingestion Radius:** $R_{\text{eat}} = R_{\text{head}} + R_{\text{orb}} + 2.0\text{px}$.
- When $\|\vec{p}_0 - \vec{P}_{\text{orb}}\| \le R_{\text{eat}}$:
  - Add $V_{\text{orb}}$ to snake mass $M$.
  - Despawn food orb from Spatial Grid.
  - Trigger glowing particle ingestion effect.

---

## 5. Formal Specification Tables & Matrices

### 5.1 Features Discovered & Formalized
| # | Category | Feature | Description | Inputs | Outputs | Error / Edge Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| 1 | Kinematics | 360° Steering | Continuous angular heading with mass-scaled angular velocity | Target $(x,y)$, dt, mass | New angle $\theta$, new head $(x_0, y_0)$ | Modulo wrap-around at $\pm \pi$; clamped to max turn rate | Slither.io physics analysis & request R1 |
| 2 | Kinematics | Body Spine IK | Arc-length sampled vertebral spine interpolation | Head trajectory history $\mathcal{H}$, segment spacing $L$ | Segment positions $[(x_1, y_1) \dots (x_N, y_N)]$ | Buffer underflow on spawn initialized along negative heading | Slither.io mechanics R1 |
| 3 | Dynamics | Boost State Machine | 1.9x speed multiplier with mass expenditure | Mouse down / Spacebar, mass $M$ | $v = v_{\text{boost}}$, trail pellet spawns | Auto-cancels when mass $M \le M_{\text{min\_boost}} (20)$ | Slither.io boost spec |
| 4 | Projection | Dynamic Camera Matrix | Viewport-centered tracking with lerp damping & mass zoom | Player head $(x, y)$, mass $M$, viewport $(W, H)$ | Camera translation matrix $(C_x, C_y, Z)$ | Clamped zoom $Z \in [0.42, 1.10]$ prevents extreme distortion | Request R1 & visual spec |
| 5 | Boundary | Circular Arena Edge | $R=2500\text{px}$ perimeter with lethal collision & warning | Head position $(x, y)$, map radius $R$ | In-bounds / Warning / Instant Death | Warning glow at $d > 0.88 R$; instant disintegration at border | Request R1 & R2 |
| 6 | Entities | Multi-tier Food Orbs | Natural, boost trail, and high-energy death orbs | World bounds, death events, boost events | Active orb instances in Spatial Hash | Constant natural food density maintained via respawn loop | Request R2 |
| 7 | Combat | Disintegration Explosion | Mass-conserving radial orb scattering upon death | Dead snake segments, mass $M$, skin color | Array of $K$ glowing energy orbs | Total dropped mass capped at $80\%$ of dead snake mass | Request R2 |
| 8 | Optimization | Spatial Hash Grid | $O(1)$ collision and culling acceleration | Entity positions & bounding radii | Nearby candidate lists for heads & viewport | Dynamic bucket rehashing on entity movement | 60 FPS performance requirement |
| 9 | UI / HUD | Dynamic Leaderboard | Live top 10 rankings of player vs AI bots | Array of all active snakes (score/mass) | Sorted leaderboard HUD overlay | Real-time highlight for player's rank | Request R3 |
| 10 | Graphics | Glow & Shading Pipeline | Multi-layered radial glowing canvas rendering | Canvas 2D ctx, entity skins, shadowBlur | High-contrast glowing neon aesthetic | Selective shadowBlur disabling for non-visible/small items | Request R3 & 60 FPS budget |

---

### 5.2 Edge Cases & Physical Boundary Conditions
| # | Feature | Edge Case Input | Exact Mathematical Behavior & Resolution |
|---|---|---|---|
| 1 | Steering | Pointer directly over snake head ($\Delta x=0, \Delta y=0$) | $\text{atan2}(0, 0)$ is undefined. Maintain previous heading angle $\theta(t)$ without change. |
| 2 | Steering | Target angle exactly opposite to current heading ($\Delta\theta = \pm\pi$) | $\text{atan2}(\sin\pi, \cos\pi) = \pi$. Branch deterministically to positive turn ($+\omega \Delta t$) to avoid oscillating deadlock. |
| 3 | Body IK | Newly spawned snake with zero historical trajectory | Pre-populate history ring buffer along ray $\vec{p}_0 - k \cdot L_{\text{joint}} \begin{pmatrix} \cos\theta \\ \sin\theta \end{pmatrix}$ for all $k \in [0 \dots N]$. |
| 4 | Boost | Player holds boost with mass $M \le 20.0$ | Force `isBoosting = false`, smoothly interpolate speed down to $v_{\text{base}}$, suppress trail food dropping. |
| 5 | Camera | Window resize event (e.g. mobile rotation or split screen) | Recalculate canvas width/height to window dimensions, update aspect ratio, recompute viewport projection matrix seamlessly. |
| 6 | Collision | Head-on head collision between two snakes | Compare masses: if $|M_A - M_B| / \max(M_A, M_B) < 0.15$, both snakes die and disintegrate; otherwise smaller snake dies. |
| 7 | Collision | Snake coils and intersects its own tail | Ignore self-collisions entirely ($A = B \implies \text{no-op}$). Enables defensive coiling. |
| 8 | Disintegration | Massive snake dies ($M > 10,000$) | Cap maximum spawned orbs at $K_{\text{max}} = 120$ and increase individual orb values $V_{\text{orb}} = \mathcal{M}_{\text{dropped}} / 120$ to prevent FPS collapse. |
| 9 | Boundary | Snake hits circular world border while boosting | Terminate boosting, trigger instant snake destruction, scatter death orbs deflected inward towards map center. |
| 10 | Performance | Viewport contains 500+ food orbs | Frustum cull off-screen orbs; render small natural orbs with direct `arc()` fills without expensive `shadowBlur`, reserving `shadowBlur` for player head and large energy orbs. |

---

## 6. Mathematical Verification & Acceptance Test Suite

To verify correct implementation in later milestones:

1. **Angular Invariance Test:**  
   Given head at $(1000, 1000)$ and mouse at $(1000, 1500)$ (directly below), target angle $\theta_{\text{target}}$ must evaluate to $+\frac{\pi}{2} \approx 1.570796\text{ rad}$. Turn rate must smoothly increment heading without discontinuous jumps.
2. **Camera Centering Test:**  
   With viewport dimensions $W_s = 1920, H_s = 1080$, player head $\vec{p}_0 = (x_0, y_0)$ transformed via World-to-Screen matrix MUST map to exact pixel coordinates $(960, 540)$ at all times.
3. **Mass Conservation in Death Test:**  
   A snake with mass $M = 500$ dying must drop $\approx 400$ mass units ($\pm 2\%$) distributed across $K$ glowing orbs.
4. **Spatial Hash Consistency Test:**  
   Entities moving across cell boundaries $(x = 119.9 \to 120.1)$ must cleanly deregister from cell $(0, j)$ and register in cell $(1, j)$ with zero memory leaks.

---

*End of Survey Specification Report.*
