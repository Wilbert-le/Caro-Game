/**
 * audio.js — Quản lý nhạc nền + sound effect đặt quân
 * Dùng chung cho cả trang chủ (index.ejs) và trang game (game.ejs)
 * Trạng thái mute được lưu trong localStorage để giữ nguyên giữa các trang
 * Music và Sound Effect được điều khiển độc lập nhau
 */

(function () {
  'use strict';

  const STORAGE_KEY_MUSIC = 'caro_music_muted';
  const STORAGE_KEY_SFX   = 'caro_sfx_muted';

  // ── Tạo các đối tượng audio (chỉ tạo 1 lần) ─────────────────
  const bgm = new Audio('/sounds/bgm.mp3');
  bgm.loop   = true;
  bgm.volume = 0.25;

  const placeSound = new Audio('/sounds/place.mp3');
  placeSound.volume = 0.6;

  // ── Trạng thái mute riêng cho từng loại ──────────────────────
  function isMusicMuted() {
    return localStorage.getItem(STORAGE_KEY_MUSIC) === '1';
  }

  function isSfxMuted() {
    return localStorage.getItem(STORAGE_KEY_SFX) === '1';
  }

  // ── Áp dụng trạng thái lên audio + icon button ───────────────
  function applyMusicState() {
    const muted = isMusicMuted();
    bgm.muted   = muted;

    // Nếu đang phát mà bị mute → dừng hẳn; nếu unmute → phát lại
    if (muted) {
      bgm.pause();
    } else {
      bgm.play().catch(() => {});
    }

    document.querySelectorAll('.btn-sound-toggle--music').forEach((btn) => {
      btn.classList.toggle('muted', muted);
    });
  }

  function applySfxState() {
    const muted       = isSfxMuted();
    placeSound.muted  = muted;

    document.querySelectorAll('.btn-sound-toggle--volume').forEach((btn) => {
      btn.classList.toggle('muted', muted);
    });
  }

  function setMusicMuted(muted) {
    localStorage.setItem(STORAGE_KEY_MUSIC, muted ? '1' : '0');
    applyMusicState();
  }

  function setSfxMuted(muted) {
    localStorage.setItem(STORAGE_KEY_SFX, muted ? '1' : '0');
    applySfxState();
  }

  // ── Phát nhạc nền ─────────────────────────────────────────────
  // Thử phát ngay khi load (trình duyệt cho phép nếu đã có interaction trước đó).
  // Nếu bị chặn autoplay, lắng nghe interaction đầu tiên rồi thử lại.
  function tryPlayBGM() {
    if (isMusicMuted()) return;
    if (!bgm.paused)    return;
    bgm.play().catch(() => {
      // Trình duyệt chặn autoplay — đăng ký lại khi có tương tác
      registerAutoplayFallback();
    });
  }

  function registerAutoplayFallback() {
    const start = () => {
      if (!isMusicMuted()) bgm.play().catch(() => {});
      document.removeEventListener('click',      start);
      document.removeEventListener('keydown',    start);
      document.removeEventListener('touchstart', start);
    };
    document.addEventListener('click',      start);
    document.addEventListener('keydown',    start);
    document.addEventListener('touchstart', start);
  }

  // ── Phát sound đặt quân ──────────────────────────────────────
  function playPlaceSound() {
    if (isSfxMuted()) return;
    placeSound.currentTime = 0;
    placeSound.play().catch(() => {});
  }

  // ── Setup toggle buttons ──────────────────────────────────────
  function initToggleButtons() {
    // Nút nhạc nền
    document.querySelectorAll('.btn-sound-toggle--music').forEach((btn) => {
      btn.addEventListener('click', () => {
        setMusicMuted(!isMusicMuted());
      });
    });

    // Nút hiệu ứng âm thanh
    document.querySelectorAll('.btn-sound-toggle--volume').forEach((btn) => {
      btn.addEventListener('click', () => {
        setSfxMuted(!isSfxMuted());
      });
    });
  }

  // ── Init ─────────────────────────────────────────────────────
  applyMusicState();   // Áp dụng trạng thái lưu cho nhạc
  applySfxState();     // Áp dụng trạng thái lưu cho SFX
  initToggleButtons();
  tryPlayBGM();        // Phát nhạc ngay (nếu đã có interaction trước đó)

  // Expose ra ngoài cho game.js dùng
  window.CaroAudio = {
    playPlaceSound,
    isMuted:       isSfxMuted,      // backward-compat alias
    isMusicMuted,
    isSfxMuted,
    setMuted:      setSfxMuted,     // backward-compat alias
    setMusicMuted,
    setSfxMuted,
  };

})();