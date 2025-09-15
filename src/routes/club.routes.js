const express = require('express');
const router = express.Router();
const clubController = require('../controllers/club.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/roleCheck');
const { uploadClubLogo } = require('../config/multer');

// === RUTAS PÚBLICAS ===
router.get('/', clubController.getPublicClubs);
router.get('/featured', clubController.getFeaturedClubs);
router.get('/search', clubController.searchClubs);

// === RUTAS DE ADMINISTRADOR ===
router.get('/admin', protect, isAdmin, clubController.getAllClubs);
router.get('/admin/stats', protect, isAdmin, clubController.getClubStats);

// Crear club con soporte para logo y banner
router.post('/admin', protect, isAdmin, uploadClubLogo.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), clubController.createClub);

router.get('/admin/:id', protect, isAdmin, clubController.getClubById);

// Actualizar club con soporte para logo y banner
router.put('/admin/:id', protect, isAdmin, uploadClubLogo.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), clubController.updateClub);

router.put('/admin/:id/status', protect, isAdmin, clubController.updateClubStatus);
router.delete('/admin/:id', protect, isAdmin, clubController.deleteClub);

// ESTA DEBE IR AL FINAL
router.get('/:id', clubController.getPublicClubById);

module.exports = router;