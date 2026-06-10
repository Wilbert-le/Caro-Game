/**
 * game.js — Frontend: Logic game Caro
 * Xử lý: render bàn cờ, đặt quân, kiểm tra thắng, AI (minimax)
 */

(function () {
  'use strict';

  /* ── Config ───────────────────────────────────────────────── */
  const BOARD_SIZE  = 15;   // 15x15
  const CELL        = 44;   // px mỗi ô (sẽ scale theo container)
  const PADDING     = 28;   // padding quanh lưới
  const DOT_RADIUS  = 4;    // chấm góc trên bàn cờ

  // Màu sắc canvas
  const COLOR = {
    bg:           '#171430',
    bgGrad1:      '#1e1a3d',
    bgGrad2:      '#120f28',
    grid:         'rgba(99,102,241,0.28)',
    gridBold:     'rgba(99,102,241,0.50)',
    dotMark:      'rgba(168,85,247,0.85)',
    black:        { fill: '#0d0d1a', shine: '#5a5a7a', shadow: 'rgba(0,0,0,0.7)' },
    white:        { fill: '#e8e4f0', shine: '#ffffff', shadow: 'rgba(0,0,0,0.35)' },
    winHighlight: 'rgba(155,109,255,0.35)',
    winStroke:    '#9b6dff',
    hover:        'rgba(155,109,255,0.15)',
    lastMove:     'rgba(91,140,255,0.5)',
  };

  const cfg = window.GAME_CONFIG;

  /* ── Player assignment ────────────────────────────────────── */
  // aiFirst=true: AI đi trước → AI=1 (đen), người=2 (trắng)
  // aiFirst=false: người đi trước → người=1 (đen), AI=2 (trắng)
  const AI_PLAYER    = (cfg.mode === 'ai' && cfg.aiFirst) ? 1 : 2;
  const HUMAN_PLAYER = (cfg.mode === 'ai' && cfg.aiFirst) ? 2 : 1;

  let board        = [];   // 0=empty, 1=black, 2=white
  let currentPlayer = 1;   // 1=black, 2=white
  let moveCount    = 0;
  let gameOver     = false;
  let scores       = { 1: 0, 2: 0 };
  let winCells     = [];   // 5 ô thắng
  let lastMove     = null; // { r, c }
  let hoverCell    = null; // { r, c }
  let aiThinking   = false;

  /* ── Canvas setup ─────────────────────────────────────────── */
  const canvas    = document.getElementById('game-canvas');
  const ctx       = canvas.getContext('2d');
  const container = canvas.parentElement;

  let scale = 1;
  let boardPx = 0; // kích thước bàn cờ tính bằng px (đã scale)

  function resizeCanvas() {
    // Lấy kích thước thực của container (trừ border)
    const cw = container.clientWidth  - 2;
    const ch = container.clientHeight - 2;

    // Bàn cờ luôn là hình vuông, fit vào cạnh nhỏ hơn
    const size = Math.min(cw, ch);

    // naturalSize: kích thước lý tưởng khi CELL = 44px
    const naturalSize = CELL * (BOARD_SIZE - 1) + PADDING * 2;
    scale = size / naturalSize;

    boardPx = size;

    // Device pixel ratio để canvas sắc nét trên màn hình retina
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = boardPx * dpr;
    canvas.height = boardPx * dpr;
    canvas.style.width  = boardPx + 'px';
    canvas.style.height = boardPx + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    draw();
  }

  /* ── Init ─────────────────────────────────────────────────── */
  function initBoard() {
    board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
    // AI đi trước → bắt đầu với lượt của AI
    currentPlayer = (cfg.mode === 'ai' && cfg.aiFirst) ? AI_PLAYER : 1;
    moveCount     = 0;
    gameOver      = false;
    winCells      = [];
    lastMove      = null;
    hoverCell     = null;
    aiThinking    = false;
    updateUI();
    draw();
    if (cfg.mode === 'ai' && cfg.aiFirst) {
      setTimeout(triggerAI, 600);
    }
  }

  /* ── Coordinate helpers ───────────────────────────────────── */
  /** Tọa độ pixel của giao điểm (r, c) */
  function cellToXY(r, c) {
    const offset = PADDING * scale;
    const step   = CELL * scale;
    return { x: offset + c * step, y: offset + r * step };
  }

  /** Tọa độ pixel → giao điểm gần nhất */
  function xyToCell(px, py) {
    const offset = PADDING * scale;
    const step   = CELL * scale;
    const c = Math.round((px - offset) / step);
    const r = Math.round((py - offset) / step);
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return null;
    // Chỉ nhận nếu click đủ gần giao điểm
    const { x, y } = cellToXY(r, c);
    if (Math.abs(px - x) > CELL * scale * 0.45) return null;
    if (Math.abs(py - y) > CELL * scale * 0.45) return null;
    return { r, c };
  }

  /* ── Draw ─────────────────────────────────────────────────── */
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawGrid();
    drawDotMarks();
    drawHover();
    drawPieces();
    drawWinHighlight();
    drawLastMove();
  }

  function drawBackground() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const radius = 18 * scale;

    // Rounded rect clip
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(w - radius, 0);
    ctx.quadraticCurveTo(w, 0, w, radius);
    ctx.lineTo(w, h - radius);
    ctx.quadraticCurveTo(w, h, w - radius, h);
    ctx.lineTo(radius, h);
    ctx.quadraticCurveTo(0, h, 0, h - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.clip();

    // Radial gradient background like Figma
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, w * 0.72);
    grad.addColorStop(0, '#2a2560');
    grad.addColorStop(0.5, '#1a1645');
    grad.addColorStop(1, '#0e0c22');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawGrid() {
    ctx.lineWidth = 1 * scale;
    for (let i = 0; i < BOARD_SIZE; i++) {
      // Nét đậm hơn cho đường giữa (index 7)
      ctx.strokeStyle = (i === 7) ? COLOR.gridBold : COLOR.grid;

      // Hàng ngang
      const { x: x0, y: y0 } = cellToXY(i, 0);
      const { x: x1 }        = cellToXY(i, BOARD_SIZE - 1);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y0);
      ctx.stroke();

      // Cột dọc
      const { x: cx0, y: cy0 } = cellToXY(0, i);
      const { y: cy1 }          = cellToXY(BOARD_SIZE - 1, i);
      ctx.strokeStyle = (i === 7) ? COLOR.gridBold : COLOR.grid;
      ctx.beginPath();
      ctx.moveTo(cx0, cy0);
      ctx.lineTo(cx0, cy1);
      ctx.stroke();
    }
  }

  /** 5 chấm định vị: 4 góc (3,3) và tâm (7,7) — chuẩn Gomoku */
  function drawDotMarks() {
    const marks = [[3,3],[3,11],[7,7],[11,3],[11,11]];
    ctx.fillStyle = COLOR.dotMark;
    marks.forEach(([r, c]) => {
      const { x, y } = cellToXY(r, c);
      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS * scale, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawHover() {
    if (!hoverCell || gameOver || aiThinking) return;
    if (board[hoverCell.r][hoverCell.c] !== 0) return;
    const { x, y } = cellToXY(hoverCell.r, hoverCell.c);
    const r = CELL * scale * 0.42;
    ctx.fillStyle = COLOR.hover;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPieces() {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === 0) continue;
        drawStone(r, c, board[r][c]);
      }
    }
  }

  function drawStone(r, c, player) {
    const { x, y } = cellToXY(r, c);
    const radius   = CELL * scale * 0.42;
    const col      = player === 1 ? COLOR.black : COLOR.white;

    // Shadow
    ctx.shadowColor   = col.shadow;
    ctx.shadowBlur    = 8 * scale;
    ctx.shadowOffsetY = 2 * scale;

    // Fill
    const grad = ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, radius * 0.05,
      x, y, radius
    );
    grad.addColorStop(0, col.shine);
    grad.addColorStop(1, col.fill);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur  = 0;
    ctx.shadowOffsetY = 0;
  }

  function drawWinHighlight() {
    if (winCells.length === 0) return;

    // Vẽ viền tròn tím sáng quanh từng quân thắng (như Figma)
    winCells.forEach(({ r, c }) => {
      const { x, y } = cellToXY(r, c);
      const radius   = CELL * scale * 0.44;

      // Outer glow
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur  = 14 * scale;
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth   = 2.5 * scale;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 0;
    });
  }

  function drawLastMove() {
    if (!lastMove || winCells.length > 0) return;
    const { x, y } = cellToXY(lastMove.r, lastMove.c);
    const radius   = CELL * scale * 0.16;
    ctx.fillStyle  = COLOR.lastMove;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ── Game logic ───────────────────────────────────────────── */
  function placePiece(r, c) {
    if (gameOver || board[r][c] !== 0) return false;
    board[r][c] = currentPlayer;
    lastMove = { r, c };
    moveCount++;

    const win = checkWin(r, c, currentPlayer);
    if (win) {
      winCells = win;
      gameOver = true;
      scores[currentPlayer]++;
      draw();
      updateUI();
      setTimeout(() => showWinModal(currentPlayer), 500);
      return true;
    }

    if (moveCount === BOARD_SIZE * BOARD_SIZE) {
      gameOver = true;
      draw();
      setTimeout(() => showModal('#modal-draw'), 500);
      return true;
    }

    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateUI();
    draw();
    return true;
  }

  /**
   * Kiểm tra thắng từ ô vừa đặt
   * @returns {Array|null} 5 ô thắng hoặc null
   */
  function checkWin(r, c, player) {
    const directions = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr, dc] of directions) {
      const line = getLine(r, c, dr, dc, player);
      if (line.length >= 5) return line.slice(0, 5);
    }
    return null;
  }

  function getLine(r, c, dr, dc, player) {
    const cells = [{ r, c }];
    // tiến
    for (let i = 1; i < 5; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
      if (board[nr][nc] !== player) break;
      cells.push({ r: nr, c: nc });
    }
    // lùi
    for (let i = 1; i < 5; i++) {
      const nr = r - dr * i, nc = c - dc * i;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
      if (board[nr][nc] !== player) break;
      cells.unshift({ r: nr, c: nc });
    }
    return cells;
  }

  /* ── UI updates ───────────────────────────────────────────── */
  function updateUI() {
    // Move counter
    document.getElementById('move-count').textContent =
      String(moveCount).padStart(3, '0');

    // Scores
    document.getElementById('p1-score').textContent = scores[1];
    document.getElementById('p2-score').textContent = scores[2];

    // Active player
    const p1 = document.getElementById('p1-info');
    const p2 = document.getElementById('p2-info');
    p1.classList.toggle('active', currentPlayer === 1 && !gameOver);
    p2.classList.toggle('active', currentPlayer === 2 && !gameOver);
  }

  /* ── Modals ───────────────────────────────────────────────── */
  function showModal(id) {
    const el = document.querySelector(id);
    if (el) el.classList.add('active');
  }

  function closeModal(id) {
    const el = document.querySelector(id);
    if (el) el.classList.remove('active');
  }

  function showWinModal(player) {
    const stone = document.getElementById('win-stone');
    const title = document.getElementById('win-title');
    const name  = player === 1 ? cfg.player1 : cfg.player2;
    stone.className = 'win-stone ' + (player === 1 ? 'black' : 'white');
    title.textContent = `${name} Wins!`;
    showModal('#modal-win');
  }

  // Play again
  document.getElementById('btn-play-again').addEventListener('click', () => {
    closeModal('#modal-win');
    initBoard();
  });

  document.getElementById('btn-play-again-draw').addEventListener('click', () => {
    closeModal('#modal-draw');
    initBoard();
  });

  // Reset button
  document.getElementById('btn-reset').addEventListener('click', () => {
    scores = { 1: 0, 2: 0 };
    initBoard();
  });

  /* ── Mouse events ─────────────────────────────────────────── */
  function getCanvasPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    // rect.width == boardPx (CSS px), canvas logic cũng boardPx → tỉ lệ 1:1
    return {
      px: clientX - rect.left,
      py: clientY - rect.top
    };
  }

  canvas.addEventListener('mousemove', (e) => {
    if (gameOver || aiThinking || isAITurn()) { hoverCell = null; return; }
    const { px, py } = getCanvasPos(e.clientX, e.clientY);
    const cell = xyToCell(px, py);
    const prev = hoverCell;
    hoverCell = cell;
    if (JSON.stringify(prev) !== JSON.stringify(cell)) draw();
  });

  canvas.addEventListener('mouseleave', () => {
    hoverCell = null;
    draw();
  });

  function isAITurn() {
    if (cfg.mode !== 'ai') return false;
    return currentPlayer === AI_PLAYER;
  }

  canvas.addEventListener('click', (e) => {
    if (gameOver || aiThinking) return;
    if (isAITurn()) return;
    const { px, py } = getCanvasPos(e.clientX, e.clientY);
    const cell = xyToCell(px, py);
    if (!cell) return;
    const placed = placePiece(cell.r, cell.c);
    if (placed && cfg.mode === 'ai' && !gameOver) triggerAI();
  });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (gameOver || aiThinking) return;
    if (isAITurn()) return;
    const touch = e.changedTouches[0];
    const { px, py } = getCanvasPos(touch.clientX, touch.clientY);
    const cell = xyToCell(px, py);
    if (!cell) return;
    const placed = placePiece(cell.r, cell.c);
    if (placed && cfg.mode === 'ai' && !gameOver) triggerAI();
  });

  /* ── AI ───────────────────────────────────────────────────── */
  function triggerAI() {
    if (gameOver) return;
    aiThinking = true;
    showAIThinking(true);
    updateUI();

    // Delay nhỏ để UI render xong rồi mới tính
    setTimeout(() => {
      const move = getBestMove();
      aiThinking = false;
      showAIThinking(false);
      if (move) placePiece(move.r, move.c);
    }, cfg.difficulty === 'easy' ? 300 : cfg.difficulty === 'medium' ? 500 : 800);
  }

  function showAIThinking(show) {
    let el = document.querySelector('.ai-thinking');
    if (!el) {
      el = document.createElement('div');
      el.className = 'ai-thinking';
      el.innerHTML = '<span class="ai-thinking__dot"></span> AI is thinking...';
      document.body.appendChild(el);
    }
    el.classList.toggle('show', show);
  }

  /**
   * Lấy nước đi tốt nhất cho AI
   * Dựa trên heuristic scoring — đủ mạnh cho Easy/Medium/Hard
   */
  function getBestMove() {
    const depth = cfg.difficulty === 'easy' ? 1 : cfg.difficulty === 'medium' ? 2 : 3;
    const candidates = getCandidates();
    if (candidates.length === 0) return { r: 7, c: 7 };

    let best = null;
    let bestScore = -Infinity;

    for (const { r, c } of candidates) {
      board[r][c] = AI_PLAYER;
      const score = minimax(board, depth - 1, false, -Infinity, Infinity);
      board[r][c] = 0;
      if (score > bestScore) {
        bestScore = score;
        best = { r, c };
      }
    }
    return best;
  }

  /** Chỉ xét các ô có quân xung quanh (tối ưu tốc độ) */
  function getCandidates() {
    const visited = new Set();
    const result  = [];
    const radius  = 2;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === 0) continue;
        for (let dr = -radius; dr <= radius; dr++) {
          for (let dc = -radius; dc <= radius; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
            if (board[nr][nc] !== 0) continue;
            const key = nr * BOARD_SIZE + nc;
            if (!visited.has(key)) {
              visited.add(key);
              result.push({ r: nr, c: nc });
            }
          }
        }
      }
    }

    // Nếu bàn cờ trống, đi giữa
    if (result.length === 0) return [{ r: 7, c: 7 }];

    // Sắp xếp theo điểm heuristic để alpha-beta hiệu quả hơn
    result.sort((a, b) => scoreCell(b.r, b.c) - scoreCell(a.r, a.c));
    return result.slice(0, 20); // giới hạn top 20 ứng viên
  }

  function minimax(boardState, depth, isMaximizing, alpha, beta) {
    const winCheck = checkFullBoardWin();
    if (winCheck === AI_PLAYER)    return 100000 + depth;
    if (winCheck === HUMAN_PLAYER) return -100000 - depth;
    if (depth === 0) return evaluateBoard();

    const candidates = getCandidates();
    if (candidates.length === 0) return evaluateBoard();

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const { r, c } of candidates) {
        boardState[r][c] = AI_PLAYER;
        const score = minimax(boardState, depth - 1, false, alpha, beta);
        boardState[r][c] = 0;
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const { r, c } of candidates) {
        boardState[r][c] = HUMAN_PLAYER;
        const score = minimax(boardState, depth - 1, true, alpha, beta);
        boardState[r][c] = 0;
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
      return minScore;
    }
  }

  /** Kiểm tra ai thắng trên toàn bàn (dùng cho minimax) */
  function checkFullBoardWin() {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = board[r][c];
        if (p === 0) continue;
        const dirs = [[0,1],[1,0],[1,1],[1,-1]];
        for (const [dr, dc] of dirs) {
          let count = 1;
          for (let i = 1; i < 5; i++) {
            const nr = r + dr * i, nc = c + dc * i;
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
            if (board[nr][nc] !== p) break;
            count++;
          }
          if (count >= 5) return p;
        }
      }
    }
    return 0;
  }

  /** Đánh giá toàn bàn cờ */
  function evaluateBoard() {
    let score = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] !== 0) {
          const s = scoreCell(r, c);
          score += board[r][c] === AI_PLAYER ? s : -s;
        }
      }
    }
    return score;
  }

  /** Chấm điểm một ô dựa trên chuỗi liên tiếp */
  function scoreCell(r, c) {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    let total = 0;
    const player = board[r][c] || AI_PLAYER; // dùng AI_PLAYER khi tính candidates

    for (const [dr, dc] of dirs) {
      const result = countLine(r, c, dr, dc, player);
      total += lineScore(result.count, result.openEnds);
    }
    return total;
  }

  function countLine(r, c, dr, dc, player) {
    let count = 1;
    let openEnds = 0;

    // tiến
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) {
      count++; nr += dr; nc += dc;
    }
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === 0) openEnds++;

    // lùi
    nr = r - dr; nc = c - dc;
    while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) {
      count++; nr -= dr; nc -= dc;
    }
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === 0) openEnds++;

    return { count, openEnds };
  }

  function lineScore(count, openEnds) {
    if (openEnds === 0 && count < 5) return 0;
    if (count >= 5) return 100000;
    if (count === 4) return openEnds === 2 ? 10000 : 1000;
    if (count === 3) return openEnds === 2 ? 1000  : 100;
    if (count === 2) return openEnds === 2 ? 100   : 10;
    return openEnds === 2 ? 10 : 1;
  }

  /* ── Resize observer ──────────────────────────────────────── */
  const resizeObserver = new ResizeObserver(() => resizeCanvas());
  resizeObserver.observe(container);

  /* ── Names ────────────────────────────────────────────────── */
  document.getElementById('p1-name').textContent = cfg.player1;
  document.getElementById('p2-name').textContent = cfg.player2;

  /* ── Start ────────────────────────────────────────────────── */
  initBoard();
  resizeCanvas();

})();