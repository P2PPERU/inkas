// src/routes/roulette.routes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const rouletteController = require('../controllers/roulette.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAgent } = require('../middlewares/roleCheck');

// Validaciones
const validateCode = [
  body('prize.type')
    .isIn(['bonus', 'points', 'free_spin', 'discount'])
    .withMessage('Tipo de premio inválido'),
  body('prize.value')
    .isNumeric()
    .withMessage('El valor del premio debe ser numérico'),
  body('expiresIn')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La expiración debe ser en días (mínimo 1)')
];

// Rutas protegidas
router.use(protect);

// Clientes pueden usar códigos
router.post('/use', 
  body('code').notEmpty().withMessage('Código requerido'),
  rouletteController.useCode
);

// Agentes/Admin pueden crear y gestionar códigos
router.use(isAgent);
router.post('/create', validateCode, rouletteController.createCode);
router.get('/codes', rouletteController.getCodes);

module.exports = router;