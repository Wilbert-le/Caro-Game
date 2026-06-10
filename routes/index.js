const express = require('express');
const router = express.Router();

// Home page
router.get('/', (req, res) => {
  res.render('index', { title: 'CARO' });
});

// Game page - 2 players local
router.get('/game/local', (req, res) => {
  res.render('game', {
    title: 'CARO - 2 Players',
    mode: 'local',
    player1: req.query.p1 || 'Player 1',
    player2: req.query.p2 || 'Player 2'
  });
});

// Game page - vs AI
router.get('/game/ai', (req, res) => {
  res.render('game', {
    title: 'CARO - vs AI',
    mode: 'ai',
    player1: req.query.p1 || 'Player',
    player2: 'AI',
    difficulty: req.query.difficulty || 'easy',
    aiFirst: req.query.aiFirst === '1'
  });
});

module.exports = router;