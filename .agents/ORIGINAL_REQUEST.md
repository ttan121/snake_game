# Original User Request

## 2026-08-29T02:19:42Z

<USER_REQUEST>
# Teamwork Project Prompt — Final

> Status: Launched 🚀
> Goal: Rebuild snake game into a Slither.io clone
> Requested team: Standard Team

**Project Description:**
Tear down and rebuild the current Snake game into a highly polished, Slither.io-style web game. This includes a massive world map, a dynamic camera system that tracks the player, AI-controlled bot snakes, and a completely redesigned, modern UI/UX.

Working directory: `D:\snake_game`
Integrity mode: development

## Requirements

### R1. Slither.io Core Mechanics & Camera
Implement a massive map (e.g., 3000x3000 pixels) where the player controls a snake with 360-degree free movement. A dynamic camera must smoothly follow the player's head, keeping it centered on the screen. The implementation must use pure HTML5 Canvas and vanilla JS without external game engines.

### R2. AI Bot System
Implement autonomous computer-controlled snake bots that roam the map and seek food. When any snake (player or bot) dies (e.g. by hitting another snake's body or the world border), its body must disintegrate into high-value glowing energy orbs that can be consumed.

### R3. Modern UI/UX Overhaul
Completely redesign the user interface to be modern, cohesive, and visually striking. This must include a sleek start menu, a real-time leaderboard showing top scores (player vs bots), and high-quality glowing graphics for the snakes and food.

## Acceptance Criteria

### Mechanics & Camera
- [ ] The game world is significantly larger than the browser viewport (e.g. >2000x2000).
- [ ] The canvas rendering uses translation/camera logic so the player's snake remains centered on screen as it moves.

### AI Bots & Gameplay
- [ ] Multiple AI bots actively navigate the map concurrently with the player.
- [ ] A collision logic exists where hitting another snake's body results in death, and dead snakes drop food entities.

### UI & Polish
- [ ] The UI contains a functional start screen and a live in-game leaderboard.
- [ ] The game runs in vanilla HTML/JS and successfully renders glowing visuals (e.g., using `shadowBlur`).
</USER_REQUEST>
