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
  const aiFirst = req.query.aiFirst === '1';
  const humanName = req.query.p1 || 'Player';
  res.render('game', {
    title: 'CARO - vs AI',
    mode: 'ai',
    // Khi AI đi trước (aiFirst=true): AI=player1(đen), người=player2(trắng)
    // Khi người đi trước (aiFirst=false): người=player1(đen), AI=player2(trắng)
    player1: aiFirst ? 'AI' : humanName,
    player2: aiFirst ? humanName : 'AI',
    difficulty: req.query.difficulty || 'easy',
    aiFirst: aiFirst
  });
});

module.exports = router;