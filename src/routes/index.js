const express = require('express');
const router = express.Router();

// Importar todas las rutas
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const agentRoutes = require('./agent.routes');
const affiliateRoutes = require('./affiliate.routes');
const bonusRoutes = require('./bonus.routes');
const newsRoutes = require('./news.routes');
const rouletteRoutes = require('./roulette.routes');
const rankingRoutes = require('./ranking.routes');
const rankingGroupRoutes = require('./rankingGroup.routes');
const clubRoutes = require('./club.routes');

// Rutas públicas
router.use('/auth', authRoutes);
router.use('/clubs', clubRoutes);
router.use('/ranking-groups', rankingGroupRoutes); // Rutas públicas de grupos de ranking

// Rutas protegidas
router.use('/users', userRoutes);
router.use('/agents', agentRoutes);
router.use('/affiliate', affiliateRoutes);
router.use('/bonus', bonusRoutes);
router.use('/news', newsRoutes);
router.use('/roulette', rouletteRoutes);
router.use('/rankings', rankingRoutes); // Rutas legacy/admin de rankings

// Ruta de salud
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString() 
  });
});

module.exports = router;