const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');
const rouletteController = require('../controllers/roulette.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAgent, isAdmin } = require('../middlewares/roleCheck');
const { handleValidationErrors } = require('../middlewares/validation.middleware');

// ==================== VALIDACIONES ====================

const validateCode = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Código requerido')
    .isLength({ min: 8, max: 20 })
    .withMessage('Código inválido'),
  handleValidationErrors
];

const validateCreateCode = [
  body('description')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('La descripción no puede exceder 255 caracteres'),
  body('expiresIn')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('La expiración debe ser entre 1 y 365 días'),
  body('quantity')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La cantidad debe ser entre 1 y 100'),
  handleValidationErrors
];

const validatePrize = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Nombre del premio requerido')
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre debe tener entre 3 y 100 caracteres'),
  body('description')
    .optional()
    .trim(),
  body('prize_type')
    .isIn(['tournament_ticket', 'deposit_bonus', 'rakeback', 'cash_game_money', 'merchandise'])
    .withMessage('Tipo de premio inválido'),
  body('prize_value')
    .isFloat({ min: 0 })
    .withMessage('El valor debe ser un número positivo'),
  body('probability')
    .isFloat({ min: 0, max: 100 })
    .withMessage('La probabilidad debe estar entre 0 y 100'),
  body('position')
    .isInt({ min: 1, max: 20 })
    .withMessage('La posición debe estar entre 1 y 20'),
  body('color')
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color debe ser un código hexadecimal válido'),
  body('prize_metadata')
    .optional()
    .isObject()
    .withMessage('Metadata debe ser un objeto'),
  handleValidationErrors
];

const validateBatchValidation = [
  body('userIds')
    .isArray({ min: 1 })
    .withMessage('Se requiere un array de IDs de usuario'),
  body('userIds.*')
    .isUUID()
    .withMessage('IDs de usuario inválidos'),
  handleValidationErrors
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página debe ser un número positivo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Límite debe estar entre 1 y 50'),
  handleValidationErrors
];

const validateUserId = [
  param('userId')
    .isUUID()
    .withMessage('ID de usuario inválido'),
  handleValidationErrors
];

const validatePrizeId = [
  param('id')
    .isUUID()
    .withMessage('ID de premio inválido'),
  handleValidationErrors
];

// ==================== RUTAS PÚBLICAS (REQUIEREN AUTH) ====================

router.use(protect); // Todas las rutas requieren autenticación

// Estado y giros del usuario
router.get('/my-status', rouletteController.getMySpinStatus);
router.post('/spin', rouletteController.spin);
router.get('/my-history', validatePagination, rouletteController.getMySpinHistory);
router.post('/validate-code', validateCode, rouletteController.validateCode);

// ==================== RUTAS DE AGENTE/ADMIN ====================

// Gestión de códigos (agents pueden crear códigos)
router.use('/codes', isAgent); // Agents y admin pueden gestionar códigos
router.post('/codes', validateCreateCode, rouletteController.createCode);
router.get('/codes', validatePagination, rouletteController.getCodes);

// ==================== RUTAS SOLO ADMIN ====================

router.use(isAdmin); // A partir de aquí solo admin

// Gestión de premios
router.get('/prizes', rouletteController.getPrizes);
router.post('/prizes', validatePrize, rouletteController.createPrize);
router.put('/prizes/:id', validatePrizeId, validatePrize, rouletteController.updatePrize);
router.delete('/prizes/:id', validatePrizeId, rouletteController.deletePrize);

// Validación de usuarios
router.get('/pending-validations', rouletteController.getPendingValidations);
router.put('/validate/:userId', validateUserId, rouletteController.validateUserSpin);
router.post('/validate-batch', validateBatchValidation, rouletteController.validateBatch);

// Estadísticas
router.get('/stats', rouletteController.getStats);

// Middleware de manejo de errores específico para ruleta
router.use((error, req, res, next) => {
  if (error.name === 'SequelizeUniqueConstraintError') {
    if (error.errors[0].path === 'position') {
      return res.status(400).json({
        success: false,
        message: 'La posición ya está ocupada por otro premio'
      });
    }
  }
  next(error);
});

module.exports = router;