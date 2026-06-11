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
    }, 50);
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
     AI ENGINE v3 — Zobrist + TT + Incremental eval + ID + α-β
     ══════════════════════════════════════════════════════════ */

  const SCORE = {
    WIN:    100_000_000,
    LIVE4:   10_000_000,
    DEAD4:      500_000,
    LIVE3:      100_000,
    DEAD3:        5_000,
    LIVE2:        1_000,
    DEAD2:          100,
  };

  const DIFFICULTY_CFG = {
    easy:   { timeBudget: 150,  maxDepth: 3, candidates: 8,  randomRate: 0.35 },
    medium: { timeBudget: 400,  maxDepth: 5, candidates: 15, randomRate: 0.0  },
    hard:   { timeBudget: 800,  maxDepth: 6, candidates: 20, randomRate: 0.0  },
  };

  let _searchDeadline = 0;
  let _searchAborted  = false;

  /* ── Zobrist Hashing ──────────────────────────────────────── */
  // Mỗi (row, col, player) có một số 32-bit ngẫu nhiên
  // Hash bàn cờ = XOR của tất cả ô có quân → O(1) update khi đặt/bỏ quân
  const ZOB = (() => {
    const t = new Int32Array(BOARD_SIZE * BOARD_SIZE * 3);
    for (let i = 0; i < t.length; i++) t[i] = (Math.random() * 0x100000000) | 0;
    return (r, c, p) => t[(r * BOARD_SIZE + c) * 3 + p];
  })();
  let _zobHash = 0;

  /* ── Transposition Table ──────────────────────────────────── */
  // Lưu kết quả minimax đã tính cho từng trạng thái bàn cờ
  // Tránh tính lại cùng một position qua nhiều nhánh khác nhau
  const TT_SIZE  = 1 << 20; // ~1M entries
  const TT_MASK  = TT_SIZE - 1;
  const ttDepth  = new Int8Array(TT_SIZE);
  const ttFlag   = new Int8Array(TT_SIZE);   // 0=exact, 1=lower, 2=upper
  const ttScore  = new Float64Array(TT_SIZE);
  const ttHash   = new Int32Array(TT_SIZE);
  const TT_EXACT = 0, TT_LOWER = 1, TT_UPPER = 2;

  function ttClear() {
    ttHash.fill(0);
  }

  function ttLookup(hash, depth, alpha, beta) {
    const idx = hash & TT_MASK;
    if (ttHash[idx] !== hash || ttDepth[idx] < depth) return null;
    const s = ttScore[idx];
    const f = ttFlag[idx];
    if (f === TT_EXACT)              return s;
    if (f === TT_LOWER && s >= beta) return s;
    if (f === TT_UPPER && s <= alpha) return s;
    return null;
  }

  function ttStore(hash, depth, score, flag) {
    const idx = hash & TT_MASK;
    // Chỉ ghi đè nếu depth mới >= depth cũ (ưu tiên kết quả sâu hơn)
    if (ttHash[idx] !== 0 && ttDepth[idx] > depth) return;
    ttHash[idx]  = hash;
    ttDepth[idx] = depth;
    ttScore[idx] = score;
    ttFlag[idx]  = flag;
  }

  /* ── Incremental Board Evaluation ────────────────────────────
     Thay vì quét toàn bàn (O(n²)), chỉ tính lại các đường đi qua
     ô vừa thay đổi — giảm ~90% số lần gọi analyzeWindow          */
  let _boardScore = 0; // điểm hiện tại của bàn cờ (AI - Human*1.1)

  function scoreAround(r, c) {
    // Tính điểm đóng góp của ô (r,c) vào tổng điểm bàn cờ
    const DIRS = [[0,1],[1,0],[1,1],[1,-1]];
    let ai = 0, hu = 0;
    for (const [dr, dc] of DIRS) {
      const seg = extractSegment(r, c, dr, dc, 5);
      ai += analyzeWindow(seg, AI_PLAYER);
      hu += analyzeWindow(seg, HUMAN_PLAYER);
    }
    return ai - hu * 1.1;
  }

  // Trích đoạn 11 ô trên một đường đi qua (r,c) — đủ để tính pattern 5 liên tiếp
  function extractSegment(r, c, dr, dc, radius) {
    const seg = [];
    for (let i = -radius; i <= radius; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) seg.push(-1); // wall
      else seg.push(board[nr][nc]);
    }
    return seg;
  }

  function evaluateBoard() {
    // Dùng điểm incremental đã được cập nhật liên tục
    return _boardScore;
  }

  // Gọi trước và sau mỗi board[r][c] = p / = 0 trong minimax
  function applyMove(r, c, p) {
    const before = scoreAround(r, c);
    _zobHash ^= ZOB(r, c, board[r][c]); // XOR out giá trị cũ
    board[r][c] = p;
    _zobHash ^= ZOB(r, c, p);           // XOR in giá trị mới
    const after  = scoreAround(r, c);
    _boardScore += after - before;
  }

  function undoMove(r, c, prev) {
    const before = scoreAround(r, c);
    _zobHash ^= ZOB(r, c, board[r][c]);
    board[r][c] = prev;
    _zobHash ^= ZOB(r, c, prev);
    const after  = scoreAround(r, c);
    _boardScore += after - before;
  }

  /* ── analyzeWindow (dùng cho cả incremental và quickScore) ─── */
  function analyzeWindow(cells, p) {
    let score = 0;
    const opp = p === 1 ? 2 : 1;
    for (let i = 0; i <= cells.length - 5; i++) {
      const w5 = cells.slice(i, i + 5);
      if (w5.includes(opp) || w5.includes(-1)) continue;
      const count = w5.filter(x => x === p).length;
      const empty = 5 - count;
      const openLeft  = i > 0 && cells[i - 1] === 0;
      const openRight = i + 5 < cells.length && cells[i + 5] === 0;
      const opens = (openLeft ? 1 : 0) + (openRight ? 1 : 0);
      if (count === 5) { score += SCORE.WIN; continue; }
      if (count === 4 && empty === 1) score += opens >= 1 ? SCORE.LIVE4 : SCORE.DEAD4;
      else if (count === 3 && empty === 2) score += opens === 2 ? SCORE.LIVE3 : SCORE.DEAD3;
      else if (count === 2 && empty === 3) score += opens === 2 ? SCORE.LIVE2 : SCORE.DEAD2;
    }
    return score;
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

  /** Chấm điểm nhanh một ô (để sắp xếp candidates) */
  function quickScoreCell(r, c) {
    // Điểm nếu AI đặt vào ô này + điểm nếu người đặt (phòng thủ)
    const DIRS = [[0,1],[1,0],[1,1],[1,-1]];
    let s = 0;
    applyMove(r, c, AI_PLAYER);
    for (const [dr, dc] of DIRS) s += analyzeWindow(extractSegment(r, c, dr, dc, 5), AI_PLAYER);
    undoMove(r, c, 0);
    applyMove(r, c, HUMAN_PLAYER);
    for (const [dr, dc] of DIRS) s += analyzeWindow(extractSegment(r, c, dr, dc, 5), HUMAN_PLAYER) * 1.1;
    undoMove(r, c, 0);
    return s;
  }

  /** Danh sách ô ứng viên xung quanh quân đã đặt */
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
    // Sắp xếp theo điểm để alpha-beta cắt tỉa sớm hơn
    result.sort((a, b) => quickScoreCell(b.r, b.c) - quickScoreCell(a.r, a.c));
    return result.slice(0, maxCount || 20);
  }

  /* ── Minimax + Alpha-Beta + Transposition Table ───────────── */
  function minimax(depth, isMaximizing, alpha, beta, maxCandidates) {
    if (Date.now() >= _searchDeadline) { _searchAborted = true; return _boardScore; }

    // Transposition Table lookup
    const ttResult = ttLookup(_zobHash, depth, alpha, beta);
    if (ttResult !== null) return ttResult;

    const win = checkFullBoardWin();
    if (win === AI_PLAYER)    return SCORE.WIN + depth;
    if (win === HUMAN_PLAYER) return -(SCORE.WIN + depth);
    if (depth === 0) return _boardScore;

    const candidates = getCandidates(maxCandidates);
    if (candidates.length === 0) return _boardScore;

    const origAlpha = alpha;
    let bestScore = isMaximizing ? -Infinity : Infinity;

    if (isMaximizing) {
      for (const { r, c } of candidates) {
        applyMove(r, c, AI_PLAYER);
        const score = minimax(depth - 1, false, alpha, beta, maxCandidates);
        undoMove(r, c, 0);
        if (_searchAborted) return bestScore === -Infinity ? score : bestScore;
        if (score > bestScore) bestScore = score;
        if (score > alpha) alpha = score;
        if (beta <= alpha) break;
      }
    } else {
      for (const { r, c } of candidates) {
        applyMove(r, c, HUMAN_PLAYER);
        const score = minimax(depth - 1, true, alpha, beta, maxCandidates);
        undoMove(r, c, 0);
        if (_searchAborted) return bestScore === Infinity ? score : bestScore;
        if (score < bestScore) bestScore = score;
        if (score < beta) beta = score;
        if (beta <= alpha) break;
      }
    }

    // Lưu vào Transposition Table
    if (!_searchAborted) {
      const flag = bestScore <= origAlpha ? TT_UPPER
                 : bestScore >= beta      ? TT_LOWER
                 : TT_EXACT;
      ttStore(_zobHash, depth, bestScore, flag);
    }

    return bestScore;
  }

  /**
   * Lấy nước đi tốt nhất — Iterative Deepening + Time Budget + TT
   */
  function getBestMove() {
    const dcfg = DIFFICULTY_CFG[cfg.difficulty] || DIFFICULTY_CFG.medium;

    if (dcfg.randomRate > 0 && Math.random() < dcfg.randomRate) {
      const pool = getCandidates(dcfg.candidates);
      return pool[Math.floor(Math.random() * Math.min(pool.length, 4))];
    }

    const candidates = getCandidates(dcfg.candidates);
    if (candidates.length === 0) return { r: 7, c: 7 };

    // Thắng ngay?
    for (const { r, c } of candidates) {
      applyMove(r, c, AI_PLAYER);
      const win = checkFullBoardWin();
      undoMove(r, c, 0);
      if (win === AI_PLAYER) return { r, c };
    }

    // Chặn đối thủ thắng ngay?
    for (const { r, c } of candidates) {
      applyMove(r, c, HUMAN_PLAYER);
      const win = checkFullBoardWin();
      undoMove(r, c, 0);
      if (win === HUMAN_PLAYER) return { r, c };
    }

    // Iterative Deepening
    ttClear();
    _searchDeadline = Date.now() + dcfg.timeBudget;
    let bestMove = candidates[0];

    for (let depth = 1; depth <= dcfg.maxDepth; depth++) {
      _searchAborted = false;
      let iterBest  = null;
      let iterScore = -Infinity;

      for (const { r, c } of candidates) {
        if (Date.now() >= _searchDeadline) { _searchAborted = true; break; }
        applyMove(r, c, AI_PLAYER);
        const score = minimax(depth - 1, false, -Infinity, Infinity, dcfg.candidates);
        undoMove(r, c, 0);
        if (score > iterScore) { iterScore = score; iterBest = { r, c }; }
      }

      if (!_searchAborted && iterBest) bestMove = iterBest;
      if (_searchAborted) break;
    }

    return bestMove;
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