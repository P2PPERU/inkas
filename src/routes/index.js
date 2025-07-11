const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes'); // Descomentar
const agentRoutes = require('./agent.routes');
const affiliateRoutes = require('./affiliate.routes');
// const newsRoutes = require('./news.routes');
// const rankingRoutes = require('./ranking.routes');
// const rouletteRoutes = require('./roulette.routes');
// const bonusRoutes = require('./bonus.routes');

// Rutas públicas
router.use('/auth', authRoutes);

// Rutas protegidas
router.use('/users', userRoutes); // Descomentar
router.use('/agents', agentRoutes);
router.use('/affiliate', affiliateRoutes);
// router.use('/news', newsRoutes);
// router.use('/rankings', rankingRoutes);
// router.use('/roulette', rouletteRoutes);
// router.use('/bonus', bonusRoutes);

// Ruta de salud
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString() 
  });
});

module.exports = router;