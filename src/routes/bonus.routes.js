const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const bonusController = require('../controllers/bonus.controller');
const { protect } = require('../middlewares/auth.middleware');
const { isAgent, isAdmin } = require('../middlewares/roleCheck');
const { handleValidationErrors } = require('../middlewares/validation.middleware');

// Validaciones
const validateBonus = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Nombre requerido')
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre debe tener entre 3 y 100 caracteres'),
  body('type')
    .isIn(['welcome', 'deposit', 'referral', 'achievement', 'custom'])
    .withMessage('Tipo de bonus inválido'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('El monto debe ser un número positivo'),
  body('assignedTo')
    .isUUID()
    .withMessage('ID de usuario inválido'),
  body('percentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('El porcentaje debe estar entre 0 y 100'),
  body('minDeposit')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El depósito mínimo debe ser positivo'),
  body('maxBonus')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El bonus máximo debe ser positivo'),
  body('validUntil')
    .optional()
    .isISO8601()
    .withMessage('Fecha de expiración inválida'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  handleValidationErrors
];

const validateStatusUpdate = [
  body('status')
    .isIn(['pending', 'active', 'claimed', 'expired'])
    .withMessage('Estado inválido'),
  handleValidationErrors
];

const validateStatsQuery = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de inicio inválida'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de fin inválida'),
  handleValidationErrors
];

// === RUTAS PÚBLICAS (requieren autenticación) ===
router.use(protect);

// Clientes pueden ver y reclamar sus bonificaciones
router.get('/my-bonuses', bonusController.getUserBonuses);
router.post('/claim/:bonusId', bonusController.claimBonus);

// === RUTAS DE AGENTES ===
// Agentes/Admin pueden crear bonificaciones y ver las de sus clientes
router.use(isAgent); // A partir de aquí se requiere rol agent o admin

router.post('/', validateBonus, bonusController.createBonus);
router.get('/user/:userId', bonusController.getUserBonuses);

// === RUTAS DE ADMINISTRADOR ===
router.use(isAdmin); // A partir de aquí solo admin

// Gestión completa de bonificaciones
router.get('/', bonusController.getAllBonuses);
router.put('/:bonusId/status', validateStatusUpdate, bonusController.updateBonusStatus);
router.delete('/:bonusId', bonusController.deleteBonus);

// Estadísticas
router.get('/stats', validateStatsQuery, bonusController.getBonusStats);

module.exports = router;