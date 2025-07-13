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

// ==================== RUTAS PÚBLICAS (REQUIEREN AUTH) ====================

router.use(protect); // Todas las rutas requieren autenticación

/**
 * @swagger
 * /api/roulette/my-status:
 *   get:
 *     summary: Obtener estado de giros del usuario
 *     tags: [Roulette]
 *     security:
 *       - bearerAuth: []
 *     description: Obtiene el estado actual de giros del usuario autenticado, incluyendo disponibilidad de giros demo y reales
 *     responses:
 *       200:
 *         description: Estado obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: object
 *                   properties:
 *                     has_demo_available:
 *                       type: boolean
 *                       description: Si tiene giro demo disponible
 *                     has_real_available:
 *                       type: boolean
 *                       description: Si tiene giro real disponible
 *                     demo_spin_done:
 *                       type: boolean
 *                       description: Si ya usó el giro demo
 *                     real_spin_done:
 *                       type: boolean
 *                       description: Si ya usó el giro real
 *                     is_validated:
 *                       type: boolean
 *                       description: Si está validado para giro real
 *                     total_spins:
 *                       type: integer
 *                       description: Total de giros realizados
 *                     available_bonus_spins:
 *                       type: integer
 *                       description: Giros de bonus disponibles
 *                     demo_prize:
 *                       type: object
 *                       nullable: true
 *                       description: Premio obtenido en giro demo
 *                       properties:
 *                         name:
 *                           type: string
 *                         prize_type:
 *                           type: string
 *                         prize_value:
 *                           type: number
 *                         color:
 *                           type: string
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get('/my-status', rouletteController.getMySpinStatus);

/**
 * @swagger
 * /api/roulette/spin:
 *   post:
 *     summary: Ejecutar giro de ruleta
 *     tags: [Roulette]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Ejecuta un giro de ruleta. El tipo de giro se determina automáticamente:
 *       1. Demo: Si no ha usado el giro demo
 *       2. Welcome Real: Si está validado y tiene giro real disponible
 *       3. Bonus: Si tiene bonus de giro activo
 *     responses:
 *       200:
 *         description: Giro ejecutado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 spin:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     type:
 *                       type: string
 *                       enum: [demo, welcome_real, code, bonus]
 *                     is_real:
 *                       type: boolean
 *                     prize:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         type:
 *                           type: string
 *                         value:
 *                           type: number
 *                         color:
 *                           type: string
 *                         position:
 *                           type: integer
 *                 message:
 *                   type: string
 *                   description: Mensaje descriptivo del resultado
 *       400:
 *         description: No tienes giros disponibles
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error al ejecutar giro
 */
router.post('/spin', rouletteController.spin);

/**
 * @swagger
 * /api/roulette/my-history:
 *   get:
 *     summary: Obtener historial de giros
 *     tags: [Roulette]
 *     security:
 *       - bearerAuth: []
 *     description: Lista el historial de giros del usuario autenticado
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Giros por página
 *     responses:
 *       200:
 *         description: Historial obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 spins:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       spin_type:
 *                         type: string
 *                         enum: [demo, welcome_real, code, bonus]
 *                       is_real_prize:
 *                         type: boolean
 *                       spin_date:
 *                         type: string
 *                         format: date-time
 *                       prize_status:
 *                         type: string
 *                         enum: [pending_validation, applied, rejected, demo]
 *                       prize:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           prize_type:
 *                             type: string
 *                           prize_value:
 *                             type: number
 *                           color:
 *                             type: string
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get('/my-history', validatePagination, rouletteController.getMySpinHistory);

/**
 * @swagger
 * /api/roulette/validate-code:
 *   post:
 *     summary: Validar y usar código de ruleta
 *     tags: [Roulette]
 *     security:
 *       - bearerAuth: []
 *     description: Valida un código de ruleta y otorga un giro bonus si es válido
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 minLength: 4
 *                 maxLength: 20
 *                 description: Código a validar (se convierte a mayúsculas)
 *           example:
 *             code: "ABC123"
 *     responses:
 *       200:
 *         description: Código válido, giro otorgado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "¡Código válido! Tienes un nuevo giro disponible."
 *       400:
 *         description: Código expirado o datos inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Código inválido o ya utilizado
 *       500:
 *         description: Error del servidor
 */
router.post('/validate-code', validateCode, rouletteController.validateCode);

// ==================== RUTAS DE AGENTE/ADMIN ====================

/**
 * @swagger
 * /api/roulette/codes:
 *   post:
 *     summary: Crear códigos de ruleta
 *     tags: [Roulette, Agent]
 *     security:
 *       - bearerAuth: []
 *     description: Crea uno o varios códigos de ruleta que otorgan giros (Agentes y Admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 maxLength: 255
 *                 description: Descripción del código
 *               expiresIn:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *                 description: Días hasta expiración
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 1
 *                 description: Cantidad de códigos a crear
 *           example:
 *             description: "Códigos promocionales Enero 2025"
 *             expiresIn: 30
 *             quantity: 10
 *     responses:
 *       201:
 *         description: Códigos creados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 codes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       code:
 *                         type: string
 *                         description: Código generado automáticamente
 *                       description:
 *                         type: string
 *                       grants_spin:
 *                         type: boolean
 *                         default: true
 *                       created_by:
 *                         type: string
 *                         format: uuid
 *                       expires_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       is_active:
 *                         type: boolean
 *                         default: true
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo agentes y administradores
 *       500:
 *         description: Error del servidor
 */
router.post('/codes', isAgent, validateCreateCode, rouletteController.createCode);

/**
 * @swagger
 * /api/roulette/codes:
 *   get:
 *     summary: Listar códigos de ruleta
 *     tags: [Roulette, Agent]
 *     security:
 *       - bearerAuth: []
 *     description: Lista los códigos de ruleta. Agentes solo ven sus propios códigos, Admin ve todos.
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, used, expired]
 *           default: all
 *         description: Filtrar por estado
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Códigos por página
 *     responses:
 *       200:
 *         description: Lista de códigos obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 codes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       code:
 *                         type: string
 *                       description:
 *                         type: string
 *                       grants_spin:
 *                         type: boolean
 *                       is_active:
 *                         type: boolean
 *                       expires_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       used_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       creator:
 *                         type: object
 *                         properties:
 *                           username:
 *                             type: string
 *                       usedBy:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           username:
 *                             type: string
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo agentes y administradores
 *       500:
 *         description: Error del servidor
 */
router.get('/codes', isAgent, validateCodeQuery, rouletteController.getCodes);

// ==================== RUTAS SOLO ADMIN ====================

/**
 * @swagger
 * /api/roulette/prizes:
 *   get:
 *     summary: Obtener configuración de premios
 *     tags: [Roulette, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Obtiene todos los premios configurados en la ruleta y valida las probabilidades (Solo Admin)
 *     responses:
 *       200:
 *         description: Premios obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 prizes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       prize_type:
 *                         type: string
 *                       prize_behavior:
 *                         type: string
 *                         enum: [instant_cash, bonus, manual, custom]
 *                       prize_value:
 *                         type: number
 *                       probability:
 *                         type: number
 *                         description: Probabilidad en porcentaje
 *                       color:
 *                         type: string
 *                         pattern: '^#[0-9A-F]{6}$'
 *                       position:
 *                         type: integer
 *                         minimum: 1
 *                         maximum: 20
 *                       is_active:
 *                         type: boolean
 *                       custom_config:
 *                         type: object
 *                         description: Configuración personalizada para comportamiento custom
 *                       creator:
 *                         type: object
 *                         properties:
 *                           username:
 *                             type: string
 *                 probability_validation:
 *                   type: object
 *                   properties:
 *                     isValid:
 *                       type: boolean
 *                       description: Si las probabilidades suman 100%
 *                     total:
 *                       type: number
 *                       description: Suma total de probabilidades
 *                     missing:
 *                       type: number
 *                       description: Diferencia para llegar a 100%
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error del servidor
 */
router.get('/prizes', isAdmin, rouletteController.getPrizes);

/**
 * @swagger
 * /api/roulette/prizes:
 *   post:
 *     summary: Crear premio de ruleta
 *     tags: [Roulette, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Crea un nuevo premio para la ruleta (Solo Admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - prize_type
 *               - prize_behavior
 *               - prize_value
 *               - probability
 *               - position
 *               - color
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 description: Nombre del premio
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Descripción del premio
 *               prize_type:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 description: Tipo de premio (ej. cash, bonus, points)
 *               prize_behavior:
 *                 type: string
 *                 enum: [instant_cash, bonus, manual, custom]
 *                 description: |
 *                   Comportamiento del premio:
 *                   - instant_cash: Se agrega directo al balance
 *                   - bonus: Crea una bonificación
 *                   - manual: Requiere procesamiento manual
 *                   - custom: Comportamiento personalizado
 *               prize_value:
 *                 type: number
 *                 minimum: 0
 *                 description: Valor monetario del premio
 *               probability:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Probabilidad de ganar (%)
 *               position:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *                 description: Posición en la ruleta
 *               color:
 *                 type: string
 *                 pattern: '^#[0-9A-F]{6}$'
 *                 example: "#FF5733"
 *                 description: Color hexadecimal del premio
 *               custom_config:
 *                 type: object
 *                 description: Configuración para comportamiento custom
 *                 properties:
 *                   auto_apply:
 *                     type: boolean
 *                   bonus_name:
 *                     type: string
 *                   bonus_type:
 *                     type: string
 *                   percentage:
 *                     type: number
 *                   min_deposit:
 *                     type: number
 *                   validity_days:
 *                     type: integer
 *               min_deposit_required:
 *                 type: number
 *                 minimum: 0
 *                 description: Depósito mínimo requerido
 *           examples:
 *             cashPrize:
 *               summary: Premio en efectivo
 *               value:
 *                 name: "$100 Cash"
 *                 description: "Gana $100 directo a tu balance"
 *                 prize_type: "cash"
 *                 prize_behavior: "instant_cash"
 *                 prize_value: 100
 *                 probability: 5
 *                 position: 1
 *                 color: "#00FF00"
 *             bonusPrize:
 *               summary: Premio de bonus
 *               value:
 *                 name: "50% Bonus"
 *                 description: "50% de bonus en tu próximo depósito"
 *                 prize_type: "bonus"
 *                 prize_behavior: "bonus"
 *                 prize_value: 500
 *                 probability: 15
 *                 position: 2
 *                 color: "#FFA500"
 *                 custom_config:
 *                   bonus_name: "Bonus Ruleta 50%"
 *                   bonus_type: "deposit"
 *                   percentage: 50
 *                   min_deposit: 20
 *                   validity_days: 7
 *     responses:
 *       201:
 *         description: Premio creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 prize:
 *                   type: object
 *       400:
 *         description: Datos inválidos o posición ocupada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error del servidor
 */
router.post('/prizes', isAdmin, validatePrize, rouletteController.createPrize);

/**
 * @swagger
 * /api/roulette/prizes/adjust-probabilities:
 *   put:
 *     summary: Ajustar probabilidades de premios
 *     tags: [Roulette, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Ajusta las probabilidades de todos los premios activos. Deben sumar 100%. (Solo Admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - probabilities
 *             properties:
 *               probabilities:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - prize_id
 *                     - probability
 *                   properties:
 *                     prize_id:
 *                       type: string
 *                       format: uuid
 *                     probability:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *           example:
 *             probabilities:
 *               - prize_id: "123e4567-e89b-12d3-a456-426614174000"
 *                 probability: 30
 *               - prize_id: "123e4567-e89b-12d3-a456-426614174001"
 *                 probability: 50
 *               - prize_id: "123e4567-e89b-12d3-a456-426614174002"
 *                 probability: 20
 *     responses:
 *       200:
 *         description: Probabilidades actualizadas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 prizes:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Las probabilidades deben sumar 100% o datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error del servidor
 */
router.put('/prizes/adjust-probabilities', isAdmin, validateProbabilityAdjustment, rouletteController.adjustProbabilities);

/**
 * @swagger
 * /api/roulette/prizes/{id}:
 *   put:
 *     summary: Actualizar premio
 *     tags: [Roulette, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Actualiza un premio existente (Solo Admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del premio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               prize_type:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               prize_behavior:
 *                 type: string
 *                 enum: [instant_cash, bonus, manual, custom]
 *               prize_value:
 *                 type: number
 *                 minimum: 0
 *               probability:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *               position:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *               color:
 *                 type: string
 *                 pattern: '^#[0-9A-F]{6}$'
 *               custom_config:
 *                 type: object
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Premio actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 prize:
 *                   type: object
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Premio no encontrado
 *       500:
 *         description: Error del servidor
 */
router.put('/prizes/:id', isAdmin, validatePrizeId, validatePrize, rouletteController.updatePrize);

/**
 * @swagger
 * /api/roulette/prizes/{id}:
 *   delete:
 *     summary: Eliminar premio
 *     tags: [Roulette, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Desactiva un premio (no se elimina físicamente) (Solo Admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del premio
 *     responses:
 *       200:
 *         description: Premio desactivado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Premio no encontrado
 *       500:
 *         description: Error del servidor
 */
router.delete('/prizes/:id', isAdmin, validatePrizeId, rouletteController.deletePrize);

/**
 * @swagger
 * /api/roulette/pending-validations:
 *   get:
 *     summary: Obtener usuarios pendientes de validación
 *     tags: [Roulette, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Lista usuarios que han usado el giro demo y están pendientes de validación para giro real (Solo Admin)
 *     responses:
 *       200:
 *         description: Usuarios pendientes obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       username:
 *                         type: string
 *                       email:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       first_spin_demo_used:
 *                         type: boolean
 *                       validated_for_spin:
 *                         type: boolean
 *                       parentAgent:
 *                         type: object
 *                         properties:
 *                           username:
 *                             type: string
 *                       rouletteSpins:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             spin_type:
 *                               type: string
 *                             prize:
 *                               type: object
 *                               properties:
 *                                 name:
 *                                   type: string
 *                                 prize_type:
 *                                   type: string
 *                                 prize_value:
 *                                   type: number
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error del servidor
 */
router.get('/pending-validations', isAdmin, rouletteController.getPendingValidations);

/**
 * @swagger
 * /api/roulette/validate/{userId}:
 *   put:
 *     summary: Validar usuario para giro real
 *     tags: [Roulette, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Valida un usuario para que pueda usar su giro real de bienvenida (Solo Admin)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del usuario a validar
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Notas sobre la validación
 *           example:
 *             notes: "Usuario verificado, cumple requisitos"
 *     responses:
 *       200:
 *         description: Usuario validado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Usuario validado exitosamente. Ahora puede usar su giro real."
 *       400:
 *         description: Usuario ya validado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.put('/validate/:userId', isAdmin, validateUserValidation, rouletteController.validateUserSpin);

/**
 * @swagger
 * /api/roulette/validate-batch:
 *   post:
 *     summary: Validar usuarios en lote
 *     tags: [Roulette, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Valida múltiples usuarios para giro real de una vez (Solo Admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 100
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array de IDs de usuario a validar
 *           example:
 *             userIds:
 *               - "123e4567-e89b-12d3-a456-426614174000"
 *               - "123e4567-e89b-12d3-a456-426614174001"
 *               - "123e4567-e89b-12d3-a456-426614174002"
 *     responses:
 *       200:
 *         description: Usuarios validados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "3 usuarios validados exitosamente"
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error del servidor
 */
router.post('/validate-batch', isAdmin, validateBatchValidation, rouletteController.validateBatch);

/**
 * @swagger
 * /api/roulette/stats:
 *   get:
 *     summary: Obtener estadísticas de la ruleta
 *     tags: [Roulette, Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Obtiene estadísticas detalladas del sistema de ruleta (Solo Admin)
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin (ISO 8601)
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     spinsByType:
 *                       type: array
 *                       description: Giros por tipo
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [demo, welcome_real, code, bonus]
 *                           count:
 *                             type: integer
 *                     topPrizes:
 *                       type: array
 *                       description: Top 10 premios más ganados
 *                       items:
 *                         type: object
 *                         properties:
 *                           prize:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               prize_type:
 *                                 type: string
 *                               prize_value:
 *                                 type: number
 *                           count:
 *                             type: integer
 *                     topSpinners:
 *                       type: array
 *                       description: Top 10 usuarios con más giros
 *                       items:
 *                         type: object
 *                         properties:
 *                           user:
 *                             type: string
 *                           spins:
 *                             type: integer
 *                     pendingValidations:
 *                       type: integer
 *                       description: Usuarios pendientes de validación
 *                     totalValueAwarded:
 *                       type: number
 *                       description: Valor total otorgado en premios reales
 *       400:
 *         description: Parámetros de fecha inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error del servidor
 */
router.get('/stats', isAdmin, validateStatsQuery, rouletteController.getStats);

// Middleware de manejo de errores específico para ruleta
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