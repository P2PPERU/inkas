// src/routes/ranking.routes.js
const express = require('express');
const router = express.Router();
const rankingController = require('../controllers/ranking.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/roleCheck');
const { uploadExcel } = require('../config/multer');

// Rutas públicas
router.get('/', rankingController.getRankings);

// Rutas protegidas (admin)
router.use(protect, isAdmin);
router.put('/player/:playerId', rankingController.updateRanking);
router.post('/import', uploadExcel.single('file'), rankingController.importFromExcel);

module.exports = router;