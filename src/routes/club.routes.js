const express = require('express');
const router = express.Router();
const clubController = require('../controllers/club.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/roleCheck');

// === RUTAS PÚBLICAS ===
router.get('/', clubController.getPublicClubs);
router.get('/search', clubController.searchClubs);
router.get('/:id', clubController.getPublicClubById);

// === RUTAS DE ADMINISTRADOR ===
router.use(protect, isAdmin);

router.get('/admin/all', clubController.getAllClubs);
router.post('/admin', clubController.createClub);
router.get('/admin/:id', clubController.getClubById);
router.put('/admin/:id', clubController.updateClub);
router.put('/admin/:id/status', clubController.updateClubStatus);
router.delete('/admin/:id', clubController.deleteClub);
router.get('/admin/stats', clubController.getClubStats);

module.exports = router;