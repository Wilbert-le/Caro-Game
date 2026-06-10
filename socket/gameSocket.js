/**
 * gameSocket.js — Backend: Socket.io game logic
 * Xử lý các sự kiện real-time (hiện tại dùng cho tính năng future)
 * Game local & AI hiện chạy hoàn toàn ở frontend
 */

module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });

    // TODO: Thêm logic multiplayer online ở đây khi cần
    // socket.on('join-room', ...)
    // socket.on('make-move', ...)
  });
};