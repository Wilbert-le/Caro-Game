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
      openModal('#modal-ai');
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

  /* ── Modal: vs AI ─────────────────────────────────────────── */
  const modalAI = $('#modal-ai');
  let selectedDifficulty = 'easy';

  if (modalAI) {
    modalAI.addEventListener('click', handleOverlayClick);

    // Difficulty buttons
    $$('.diff-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.diff-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDifficulty = btn.dataset.level;
      });
    });

    $('#modal-ai-cancel').addEventListener('click', () => {
      closeModal('#modal-ai');
    });

    $('#modal-ai-start').addEventListener('click', () => {
      const p1 = ($('#input-ai-p1').value.trim()) || 'Player';
      window.location.href = `/game/ai?p1=${encodeURIComponent(p1)}&difficulty=${selectedDifficulty}`;
    });

    $('#input-ai-p1').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#modal-ai-start').click();
    });
  }

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