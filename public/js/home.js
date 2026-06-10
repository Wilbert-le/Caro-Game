/**
 * home.js — Frontend: Trang chủ CARO
 * Xử lý modal chọn chế độ chơi, navigation, UX
 */

(function () {
  'use strict';

  /* ── Helpers ──────────────────────────────────────────────── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /**
   * Mở một modal overlay
   * @param {string} id - ID của .modal-overlay
   */
  function openModal(id) {
    const overlay = $(id);
    if (!overlay) return;
    overlay.classList.add('active');
    // Focus vào input đầu tiên nếu có
    const firstInput = overlay.querySelector('input');
    if (firstInput) setTimeout(() => firstInput.focus(), 80);
  }

  /**
   * Đóng một modal overlay
   * @param {string} id
   */
  function closeModal(id) {
    const overlay = $(id);
    if (overlay) overlay.classList.remove('active');
  }

  /**
   * Đóng tất cả modal khi click ra ngoài
   */
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.remove('active');
    }
  }

  /* ── Menu buttons ─────────────────────────────────────────── */
  const btn2Players = $('#btn-2players');
  const btnVsAI     = $('#btn-vsai');
  const btnHelp     = $('#btn-help');

  if (btn2Players) {
    btn2Players.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('#modal-local');
    });
  }

  if (btnVsAI) {
    btnVsAI.addEventListener('click', (e) => {
      e.preventDefault();
      openSetup();
    });
  }

  if (btnHelp) {
    btnHelp.addEventListener('click', () => openModal('#modal-help'));
  }

  /* ── Modal: 2 Players ─────────────────────────────────────── */
  const modalLocal = $('#modal-local');

  if (modalLocal) {
    modalLocal.addEventListener('click', handleOverlayClick);

    $('#modal-local-cancel').addEventListener('click', () => {
      closeModal('#modal-local');
    });

    $('#modal-local-start').addEventListener('click', () => {
      const p1 = ($('#input-p1').value.trim()) || 'Player 1';
      const p2 = ($('#input-p2').value.trim()) || 'Player 2';
      // Chuyển sang trang game local
      window.location.href = `/game/local?p1=${encodeURIComponent(p1)}&p2=${encodeURIComponent(p2)}`;
    });

    // Bấm Enter trên input cũng start game
    modalLocal.querySelectorAll('input').forEach((input) => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('#modal-local-start').click();
      });
    });
  }

  /* ── Setup Screen: vs AI ──────────────────────────────────── */
  const setupScreen      = $('#setup-ai');
  let selectedDifficulty = 'easy';
  let selectedOrder      = 'first';

  function openSetup() {
    setupScreen.classList.add('active');
    setupScreen.setAttribute('aria-hidden', 'false');
    setupScreen.scrollTop = 0;
  }

  function closeSetup() {
    setupScreen.classList.remove('active');
    setupScreen.setAttribute('aria-hidden', 'true');
  }

  function setDiff(level) {
    selectedDifficulty = level;
    setupScreen.querySelectorAll('.diff-card').forEach(c => {
      const active = c.dataset.level === level;
      c.classList.toggle('active', active);
      c.setAttribute('aria-pressed', String(active));
    });
  }

  function setOrder(order) {
    selectedOrder = order;
    setupScreen.querySelectorAll('.order-card').forEach(c => {
      const active = c.dataset.order === order;
      c.classList.toggle('active', active);
      c.setAttribute('aria-pressed', String(active));
    });
  }

  if (setupScreen) {
    // Set defaults
    setDiff('easy');
    setOrder('first');

    setupScreen.querySelectorAll('.diff-card').forEach(card => {
      card.addEventListener('click', () => setDiff(card.dataset.level));
    });

    setupScreen.querySelectorAll('.order-card').forEach(card => {
      card.addEventListener('click', () => setOrder(card.dataset.order));
    });

    $('#setup-ai-back').addEventListener('click', closeSetup);

    $('#setup-ai-start').addEventListener('click', () => {
      const aiFirst = selectedOrder === 'second' ? '1' : '0';
      window.location.href = `/game/ai?difficulty=${selectedDifficulty}&aiFirst=${aiFirst}`;
    });
  }

  /* ── Modal: vs AI (replaced by setup screen) ─────────────── */

  /* ── Modal: Help ──────────────────────────────────────────── */
  const modalHelp = $('#modal-help');

  if (modalHelp) {
    modalHelp.addEventListener('click', handleOverlayClick);

    $('#modal-help-close').addEventListener('click', () => {
      closeModal('#modal-help');
    });
  }

  /* ── Keyboard: Escape đóng modal ──────────────────────────── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.modal-overlay.active').forEach((overlay) => {
        overlay.classList.remove('active');
      });
    }
  });

  /* ── Dots hover animation ─────────────────────────────────── */
  const dots = $$('.dot');
  dots.forEach((dot, i) => {
    dot.style.transition = `transform 0.3s ease ${i * 50}ms, opacity 0.3s ease`;
    dot.addEventListener('mouseenter', () => {
      dot.style.transform = 'translateY(-4px) scale(1.2)';
    });
    dot.addEventListener('mouseleave', () => {
      dot.style.transform = '';
    });
  });

})();