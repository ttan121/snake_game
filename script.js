const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const overlay = document.getElementById('overlay');
const statusText = document.getElementById('statusText');
const playBtn = document.getElementById('playBtn');

// HiDPI Canvas Scaling
function scaleCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = 400;
    const logicalHeight = 400;
    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    ctx.scale(dpr, dpr);
}
scaleCanvas();

const tileCount = 20;
const tileSize = 400 / tileCount; 
let baseSpeed = 5;
let currentSpeed = baseSpeed;

let snake = [];
let dx = 0; 
let dy = 0;
let nextDx = 0; 
let nextDy = 0;
let appleX = 5; 
let appleY = 5;
let score = 0;
let highScore = localStorage.getItem('neonSnakeHighScore') || 0;
highScoreEl.innerText = highScore;

let gameLoop;
let isRunning = false;

// 1. HÀM KHỞI TẠO GAME
function startGame() {
    snake = [
        {x: 10, y: 10}, 
        {x: 10, y: 11}  
    ];
    dx = 0; dy = 0;
    nextDx = 0; nextDy = 0;
    score = 0;
    currentSpeed = baseSpeed;
    scoreEl.innerText = score;
    isRunning = true;
    
    overlay.classList.add('hidden');
    generateApple();
    
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(updateGame, 1000 / currentSpeed);
}

playBtn.addEventListener('click', startGame);

// 2. VÒNG LẶP CHÍNH CỦA GAME
function updateGame() {
    if (!isRunning) return;

    dx = nextDx;
    dy = nextDy;

    if (dx === 0 && dy === 0) {
        drawGame();
        return;
    }

    const newHead = { x: snake[0].x + dx, y: snake[0].y + dy };

    if (newHead.x < 0 || newHead.x >= tileCount || newHead.y < 0 || newHead.y >= tileCount) {
        triggerGameOver();
        return; 
    }
    for (let i = 0; i < snake.length; i++) {
        if (newHead.x === snake[i].x && newHead.y === snake[i].y) {
            triggerGameOver();
            return;
        }
    }

    snake.unshift(newHead);

    if (newHead.x === appleX && newHead.y === appleY) {
        score += 10;
        scoreEl.innerText = score;
        scoreEl.classList.remove('pop');
        void scoreEl.offsetWidth; // trigger reflow
        scoreEl.classList.add('pop');

        if (score > highScore) {
            highScore = score;
            highScoreEl.innerText = highScore;
            localStorage.setItem('neonSnakeHighScore', highScore);
        }

        // Increase speed per 50 points
        if (score % 50 === 0) {
            currentSpeed += 1;
            clearInterval(gameLoop);
            gameLoop = setInterval(updateGame, 1000 / currentSpeed);
        }

        generateApple();
    } else {
        snake.pop(); 
    }

    drawGame();
}

// 3. HÀM VẼ 
function drawGame() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, 400, 400);

    // Vẽ Táo (Hình dạng Lõi năng lượng phát sáng)
    let appleCX = appleX * tileSize + tileSize / 2;
    let appleCY = appleY * tileSize + tileSize / 2;
    ctx.fillStyle = '#f0f';
    ctx.shadowBlur = 20; ctx.shadowColor = '#f0f';
    ctx.beginPath();
    ctx.arc(appleCX, appleCY, tileSize/2 - 2, 0, Math.PI * 2);
    ctx.fill();
    // Tâm táo chói sáng
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 10; ctx.shadowColor = '#fff';
    ctx.beginPath();
    ctx.arc(appleCX, appleCY, tileSize/4 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Vẽ Rắn
    for (let i = 0; i < snake.length; i++) {
        let centerX = snake[i].x * tileSize + tileSize / 2;
        let centerY = snake[i].y * tileSize + tileSize / 2;
        let radius = (tileSize / 2) - 1;
        
        // Hiệu ứng Teo nhỏ dần (Tapering) về phía đuôi
        if (i > 0) {
            let taper = 1 - (i / snake.length) * 0.45; // Đuôi nhỏ tối đa bằng 55% so với đầu
            radius *= taper;
        }

        // Đổ bóng Gradient dọc thân rắn: Đầu sáng chói, đuôi tối mờ ảo
        ctx.fillStyle = i === 0 ? '#0ff' : `hsl(180, 100%, ${40 - (i/snake.length)*20}%)`; 
        
        if (i === 0) { 
            ctx.shadowBlur = 20; ctx.shadowColor = '#0ff';
        } else {
            ctx.shadowBlur = 8; ctx.shadowColor = `hsl(180, 100%, ${30 - (i/snake.length)*15}%)`;
        }
        
        // Vẽ Body/Head bo tròn mềm mại
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Vẽ Đôi Mắt sát thủ cho Rắn (Dành riêng cho phần Đầu)
        if (i === 0) {
            // Xác định hướng nhìn (Mặc định nhìn lên khi game mới bắt đầu)
            let lookDx = (dx === 0 && dy === 0) ? 0 : dx;
            let lookDy = (dx === 0 && dy === 0) ? -1 : dy;
            
            ctx.fillStyle = '#fff'; // Lòng trắng
            let eyeOffsetX = lookDx === 0 ? 4 : (lookDx > 0 ? 5 : -5);
            let eyeOffsetY = lookDy === 0 ? 4 : (lookDy > 0 ? 5 : -5);
            
            if (lookDx !== 0) {
                // Rắn đang đi ngang
                ctx.beginPath(); ctx.arc(centerX + eyeOffsetX, centerY - 4, 2.5, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(centerX + eyeOffsetX, centerY + 4, 2.5, 0, Math.PI*2); ctx.fill();
                // Lòng đen (Con ngươi) nhìn theo hướng di chuyển
                ctx.fillStyle = '#000';
                ctx.beginPath(); ctx.arc(centerX + eyeOffsetX + lookDx*1.5, centerY - 4, 1.2, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(centerX + eyeOffsetX + lookDx*1.5, centerY + 4, 1.2, 0, Math.PI*2); ctx.fill();
            } else {
                // Rắn đang đi dọc
                ctx.beginPath(); ctx.arc(centerX - 4, centerY + eyeOffsetY, 2.5, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(centerX + 4, centerY + eyeOffsetY, 2.5, 0, Math.PI*2); ctx.fill();
                // Lòng đen (Con ngươi)
                ctx.fillStyle = '#000';
                ctx.beginPath(); ctx.arc(centerX - 4, centerY + eyeOffsetY + lookDy*1.5, 1.2, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(centerX + 4, centerY + eyeOffsetY + lookDy*1.5, 1.2, 0, Math.PI*2); ctx.fill();
            }
        }
    }
}

// 4. CÁC HÀM PHỤ TRỢ
function triggerGameOver() {
    isRunning = false;
    statusText.innerText = "GAME OVER";
    statusText.style.color = "#f00";
    playBtn.innerText = "Play Again";
    overlay.classList.remove('hidden');
    clearInterval(gameLoop);
}

function generateApple() {
    let valid = false;
    while (!valid) {
        appleX = Math.floor(Math.random() * tileCount);
        appleY = Math.floor(Math.random() * tileCount);
        valid = true;
        for (let part of snake) {
            if (part.x === appleX && part.y === appleY) {
                valid = false; break;
            }
        }
    }
}

// 5. XỬ LÝ NHẬN LỆNH ĐIỀU KHIỂN
function changeDirection(newDx, newDy) {
    if (!isRunning) return;
    
    if (dx !== 0 && newDx === -dx) return;
    if (dy !== 0 && newDy === -dy) return;
    
    if (snake.length > 1) {
        if (snake[0].x + newDx === snake[1].x && snake[0].y + newDy === snake[1].y) {
            return; 
        }
    }
    
    nextDx = newDx;
    nextDy = newDy;
}

// Bàn phím
document.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') changeDirection(0, -1);
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') changeDirection(0, 1);
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') changeDirection(-1, 0);
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') changeDirection(1, 0);
});

// Swipe controls cho mobile
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', (e) => {
    if (e.target === canvas) e.preventDefault();
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, {passive: false});

document.addEventListener('touchend', (e) => {
    let touchEndX = e.changedTouches[0].screenX;
    let touchEndY = e.changedTouches[0].screenY;
    handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
}, {passive: false});

function handleSwipe(startX, startY, endX, endY) {
    const diffX = endX - startX;
    const diffY = endY - startY;
    
    if (Math.abs(diffX) < 30 && Math.abs(diffY) < 30) return;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0) changeDirection(1, 0); 
        else changeDirection(-1, 0); 
    } else {
        if (diffY > 0) changeDirection(0, 1); 
        else changeDirection(0, -1); 
    }
}

drawGame();