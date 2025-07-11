const express = require('express');
const router = express.Router();
const rankingController = require('../controllers/ranking.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/roleCheck');
const { uploadExcel } = require('../config/multer');

// === RUTAS PÚBLICAS ===
// Ver rankings (no requiere autenticación)
router.get('/', rankingController.getRankings);

// Ver ranking de un jugador específico (puede ser UUID o nombre externo)
router.get('/player/:playerId', rankingController.getPlayerRanking);

// === RUTAS PROTEGIDAS (ADMIN) ===
router.use(protect, isAdmin);

// Gestión de rankings
router.get('/all', rankingController.getAllRankings);
router.put('/player/:playerId', rankingController.updateRanking);
router.post('/import', uploadExcel.single('file'), rankingController.importFromExcel);
router.put('/:rankingId/visibility', rankingController.toggleVisibility);
router.delete('/:rankingId', rankingController.deleteRanking);

// Estadísticas y utilidades
router.get('/stats', rankingController.getRankingStats);
router.post('/recalculate', rankingController.recalculatePositions);
router.get('/template', rankingController.downloadTemplate);

// Búsqueda de jugadores (útil para autocompletado en admin)
router.get('/search/players', rankingController.searchPlayers);

module.exports = router;