// src/routes/rankingGroup.routes.js
const express = require('express');
const router = express.Router();
const rankingGroupController = require('../controllers/rankingGroup.controller');
const rankingController = require('../controllers/ranking.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/roleCheck');
const { uploadExcel } = require('../config/multer');

// === RUTAS PÚBLICAS ===

router.get('/', rankingGroupController.getRankingGroups);

router.get('/:groupId', rankingGroupController.getRankingGroup);

router.get('/:groupId/rankings', rankingController.getRankingsByGroup);

router.get('/:groupId/rankings/player/:playerId', rankingController.getPlayerRankingInGroup);

// === RUTAS PROTEGIDAS (ADMIN) ===
router.use(protect, isAdmin);

router.get('/admin/all', rankingGroupController.getAllRankingGroups);

router.post('/', rankingGroupController.createRankingGroup);

router.put('/:groupId', rankingGroupController.updateRankingGroup);

router.delete('/:groupId', rankingGroupController.deleteRankingGroup);

router.delete('/:groupId/force-delete', rankingGroupController.forceDeleteRankingGroup);

router.post('/:groupId/duplicate', rankingGroupController.duplicateRankingGroup);

// === RUTAS PARA GESTIÓN DE RANKINGS DENTRO DE GRUPOS ===

router.get('/:groupId/rankings/all', rankingController.getAllRankingsInGroup);

router.put('/:groupId/rankings/player/:playerId', rankingController.updateRankingInGroup);

router.post('/:groupId/rankings/import', uploadExcel.single('file'), rankingController.importToGroup);

router.put('/:groupId/rankings/:rankingId/visibility', rankingController.toggleVisibility);

router.delete('/:groupId/rankings/:rankingId', rankingController.deleteRanking);

router.post('/:groupId/recalculate', rankingController.recalculateGroupPositions);

router.get('/:groupId/stats', rankingController.getGroupStats);

module.exports = router;