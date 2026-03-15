const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const overlay = document.getElementById('overlay');
const statusText = document.getElementById('statusText');
const playBtn = document.getElementById('playBtn');

const tileCount = 20;
const tileSize = canvas.width / tileCount; 
const speed = 5; // Đã giảm tốc độ cho chậm lại một xíu (trước là 7)

let snake = [];
let dx = 0; 
let dy = 0;
let nextDx = 0; 
let nextDy = 0;
let appleX = 5; 
let appleY = 5;
let score = 0;
let gameLoop;
let isRunning = false;

// 1. HÀM KHỞI TẠO GAME
function startGame() {
    snake = [
        {x: 10, y: 10}, // Đầu rắn
        {x: 10, y: 11}  // Đuôi rắn (đang nằm dưới đầu)
    ];
    dx = 0; dy = 0;
    nextDx = 0; nextDy = 0;
    score = 0;
    scoreEl.innerText = score;
    isRunning = true;
    
    overlay.classList.add('hidden');
    generateApple();
    
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(updateGame, 1000 / speed);
}

playBtn.addEventListener('click', startGame);

// 2. VÒNG LẶP CHÍNH CỦA GAME
function updateGame() {
    if (!isRunning) return;

    // Cập nhật hướng di chuyển thực tế
    dx = nextDx;
    dy = nextDy;

    // Nếu người chơi chưa bấm phím di chuyển, chỉ vẽ lại màn hình
    if (dx === 0 && dy === 0) {
        drawGame();
        return;
    }

    // Tính toán tọa độ cái "Đầu" mới nếu di chuyển
    const newHead = { x: snake[0].x + dx, y: snake[0].y + dy };

    // -- KIỂM TRA VA CHẠM --
    // Chạm tường 
    if (newHead.x < 0 || newHead.x >= tileCount || newHead.y < 0 || newHead.y >= tileCount) {
        triggerGameOver();
        return; 
    }
    // Cắn vào thân
    for (let i = 0; i < snake.length; i++) {
        if (newHead.x === snake[i].x && newHead.y === snake[i].y) {
            triggerGameOver();
            return;
        }
    }

    // -- NẾU KHÔNG VA CHẠM, CHO RẮN TIẾN TỚI --
    snake.unshift(newHead); // Thêm đầu mới vào mảng

    // Kiểm tra ăn táo
    if (newHead.x === appleX && newHead.y === appleY) {
        score += 10;
        scoreEl.innerText = score;
        generateApple();
    } else {
        snake.pop(); // Nếu không ăn táo, cắt bỏ khúc đuôi cuối cùng
    }

    drawGame();
}

// 3. HÀM VẼ 
function drawGame() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ff3333';
    ctx.shadowBlur = 15; ctx.shadowColor = 'red';
    ctx.fillRect(appleX * tileSize + 1, appleY * tileSize + 1, tileSize - 2, tileSize - 2);
    ctx.shadowBlur = 0;

    for (let i = 0; i < snake.length; i++) {
        let colorVal = 255 - (i * 5); 
        if (colorVal < 50) colorVal = 50;
        
        ctx.fillStyle = i === 0 ? '#4dff4d' : `rgb(0, ${colorVal}, 0)`; 
        
        if (i === 0) { 
            ctx.shadowBlur = 15; ctx.shadowColor = '#4dff4d';
        } else {
            ctx.shadowBlur = 0;
        }
        
        ctx.fillRect(snake[i].x * tileSize + 1, snake[i].y * tileSize + 1, tileSize - 2, tileSize - 2);
    }
    ctx.shadowBlur = 0;
}

// 4. CÁC HÀM PHỤ TRỢ
function triggerGameOver() {
    isRunning = false;
    statusText.innerText = "GAME OVER";
    statusText.style.color = "#ff4d4d";
    playBtn.innerText = "Chơi Lại";
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
    
    // Chống lỗi quay đầu 180 độ khi đang chạy
    if (dx !== 0 && newDx === -dx) return;
    if (dy !== 0 && newDy === -dy) return;
    
    // SỬA BUG: Chống lỗi "tự cắn cổ" khi đang đứng yên chưa bắt đầu
    if (snake.length > 1) {
        if (snake[0].x + newDx === snake[1].x && snake[0].y + newDy === snake[1].y) {
            return; // Nếu phím bấm lao thẳng vào đốt thân thứ 2 thì bỏ qua lệnh này
        }
    }
    
    nextDx = newDx;
    nextDy = newDy;
}

// Bàn phím
document.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W') changeDirection(0, -1);
    if (e.key === 's' || e.key === 'S') changeDirection(0, 1);
    if (e.key === 'a' || e.key === 'A') changeDirection(-1, 0);
    if (e.key === 'd' || e.key === 'D') changeDirection(1, 0);
});

// Nút cảm ứng
document.getElementById('btnUp').addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(0, -1); });
document.getElementById('btnDown').addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(0, 1); });
document.getElementById('btnLeft').addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(-1, 0); });
document.getElementById('btnRight').addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(1, 0); });

document.getElementById('btnUp').addEventListener('mousedown', () => changeDirection(0, -1));
document.getElementById('btnDown').addEventListener('mousedown', () => changeDirection(0, 1));
document.getElementById('btnLeft').addEventListener('mousedown', () => changeDirection(-1, 0));
document.getElementById('btnRight').addEventListener('mousedown', () => changeDirection(1, 0));

drawGame();