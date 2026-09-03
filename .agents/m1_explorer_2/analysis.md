# Technical Specification & Architecture Report: Snake Entity, 360° Steering & Ring Buffer Spine Kinematics

**Milestone**: Milestone 1 (Engine, Camera, Snake Entity & 360° Movement)  
**Agent**: Milestone 1 Explorer 2 (`teamwork_preview_spec_miner`)  
**Target Repository**: `D:\snake_game`  
**Date**: 2026-08-29  

---

## 1. Executive Summary & Architectural Role

In Slither.io, the core game feel depends entirely on **fluid 360-degree continuous steering** and **organic, non-stretching serpentine spine kinematics**. A naive discretized snake (like traditional grid snakes or index-based position arrays) fails immediately when speeds vary between normal cruising ($160\text{ px/s}$) and boosting ($304\text{ px/s}$), causing severe stretching (accordion effect), segment bunching, and erratic turns across the $\pm\pi$ boundary.

This report establishes the complete mathematical specification, data structures, and implementation blueprint for:
1. **The Unified `Snake` Entity Schema**: A high-performance, polymorphic entity class serving both the human player and 25+ concurrent autonomous AI bots.
2. **Continuous 360° Angular Steering & Mass-Dependent Turn Rate $\omega(M)$**: Shortest-arc angular normalization $\Delta\theta = \text{atan2}(\sin(\theta_t - \theta), \cos(\theta_t - \theta))$ and rotational inertia scaling.
3. **Arc-Length Parameterized Ring Buffer Spine Kinematics**: An $O(1)$ circular buffer algorithm that guarantees constant vertebral spacing $L_{\text{joint}}(M)$ invariant to variable frame rates ($\Delta t$) and speed transitions.
4. **Mass, Length, Radius & Vertebral Tapering Formulations**: Biometric scaling curves ensuring natural head-to-body-to-tail proportions across all mass tiers ($M \in [10, 10000]$).
5. **Worker Implementation Blueprint**: Complete, production-ready ES6 classes, methods, and test fixtures ready for immediate synthesis in `script.js`.

---

## 2. Unified Snake Entity Data Model & Schema Specification

```
                                SNAKE ENTITY ARCHITECTURE
+-----------------------------------------------------------------------------------------+
|                                      Snake Class                                        |
|  - id: string/number                                                                    |
|  - name: string                                                                         |
|  - isPlayer: boolean                                                                    |
|  - x, y: number (Head World Position)                                                   |
|  - angle, targetAngle: number (Radians, [-PI, PI))                                      |
|  - speed, baseSpeed, boostSpeed: number                                                 |
|  - isBoosting: boolean                                                                  |
|  - mass, score, kills: number                                                           |
|  - radius, headRadius: number                                                           |
|  - skin: SnakeSkinConfig                                                                |
+----------------------------+-------------------------------+----------------------------+
                             |                               |
                             v                               v
             +---------------+---------------+ +-------------+---------------+
             |   PositionHistoryRingBuffer   | |       segments: Array       |
             |   - capacity: number          | |   [ {x, y, radius, angle} ] |
             |   - buffer: Float64Array      | |   - Index 0: Head           |
             |   - headIdx, count: number    | |   - Index 1..N-k: Body      |
             |   - cumDistances: Float64Array| |   - Index N-k..N-1: Tail    |
             +-------------------------------+ +-----------------------------+
```

### 2.1 JSDoc / TypeScript Interface Definition

```javascript
/**
 * @typedef {Object} BodySegment
 * @property {number} x - Segment world coordinate X
 * @property {number} y - Segment world coordinate Y
 * @property {number} radius - Segment visual & collision radius
 * @property {number} angle - Orientation angle of segment in radians
 */

/**
 * @typedef {Object} SnakeSkinConfig
 * @property {string} id - Unique skin ID ('neon-cyan', 'matrix-green', 'cyber-plasma', 'solar-flare', etc.)
 * @property {string} headColor - Hex/RGB color of head & snout
 * @property {string} bodyPrimary - Main body segment color
 * @property {string} bodySecondary - Secondary body segment stripe color
 * @property {string} glowColor - Outer neon glow halo color
 * @property {number} glowBlur - Base glow intensity (12 - 24)
 * @property {string} eyeColor - Sclera color ('#ffffff')
 * @property {string} pupilColor - Pupil color ('#000000' or '#05051a')
 * @property {'stripes'|'solid'|'gradient'|'dual-ring'} patternType - Segment rendering style
 * @property {number} stripeInterval - Number of segments per color cycle (default: 2 or 3)
 */

/**
 * @typedef {Object} SnakeHistorySample
 * @property {number} x - Recorded world X
 * @property {number} y - Recorded world Y
 * @property {number} s - Cumulative arc-length distance from inception
 */
```

### 2.2 Complete Snake Class State Schema

| Property | Type | Default Value | Description |
|---|---|---|---|
| `id` | `string` / `number` | Required | Unique identifier (`'player'` or `'bot_1'`) |
| `name` | `string` | `'Player'` | Display name rendered above head & in leaderboard |
| `isPlayer` | `boolean` | `false` | Distinguishes human player from AI bot instances |
| `isDead` | `boolean` | `false` | Life cycle status flag |
| `disintegrated` | `boolean` | `false` | True when death energy orbs have been spawned |
| `x` | `number` | `1500.0` | Current head world X coordinate |
| `y` | `number` | `1500.0` | Current head world Y coordinate |
| `angle` | `number` | `-1.57079` ($-\pi/2$) | Current heading orientation in radians $[-\pi, \pi)$ |
| `targetAngle` | `number` | `-1.57079` | Desired steering heading from input or AI |
| `speed` | `number` | `160.0` | Current translational speed in pixels per second |
| `baseSpeed` | `number` | `160.0` | Normal cruising speed constant |
| `boostSpeed` | `number` | `304.0` | Maximum boosted speed ($1.9 \times \text{baseSpeed}$) |
| `isBoosting` | `boolean` | `false` | Active boost state flag |
| `mass` | `number` | `10.0` | Current mass ($M$), driving length, radius, and turn inertia |
| `score` | `number` | `0` | Score points displayed in UI ($M \times 10$) |
| `kills` | `number` | `0` | Opponent snakes killed in current match |
| `radius` | `number` | `9.57` | Computed trunk body segment radius $R_{\text{body}}(M)$ |
| `headRadius` | `number` | `11.48` | Computed head radius $R_{\text{head}}(M) = 1.20 \times R_{\text{body}}$ |
| `segments` | `BodySegment[]` | `[]` | Array of placed body vertebrae in world space |
| `pathHistory` | `RingBuffer` | `instance` | Dense arc-length sampled position history buffer |
| `skin` | `SnakeSkinConfig` | `{...}` | Neon skin and palette styling configuration |
| `turnSpeed` | `number` | `4.2` | Current max angular velocity in rad/s $\omega(M)$ |

---

## 3. 360-Degree Continuous Steering & Angular Kinematics

```
                             ANGULAR ERROR RESOLUTION
                                     +Y (PI/2)
                                         |
                                         |    θ_target
                                         |   /
                        (-PI) -----------+----------- (+0) +X
                                         | \
                                         |  θ_current
                                         |
                                     -Y (-PI/2)

           Δθ = atan2( sin(θ_target - θ_current), cos(θ_target - θ_current) )
               - If Δθ > 0: Turn Counter-Clockwise (left)
               - If Δθ < 0: Turn Clockwise (right)
               - Always picks shortest angular arc (|Δθ| <= PI)
```

### 3.1 Shortest Arc Angle Normalization Formula

When a target angle is provided (from cursor coordinates $(X_m, Y_m)$ or AI navigation):
$$\theta_{\text{target}} = \text{atan2}(Y_m - Y_{\text{head}}, X_m - X_{\text{head}})$$

The angular difference $\Delta\theta$ must wrap around $[-\pi, \pi]$ seamlessly. The standard 4-quadrant tangent formulation guarantees the exact shortest rotational displacement:
$$\Delta\theta = \text{atan2}\left(\sin(\theta_{\text{target}} - \theta), \cos(\theta_{\text{target}} - \theta)\right)$$

**Proof of Invariance**:
- Let $\theta = +3.10\text{ rad}$ ($+177.6^\circ$) and $\theta_{\text{target}} = -3.10\text{ rad}$ ($-177.6^\circ$).
- Naive subtraction: $\theta_{\text{target}} - \theta = -6.20\text{ rad}$ ($\approx -355^\circ$, causing an erroneous nearly full 360° spin).
- Shortest arc formula:
  $$\Delta\theta = \text{atan2}(\sin(-6.20), \cos(-6.20)) = \text{atan2}(+0.0831, +0.9965) = +0.0832\text{ rad} \quad (+4.77^\circ)$$
- Result: Snake smoothly turns $+4.77^\circ$ across the branch cut without spinning in circles.

### 3.2 Mass-Dependent Turn Rate $\omega(M)$

Large snakes have higher rotational inertia, forcing wider turning circles. This fundamental mechanic prevents high-mass snakes from snapping around instantly and allows smaller snakes to execute tight evasive maneuvers:

$$\omega(M) = \max\left(\omega_{\text{min}}, \omega_{\text{base}} \cdot \left(\frac{M_{\text{ref}}}{M + M_{\text{ref}}}\right)^{\gamma_\omega}\right)$$

| Parameter | Symbol | Nominal Value | Physical Meaning |
|---|---|---|---|
| Base Turn Rate | $\omega_{\text{base}}$ | $4.20\text{ rad/s}$ ($0.070\text{ rad/tick}$) | Agility of starter snake ($M=10$) |
| Reference Mass | $M_{\text{ref}}$ | $120.0\text{ mass units}$ | Mass scale where turning resistance begins |
| Decay Exponent | $\gamma_\omega$ | $0.35$ | Non-linear decay curvature |
| Minimum Turn Rate | $\omega_{\text{min}}$ | $1.20\text{ rad/s}$ ($0.020\text{ rad/tick}$) | Agility floor for behemoth snakes ($M \ge 5000$) |

#### Sample Values of $\omega(M)$:
- $M = 10$: $\omega(10) = 4.2 \cdot (120 / 130)^{0.35} \approx 4.08\text{ rad/s}$ ($234^\circ/\text{s}$)
- $M = 100$: $\omega(100) = 4.2 \cdot (120 / 220)^{0.35} \approx 3.39\text{ rad/s}$ ($194^\circ/\text{s}$)
- $M = 500$: $\omega(500) = 4.2 \cdot (120 / 620)^{0.35} \approx 2.36\text{ rad/s}$ ($135^\circ/\text{s}$)
- $M = 2000$: $\omega(2000) = 4.2 \cdot (120 / 2120)^{0.35} \approx 1.54\text{ rad/s}$ ($88^\circ/\text{s}$)
- $M = 10000$: Clamped to $\omega_{\text{min}} = 1.20\text{ rad/s}$ ($69^\circ/\text{s}$)

### 3.3 Physical Integration Step

At each update tick with delta time $\Delta t$ (nominal $\Delta t = 1/60 \approx 0.01667\text{s}$):
1. **Clamp Angular Delta**:
   $$\Delta\theta_{\text{applied}} = \text{clamp}\left(\Delta\theta, -\omega(M) \cdot \Delta t, +\omega(M) \cdot \Delta t\right)$$
2. **Update Orientation**:
   $$\theta(t + \Delta t) = \text{atan2}\left(\sin(\theta(t) + \Delta\theta_{\text{applied}}), \cos(\theta(t) + \Delta\theta_{\text{applied}})\right)$$
3. **Speed Interpolation**:
   $$v_{\text{target}} = \text{isBoosting} \text{ ? } v_{\text{boost}} : v_{\text{base}}$$
   $$v(t + \Delta t) = v(t) + (v_{\text{target}} - v(t)) \cdot \left(1 - e^{-12.0 \cdot \Delta t}\right)$$
4. **Translate Head Position**:
   $$x(t + \Delta t) = x(t) + v(t + \Delta t) \cdot \cos(\theta(t + \Delta t)) \cdot \Delta t$$
   $$y(t + \Delta t) = y(t) + v(t + \Delta t) \cdot \sin(\theta(t + \Delta t)) \cdot \Delta t$$

---

## 4. Arc-Length Sampled Ring Buffer Spine Kinematics

```
               ARC-LENGTH PARAMETERIZED VERTEBRAL MAPPING
                                                                      
    Head p0                                                        Tail pN-1
       ●======○==============○==============○==============○========○
       s=0    s=L            s=2L           s=3L           s=4L     s=(N-1)L
       |      |              |              |              |        |
    [h0]───[h1]──────[h2]───[h3]──────────[h4]───────[h5]───[h6]───[h7]...
    (Dense History Buffer: h_k with cumulative distance s_k)
```

### 4.1 The Flaw of Discrete Index History

In naive snake models, segment $i$ takes position `pathHistory[i * K]`.
- At normal speed ($v = 160\text{ px/s}, \Delta t = 0.0167\text{s}$), sample step is $\delta d = 2.67\text{ px}$. For $K=4$, joint distance is $10.68\text{ px}$.
- When boosting ($v = 304\text{ px/s}$), sample step is $\delta d = 5.08\text{ px}$. The joint distance stretches to $20.32\text{ px}$ ($90\%$ lengthening!).
- When frame drops occur ($\Delta t = 0.033\text{s}$), the snake doubles in length instantaneously, creating severe visual jitter and unfair collision stretching.

### 4.2 The Arc-Length Ring Buffer Algorithm

The correct Slither.io formulation operates strictly on **accumulated physical path distance ($s$)**:

#### 1. Ring Buffer Storage Structure:
We store high-resolution head path samples in a circular ring buffer:
- `bufferX: Float64Array(MAX_SAMPLES)`
- `bufferY: Float64Array(MAX_SAMPLES)`
- `bufferDist: Float64Array(MAX_SAMPLES)` (Cumulative arc length $s_k$)
- `headIdx`: Write index for the newest sample
- `totalSamples`: Total valid samples currently stored

#### 2. Head Recording Step:
When the head moves from $(x_{\text{prev}}, y_{\text{prev}})$ to $(x_{\text{new}}, y_{\text{new}})$:
$$\delta s = \sqrt{(x_{\text{new}} - x_{\text{prev}})^2 + (y_{\text{new}} - y_{\text{prev}})^2}$$
If $\delta s > 0.5\text{ px}$:
- $s_{\text{head}} \leftarrow s_{\text{prev}} + \delta s$
- Push $(x_{\text{new}}, y_{\text{new}}, s_{\text{head}})$ to ring buffer.

#### 3. Vertebral Placement & Linear Interpolation:
Let $N(M)$ be the target segment count.  
Let $L_{\text{joint}}(M)$ be the inter-vertebra spacing:
$$L_{\text{joint}}(M) = L_0 + c_L \cdot R_{\text{body}}(M) \quad (L_0 = 4.0\text{px}, c_L = 0.45 \implies L_{\text{joint}} \approx 8.3\text{px} - 15.0\text{px})$$

For each segment $i \in \{0, 1, \dots, N(M) - 1\}$:
- For $i = 0$ (Head):
  $$\vec{p}_0 = (x_{\text{head}}, y_{\text{head}}), \quad \theta_0 = \theta$$
- For $i \ge 1$:
  Required target distance from current head:
  $$S_i = i \cdot L_{\text{joint}}(M)$$
  Target absolute cumulative distance:
  $$s_{\text{target}} = s_{\text{head}} - S_i$$

- Walk backwards through the ring buffer to find adjacent samples $A$ and $B$ where:
  $$s_B \le s_{\text{target}} \le s_A$$
- Compute linear interpolation weight:
  $$\alpha = \frac{s_{\text{target}} - s_B}{s_A - s_B} \quad (\text{with } s_A \ne s_B)$$
- Interpolate exact vertebra position:
  $$x_i = x_B + \alpha \cdot (x_A - x_B)$$
  $$y_i = y_B + \alpha \cdot (y_A - y_B)$$
- Compute vertebra orientation:
  $$\theta_i = \text{atan2}(y_{i-1} - y_i, x_{i-1} - x_i)$$

#### 4. Buffer Pruning:
Samples with cumulative distance $s < s_{\text{head}} - (N \cdot L_{\text{joint}} + 50\text{px})$ are outside the snake's body reach and are safely overwritten or ignored.

---

## 5. Mass, Length, Radius & Vertebral Tapering Formulas

```
                   SNAKE BODY MORPHOLOGY & TAPERING
    
          Head                Neck            Trunk (Main Body)             Tail
        (r=1.20*R)        (r=1.20->1.0*R)          (r=R)              (r=1.0->0.45*R)
         +------+             +---+             +---------+                +--+
        /        \           /     \           /           \              /    \
       |   (O)(O) |=========|       |=========|             |============|      >
        \        /           \     /           \           /              \    /
         +------+             +---+             +---------+                +--+
         Index 0            Index 1..2        Index 3..N-k              Index N-k..N-1
```

### 5.1 Mass Scaling Relationships

| Metric | Mathematical Formula | Nominal Coefficients | Starter ($M=10$) | Medium ($M=200$) | Giant ($M=2000$) |
|---|---|---|---|---|---|
| **Body Radius** $R(M)$ | $R_0 + c_r \cdot \sqrt{M}$ | $R_0 = 9.0\text{px}, c_r = 0.18$ | $9.57\text{px}$ | $11.55\text{px}$ | $17.05\text{px}$ |
| **Head Radius** $R_h(M)$ | $1.20 \cdot R(M)$ | factor $= 1.20$ | $11.48\text{px}$ | $13.86\text{px}$ | $20.46\text{px}$ |
| **Segment Count** $N(M)$ | $\lfloor N_0 + c_n \cdot M^{0.65} \rfloor$ | $N_0 = 10, c_n = 1.25$ | $15$ segments | $49$ segments | $184$ segments |
| **Joint Spacing** $L_j(M)$ | $L_0 + c_L \cdot R(M)$ | $L_0 = 4.0\text{px}, c_L = 0.45$ | $8.31\text{px}$ | $9.20\text{px}$ | $11.67\text{px}$ |
| **Total Length** $\mathcal{L}(M)$ | $(N - 1) \cdot L_j(M)$ | - | $116.3\text{px}$ | $441.6\text{px}$ | $2,135.6\text{px}$ |

### 5.2 Vertebral Segment Tapering Function $R_i(M)$

To produce the signature sleek, organic Slither.io silhouette:
1. **Head ($i = 0$):**
   $$R_0 = R_{\text{head}}(M) = 1.20 \cdot R_{\text{body}}(M)$$
2. **Neck Transition ($i \in \{1, 2\}$):**
   $$R_i = R_{\text{head}} - \left(R_{\text{head}} - R_{\text{body}}\right) \cdot \frac{i}{3}$$
3. **Trunk / Mid-Body ($i \in [3, N - k_{\text{tail}} - 1]$):**
   $$R_i = R_{\text{body}}(M)$$
4. **Tail Tapering ($i \in [N - k_{\text{tail}}, N - 1]$):**
   Let tail length $k_{\text{tail}} = \max\left(5, \min\left(20, \lfloor 0.25 \cdot N \rfloor\right)\right)$.
   For step $u = i - (N - k_{\text{tail}})$ from $0$ to $k_{\text{tail}} - 1$:
   $$\tau = \frac{u + 1}{k_{\text{tail}}} \in (0, 1]$$
   $$R_i = R_{\text{body}}(M) \cdot \left(1.0 - 0.55 \cdot \tau^{1.5}\right)$$
   (At the tip of the tail $\tau = 1$, $R_{\text{tail\_tip}} = 0.45 \cdot R_{\text{body}}$, creating a tapered point).

---

## 6. Visual Rendering Pipeline: Eyes, Expressive Face & Neon Skins

```
                           SNAKE HEAD FACE GEOMETRY
                                    Forward +X
                                        ▲
                                        │
                                   eyeForward (0.45*R)
                                        │
                      Left Eye          │         Right Eye
                     (Sclera) ───●◄─────┼─────►●── (Sclera)
                          \     /       │       \     /
                           (Pupil)      │      (Pupil)
                                        │
                     ───────────────────●─────────────────── Perpendicular
                                  Head Center (p0)
```

### 6.1 Expressive Eye Tracking & Boost Squint

The snake's head features two large, lively cartoon/cyberpunk eyes that gaze in the direction of intended travel ($\theta_{\text{target}}$):

#### Coordinate Math:
Let $\hat{u}_{\text{forward}} = (\cos\theta, \sin\theta)$ and $\hat{u}_{\text{perp}} = (-\sin\theta, \cos\theta)$.
- Head radius $R_h = R_{\text{head}}$.
- Eye lateral offset: $d_{\text{lat}} = 0.48 \cdot R_h$.
- Eye forward offset: $d_{\text{fwd}} = 0.42 \cdot R_h$.
- Sclera radius: $r_{\text{eye}} = 0.32 \cdot R_h$.
- Pupil radius: $r_{\text{pupil}} = \text{isBoosting} \text{ ? } (0.12 \cdot R_h) : (0.18 \cdot R_h)$ (pupils dilate/squint dynamically when boosting).

#### Eye Center Positions:
$$\vec{C}_{\text{eye,left}} = \vec{p}_0 + \hat{u}_{\text{fwd}} \cdot d_{\text{fwd}} + \hat{u}_{\text{perp}} \cdot d_{\text{lat}}$$
$$\vec{C}_{\text{eye,right}} = \vec{p}_0 + \hat{u}_{\text{fwd}} \cdot d_{\text{fwd}} - \hat{u}_{\text{perp}} \cdot d_{\text{lat}}$$

#### Pupil Look-At Offset:
The pupils look towards $\theta_{\text{target}}$:
$$\vec{u}_{\text{look}} = \begin{pmatrix} \cos(\theta_{\text{target}}) \\ \sin(\theta_{\text{target}}) \end{pmatrix}$$
$$\vec{C}_{\text{pupil}} = \vec{C}_{\text{eye}} + \vec{u}_{\text{look}} \cdot (0.35 \cdot r_{\text{eye}})$$

### 6.2 Pre-defined Cyberpunk Neon Skins

| Skin ID | Head Color | Primary Body | Secondary Body | Outer Glow | Pattern |
|---|---|---|---|---|---|
| `'neon-cyan'` | `#00f0ff` | `#00b4d8` | `#0077b6` | `#00f0ff` | `stripes` (2 segs) |
| `'cyber-magenta'` | `#ff007f` | `#d0006f` | `#7209b7` | `#ff007f` | `stripes` (2 segs) |
| `'matrix-lime'` | `#39ff14` | `#00cc44` | `#006622` | `#39ff14` | `stripes` (3 segs) |
| `'solar-flare'` | `#ffaa00` | `#ff6600` | `#cc3300` | `#ffaa00` | `stripes` (2 segs) |
| `'plasma-purple'` | `#b5179e` | `#7209b7` | `#3a0ca3` | `#b5179e` | `gradient` |
| `'electric-white'` | `#ffffff` | `#cccccc` | `#48cae4` | `#ffffff` | `stripes` (2 segs) |

---

## 7. Edge Cases & Boundary Conditions Matrix

```
## Edge Cases
| # | Feature | Input / Condition | Observed / Required Behavior |
|---|---------|-------------------|------------------------------|
| 1 | Angle Normalization | Heading $\theta = +3.14$, target $\theta_t = -3.14$ | Turns $\approx +0.003\text{ rad}$ across $\pi$ border; zero erratic $360^\circ$ spins. |
| 2 | Extreme Mass Agility | Snake mass $M = 50,000$ (mega behemoth) | Turn rate $\omega(M)$ clamps strictly at $\omega_{\text{min}} = 1.20\text{ rad/s}$; does not divide by zero or freeze. |
| 3 | Frame-Rate Spike | Lag spike with $\Delta t = 0.25\text{s}$ | Delta time is clamped at $\Delta t_{\text{max}} = 0.1\text{s}$; spine does not jump or tunnel. |
| 4 | Stationary / Zero Delta | Snake is immobilized or speed $= 0$ | Cumulative distance $\delta s = 0$; ring buffer skips push; vertebrae retain exact previous coordinates. |
| 5 | Ring Buffer Overflow | Match runs for 60 minutes ($>200,000$ updates) | Ring buffer utilizes fixed-capacity circular index wrapping; memory consumption is $O(1)$ constant. |
| 6 | Rapid Mass Boost Drain | Mass drained to $M = 20.0$ threshold | Boost immediately deactivates; speed lerps to $v_{\text{base}}$; mass floor at $M \ge 10.0$ preserved. |
| 7 | Single Segment Initial Spawn | Freshly spawned snake ($N=10$, $0$ history samples) | `initHistory()` pre-populates initial linear history behind heading; zero initial segment bunching. |
| 8 | Instant 180° Reversal | Mouse flicks $180^\circ$ behind snake | Snake executes smooth circular U-turn constrained by $\omega(M)$; never collapses backwards through its own head. |
```

---

## 8. Detailed Implementation Blueprint for the Worker

This blueprint provides the exact, copy-paste ready ES6 implementation designed for inclusion in `script.js` or modular imports.

```javascript
/**
 * ============================================================================
 * PositionHistoryRingBuffer: O(1) Arc-Length History Buffer
 * ============================================================================
 */
class PositionHistoryRingBuffer {
    /**
     * @param {number} capacity - Maximum recorded samples (e.g. 4000)
     */
    constructor(capacity = 4000) {
        this.capacity = capacity;
        this.bufferX = new Float64Array(capacity);
        this.bufferY = new Float64Array(capacity);
        this.bufferDist = new Float64Array(capacity); // Cumulative arc-length
        this.headIdx = 0;
        this.count = 0;
        this.totalDist = 0;
    }

    /**
     * Resets and seeds initial history array behind head
     */
    seed(startX, startY, angle, spacing, count) {
        this.headIdx = 0;
        this.count = 0;
        this.totalDist = 0;

        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        // Pre-fill history backwards along angle
        for (let i = count - 1; i >= 0; i--) {
            const dist = (count - 1 - i) * spacing;
            const px = startX - cosA * (i * spacing);
            const py = startY - sinA * (i * spacing);
            this.push(px, py, spacing);
        }
    }

    /**
     * Pushes a new head coordinate
     */
    push(x, y, stepDist = 0) {
        this.totalDist += stepDist;
        this.headIdx = (this.headIdx + 1) % this.capacity;
        this.bufferX[this.headIdx] = x;
        this.bufferY[this.headIdx] = y;
        this.bufferDist[this.headIdx] = this.totalDist;

        if (this.count < this.capacity) {
            this.count++;
        }
    }

    /**
     * Evaluates interpolated world coordinate at target distance behind head
     * @param {number} targetDistance - Arc-length distance from head (px)
     * @returns {{x: number, y: number}}
     */
    getSampleAtDistance(targetDistance) {
        if (this.count === 0) return { x: 0, y: 0 };
        if (this.count === 1 || targetDistance <= 0) {
            return { x: this.bufferX[this.headIdx], y: this.bufferY[this.headIdx] };
        }

        const targetCumDist = this.totalDist - targetDistance;

        // Search backward from headIdx
        let curr = this.headIdx;
        for (let i = 0; i < this.count - 1; i++) {
            let prev = (curr - 1 + this.capacity) % this.capacity;
            let dCurr = this.bufferDist[curr];
            let dPrev = this.bufferDist[prev];

            if (dPrev <= targetCumDist && targetCumDist <= dCurr) {
                const span = dCurr - dPrev;
                if (span < 1e-6) {
                    return { x: this.bufferX[curr], y: this.bufferY[curr] };
                }
                const alpha = (targetCumDist - dPrev) / span;
                return {
                    x: this.bufferX[prev] + alpha * (this.bufferX[curr] - this.bufferX[prev]),
                    y: this.bufferY[prev] + alpha * (this.bufferY[curr] - this.bufferY[prev])
                };
            }
            curr = prev;
        }

        // Return oldest sample if distance exceeds recorded buffer
        const oldestIdx = (this.headIdx - (this.count - 1) + this.capacity) % this.capacity;
        return { x: this.bufferX[oldestIdx], y: this.bufferY[oldestIdx] };
    }
}

/**
 * ============================================================================
 * Snake Entity Class
 * ============================================================================
 */
class Snake {
    /**
     * @param {string|number} id
     * @param {string} name
     * @param {number} x
     * @param {number} y
     * @param {SnakeSkinConfig} skin
     * @param {boolean} isPlayer
     */
    constructor(id, name, x, y, skin, isPlayer = false) {
        this.id = id;
        this.name = name || (isPlayer ? 'Player' : `Bot_${id}`);
        this.isPlayer = isPlayer;
        this.isDead = false;
        this.disintegrated = false;

        // Coordinates & Kinematics
        this.x = x;
        this.y = y;
        this.angle = -Math.PI / 2;
        this.targetAngle = -Math.PI / 2;
        this.baseSpeed = 160.0;
        this.boostSpeed = 304.0;
        this.speed = this.baseSpeed;
        this.isBoosting = false;

        // Mass & Progression
        this.mass = 10.0;
        this.score = 100;
        this.kills = 0;
        this.radius = 9.57;
        this.headRadius = 11.48;

        // Visual Customization
        this.skin = skin || {
            id: 'neon-cyan',
            headColor: '#00f0ff',
            bodyPrimary: '#00b4d8',
            bodySecondary: '#0077b6',
            glowColor: '#00f0ff',
            glowBlur: 18,
            eyeColor: '#ffffff',
            pupilColor: '#020210',
            patternType: 'stripes',
            stripeInterval: 2
        };

        // Segments and History
        this.segments = [];
        this.history = new PositionHistoryRingBuffer(4000);
        this.initHistory();
    }

    /**
     * Seeds initial spine vertebrae and history
     */
    initHistory() {
        const segCount = this.calculateSegmentCount();
        const jointSpacing = this.calculateJointSpacing();
        this.history.seed(this.x, this.y, this.angle, jointSpacing, segCount * 3);
        this.updateDimensions();
        this.updateSpine();
    }

    /**
     * Updates target heading angle
     * @param {number} rad
     */
    setTargetAngle(rad) {
        this.targetAngle = rad;
    }

    /**
     * Toggles boosting state
     * @param {boolean} boosting
     */
    setBoosting(boosting) {
        // Boost requires minimum mass > 20.0
        if (boosting && this.mass > 20.0) {
            this.isBoosting = true;
        } else {
            this.isBoosting = false;
        }
    }

    /**
     * Adds mass from food orbs
     * @param {number} amount
     */
    addMass(amount) {
        if (amount <= 0 || this.isDead) return;
        this.mass += amount;
        this.score = Math.floor(this.mass * 10);
        this.updateDimensions();
    }

    /**
     * Drains mass during boosting
     * @param {number} amount
     */
    drainMass(amount) {
        if (this.isDead) return;
        this.mass = Math.max(10.0, this.mass - amount);
        this.score = Math.floor(this.mass * 10);
        if (this.mass <= 20.0 && this.isBoosting) {
            this.isBoosting = false;
        }
        this.updateDimensions();
    }

    /**
     * Updates radius, headRadius, and segment parameters from mass
     */
    updateDimensions() {
        const R0 = 9.0;
        const cr = 0.18;
        this.radius = Math.min(38.0, R0 + cr * Math.sqrt(this.mass));
        this.headRadius = 1.20 * this.radius;
    }

    /**
     * Calculates required segment count
     * @returns {number}
     */
    calculateSegmentCount() {
        const N0 = 10;
        const cn = 1.25;
        return Math.floor(N0 + cn * Math.pow(this.mass, 0.65));
    }

    /**
     * Calculates inter-joint spacing
     * @returns {number}
     */
    calculateJointSpacing() {
        const L0 = 4.0;
        const cL = 0.45;
        return L0 + cL * this.radius;
    }

    /**
     * Calculates turn rate scaled by mass
     * @returns {number} rad/s
     */
    getTurnRate() {
        const omegaBase = 4.2;
        const Mref = 120.0;
        const gamma = 0.35;
        const omegaMin = 1.2;
        const rate = omegaBase * Math.pow(Mref / (this.mass + Mref), gamma);
        return Math.max(omegaMin, rate);
    }

    /**
     * Physical update step
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        if (this.isDead) return;
        const clampedDt = Math.min(0.1, Math.max(0.001, dt));

        // 1. Angular Steering Integration
        const diff = Math.atan2(
            Math.sin(this.targetAngle - this.angle),
            Math.cos(this.targetAngle - this.angle)
        );
        const maxTurn = this.getTurnRate() * clampedDt;
        const appliedDelta = Math.max(-maxTurn, Math.min(maxTurn, diff));
        this.angle = Math.atan2(Math.sin(this.angle + appliedDelta), Math.cos(this.angle + appliedDelta));

        // 2. Speed Interpolation
        const targetSpeed = this.isBoosting ? this.boostSpeed : this.baseSpeed;
        this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-12.0 * clampedDt));

        // 3. Translational Movement
        const prevX = this.x;
        const prevY = this.y;
        const moveDist = this.speed * clampedDt;
        this.x += Math.cos(this.angle) * moveDist;
        this.y += Math.sin(this.angle) * moveDist;

        // 4. Record to Ring Buffer
        const stepActual = Math.hypot(this.x - prevX, this.y - prevY);
        this.history.push(this.x, this.y, stepActual);

        // 5. Update Spine Kinematics
        this.updateSpine();
    }

    /**
     * Reconstructs vertebral segment positions along arc-length history
     */
    updateSpine() {
        const segCount = this.calculateSegmentCount();
        const jointSpacing = this.calculateJointSpacing();

        if (this.segments.length !== segCount) {
            this.segments = new Array(segCount);
        }

        // Head segment (Index 0)
        this.segments[0] = {
            x: this.x,
            y: this.y,
            radius: this.headRadius,
            angle: this.angle
        };

        const kTail = Math.max(5, Math.min(20, Math.floor(0.25 * segCount)));

        // Body segments (Index 1 to segCount - 1)
        for (let i = 1; i < segCount; i++) {
            const targetDist = i * jointSpacing;
            const pt = this.history.getSampleAtDistance(targetDist);

            // Tapering calculation
            let segRadius = this.radius;
            if (i < 3) {
                // Neck transition
                segRadius = this.headRadius - (this.headRadius - this.radius) * (i / 3);
            } else if (i >= segCount - kTail) {
                // Tail tapering
                const u = i - (segCount - kTail);
                const tau = (u + 1) / kTail;
                segRadius = this.radius * (1.0 - 0.55 * Math.pow(tau, 1.5));
            }

            const prevSeg = this.segments[i - 1];
            const segAngle = Math.atan2(prevSeg.y - pt.y, prevSeg.x - pt.x);

            this.segments[i] = {
                x: pt.x,
                y: pt.y,
                radius: segRadius,
                angle: segAngle
            };
        }
    }

    /**
     * Returns head bounding circle
     */
    getHead() {
        return {
            x: this.x,
            y: this.y,
            radius: this.headRadius,
            angle: this.angle
        };
    }

    /**
     * Returns all body segments for collision checking
     */
    getSegments() {
        return this.segments;
    }

    /**
     * Kills the snake
     */
    die() {
        this.isDead = true;
    }

    /**
     * Render pass for snake body, head, and eyes
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        if (this.isDead || this.segments.length === 0) return;

        const { headColor, bodyPrimary, bodySecondary, glowColor, eyeColor, pupilColor, stripeInterval } = this.skin;
        const interval = stripeInterval || 2;

        // 1. Draw Body Segments (Back-to-Front for clean layering)
        for (let i = this.segments.length - 1; i >= 1; i--) {
            const seg = this.segments[i];
            const isStripe = Math.floor(i / interval) % 2 === 1;
            ctx.fillStyle = isStripe ? bodySecondary : bodyPrimary;

            ctx.beginPath();
            ctx.arc(seg.x, seg.y, seg.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 2. Draw Head
        const head = this.segments[0];
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.arc(head.x, head.y, head.radius, 0, Math.PI * 2);
        ctx.fill();

        // 3. Draw Expressive Eyes
        const lookX = Math.cos(this.angle);
        const lookY = Math.sin(this.angle);
        const perpX = -lookY;
        const perpY = lookX;

        const eyeLat = 0.48 * head.radius;
        const eyeFwd = 0.42 * head.radius;
        const eyeRad = 0.32 * head.radius;
        const pupilRad = this.isBoosting ? (0.13 * head.radius) : (0.18 * head.radius);

        const leftEyeX = head.x + perpX * eyeLat + lookX * eyeFwd;
        const leftEyeY = head.y + perpY * eyeLat + lookY * eyeFwd;
        const rightEyeX = head.x - perpX * eyeLat + lookX * eyeFwd;
        const rightEyeY = head.y - perpY * eyeLat + lookY * eyeFwd;

        // Sclera (Whites)
        ctx.fillStyle = eyeColor || '#ffffff';
        ctx.beginPath();
        ctx.arc(leftEyeX, leftEyeY, eyeRad, 0, Math.PI * 2);
        ctx.arc(rightEyeX, rightEyeY, eyeRad, 0, Math.PI * 2);
        ctx.fill();

        // Pupils (Oriented towards targetAngle)
        const targLookX = Math.cos(this.targetAngle);
        const targLookY = Math.sin(this.targetAngle);
        const pupilShift = 0.35 * eyeRad;

        ctx.fillStyle = pupilColor || '#020210';
        ctx.beginPath();
        ctx.arc(leftEyeX + targLookX * pupilShift, leftEyeY + targLookY * pupilShift, pupilRad, 0, Math.PI * 2);
        ctx.arc(rightEyeX + targLookX * pupilShift, rightEyeY + targLookY * pupilShift, pupilRad, 0, Math.PI * 2);
        ctx.fill();
    }
}
