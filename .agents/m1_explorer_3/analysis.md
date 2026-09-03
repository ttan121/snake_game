# Milestone 1 Technical Specification & Implementation Blueprint: Boost Mechanics, Mass Drainage & Multi-Input Control Adapters

**Agent:** Milestone 1 Explorer 3 (`teamwork_preview_explorer`)  
**Mission:** Technical Architecture & Worker Implementation Blueprint for Milestone 1 Features (Feature 4: Speed Boost & Mass Dissipation, Feature 5: Multi-Input Controls)  
**Target Codebase:** `D:\snake_game` (`script.js`, `style.css`, `index.html`)  
**Date:** 2026-08-29  

---

## 1. Executive Summary

Milestone 1 establishes the core physical foundation and real-time control mechanics of the Slither.io clone. This report delivers the complete mathematical formulas, state machine dynamics, input adapter abstractions, and concrete code implementations for:
1. **Speed Boost State Machine:** $1.90\times$ speed multiplier ($v_{\text{boost}} = 304\text{ px/s}$ vs $v_{\text{base}} = 160\text{ px/s}$), mass dissipation rate ($\dot{M} = 4.5\text{ mass/s}$), strict $M \le 20.0$ cutoff threshold, and spatial-interval trail pellet drop event hooks ($\Delta d = 24\text{px}$).
2. **Unified Multi-Input Control Layer:**
   - **Mouse Adapter:** Direct viewport-centered angle tracking $\theta = \text{atan2}(Y_m - H/2, X_m - W/2)$ with center deadzone, left-click & right-click boosting, and contextmenu suppression.
   - **Keyboard Adapter:** WASD / Arrow keys 8-directional steering vectors + Spacebar / Shift boosting with scroll event suppression.
   - **Touch/Mobile Adapter:** Multi-touch identifier tracking, floating dynamic virtual joystick with clamped thumb deflection ($R_{\text{max}} = 50\text{px}$), and a dedicated neon glowing boost touch button.
3. **Fixed-Step Main Loop & Camera Coupling:** Deterministic 60Hz physics accumulator, transform matrix stack, and screen-to-world invariance.

---

## 2. Speed Boost State Machine & Mass Drainage Physics

```
                          SPEED BOOST STATE MACHINE
        ┌─────────────────────────────────────────────────────────┐
        │                                                         │
        │                     NORMAL STATE                        │
        │                     v = 160 px/s                        │
        │                     dM/dt = 0                           │
        │                     Trail Dropping: OFF                 │
        │                                                         │
        └──────────────────┬───────────────────▲──────────────────┘
                           │                   │
           [Boost Input ACTIVE                 │ [Boost Input RELEASED
            AND Mass M > 20.0]                 │  OR Mass M <= 20.0
                           │                   │  OR Snake is Dead]
                           ▼                   │
        ┌──────────────────────────────────────┴──────────────────┐
        │                                                         │
        │                      BOOST STATE                        │
        │                      v = 304 px/s (1.9x)                │
        │                      dM/dt = -4.5 mass/s                │
        │                      Trail Dropping: ON (every 24px)    │
        │                                                         │
        └─────────────────────────────────────────────────────────┘
```

### 2.1 Velocity Dynamics & Exponential Smoothing

- **Base Velocity ($v_{\text{base}}$):** $160.0\text{ px/s}$ ($2.667\text{ px/frame}$ at 60 FPS).
- **Boost Velocity ($v_{\text{boost}}$):** $1.90 \times v_{\text{base}} = 304.0\text{ px/s}$ ($5.067\text{ px/frame}$ at 60 FPS).
- **Velocity State Integration:** Rather than snapping speeds instantly, velocity transitions smoothly to create a responsive, arcade-quality inertia:
  $$v(t + \Delta t) = v(t) + (v_{\text{target}} - v(t)) \cdot \left(1 - e^{-k_v \Delta t}\right)$$
  where:
  - $v_{\text{target}} = \text{isBoosting} ? v_{\text{boost}} : v_{\text{base}}$
  - $k_v = 12.0\text{ s}^{-1}$ (reaches $95\%$ of target speed in $\approx 250\text{ms}$).

### 2.2 Continuous Mass Consumption

When `isBoosting` is true and mass $M > 20.0$:
$$\dot{M}_{\text{boost}} = 4.5\text{ mass units/sec}$$
$$\Delta M = -\dot{M}_{\text{boost}} \cdot \Delta t$$
$$M(t + \Delta t) = \max\left(20.0, M(t) + \Delta M\right)$$

### 2.3 Hard Cutoff Boundary Condition ($M \le 20.0$)

- **Threshold Value:** $M_{\text{min\_boost}} = 20.0$ mass units.
- **Deactivation Rule:**
  $$\text{if } (M \le 20.0) \implies \text{isBoosting} = \text{false}$$
- **Lockout Rule:** If $M \le 20.0$, boost cannot be initiated even if mouse/keyboard/touch boost controls are actively held down. Once mass grows above $20.0$ (via eating food), boosting is re-enabled if input is held.

### 2.4 Spatial Trail Pellet Shedding & Event Hooks

To prevent pellet clustering at low speeds or when accelerating, pellet ejection is governed by **accumulated distance travelled** during boosting:
- **Shedding Distance Interval:** $\Delta d_{\text{shed}} = 24.0\text{ px}$
- **Pellet Mass Value:** $V_{\text{pellet}} = 1.2\text{ mass units}$
- **Algorithm:**
  ```javascript
  if (this.isBoosting) {
      this.boostDistAccumulator += this.currentSpeed * dt;
      while (this.boostDistAccumulator >= 24.0) {
          this.boostDistAccumulator -= 24.0;
          this.emitTrailPellet();
      }
  } else {
      this.boostDistAccumulator = 0;
  }
  ```
- **Pellet Spawn Kinematics:**
  - Origin: Tail segment $\vec{p}_{N-1} = (x_{N-1}, y_{N-1})$.
  - Ejection angle: $\theta_{\text{eject}} = \theta_{\text{tail}} + \pi + \mathcal{U}(-0.3, 0.3)\text{ rad}$ (backward with slight radial scatter).
  - Initial ejection speed: $v_{\text{eject}} = 35.0 + \mathcal{U}(-10, 10)\text{ px/s}$.
  - Event Hook Callback: `onTrailPelletDrop({ x, y, vx, vy, value: 1.2, color: skin.glowColor })`.

---

## 3. Multi-Input Control Adapter Layer Architecture

```
                             INPUT ADAPTER ARCHITECTURE
   +───────────────────+  +──────────────────────+  +─────────────────────+
   │ MouseInputAdapter │  │ KeyboardInputAdapter │  │  TouchInputAdapter  │
   │ - Viewport atan2  │  │ - 8-Direction WASD   │  │ - Floating Joystick │
   │ - L/R Click Boost │  │ - Space / Shift Boost│  │ - Dedicated Button │
   +─────────┬─────────+  +──────────┬───────────+  +──────────┬──────────+
             │                       │                         │
             └───────────────────────┼─────────────────────────┘
                                     ▼
                      +──────────────────────────────+
                      │         InputManager         │
                      │ - Device Priority Arbiter    │
                      │ - Active Mode State Machine  │
                      +──────────────┬───────────────+
                                     ▼
                      +──────────────────────────────+
                      │          InputState          │
                      │ { targetAngle, isBoosting }  │
                      +──────────────┬───────────────+
                                     ▼
                      +──────────────────────────────+
                      │         Snake Entity         │
                      │  snake.handleInput(state)    │
                      +──────────────────────────────+
```

### 3.1 Unified Interface Contract

```javascript
/**
 * @typedef {Object} InputState
 * @property {number|null} targetAngle - Target heading angle in radians [-PI, PI], or null if neutral
 * @property {boolean} isBoosting - Boolean boost command
 * @property {string} activeDevice - 'mouse' | 'keyboard' | 'touch'
 */
```

### 3.2 Mouse Input Adapter (`MouseInputAdapter`)

1. **Heading Angle Derivation:**
   Because the camera keeps the player snake's head perfectly centered at viewport midpoint $(W_s / 2, H_s / 2)$:
   $$\vec{P}_{\text{cursor}} = (X_m, Y_m)$$
   $$\Delta X_m = X_m - \frac{W_s}{2}, \quad \Delta Y_m = Y_m - \frac{H_s}{2}$$
   $$\theta_{\text{target}} = \text{atan2}(\Delta Y_m, \Delta X_m)$$
   *Mathematical Invariance:* This equation is completely independent of camera world position $(C_x, C_y)$ and zoom level $Z$.
2. **Deadzone Stabilization:**
   If $\sqrt{\Delta X_m^2 + \Delta Y_m^2} < 8.0\text{px}$ (cursor hovering directly over head center), retain previous target angle to eliminate micro-jitter.
3. **Boost Input:**
   - Left click (`button === 0`) or Right click (`button === 2`) sets `isBoosting = true`.
   - Releasing all mouse buttons sets `isBoosting = false`.
   - Must call `event.preventDefault()` on `contextmenu` event to permit right-click boosting without opening browser context menu.

### 3.3 Keyboard Input Adapter (`KeyboardInputAdapter`)

1. **Steering Vectors (8 Directions):**
   - Track keydown states for `['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']`.
   - Compute aggregate directional vector:
     $$V_x = (\text{KeyD} \lor \text{ArrowRight} ? 1 : 0) - (\text{KeyA} \lor \text{ArrowLeft} ? 1 : 0)$$
     $$V_y = (\text{KeyS} \lor \text{ArrowDown} ? 1 : 0) - (\text{KeyW} \lor \text{ArrowUp} ? 1 : 0)$$
   - If $|V_x| > 0$ or $|V_y| > 0$:
     $$\theta_{\text{target}} = \text{atan2}(V_y, V_x)$$
   - If no steering keys are pressed, `targetAngle = null` (snake maintains current heading).
2. **Boost Input:**
   - `Space` (`event.code === 'Space'`) or `Shift` (`event.key === 'Shift'`) triggers boost.
   - Prevent default on `Space` and `Arrow` keys to stop unwanted window scrolling.

### 3.4 Touch / Mobile Input Adapter (`TouchInputAdapter`)

1. **Dual-Zone Screen Partitioning & Multi-Touch Tracking:**
   - Multi-touch handling uses unique `touch.identifier` values to decouple steering from boosting.
   - **Zone A (Joystick Zone):** Left half of screen (or any touch starting outside the dedicated boost button).
   - **Zone B (Boost Zone):** Dedicated HTML/CSS button (`#boost-btn`) positioned in the bottom-right corner.
2. **Dynamic Floating Virtual Joystick:**
   - `touchstart`:
     - Record `joystickTouchId = touch.identifier`.
     - Anchor base at $(X_{\text{origin}}, Y_{\text{origin}}) = (\text{touch.clientX}, \text{touch.clientY})$.
     - Reveal `#joystick-base` and `#joystick-thumb` at anchor position.
   - `touchmove`:
     - Filter for `touch.identifier === joystickTouchId`.
     - $\Delta x = \text{touch.clientX} - X_{\text{origin}}$, $\Delta y = \text{touch.clientY} - Y_{\text{origin}}$.
     - Distance $r = \sqrt{\Delta x^2 + \Delta y^2}$.
     - Deadzone threshold $r_{\text{dead}} = 5.0\text{px}$.
     - Max deflection radius $R_{\text{max}} = 50.0\text{px}$.
     - If $r > r_{\text{dead}}$:
       $$\theta_{\text{target}} = \text{atan2}(\Delta y, \Delta x)$$
       Thumb position clamped to circular boundary:
       $$T_x = \cos(\theta_{\text{target}}) \cdot \min(r, R_{\text{max}}), \quad T_y = \sin(\theta_{\text{target}}) \cdot \min(r, R_{\text{max}})$$
       Visual CSS: `transform: translate(calc(-50% + ${T_x}px), calc(-50% + ${T_y}px))`.
   - `touchend` / `touchcancel`:
     - If `touch.identifier === joystickTouchId`, reset joystick and add `.hidden` class to `#joystick-base`.
3. **Dedicated Boost Touch Button:**
   - Placed at `bottom: 40px; right: 40px; width: 80px; height: 80px;` with neon cyan/magenta styling.
   - `touchstart` on button $\to$ `isBoosting = true`, adds `.active` visual feedback.
   - `touchend` / `touchcancel` on button $\to$ `isBoosting = false`.
4. **Fallback Double-Tap Gesture:**
   - If user double-taps anywhere within 250ms and holds, activate boost until release.

### 3.5 Device Priority & Seamless Runtime Switching

`InputManager` registers listeners for mouse, keyboard, and touch concurrently. It maintains an `activeDevice` state:
- When a `touchstart` occurs $\to$ `activeDevice = 'touch'`.
- When a `mousemove` occurs $\to$ `activeDevice = 'mouse'`.
- When a `keydown` occurs $\to$ `activeDevice = 'keyboard'`.
- This ensures zero latency when switching between mouse and keyboard on desktop, and suppresses spurious mouse events synthesized from touch taps on mobile.

---

## 4. Integration with Main Loop and Camera

### 4.1 Fixed-Step Game Loop Integration

```javascript
class GameEngine {
    constructor() {
        this.FIXED_DT = 1 / 60; // 16.6667ms
        this.accumulator = 0;
        this.lastTime = performance.now();
        this.inputManager = new InputManager(canvas, boostBtn);
        this.camera = new Camera(window.innerWidth, window.innerHeight);
        this.player = new Snake({ id: 'player', isPlayer: true, x: 1500, y: 1500 });
    }

    loop(currentTime) {
        if (!this.isRunning) return;
        requestAnimationFrame((t) => this.loop(t));

        let frameTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        if (frameTime > 0.1) frameTime = 0.1; // clamp against lag spikes

        this.accumulator += frameTime;
        while (this.accumulator >= this.FIXED_DT) {
            this.physicsStep(this.FIXED_DT);
            this.accumulator -= this.FIXED_DT;
        }

        this.render();
    }

    physicsStep(dt) {
        // 1. Poll input state
        const inputState = this.inputManager.getState();
        
        // 2. Feed input into player snake
        this.player.handleInput(inputState);
        
        // 3. Update player kinematics, boost & mass
        this.player.update(dt, (pelletData) => {
            this.foodManager.spawnBoostOrb(pelletData);
        });

        // 4. Update camera tracking
        this.camera.update(this.player.head.x, this.player.head.y, this.player.mass, dt);
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // World Space Rendering
        this.camera.applyTransform(this.ctx);
        this.drawWorldBackground();
        this.foodManager.draw(this.ctx);
        this.player.draw(this.ctx);
        this.camera.restoreTransform(this.ctx);

        // Screen Space HUD Rendering
        this.uiController.drawHUD(this.player);
    }
}
```

---

## 5. Worker Implementation Blueprint & Detailed Code Changes

### 5.1 File Modifications: `index.html`

```html
<!-- Replace game-container & controls in index.html -->
<div id="game-wrapper">
    <canvas id="gameCanvas"></canvas>
    
    <!-- Top HUD Overlay -->
    <div id="hud" class="hud-layer">
        <div class="hud-stat">MASS: <span id="hud-mass" class="neon-text">10</span></div>
        <div class="hud-stat">SCORE: <span id="hud-score" class="neon-text">0</span></div>
        <div class="hud-stat">RANK: <span id="hud-rank" class="neon-text">#1</span>/<span id="hud-total">1</span></div>
    </div>

    <!-- Virtual Joystick -->
    <div id="joystick-base" class="hidden">
        <div id="joystick-thumb"></div>
    </div>

    <!-- Mobile Dedicated Boost Button -->
    <div id="boost-btn" class="mobile-boost-btn hidden">
        <div class="boost-inner">
            <svg viewBox="0 0 24 24" class="boost-icon">
                <path fill="currentColor" d="M7 2v11h3v9l7-12h-4l4-8z"/>
            </svg>
            <span>BOOST</span>
        </div>
    </div>
</div>
```

### 5.2 File Modifications: `style.css`

```css
/* Responsive Fullscreen Canvas & UI Container */
#game-wrapper {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
}

canvas#gameCanvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
    background: #060610;
}

/* Fixed HUD */
.hud-layer {
    position: absolute;
    top: 20px;
    left: 20px;
    display: flex;
    gap: 20px;
    pointer-events: none;
    z-index: 20;
    font-family: 'Orbitron', sans-serif;
    font-size: 1rem;
    color: #fff;
    text-shadow: 0 0 8px rgba(0, 255, 255, 0.6);
}
.neon-text {
    color: #00ffff;
    font-weight: bold;
    text-shadow: 0 0 10px #00ffff;
}

/* Dynamic Floating Virtual Joystick */
#joystick-base {
    position: fixed;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0, 255, 255, 0.15) 0%, rgba(0, 255, 255, 0.03) 70%);
    border: 2px solid rgba(0, 255, 255, 0.5);
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 100;
    box-shadow: 0 0 20px rgba(0, 255, 255, 0.3), inset 0 0 15px rgba(0, 255, 255, 0.15);
}

#joystick-thumb {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: radial-gradient(circle, #00ffff 0%, #0088cc 100%);
    transform: translate(-50%, -50%);
    box-shadow: 0 0 18px #00ffff;
    pointer-events: none;
}

/* Dedicated Mobile Boost Touch Button */
.mobile-boost-btn {
    position: fixed;
    bottom: 35px;
    right: 35px;
    width: 84px;
    height: 84px;
    border-radius: 50%;
    background: rgba(10, 15, 30, 0.75);
    border: 2px solid #ff007f;
    box-shadow: 0 0 20px rgba(255, 0, 127, 0.4), inset 0 0 15px rgba(255, 0, 127, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    cursor: pointer;
    touch-action: none;
    transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.mobile-boost-btn:active, .mobile-boost-btn.active {
    transform: scale(0.92);
    background: rgba(255, 0, 127, 0.3);
    box-shadow: 0 0 30px rgba(255, 0, 127, 0.8), inset 0 0 25px rgba(255, 0, 127, 0.5);
}

.boost-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #ff007f;
    font-family: 'Orbitron', sans-serif;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 1px;
    pointer-events: none;
}

.boost-icon {
    width: 28px;
    height: 28px;
    fill: #ff007f;
    filter: drop-shadow(0 0 6px #ff007f);
}
```

### 5.3 File Modifications: `script.js` Component Blueprint

#### 1. Input Module Implementation
```javascript
/**
 * Unified Input Manager & Adapters
 */
class MouseInputAdapter {
    constructor(canvas) {
        this.canvas = canvas;
        this.targetAngle = -Math.PI / 2;
        this.isBoosting = false;
        this.hasMoved = false;

        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenCenterX = rect.left + rect.width / 2;
        const screenCenterY = rect.top + rect.height / 2;

        const dx = e.clientX - screenCenterX;
        const dy = e.clientY - screenCenterY;
        const dist = Math.hypot(dx, dy);

        if (dist > 8.0) {
            this.targetAngle = Math.atan2(dy, dx);
            this.hasMoved = true;
        }
    }

    onMouseDown(e) {
        if (e.button === 0 || e.button === 2) {
            this.isBoosting = true;
        }
    }

    onMouseUp(e) {
        if (e.button === 0 || e.button === 2) {
            this.isBoosting = false;
        }
    }
}

class KeyboardInputAdapter {
    constructor() {
        this.keys = {};
        this.isBoosting = false;
        this.hasInput = false;

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
    }

    onKeyDown(e) {
        this.keys[e.code] = true;
        this.keys[e.key] = true;
        if (e.code === 'Space' || e.key === 'Shift') {
            this.isBoosting = true;
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
            e.preventDefault();
        }
    }

    onKeyUp(e) {
        this.keys[e.code] = false;
        this.keys[e.key] = false;
        if (e.code === 'Space' || e.key === 'Shift') {
            this.isBoosting = false;
        }
    }

    getTargetAngle() {
        let vx = 0;
        let vy = 0;

        if (this.keys['KeyD'] || this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) vx += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) vx -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) vy += 1;
        if (this.keys['KeyW'] || this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) vy -= 1;

        if (vx !== 0 || vy !== 0) {
            this.hasInput = true;
            return Math.atan2(vy, vx);
        }
        this.hasInput = false;
        return null;
    }
}

class TouchInputAdapter {
    constructor(canvas, boostBtn, joyBase, joyThumb) {
        this.canvas = canvas;
        this.boostBtn = boostBtn;
        this.joyBase = joyBase;
        this.joyThumb = joyThumb;

        this.targetAngle = null;
        this.isBoosting = false;
        this.joystickTouchId = null;
        this.startX = 0;
        this.startY = 0;
        this.maxRadius = 50.0;
        this.deadzone = 5.0;

        this.initEvents();
    }

    initEvents() {
        // Boost button handlers
        if (this.boostBtn) {
            this.boostBtn.classList.remove('hidden');
            this.boostBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
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

        // Virtual joystick touch handlers on canvas/screen
        window.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
        window.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });
    }

    onTouchStart(e) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            // Skip if touch was on the boost button
            if (this.boostBtn && this.boostBtn.contains(touch.target)) continue;

            if (this.joystickTouchId === null) {
                e.preventDefault();
                this.joystickTouchId = touch.identifier;
                this.startX = touch.clientX;
                this.startY = touch.clientY;

                this.joyBase.classList.remove('hidden');
                this.joyBase.style.left = `${this.startX}px`;
                this.joyBase.style.top = `${this.startY}px`;
                this.joyThumb.style.transform = `translate(-50%, -50%)`;
                break;
            }
        }
    }

    onTouchMove(e) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === this.joystickTouchId) {
                e.preventDefault();
                const dx = touch.clientX - this.startX;
                const dy = touch.clientY - this.startY;
                const dist = Math.hypot(dx, dy);

                if (dist > this.deadzone) {
                    this.targetAngle = Math.atan2(dy, dx);
                    const clampedDist = Math.min(dist, this.maxRadius);
                    const tx = Math.cos(this.targetAngle) * clampedDist;
                    const ty = Math.sin(this.targetAngle) * clampedDist;
                    this.joyThumb.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;
                }
                break;
            }
        }
    }

    onTouchEnd(e) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === this.joystickTouchId) {
                this.joystickTouchId = null;
                this.targetAngle = null;
                this.joyBase.classList.add('hidden');
                break;
            }
        }
    }
}

class InputManager {
    constructor(canvas, boostBtn, joyBase, joyThumb) {
        this.mouse = new MouseInputAdapter(canvas);
        this.keyboard = new KeyboardInputAdapter();
        this.touch = new TouchInputAdapter(canvas, boostBtn, joyBase, joyThumb);
        this.activeMode = 'mouse';

        // Auto-detect last active input mode
        window.addEventListener('mousemove', () => { this.activeMode = 'mouse'; });
        window.addEventListener('keydown', () => { this.activeMode = 'keyboard'; });
        window.addEventListener('touchstart', () => { this.activeMode = 'touch'; });
    }

    getState() {
        let targetAngle = null;
        let isBoosting = false;

        if (this.activeMode === 'touch' && this.touch.targetAngle !== null) {
            targetAngle = this.touch.targetAngle;
            isBoosting = this.touch.isBoosting;
        } else if (this.activeMode === 'keyboard' && this.keyboard.hasInput) {
            targetAngle = this.keyboard.getTargetAngle();
            isBoosting = this.keyboard.isBoosting;
        } else {
            targetAngle = this.mouse.targetAngle;
            isBoosting = this.mouse.isBoosting || this.keyboard.isBoosting;
        }

        return {
            targetAngle: targetAngle,
            isBoosting: isBoosting,
            activeMode: this.activeMode
        };
    }
}
```

#### 2. Snake Kinematics & Boost Integration
```javascript
class Snake {
    constructor(config) {
        this.id = config.id || 'snake_' + Math.random().toString(36).substr(2, 9);
        this.name = config.name || 'Player';
        this.isPlayer = !!config.isPlayer;

        this.head = { x: config.x || 1500, y: config.y || 1500 };
        this.angle = config.angle || -Math.PI / 2;
        this.targetAngle = this.angle;

        this.mass = config.mass || 10.0;
        this.score = 0;
        this.isDead = false;

        // Kinematics & Boost
        this.baseSpeed = 160.0;
        this.boostSpeed = 304.0;
        this.currentSpeed = this.baseSpeed;
        this.isBoosting = false;
        this.boostDrainRate = 4.5;
        this.minBoostMass = 20.0;
        this.boostDistAccumulator = 0.0;

        // Path history & segment chain
        this.segments = [];
        this.pathHistory = [];
        this.historySpacing = 8;
        this.skin = config.skin || {
            headColor: '#00ffff',
            bodyPrimary: '#00ccff',
            bodySecondary: '#0066aa',
            glowColor: '#00ffff'
        };

        this.initSegments();
    }

    getSegmentCount() {
        return Math.floor(10 + 1.2 * Math.pow(this.mass, 0.65));
    }

    getBodyRadius() {
        return Math.min(38.0, 9.0 + 0.18 * Math.sqrt(this.mass));
    }

    getHeadRadius() {
        return this.getBodyRadius() * 1.20;
    }

    getTurnRate() {
        // Angular speed slows with increased mass: omega(M) = 4.2 * (120 / (M + 120))^0.35
        const omega = 4.2 * Math.pow(120.0 / (this.mass + 120.0), 0.35);
        return Math.max(1.2, omega);
    }

    initSegments() {
        const count = this.getSegmentCount();
        this.segments = [];
        this.pathHistory = [];

        for (let i = 0; i < count * this.historySpacing; i++) {
            this.pathHistory.push({
                x: this.head.x - Math.cos(this.angle) * i * (this.baseSpeed / 60),
                y: this.head.y - Math.sin(this.angle) * i * (this.baseSpeed / 60)
            });
        }

        for (let i = 0; i < count; i++) {
            this.segments.push({
                x: this.head.x - Math.cos(this.angle) * i * this.historySpacing,
                y: this.head.y - Math.sin(this.angle) * i * this.historySpacing,
                radius: this.getBodyRadius()
            });
        }
    }

    handleInput(inputState) {
        if (this.isDead) return;

        if (inputState.targetAngle !== null) {
            this.targetAngle = inputState.targetAngle;
        }

        // Boost eligibility check (Mass must exceed 20.0)
        if (inputState.isBoosting && this.mass > this.minBoostMass) {
            this.isBoosting = true;
        } else {
            this.isBoosting = false;
        }
    }

    update(dt, onPelletDrop) {
        if (this.isDead) return;

        // 1. Boost mass drainage & cutoff check
        if (this.isBoosting) {
            if (this.mass > this.minBoostMass) {
                const drain = this.boostDrainRate * dt;
                this.mass = Math.max(this.minBoostMass, this.mass - drain);
                if (this.mass <= this.minBoostMass) {
                    this.isBoosting = false;
                }
            } else {
                this.isBoosting = false;
            }
        }

        // 2. Smooth Speed Interpolation
        const targetV = this.isBoosting ? this.boostSpeed : this.baseSpeed;
        this.currentSpeed += (targetV - this.currentSpeed) * (1 - Math.exp(-12.0 * dt));

        // 3. Angular Steering with Shortest Arc
        let diff = this.targetAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const maxTurn = this.getTurnRate() * dt;
        const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
        this.angle += turn;

        // 4. Head Position Step
        this.head.x += Math.cos(this.angle) * this.currentSpeed * dt;
        this.head.y += Math.sin(this.angle) * this.currentSpeed * dt;

        // 5. Update Path History Ring Buffer
        this.pathHistory.unshift({ x: this.head.x, y: this.head.y });
        const maxHistory = this.getSegmentCount() * this.historySpacing + 10;
        if (this.pathHistory.length > maxHistory) {
            this.pathHistory.length = maxHistory;
        }

        // 6. Update Body Segments Along Path History
        const segCount = this.getSegmentCount();
        this.segments = [{ x: this.head.x, y: this.head.y, radius: this.getHeadRadius() }];
        const bodyRadius = this.getBodyRadius();

        for (let i = 1; i < segCount; i++) {
            const histIdx = i * this.historySpacing;
            const pt = histIdx < this.pathHistory.length ? this.pathHistory[histIdx] : this.pathHistory[this.pathHistory.length - 1];
            
            // Tail tapering formula
            let r = bodyRadius;
            const taperCount = Math.min(8, Math.floor(0.2 * segCount));
            if (i >= segCount - taperCount && taperCount > 0) {
                const frac = (i - (segCount - taperCount)) / taperCount;
                r *= (1.0 - 0.45 * frac * frac);
            }

            this.segments.push({ x: pt.x, y: pt.y, radius: r });
        }

        // 7. Boost Trail Pellets Ejection Event
        if (this.isBoosting && onPelletDrop && this.segments.length > 0) {
            this.boostDistAccumulator += this.currentSpeed * dt;
            const tail = this.segments[this.segments.length - 1];
            const preTail = this.segments.length > 1 ? this.segments[this.segments.length - 2] : this.head;
            const tailAngle = Math.atan2(tail.y - preTail.y, tail.x - preTail.x);

            while (this.boostDistAccumulator >= 24.0) {
                this.boostDistAccumulator -= 24.0;
                const ejectAngle = tailAngle + Math.PI + (Math.random() - 0.5) * 0.6;
                const ejectSpeed = 35.0 + (Math.random() - 0.5) * 20.0;

                onPelletDrop({
                    type: 'BOOST_TRAIL',
                    x: tail.x,
                    y: tail.y,
                    vx: Math.cos(ejectAngle) * ejectSpeed,
                    vy: Math.sin(ejectAngle) * ejectSpeed,
                    value: 1.2,
                    color: this.skin.glowColor
                });
            }
        } else {
            this.boostDistAccumulator = 0.0;
        }
    }

    draw(ctx) {
        if (this.isDead) return;

        // Render body segments from tail to head
        for (let i = this.segments.length - 1; i >= 0; i--) {
            const seg = this.segments[i];
            const isHead = (i === 0);

            ctx.beginPath();
            ctx.arc(seg.x, seg.y, seg.radius, 0, Math.PI * 2);

            if (isHead) {
                ctx.fillStyle = this.skin.headColor;
                ctx.shadowColor = this.skin.glowColor;
                ctx.shadowBlur = this.isBoosting ? 28 : 18;
            } else {
                ctx.fillStyle = (i % 2 === 0) ? this.skin.bodyPrimary : this.skin.bodySecondary;
                ctx.shadowColor = this.skin.glowColor;
                ctx.shadowBlur = this.isBoosting ? 14 : 6;
            }

            ctx.fill();
            ctx.shadowBlur = 0;

            // Render expressive eyes on head
            if (isHead) {
                this.drawEyes(ctx, seg.x, seg.y, this.angle, seg.radius);
            }
        }
    }

    drawEyes(ctx, hx, hy, angle, radius) {
        const eyeOffsetDist = radius * 0.45;
        const eyeForward = radius * 0.45;
        const eyeRadius = radius * 0.32;
        const pupilRadius = radius * 0.16;

        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const perpX = -sinA;
        const perpY = cosA;

        const eye1X = hx + perpX * eyeOffsetDist + cosA * eyeForward;
        const eye1Y = hy + perpY * eyeOffsetDist + sinA * eyeForward;
        const eye2X = hx - perpX * eyeOffsetDist + cosA * eyeForward;
        const eye2Y = hy - perpY * eyeOffsetDist + sinA * eyeForward;

        // Sclera (White)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeRadius, 0, Math.PI * 2);
        ctx.arc(eye2X, eye2Y, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Pupils (Black) pointing in look direction
        ctx.fillStyle = '#050510';
        ctx.beginPath();
        ctx.arc(eye1X + cosA * pupilRadius, eye1Y + sinA * pupilRadius, pupilRadius, 0, Math.PI * 2);
        ctx.arc(eye2X + cosA * pupilRadius, eye2Y + sinA * pupilRadius, pupilRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}
```

---

## 6. Edge Cases, Failure Modes & Verification Test Matrix

| # | Test Category | Specific Condition | Expected Behavior |
|---|---|---|---|
| 1 | **Boost Threshold** | Player holds boost with $M = 20.0$ | Boost does not engage, speed remains $v_{\text{base}} = 160\text{ px/s}$, mass does not drain. |
| 2 | **Boost Depletion** | Snake boosting drops from $M = 21.0 \to 20.0$ | At exact moment $M=20.0$, `isBoosting` toggles to false, speed decelerates smoothly to $v_{\text{base}}$, trail drop stops. |
| 3 | **Mouse Head Center** | Cursor at exact center $(\Delta X=0, \Delta Y=0)$ | Retains previous `targetAngle`, no `NaN` or twitching. |
| 4 | **Right-Click Boost** | Player right clicks on canvas | Context menu blocked, boost activates cleanly. |
| 5 | **Keyboard 8-Way** | Simultaneous W+D pressed | Heading targets exactly $-\pi/4$ ($-45^\circ$). |
| 6 | **Mobile Multi-Touch** | Left thumb dragging joystick, right thumb pressing boost | Both inputs processed simultaneously with zero crosstalk via touch identifiers. |
| 7 | **Window Resize** | Viewport resizes from desktop to mobile resolution | Canvas auto-scales, center coordinate adjusts dynamically, mouse heading formula remains exact. |
| 8 | **Lag Spike Frame** | Browser tab freezes for 500ms | $\Delta t$ clamped to $0.1\text{s}$, preventing physics disintegration or massive instant mass drops. |

---

## 7. Next Steps for Implementation Worker

1. Update `index.html` structure with fullscreen `#game-wrapper`, `#joystick-base`, `#joystick-thumb`, and `#boost-btn`.
2. Apply neon cyberpunk responsive CSS rules in `style.css`.
3. Refactor `script.js` to instantiate the modular `InputManager` and updated `Snake` class with boost physics and trail pellet callbacks.
4. Execute headless simulation scripts to verify 100% compliance with Milestone 1 specifications.
