// src/routes/bonus.routes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const bonusController = require('../controllers/bonus.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAgent } = require('../middlewares/roleCheck');

// Validaciones
const validateBonus = [
  body('name').notEmpty().withMessage('Nombre requerido'),
  body('type')
    .isIn(['welcome', 'deposit', 'referral', 'achievement', 'custom'])
    .withMessage('Tipo de bonus inválido'),
  body('amount')
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Monto debe ser un número positivo'),
  body('assignedTo')
    .isMongoId()
    .withMessage('ID de usuario inválido')
];

// Rutas protegidas
router.use(protect);

// Clientes pueden ver y reclamar sus bonificaciones
router.get('/my-bonuses', bonusController.getUserBonuses);
router.post('/claim/:bonusId', bonusController.claimBonus);

// Agentes/Admin pueden crear bonificaciones
router.use(isAgent);
router.post('/', validateBonus, bonusController.createBonus);
router.get('/user/:userId', bonusController.getUserBonuses);

module.exports = router;