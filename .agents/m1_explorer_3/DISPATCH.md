## 2026-08-29T02:25:00Z
Investigate and design the technical implementation plan for Milestone 1: Speed Boost Mechanics, Mass Drainage, Trail Shedding, and Multi-Input Control Adapters (Mouse, Keyboard, Touch Joystick & Boost).

INVESTIGATE & SPECIFY:
1. Boost state machine: 1.9x speed multiplier, mass consumption rate (M_dot = 4.5 mass/s), M <= 20 cutoff threshold, trail pellet drop event hooks.
2. Input adapter layer:
   - Mouse: target angle from viewport center atan2(Y_m - H/2, X_m - W/2), left-click / right-click boost.
   - Keyboard: WASD / Arrow keys angle steering, Spacebar boost.
   - Touch/Mobile: Dynamic floating virtual joystick with vector direction, dedicated boost touch button.
3. Integration with main loop and camera.
4. Detailed code changes and implementation blueprint for the Worker.
