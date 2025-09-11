// routes/roulette.routes.js
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
    .isLength({ min: 4, max: 20 })
    .withMessage('Código debe tener entre 4 y 20 caracteres')
    .toUpperCase(),
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
    .trim()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  body('prize_type')
    .trim()
    .notEmpty()
    .withMessage('Tipo de premio requerido')
    .isLength({ min: 3, max: 50 })
    .withMessage('El tipo debe tener entre 3 y 50 caracteres'),
  body('prize_behavior')
    .isIn(['instant_cash', 'bonus', 'manual', 'custom'])
    .withMessage('Comportamiento de premio inválido'),
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
  body('custom_config')
    .optional()
    .isObject()
    .withMessage('Configuración personalizada debe ser un objeto'),
  body('min_deposit_required')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El depósito mínimo debe ser positivo'),
  handleValidationErrors
];

const validateProbabilityAdjustment = [
  body('probabilities')
    .isArray({ min: 1 })
    .withMessage('Se requiere un array de probabilidades'),
  body('probabilities.*.prize_id')
    .isUUID()
    .withMessage('ID de premio inválido'),
  body('probabilities.*.probability')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Probabilidad debe estar entre 0 y 100'),
  handleValidationErrors
];

const validateBatchValidation = [
  body('userIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Se requiere un array de IDs de usuario (máximo 100)'),
  body('userIds.*')
    .isUUID()
    .withMessage('IDs de usuario inválidos'),
  handleValidationErrors
];

const validateUserValidation = [
  param('userId')
    .isUUID()
    .withMessage('ID de usuario inválido'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Las notas no pueden exceder 500 caracteres'),
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

const validateStatsQuery = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de inicio inválida'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de fin inválida')
    .custom((value, { req }) => {
      if (req.query.startDate && value) {
        return new Date(value) >= new Date(req.query.startDate);
      }
      return true;
    })
    .withMessage('La fecha de fin debe ser posterior a la fecha de inicio'),
  handleValidationErrors
];

const validateCodeQuery = [
  query('status')
    .optional()
    .isIn(['all', 'active', 'used', 'expired'])
    .withMessage('Estado inválido'),
  ...validatePagination
];

const validatePrizeId = [
  param('id')
    .isUUID()
    .withMessage('ID de premio inválido'),
  handleValidationErrors
];

// ==================== RUTAS PÚBLICAS (SIN AUTENTICACIÓN) ====================

// Obtener premios - PÚBLICO para todos (usuarios autenticados y no autenticados)
router.get('/prizes', rouletteController.getPrizes);

// ==================== RUTAS PROTEGIDAS (REQUIEREN AUTENTICACIÓN) ====================

router.use(protect); // Desde aquí todas las rutas requieren autenticación

// Obtener estado de giros del usuario
router.get('/my-status', rouletteController.getMySpinStatus);

// Ejecutar giro de ruleta
router.post('/spin', rouletteController.spin);

// Obtener historial de giros
router.get('/my-history', validatePagination, rouletteController.getMySpinHistory);

// Validar y usar código de ruleta
router.post('/validate-code', validateCode, rouletteController.validateCode);

// ==================== RUTAS DE AGENTE/ADMIN ====================

// Crear códigos de ruleta (Agentes y Admin)
router.post('/codes', isAgent, validateCreateCode, rouletteController.createCode);

// Listar códigos de ruleta
router.get('/codes', isAgent, validateCodeQuery, rouletteController.getCodes);

// ==================== RUTAS SOLO ADMIN ====================

// Obtener configuración completa de la ruleta
router.get('/config', isAdmin, rouletteController.getRouletteConfig);

// Crear premio de ruleta
router.post('/prizes', isAdmin, validatePrize, rouletteController.createPrize);

// Reordenar posiciones de premios
router.put('/prizes/reorder', isAdmin, rouletteController.reorderPrizes);

// Clonar premio existente
router.post('/prizes/:id/clone', isAdmin, validatePrizeId, rouletteController.clonePrize);

// Actualización masiva de premios
router.put('/prizes/bulk-update', isAdmin, rouletteController.bulkUpdatePrizes);

// Activar/Desactivar múltiples premios
router.put('/prizes/toggle-status', isAdmin, rouletteController.togglePrizesStatus);

// Ajustar probabilidades de todos los premios
router.put('/prizes/adjust-probabilities', isAdmin, validateProbabilityAdjustment, rouletteController.adjustProbabilities);

// Actualizar premio
router.put('/prizes/:id', isAdmin, validatePrizeId, validatePrize, rouletteController.updatePrize);

// Eliminar premio (desactivar)
router.delete('/prizes/:id', isAdmin, validatePrizeId, rouletteController.deletePrize);

// Restablecer premios por defecto
router.post('/reset-defaults', isAdmin, rouletteController.resetToDefaultPrizes);

// Previsualizar configuración de ruleta
router.get('/preview', isAdmin, rouletteController.previewRoulette);

// Exportar configuración de ruleta
router.get('/config/export', isAdmin, rouletteController.exportConfig);

// Importar configuración de ruleta
router.post('/config/import', isAdmin, rouletteController.importConfig);

// Obtener usuarios pendientes de validación
router.get('/pending-validations', isAdmin, rouletteController.getPendingValidations);

// Validar usuario para giro real
router.put('/validate/:userId', isAdmin, validateUserValidation, rouletteController.validateUserSpin);

// Validación en lote
router.post('/validate-batch', isAdmin, validateBatchValidation, rouletteController.validateBatch);

// Obtener estadísticas de la ruleta
router.get('/stats', isAdmin, validateStatsQuery, rouletteController.getStats);

// ==================== MIDDLEWARE DE MANEJO DE ERRORES ====================

router.use((error, req, res, next) => {
  if (error.name === 'SequelizeUniqueConstraintError') {
    if (error.errors[0].path === 'position') {
      return res.status(400).json({
        success: false,
        message: 'La posición ya está ocupada por otro premio'
      });
    }
    if (error.errors[0].path === 'code') {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un código con ese valor'
      });
    }
  }
  
  if (error.message && error.message.includes('No hay premios configurados')) {
    return res.status(400).json({
      success: false,
      message: 'No hay premios configurados en la ruleta. Configure premios antes de girar.'
    });
  }
  
  next(error);
});

module.exports = router;