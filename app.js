const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
const indexRouter = require('./routes/index');
app.use('/', indexRouter);

// Socket.io game logic
const gameSocket = require('./socket/gameSocket');
gameSocket(io);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Caro Game running at http://localhost:${PORT}`);
});