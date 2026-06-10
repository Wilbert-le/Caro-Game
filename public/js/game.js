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
  // Đọc aiFirst trực tiếp từ URL để tránh mọi lỗi EJS rendering
  const _urlParams   = new URLSearchParams(window.location.search);
  const _aiFirstRaw  = _urlParams.get('aiFirst');
  const AI_GOES_FIRST = cfg.mode === 'ai' && _aiFirstRaw === '1';

  // AI_GOES_FIRST=true: AI=player1(đen đi trước), người=player2(trắng)
  // AI_GOES_FIRST=false: người=player1(đen đi trước), AI=player2(trắng)
  const AI_PLAYER    = AI_GOES_FIRST ? 1 : 2;
  const HUMAN_PLAYER = AI_GOES_FIRST ? 2 : 1;

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

    // Debug: log để kiểm tra giá trị thực tế
    console.log('[CARO] cfg.aiFirst =', cfg.aiFirst, typeof cfg.aiFirst);
    console.log('[CARO] AI_PLAYER =', AI_PLAYER, '| HUMAN_PLAYER =', HUMAN_PLAYER);

    currentPlayer = 1; // luôn bắt đầu bằng player 1 (đen)
    moveCount     = 0;
    gameOver      = false;
    winCells      = [];
    lastMove      = null;
    hoverCell     = null;
    aiThinking    = false;
    updateUI();
    draw();
    // Nếu AI đi trước (người chọn "Second"), trigger AI ngay lượt 1
    if (cfg.mode === 'ai' && AI_PLAYER === 1) {
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

  /* ══════════════════════════════════════════════════════════
     AI ENGINE v2 — Threat-based heuristic + deeper minimax
     ══════════════════════════════════════════════════════════ */

  // Điểm cho từng pattern (count quân liên tiếp, số đầu mở)
  // Phân biệt rõ "live" (2 đầu mở) vs "dead" (1 đầu mở)
  const SCORE = {
    WIN:        100_000_000,  // 5 liên tiếp
    LIVE4:       10_000_000,  // _XXXX_ — thắng ngay lượt sau, không thể chặn đủ
    DEAD4:          500_000,  // XXXX_ hoặc _XXXX — phải chặn
    LIVE3:          100_000,  // _XXX_ — đe dọa live4
    DEAD3:            5_000,
    LIVE2:            1_000,
    DEAD2:              100,
  };

  // Mức độ khó: depth minimax + số candidates + có random không
  const DIFFICULTY_CFG = {
    easy:   { depth: 2, candidates: 8,  randomRate: 0.35 },
    medium: { depth: 4, candidates: 15, randomRate: 0.0  },
    hard:   { depth: 5, candidates: 20, randomRate: 0.0  },
  };

  /**
   * Phân tích một đoạn thẳng (window) của bàn cờ cho player `p`
   * Trả về score cho đoạn đó
   */
  function analyzeWindow(cells, p) {
    // cells: mảng giá trị board (0, 1, 2) có độ dài >= 5
    // Quét mọi đoạn 6 ô liên tiếp để phát hiện pattern
    let score = 0;
    const opp = p === 1 ? 2 : 1;

    for (let i = 0; i <= cells.length - 5; i++) {
      const w = cells.slice(i, i + 6); // window 6 để kiểm tra đầu mở
      const w5 = w.slice(0, 5);

      // Bỏ qua nếu có quân đối thủ trong 5 ô
      if (w5.includes(opp)) continue;

      const count = w5.filter(x => x === p).length;
      const empty = w5.filter(x => x === 0).length;
      if (count + empty < 5) continue;

      // Kiểm tra đầu mở: ô trước i và ô i+5
      const openLeft  = i > 0 ? cells[i - 1] === 0 : false;
      const openRight = w.length >= 6 ? w[5] === 0 : false;
      const opens = (openLeft ? 1 : 0) + (openRight ? 1 : 0);

      if (count === 5) { score += SCORE.WIN; continue; }
      if (count === 4 && empty === 1) {
        score += opens >= 1 ? SCORE.LIVE4 : SCORE.DEAD4;
      } else if (count === 3 && empty === 2) {
        score += opens === 2 ? SCORE.LIVE3 : SCORE.DEAD3;
      } else if (count === 2 && empty === 3) {
        score += opens === 2 ? SCORE.LIVE2 : SCORE.DEAD2;
      }
    }
    return score;
  }

  /**
   * Đánh giá toàn bàn cờ — tính điểm cho AI_PLAYER trừ HUMAN_PLAYER
   */
  function evaluateBoard() {
    const DIRS = [[0,1],[1,0],[1,1],[1,-1]];
    let aiScore = 0, humanScore = 0;

    for (const [dr, dc] of DIRS) {
      // Lấy tất cả các hàng/cột/đường chéo theo hướng [dr,dc]
      const lines = extractLines(dr, dc);
      for (const line of lines) {
        aiScore    += analyzeWindow(line, AI_PLAYER);
        humanScore += analyzeWindow(line, HUMAN_PLAYER);
      }
    }

    // AI phòng thủ mạnh hơn tấn công 1 chút (hệ số 1.1)
    return aiScore - humanScore * 1.1;
  }

  /** Trích tất cả đường thẳng theo hướng [dr, dc] */
  function extractLines(dr, dc) {
    const lines = [];
    const visited = new Set();

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        // Tìm điểm bắt đầu của đường (không có ô trước đó theo hướng này)
        const pr = r - dr, pc = c - dc;
        if (pr >= 0 && pr < BOARD_SIZE && pc >= 0 && pc < BOARD_SIZE) continue;

        const line = [];
        let nr = r, nc = c;
        while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          line.push(board[nr][nc]);
          nr += dr; nc += dc;
        }
        if (line.length >= 5) lines.push(line);
      }
    }
    return lines;
  }

  /** Kiểm tra ai thắng trên toàn bàn */
  function checkFullBoardWin() {
    const DIRS = [[0,1],[1,0],[1,1],[1,-1]];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = board[r][c];
        if (p === 0) continue;
        for (const [dr, dc] of DIRS) {
          let cnt = 1;
          for (let i = 1; i < 5; i++) {
            const nr = r + dr * i, nc = c + dc * i;
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
            if (board[nr][nc] !== p) break;
            cnt++;
          }
          if (cnt >= 5) return p;
        }
      }
    }
    return 0;
  }

  /**
   * Tính điểm nhanh cho một ô trống (dùng để sắp xếp candidates)
   * Kết hợp cả tấn công (AI) và phòng thủ (HUMAN)
   */
  function quickScoreCell(r, c) {
    const DIRS = [[0,1],[1,0],[1,1],[1,-1]];
    let s = 0;
    board[r][c] = AI_PLAYER;
    for (const [dr, dc] of DIRS) s += scoreLine1D(r, c, dr, dc, AI_PLAYER);
    board[r][c] = HUMAN_PLAYER;
    for (const [dr, dc] of DIRS) s += scoreLine1D(r, c, dr, dc, HUMAN_PLAYER) * 1.1;
    board[r][c] = 0;
    return s;
  }

  function scoreLine1D(r, c, dr, dc, p) {
    const opp = p === 1 ? 2 : 1;
    let count = 1, openEnds = 0;
    // tiến
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === p) {
      count++; nr += dr; nc += dc;
    }
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === 0) openEnds++;
    // lùi
    nr = r - dr; nc = c - dc;
    while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === p) {
      count++; nr -= dr; nc -= dc;
    }
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === 0) openEnds++;

    if (count >= 5) return SCORE.WIN;
    if (count === 4) return openEnds === 2 ? SCORE.LIVE4 : SCORE.DEAD4;
    if (count === 3) return openEnds === 2 ? SCORE.LIVE3 : SCORE.DEAD3;
    if (count === 2) return openEnds === 2 ? SCORE.LIVE2 : SCORE.DEAD2;
    return openEnds > 0 ? 10 : 0;
  }

  /**
   * Lấy danh sách ô ứng viên (xung quanh quân đã đặt)
   * Sắp xếp theo điểm giảm dần để alpha-beta cắt tỉa tốt hơn
   */
  function getCandidates(maxCount) {
    const visited = new Set();
    const result  = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === 0) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
            if (board[nr][nc] !== 0) continue;
            const key = nr * BOARD_SIZE + nc;
            if (!visited.has(key)) { visited.add(key); result.push({ r: nr, c: nc }); }
          }
        }
      }
    }

    if (result.length === 0) return [{ r: 7, c: 7 }];

    // Sắp xếp để alpha-beta cắt tỉa hiệu quả hơn
    result.sort((a, b) => quickScoreCell(b.r, b.c) - quickScoreCell(a.r, a.c));
    return result.slice(0, maxCount || 20);
  }

  /* ── Minimax với Alpha-Beta pruning ───────────────────────── */
  function minimax(depth, isMaximizing, alpha, beta, maxCandidates) {
    const win = checkFullBoardWin();
    if (win === AI_PLAYER)    return SCORE.WIN + depth;
    if (win === HUMAN_PLAYER) return -(SCORE.WIN + depth);
    if (depth === 0) return evaluateBoard();

    const candidates = getCandidates(maxCandidates);
    if (candidates.length === 0) return evaluateBoard();

    if (isMaximizing) {
      let best = -Infinity;
      for (const { r, c } of candidates) {
        board[r][c] = AI_PLAYER;
        const score = minimax(depth - 1, false, alpha, beta, maxCandidates);
        board[r][c] = 0;
        best = Math.max(best, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (const { r, c } of candidates) {
        board[r][c] = HUMAN_PLAYER;
        const score = minimax(depth - 1, true, alpha, beta, maxCandidates);
        board[r][c] = 0;
        best = Math.min(best, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
      return best;
    }
  }

  /**
   * Lấy nước đi tốt nhất cho AI
   * 1. Ưu tiên thắng ngay lập tức
   * 2. Chặn đối thủ thắng ngay
   * 3. Minimax với độ sâu theo difficulty
   */
  function getBestMove() {
    const dcfg = DIFFICULTY_CFG[cfg.difficulty] || DIFFICULTY_CFG.medium;

    // Easy: đôi khi đi ngẫu nhiên (mô phỏng sai lầm)
    if (dcfg.randomRate > 0 && Math.random() < dcfg.randomRate) {
      const pool = getCandidates(dcfg.candidates);
      return pool[Math.floor(Math.random() * Math.min(pool.length, 4))];
    }

    const candidates = getCandidates(dcfg.candidates);
    if (candidates.length === 0) return { r: 7, c: 7 };

    // Bước 1: AI thắng ngay không?
    for (const { r, c } of candidates) {
      board[r][c] = AI_PLAYER;
      const win = checkFullBoardWin();
      board[r][c] = 0;
      if (win === AI_PLAYER) return { r, c };
    }

    // Bước 2: Chặn đối thủ thắng ngay không?
    for (const { r, c } of candidates) {
      board[r][c] = HUMAN_PLAYER;
      const win = checkFullBoardWin();
      board[r][c] = 0;
      if (win === HUMAN_PLAYER) return { r, c };
    }

    // Bước 3: Minimax
    let best = null;
    let bestScore = -Infinity;

    for (const { r, c } of candidates) {
      board[r][c] = AI_PLAYER;
      const score = minimax(dcfg.depth - 1, false, -Infinity, Infinity, dcfg.candidates);
      board[r][c] = 0;
      if (score > bestScore) { bestScore = score; best = { r, c }; }
    }
    return best;
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